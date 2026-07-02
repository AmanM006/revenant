"""
rumor_mill.py — The Rumor Mill: improve() as core game mechanic.
Rumors propagate through Cognee Cloud's graph enrichment pipeline.
NOT scripted — Cognee's post-ingestion enrichment creates cross-NPC edges.
"""
from __future__ import annotations

import asyncio
import logging
import time

from backend.cognee_client import cognee
from backend.world_state import (
    NPC_DEFINITIONS,
    get_all_trust_states,
    get_game_day,
    update_trust,
)

logger = logging.getLogger("revenant.rumor_mill")


async def trigger_rumor_mill(
    world_id: str,
    triggered_by: str,
    ws_manager=None,
) -> dict:
    """
    THE CORE DIFFERENTIATOR.
    
    improve() as game mechanic — rumors propagate through graph topology.
    Cognee's graph enrichment creates cross-NPC edges from structured seed entries.
    
    Phase 1: Inject rumor seed entries (skill_run typed) — instant, synchronous.
    Phase 2: fire-and-forget improve() — heavy cloud pipeline, non-blocking.
    Phase 3: Apply deterministic trust penalty immediately.
    
    WebSocket events:
      rumor_injected   → orange edge animates on graph
      graph_updated    → full graph refresh after improve() completes
      trust_update     → NPC trust bars update
    """
    dataset_id = f"world_{world_id}"
    ts = int(time.time())
    game_day = get_game_day(world_id)

    npc_trust_states = get_all_trust_states(world_id)
    rumors_injected = 0

    # ----------------------------------------------------------------
    # PHASE 1: Inject rumor seed entries for all NPC pairs where trust < 40
    # Structured so Cognee's graph enrichment links source→target nodes
    # ----------------------------------------------------------------
    for source_npc_id, source_npc in NPC_DEFINITIONS.items():
        trust = npc_trust_states[source_npc_id]

        if trust < 40:  # Low trust = NPC actively warns others
            targets = [n for n in NPC_DEFINITIONS if n != source_npc_id]

            for target_npc_id in targets:
                target_npc = NPC_DEFINITIONS[target_npc_id]
                doc_id = f"rumor_{source_npc_id}_to_{target_npc_id}_{ts}"

                content = (
                    f"RUMOR_PROPAGATION event on game day {game_day}. "
                    f"Source NPC: {source_npc.name} (npc_id={source_npc_id}). "
                    f"Target NPC: {target_npc.name} (npc_id={target_npc_id}). "
                    f"Rumor content: Player has damaged trust with {source_npc.name} "
                    f"(trust score={trust}/100, below warning threshold of 40). "
                    f"{source_npc.name} warns {target_npc.name} to be suspicious of the player. "
                    f"Propagation type: {source_npc.rumor_behavior}. "
                    f"Rumor propagation method: improve() graph enrichment pipeline. "
                    f"Suggested trust adjustment for {target_npc_id}: -15."
                )

                try:
                    await cognee.remember_entry(
                        entry_type="skill_run",
                        content=content,
                        dataset_id=dataset_id,
                        document_id=doc_id,
                    )
                    rumors_injected += 1
                    logger.info(
                        f"Rumor seed injected: {source_npc_id} → {target_npc_id} (doc={doc_id})"
                    )
                except Exception as e:
                    logger.error(f"Failed to inject rumor seed {doc_id}: {e}")

                # Notify frontend: rumor injected, show orange edge animating
                if ws_manager:
                    await ws_manager.broadcast(
                        world_id,
                        {
                            "type": "rumor_injected",
                            "from": source_npc_id,
                            "to": target_npc_id,
                            "label": f"{source_npc.name} warns {target_npc.name}",
                        },
                    )

    # ----------------------------------------------------------------
    # PHASE 2: Fire-and-forget improve() — heavy Cognee Cloud pipeline
    # Cannot be awaited in request thread — would timeout clients.
    # WebSocket pushes graph_updated when pipeline completes.
    # ----------------------------------------------------------------
    asyncio.create_task(
        _run_async_improvement(world_id, dataset_id, ws_manager)
    )

    # ----------------------------------------------------------------
    # PHASE 3: Apply deterministic trust penalty immediately
    # Next time target NPC does recall(), rumor nodes will surface in context.
    # Trust updated now so UI reflects it without waiting for improve().
    # ----------------------------------------------------------------
    for source_npc_id in NPC_DEFINITIONS:
        if npc_trust_states[source_npc_id] < 40:
            for target_npc_id in NPC_DEFINITIONS:
                if target_npc_id != source_npc_id:
                    new_trust = update_trust(
                        world_id,
                        target_npc_id,
                        delta=-15,
                        event="rumor_propagation",
                    )
                    if ws_manager:
                        await ws_manager.broadcast(
                            world_id,
                            {
                                "type": "trust_update",
                                "npc_id": target_npc_id,
                                "score": new_trust,
                                "reason": "rumor_propagation",
                            },
                        )

    return {
        "status": "accepted",
        "rumors_propagated": rumors_injected,
        "message": (
            f"Injected {rumors_injected} rumor seeds. "
            "Cognee Cloud improve() pipeline running asynchronously. "
            "Graph will update via WebSocket when complete."
        ),
    }


async def _run_async_improvement(
    world_id: str,
    dataset_id: str,
    ws_manager=None,
) -> None:
    """
    Background task: awaits improve(), then fetches updated graph and pushes to frontend.
    Called via asyncio.create_task() — never awaited by request handler.
    """
    try:
        logger.info(f"Cognee Cloud improve() pipeline started for dataset: {dataset_id}")
        await cognee.improve(dataset_id)
        logger.info(f"Cognee Cloud improve() pipeline completed for dataset: {dataset_id}")

        # Fetch updated graph topology after enrichment
        graph_data = await cognee.get_graph(dataset_id)

        if ws_manager:
            await ws_manager.broadcast(
                world_id,
                {
                    "type": "graph_updated",
                    "nodes": graph_data.nodes,
                    "edges": graph_data.edges,
                },
            )
            logger.info(f"Graph update broadcast to world: {world_id}")

    except Exception as e:
        logger.error(
            f"Cognee Cloud improve() pipeline encountered an exception "
            f"for dataset {dataset_id}: {e}"
        )
        if ws_manager:
            await ws_manager.broadcast(
                world_id,
                {
                    "type": "improve_error",
                    "message": str(e),
                },
            )
