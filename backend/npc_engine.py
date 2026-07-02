"""
npc_engine.py — NPC state machine, dialogue orchestrator, trust calculator.
Full dialogue loop: recall() → Claude → remember() × 4 types → rumor mill trigger.
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
    "bribe": -5,   # NPCs don't like being bribed (suspicious)
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
    4. Generate response via Claude tool-calling
    5. remember() all 4 typed entries (qa, trace, feedback, skill_run)
    6. Auto-trigger rumor mill every 3 turns
    """
    dataset_id = f"world_{world_id}"
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
    recall_result = await cognee.recall(
        query=(
            f"What do I know about the player? "
            f"What have I heard from other NPCs? "
            f"What recent events involved the player? "
            f"Any rumors, trust changes, or crimes?"
        ),
        dataset_id=dataset_id,
        session_id=session_id,
        graph_traversal=True,
    )

    # ----------------------------------------------------------------
    # STEP 2: Check for provenance query → multi-hop chain
    # ----------------------------------------------------------------
    provenance_chain: Optional[list[dict[str, Any]]] = None
    message_lower = player_message.lower()
    is_provenance_query = any(trigger in message_lower for trigger in PROVENANCE_TRIGGERS)

    if is_provenance_query:
        logger.info(f"Provenance query detected for {npc_id}: '{player_message}'")
        prov_result = await cognee.recall(
            query=(
                f"Who is the original source of information about the player being "
                f"untrustworthy, a thief, or a criminal? "
                f"Trace the complete information propagation path from origin to {npc_id}. "
                f"Show the chain: player action → NPC reaction → rumor → target NPC."
            ),
            dataset_id=dataset_id,
            graph_traversal=True,
        )
        provenance_chain = [
            {
                "step": i + 1,
                "document_id": n.get("document_id", n.get("id", "unknown")),
                "type": n.get("type", "unknown"),
                "content_preview": str(n.get("content", ""))[:60],
                "timestamp": str(n.get("metadata", {}).get("timestamp", "")),
            }
            for i, n in enumerate(prov_result.nodes[:5])
        ]

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
    if any(c.type in ("skill_run", "rumor") for c in recall_result.citations):
        rumor_note = (
            "\nRUMOR AWARENESS: Some of your memory comes from rumors (type=skill_run or rumor). "
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

    system_prompt = f"""You are {npc.name}, {npc.role} in the town of Ashenvale.

PERSONALITY: {npc.personality}

CURRENT TRUST IN PLAYER: {trust}/100 — {trust_label}
TRUST TRAJECTORY: {trajectory}
CURRENT GAME DAY: {game_day}

MEMORY CONTEXT (from Cognee knowledge graph):
{recall_result.graph_context or "No prior interactions recorded."}
{rumor_note}
{provenance_note}

RULES:
1. Respond in character. Reference specific past events from memory context when possible.
2. Trust level MUST influence tone. Low trust = curt/suspicious. High trust = warm/helpful.
3. If drawing on a rumor, reference your source: "I heard from [NPC name]..."
4. Provenance query ("who told you?") → trace your source chain naturally in dialogue.
5. Keep response under 120 words. Be sharp. No asterisks or stage directions.
6. Use the npc_response tool to structure your output."""

    # ----------------------------------------------------------------
    # STEP 4: Generate NPC response via Claude tool-calling
    # ----------------------------------------------------------------
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

    # ----------------------------------------------------------------
    # STEP 5: remember() all typed entries
    # ----------------------------------------------------------------

    # qa: the dialogue turn itself
    await cognee.remember_entry(
        entry_type="qa",
        content=f"Player: {player_message}\n{npc.name}: {response_text}",
        dataset_id=dataset_id,
        session_id=session_id,
        document_id=f"qa_{npc_id}_{ts}",
    )

    # trace: NPC internal reasoning
    await cognee.remember_entry(
        entry_type="trace",
        content=(
            f"{npc.name} reasoning at turn {turn_count} (game day {game_day}): "
            f"Trust={trust}/100, Trajectory={trajectory}. "
            f"Memory nodes used: {[c.document_id for c in recall_result.citations[:3]]}. "
            f"Decision: trust_delta={trust_delta}, action={action}. "
            f"Player message classified as: "
            f"{'hostile' if trust_delta < -5 else 'neutral' if trust_delta == 0 else 'friendly'}. "
            f"Provenance query: {is_provenance_query}."
        ),
        dataset_id=dataset_id,
        document_id=f"trace_{npc_id}_{ts}",
    )

    # feedback: trust update with bi-temporal metadata
    new_trust = update_trust(world_id, npc_id, trust_delta, event="dialogue")
    now_iso = datetime.now(timezone.utc).isoformat()
    await cognee.remember_entry(
        entry_type="feedback",
        content=(
            f"Trust update for {npc.name}: {trust} → {new_trust} (delta={trust_delta}). "
            f"Reason: player dialogue at turn {turn_count}, game day {game_day}. "
            f"valid_from={now_iso}, game_day={game_day}. "
            f"Player message: '{player_message[:100]}'"
        ),
        dataset_id=dataset_id,
        document_id=f"trust_{npc_id}_{ts}",
    )

    # skill_run: NPC action record (if action taken)
    if action != "none":
        await cognee.remember_entry(
            entry_type="skill_run",
            content=(
                f"{npc.name} executed action '{action}' on game day {game_day}. "
                f"Triggered by player dialogue at turn {turn_count}. "
                f"Trust at time of action: {trust}/100."
            ),
            dataset_id=dataset_id,
            document_id=f"skill_{npc_id}_{action}_{ts}",
        )

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
    """
    Record a player action (betray, steal, help, pay, etc.) as typed memory.
    Updates trust + stores bi-temporal TrustEdge with feedback entry.
    """
    dataset_id = f"world_{world_id}"
    ts = int(time.time())
    npc = NPC_DEFINITIONS[npc_id]
    trust = get_trust(world_id, npc_id)
    game_day = get_game_day(world_id)
    now_iso = datetime.now(timezone.utc).isoformat()

    delta = ACTION_TRUST_DELTAS.get(action_type, 0)
    new_trust = update_trust(world_id, npc_id, delta, event=action_type)

    # feedback: the action event itself
    await cognee.remember_entry(
        entry_type="feedback",
        content=(
            f"PLAYER_ACTION: {action_type.upper()} against {npc.name} on game day {game_day}. "
            f"Trust before: {trust}/100. Trust after: {new_trust}/100 (delta={delta}). "
            f"valid_from={now_iso}, game_day={game_day}. "
            f"This event is now part of {npc.name}'s permanent memory."
        ),
        dataset_id=dataset_id,
        document_id=f"feedback_{npc_id}_{action_type}_{ts}",
    )

    # trace: NPC awareness of the action
    await cognee.remember_entry(
        entry_type="trace",
        content=(
            f"{npc.name} witnessed or learned of player action '{action_type}' "
            f"on game day {game_day}. "
            f"Trust impact: {delta:+d} (now {new_trust}/100). "
            f"valid_from={now_iso}. "
            f"Rumor threshold {'CROSSED — will warn others' if new_trust < 40 else 'not crossed'}."
        ),
        dataset_id=dataset_id,
        document_id=f"trace_{npc_id}_{action_type}_{ts}",
    )

    # skill_run: NPC reaction (warn others if trust drops below 40)
    if new_trust < 40 and delta < 0:
        await cognee.remember_entry(
            entry_type="skill_run",
            content=(
                f"{npc.name} initiated WARN_OTHERS protocol after player action '{action_type}'. "
                f"Trust score {new_trust}/100 has crossed warning threshold (40). "
                f"Rumor behavior: {npc.rumor_behavior}. "
                f"Other NPCs will receive warning via next improve() call."
            ),
            dataset_id=dataset_id,
            document_id=f"skill_{npc_id}_warn_{ts}",
        )

    # Broadcast trust update
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
    """
    Player spends 50 gold to surgically remove a specific memory from an NPC.
    Calls DELETE at document_id granularity — does NOT nuke entire NPC memory.
    """
    dataset_id = f"world_{world_id}"
    ts = int(time.time())
    game_day = get_game_day(world_id)
    gold = get_gold(world_id)

    if gold < 50:
        raise ValueError(f"Not enough gold. Amnesia costs 50g, you have {gold}g.")

    remaining_gold = deduct_gold(world_id, 50)

    # SURGICAL DELETE — document_id level, not dataset level
    result = await cognee.forget_document(dataset_id, document_id)

    # Record the forgetting itself as a trace entry
    await cognee.remember_entry(
        entry_type="trace",
        content=(
            f"AMNESIA_SPELL cast on {npc_id} at game day {game_day}. "
            f"Memory erased: {document_id}. "
            f"Player spent 50 gold. "
            f"Next recall() by {npc_id} will not surface this memory node. "
            f"The forgetting itself is now a permanent trace in the knowledge graph."
        ),
        dataset_id=dataset_id,
        document_id=f"amnesia_{npc_id}_{ts}",
    )

    # Push dissolve animation to frontend
    if ws_manager:
        await ws_manager.broadcast(
            world_id,
            {
                "type": "node_dissolve",
                "document_id": document_id,
                "npc_id": npc_id,
            },
        )

    logger.info(f"Amnesia cast: {npc_id} forgot {document_id}. Gold remaining: {remaining_gold}")

    return {
        "success": True,
        "document_id_erased": document_id,
        "gold_remaining": remaining_gold,
        "message": (
            f"Memory '{document_id}' has been erased from {NPC_DEFINITIONS[npc_id].name}'s mind. "
            f"-50 gold. {remaining_gold}g remaining."
        ),
    }
