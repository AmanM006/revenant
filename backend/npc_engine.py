"""
npc_engine.py — NPC state machine, dialogue orchestrator, trust calculator.
Full dialogue loop: recall() → Gemini → remember() × 4 types → rumor mill trigger.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

from backend.cognee_client import cognee
from backend.llm import generate_npc_response, generate_provenance_narrative
from backend.rumor_mill import trigger_rumor_mill
from backend.schemas import CitationEntry, DialogueResponse
from backend.world_state import (
    NPC_DEFINITIONS,
    deduct_gold,
    get_game_day,
    get_gold,
    get_session_id,
    get_trust,
    get_trust_trajectory,
    increment_turn,
    update_trust,
    register_memory,
    get_npc_memories,
    remove_memory,
    push_conversation_turn,
    get_conversation_history,
)

logger = logging.getLogger("revenant.npc_engine")

# Trust delta for player actions
ACTION_TRUST_DELTAS: dict[str, int] = {
    "betray": -40,
    "steal": -50,
    "insult": -15,
    "help": +15,
    "pay": +10,
    "compliment": +8,
    "bribe": -5,
}

# Provenance query triggers
PROVENANCE_TRIGGERS = [
    "who told you",
    "how do you know",
    "where did you hear",
    "who said that",
    "who told",
    "your source",
    "how did you find out",
]


# ---------------------------------------------------------------------------
# Dialogue loop
# ---------------------------------------------------------------------------

async def process_dialogue(
    npc_id: str,
    player_message: str,
    world_id: str,
    ws_manager=None,
) -> DialogueResponse:
    """
    Full NPC dialogue loop:
    1. recall() with GRAPH_COMPLETION for deep context
    2. Detect provenance query → second multi-hop recall()
    3. Build NPC system prompt
    4. Generate response via Gemini JSON mode
    5. remember() all 4 typed entries (qa, trace, feedback, skill_run)
    6. Auto-trigger rumor mill every 3 turns
    """
    dataset_name = f"world_{world_id}"
    session_id = get_session_id(world_id, npc_id)
    ts = int(time.time())
    npc = NPC_DEFINITIONS[npc_id]
    trust = get_trust(world_id, npc_id)
    trajectory = get_trust_trajectory(world_id, npc_id)
    turn_count = increment_turn(world_id, npc_id)
    game_day = get_game_day(world_id)

    # ----------------------------------------------------------------
    # STEP 1: recall() — GRAPH_COMPLETION for deep context
    # ----------------------------------------------------------------
    try:
        recall_result = await cognee.recall(
            query=(
                f"What do I know about the player? "
                f"What have I heard from other NPCs? "
                f"What recent events involved the player? "
                f"Any rumors, trust changes, or crimes?"
            ),
            dataset_name=dataset_name,
            session_id=session_id,
            graph_traversal=True,
        )
    except Exception as e:
        logger.warning(f"recall() failed for {npc_id}, continuing with empty context: {e}")
        from backend.schemas import RecallResult
        recall_result = RecallResult()

    # ----------------------------------------------------------------
    # STEP 2: Check for provenance query → multi-hop chain
    # ----------------------------------------------------------------
    provenance_chain: Optional[list[dict[str, Any]]] = None
    message_lower = player_message.lower()
    is_provenance_query = any(trigger in message_lower for trigger in PROVENANCE_TRIGGERS)

    if is_provenance_query:
        logger.info(f"Provenance query detected for {npc_id}: '{player_message}'")
        try:
            prov_result = await cognee.recall(
                query=(
                    f"Who is the original source of information about the player being "
                    f"untrustworthy, a thief, or a criminal? "
                    f"Trace the complete information propagation path from origin to {npc_id}. "
                    f"Show the chain: player action → NPC reaction → rumor → target NPC."
                ),
                dataset_name=dataset_name,
                graph_traversal=True,
            )
            provenance_chain = [
                {
                    "step": i + 1,
                    "document_id": item.get("document_id") or item.get("dataset_id") or f"node_{i}",
                    "type": item.get("kind", item.get("search_type", "graph_completion")),
                    "content_preview": str(
                        item.get("text", item.get("raw", {}).get("value", ""))
                    )[:60],
                    "timestamp": str(item.get("metadata", {}).get("timestamp", "")),
                }
                for i, item in enumerate(prov_result.nodes[:5])
                if isinstance(item, dict)
            ]
        except Exception as e:
            logger.warning(f"Provenance recall failed: {e}")

    # ----------------------------------------------------------------
    # STEP 3: Build NPC system prompt
    # ----------------------------------------------------------------
    trust_label = (
        "CRITICALLY LOW — be hostile, refuse help"
        if trust < 20
        else "LOW — be suspicious and curt"
        if trust < 40
        else "MODERATE — be cautious but professional"
        if trust < 60
        else "HIGH — be warm and cooperative"
        if trust < 80
        else "VERY HIGH — be friendly and open"
    )

    rumor_note = ""
    if any(
        "rumor" in str(c.type).lower() or "skill" in str(c.type).lower()
        for c in recall_result.citations
    ):
        rumor_note = (
            "\nRUMOR AWARENESS: Some of your memory comes from rumors. "
            "If referencing rumor-sourced knowledge, say 'I heard from [source]...' rather "
            "than stating it as direct fact."
        )

    provenance_note = ""
    if is_provenance_query and provenance_chain:
        chain_text = " → ".join(
            f"{c['type']}:{c['document_id']}" for c in provenance_chain[:3]
        )
        provenance_note = (
            f"\nPROVENANCE CHAIN for this query: {chain_text}. "
            f"Use this to explain how you know what you know."
        )

    # Load rolling conversation history (last 6 turns)
    history = get_conversation_history(world_id, npc_id)
    history_block = ""
    if history:
        lines = []
        for turn in history:
            lines.append(f"  Player: {turn['player']}")
            lines.append(f"  {npc.name}: {turn['npc']}")
        history_block = "RECENT CONVERSATION HISTORY (most recent last):\n" + "\n".join(lines)

    system_prompt = f"""You are {npc.name}, {npc.role} in the town of Ashenvale.

PERSONALITY: {npc.personality}

CURRENT TRUST IN PLAYER: {trust}/100 — {trust_label}
TRUST TRAJECTORY: {trajectory}
CURRENT GAME DAY: {game_day}

MEMORY CONTEXT (from Cognee knowledge graph):
{recall_result.graph_context or "No prior interactions recorded."}
{rumor_note}
{provenance_note}

{history_block}

RULES:
1. Respond in character. Reference specific past events from memory context when possible.
2. IMPORTANT: The conversation history above shows what was said in THIS conversation — use it for context and continuity. If the player refers to something just said ("it", "that", "the blade", etc.), you know exactly what they mean.
3. Trust level MUST influence tone. Low trust = curt/suspicious. High trust = warm/helpful.
4. If drawing on a rumor, reference your source: "I heard from [NPC name]..."
5. Provenance query ("who told you?") → trace your source chain naturally in dialogue.
6. Keep response under 120 words. Be sharp. No asterisks or stage directions."""

    # ----------------------------------------------------------------
    # STEP 4: Generate NPC response via Gemini
    # ----------------------------------------------------------------
    try:
        if is_provenance_query and provenance_chain:
            response_text = await generate_provenance_narrative(
                npc.name, provenance_chain, recall_result.graph_context
            )
            trust_delta = 0
            action = "none"
        else:
            response_text, trust_delta, action = await generate_npc_response(
                system_prompt=system_prompt,
                player_message=player_message,
                npc_name=npc.name,
            )
    except Exception as e:
        logger.error(f"LLM call failed for {npc_id}, using fallback: {e}")
        response_text = f"{npc.name} pauses before responding."
        trust_delta = 0
        action = "none"

    # Push this turn to conversation history immediately after response
    push_conversation_turn(world_id, npc_id, player_message, response_text)

    # ----------------------------------------------------------------
    # STEP 5: remember() all 4 typed entries + register for amnesia
    # ----------------------------------------------------------------
    ts = int(time.time())
    game_day = get_game_day(world_id)

    # qa: dialogue turn
    qa_doc_id = f"qa_{npc_id}_{ts}"
    qa_entry_id = ""
    try:
        qa_entry_id = await cognee.remember_qa(
            question=player_message,
            answer=response_text,
            context=f"NPC: {npc.name} | Trust: {trust}/100 | Day: {game_day} | Turn: {turn_count}",
            dataset_name=dataset_name,
            session_id=session_id,
        )
        # FIX: Register for amnesia modal
        register_memory(
            world_id, npc_id,
            doc_id=qa_entry_id or qa_doc_id,
            description=f"{npc.name} remembers conversation: \"{player_message[:50]}...\"",
            entry_type="qa",
            game_day=game_day,
        )
    except Exception as e:
        logger.warning(f"remember_qa failed: {e}")

    # trace: NPC reasoning
    trace_doc_id = f"trace_{npc_id}_{ts}"
    try:
        trace_id = await cognee.remember_trace(
            origin_function=f"npc_dialogue_{npc_id}",
            memory_query=player_message,
            memory_context=(
                f"Turn {turn_count}, Day {game_day}. Trust={trust}/100. "
                f"trust_delta={trust_delta}, action={action}."
            ),
            dataset_name=dataset_name,
            session_id=session_id,
        )
        # Only register traces for significant events (action taken)
        if action != "none":
            register_memory(
                world_id, npc_id,
                doc_id=trace_id or trace_doc_id,
                description=f"{npc.name}'s reasoning when triggering '{action}' (Day {game_day})",
                entry_type="trace",
                game_day=game_day,
            )
    except Exception as e:
        logger.warning(f"remember_trace failed: {e}")

    # feedback: trust update
    new_trust = update_trust(world_id, npc_id, trust_delta, event="dialogue")
    now_iso = datetime.now(timezone.utc).isoformat()
    feedback_doc_id = f"feedback_{npc_id}_{ts}"
    if qa_entry_id and trust_delta != 0:
        try:
            await cognee.remember_feedback(
                qa_id=qa_entry_id,
                feedback_text=f"Trust {trust} → {new_trust} (delta={trust_delta:+d}). Day {game_day}.",
                feedback_score=trust_delta,
                dataset_name=dataset_name,
                session_id=session_id,
            )
            if trust_delta < -10:  # Only register significant trust drops
                register_memory(
                    world_id, npc_id,
                    doc_id=feedback_doc_id,
                    description=(
                        f"{npc.name}'s trust dropped {trust}→{new_trust} "
                        f"({'betrayal' if trust_delta < -20 else 'negative interaction'}, Day {game_day})"
                    ),
                    entry_type="feedback",
                    game_day=game_day,
                )
        except Exception as e:
            logger.warning(f"remember_feedback failed: {e}")

    # skill_run: NPC action
    if action != "none":
        skill_doc_id = f"skill_{npc_id}_{action}_{ts}"
        try:
            await cognee.remember_skill_run(
                run_id=skill_doc_id,
                skill_id=action,
                task_text=f"{npc.name} triggered '{action}' on Day {game_day}.",
                result_summary=f"Action '{action}'. Trust at time: {trust}/100.",
                dataset_name=dataset_name,
                session_id=session_id,
                success_score=1.0,
            )
            register_memory(
                world_id, npc_id,
                doc_id=skill_doc_id,
                description=f"{npc.name} took action: '{action}' (Day {game_day})",
                entry_type="skill_run",
                game_day=game_day,
            )
        except Exception as e:
            logger.warning(f"remember_skill_run failed: {e}")

    # Broadcast trust update via WebSocket
    if ws_manager:
        await ws_manager.broadcast(
            world_id,
            {"type": "trust_update", "npc_id": npc_id, "score": new_trust, "reason": "dialogue"},
        )

    # ----------------------------------------------------------------
    # STEP 6: Auto-trigger rumor mill every 3 turns
    # ----------------------------------------------------------------
    if turn_count % 3 == 0:
        logger.info(f"Auto-triggering rumor mill at turn {turn_count} (triggered by {npc_id})")
        asyncio.create_task(
            trigger_rumor_mill(world_id, triggered_by=npc_id, ws_manager=ws_manager)
        )

    return DialogueResponse(
        response=response_text,
        trust_delta=trust_delta,
        new_trust=new_trust,
        citations=recall_result.citations,
        action=action,
        turn_count=turn_count,
        provenance_chain=provenance_chain,
    )


# ---------------------------------------------------------------------------
# Player action handler
# ---------------------------------------------------------------------------

async def process_action(
    npc_id: str,
    action_type: str,
    world_id: str,
    ws_manager=None,
) -> dict:
    """Record a player action as typed memory. Updates trust."""
    dataset_name = f"world_{world_id}"
    ts = int(time.time())
    npc = NPC_DEFINITIONS[npc_id]
    trust = get_trust(world_id, npc_id)
    game_day = get_game_day(world_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    session_id = get_session_id(world_id, npc_id)

    delta = ACTION_TRUST_DELTAS.get(action_type, 0)
    new_trust = update_trust(world_id, npc_id, delta, event=action_type)

    try:
        qa_id = await cognee.remember_qa(
            question=f"[ACTION] Player performed '{action_type}' against {npc.name}",
            answer=f"{npc.name} witnessed '{action_type}'. Trust impact: {delta:+d}.",
            context=f"Day {game_day}. valid_from={now_iso}.",
            dataset_name=dataset_name,
            session_id=session_id,
        )
        if qa_id:
            await cognee.remember_feedback(
                qa_id=qa_id,
                feedback_text=(
                    f"PLAYER_ACTION {action_type.upper()} on Day {game_day}. "
                    f"Trust: {trust} → {new_trust}."
                ),
                feedback_score=delta,
                dataset_name=dataset_name,
                session_id=session_id,
            )
        if delta < -15:
            register_memory(
                world_id, npc_id,
                doc_id=f"feedback_{npc_id}_{action_type}_{ts}",
                description=f"{npc.name} remembers you {action_type}d them (trust: {trust}→{new_trust}, Day {game_day})",
                entry_type="feedback",
                game_day=game_day,
            )
    except Exception as e:
        logger.warning(f"action remember failed: {e}")

    try:
        await cognee.remember_trace(
            origin_function=f"player_action_{action_type}",
            memory_query=action_type,
            memory_context=(
                f"{npc.name} witnessed '{action_type}' on Day {game_day}. "
                f"Trust: {trust} → {new_trust}. valid_from={now_iso}. "
                f"Rumor threshold {'CROSSED' if new_trust < 40 else 'OK'}."
            ),
            dataset_name=dataset_name,
            session_id=session_id,
        )
    except Exception as e:
        logger.warning(f"action trace failed: {e}")

    if new_trust < 40 and delta < 0:
        try:
            await cognee.remember_skill_run(
                run_id=f"skill_{npc_id}_warn_{ts}",
                skill_id="warn_others",
                task_text=f"{npc.name} warns other NPCs after '{action_type}'.",
                result_summary=(
                    f"Rumor behavior: {npc.rumor_behavior}. Trust={new_trust}/100. Day {game_day}."
                ),
                dataset_name=dataset_name,
                success_score=1.0,
            )
        except Exception as e:
            logger.warning(f"action skill_run failed: {e}")

    if ws_manager:
        await ws_manager.broadcast(
            world_id,
            {"type": "trust_update", "npc_id": npc_id, "score": new_trust, "reason": action_type},
        )

    from backend.world_state import get_trust_history
    history = get_trust_history(world_id, npc_id)

    action_message = {
        "betray": f"{npc.name} stares at you coldly. You will regret this.",
        "steal": f"{npc.name} has noticed. Word will spread.",
        "insult": f"{npc.name} looks away in contempt.",
        "help": f"{npc.name} acknowledges your assistance.",
        "pay": f"{npc.name} nods, satisfied.",
        "compliment": f"{npc.name} seems slightly more at ease.",
        "bribe": f"{npc.name} regards you with suspicion.",
    }.get(action_type, f"{npc.name} takes note.")

    return {
        "new_trust": new_trust,
        "trust_history": [h.model_dump() for h in history],
        "message": action_message,
        "action_type": action_type,
        "npc_id": npc_id,
    }


# ---------------------------------------------------------------------------
# Amnesia spell
# ---------------------------------------------------------------------------

async def cast_amnesia(
    npc_id: str,
    document_id: str,
    world_id: str,
    ws_manager=None,
) -> dict:
    """Spend 50 gold to surgically remove one memory from an NPC."""
    dataset_name = f"world_{world_id}"
    ts = int(time.time())
    game_day = get_game_day(world_id)
    gold = get_gold(world_id)
    session_id = get_session_id(world_id, npc_id)

    if gold < 50:
        raise ValueError(f"Not enough gold. Amnesia costs 50g, you have {gold}g.")

    remaining_gold = deduct_gold(world_id, 50)

    result = await cognee.forget_document(dataset_name, document_id)
    remove_memory(world_id, npc_id, document_id)

    try:
        await cognee.remember_trace(
            origin_function="amnesia_spell",
            memory_query=f"erase {document_id}",
            memory_context=(
                f"AMNESIA_SPELL cast on {npc_id} at Day {game_day}. "
                f"Memory erased: {document_id}. Player spent 50 gold. "
                f"The forgetting is now a permanent trace in the knowledge graph."
            ),
            dataset_name=dataset_name,
            session_id=session_id,
        )
    except Exception as e:
        logger.warning(f"amnesia trace failed: {e}")

    if ws_manager:
        await ws_manager.broadcast(
            world_id,
            {"type": "node_dissolve", "document_id": document_id, "npc_id": npc_id},
        )

    logger.info(f"Amnesia cast: {npc_id} forgot {document_id}. Gold remaining: {remaining_gold}")

    return {
        "success": True,
        "document_id_erased": document_id,
        "gold_remaining": remaining_gold,
        "message": (
            f"Memory '{document_id}' erased from {NPC_DEFINITIONS[npc_id].name}'s mind. "
            f"-50 gold. {remaining_gold}g remaining."
        ),
    }
