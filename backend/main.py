"""
main.py — FastAPI application, all routes, WebSocket manager.
Entry point: uvicorn backend.main:app --reload
"""
from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.cognee_client import cognee
from backend.npc_engine import cast_amnesia, process_action, process_dialogue
from backend.rumor_mill import trigger_rumor_mill
from backend.schemas import (
    ActionRequest,
    ActionResponse,
    AmnesiaResponse,
    DialogueRequest,
    RumorMillRequest,
    RumorMillResponse,
    TimeskipRequest,
    TrustResponse,
    WorldInitRequest,
    WorldInitResponse,
)
from backend.world_state import (
    NPC_DEFINITIONS,
    advance_game_day,
    get_game_day,
    get_gold,
    get_trust,
    get_trust_history,
    get_trust_trajectory,
    init_world_state,
    require_world,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
)
logger = logging.getLogger("revenant.main")


# ---------------------------------------------------------------------------
# WebSocket manager
# ---------------------------------------------------------------------------

class WSManager:
    """Manages per-world WebSocket connections for live event streaming."""

    def __init__(self) -> None:
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, world_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.setdefault(world_id, []).append(ws)
        logger.info(f"WebSocket connected: world={world_id}")

    def disconnect(self, world_id: str, ws: WebSocket) -> None:
        if world_id in self.connections:
            try:
                self.connections[world_id].remove(ws)
            except ValueError:
                pass
        logger.info(f"WebSocket disconnected: world={world_id}")

    async def broadcast(self, world_id: str, data: dict) -> None:
        """Broadcast JSON event to all clients connected to this world."""
        dead: list[WebSocket] = []
        for ws in self.connections.get(world_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections[world_id].remove(ws)


ws_manager = WSManager()


# ---------------------------------------------------------------------------
# App lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Revenant backend starting up.")
    yield
    logger.info("Revenant backend shutting down.")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Revenant — Cognitive State Engine",
    description="NPC social memory engine powered by Cognee Cloud knowledge graph.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# World initialization
# ---------------------------------------------------------------------------

@app.post("/world/init", response_model=WorldInitResponse)
async def init_world(body: WorldInitRequest) -> WorldInitResponse:
    """
    Seed NPC backstories into Cognee Cloud via add_text + cognify.
    Must be called before any other endpoints.
    """
    world_id = body.world_name
    dataset_name = f"world_{world_id}"
    logger.info(f"Initializing world: {world_id}")

    # 1. Collect all NPC seed texts and push via add_text + cognify
    seed_texts: list[str] = []
    for npc_id, npc in NPC_DEFINITIONS.items():
        seed_texts.append(npc.full_backstory)
        seed_texts.append(npc.skills_description)
        seed_texts.append(npc.secret)

    try:
        await cognee.init_dataset(dataset_name, seed_texts)
        logger.info(f"Dataset '{dataset_name}' seeded with {len(seed_texts)} texts")
    except Exception as e:
        logger.warning(f"init_dataset failed (continuing): {e}")

    # 2. Write typed memory entries for each NPC
    npcs_seeded: list[str] = []
    for npc_id, npc in NPC_DEFINITIONS.items():
        session_id = f"{dataset_name}_{npc_id}_init"
        try:
            # Backstory as trace
            await cognee.remember_trace(
                origin_function=f"world_init_{npc_id}",
                memory_query=f"{npc.name} identity",
                memory_context=npc.full_backstory,
                dataset_name=dataset_name,
                session_id=session_id,
            )
            # Skills also as trace (skill_run requires pre-registered skill IDs)
            await cognee.remember_trace(
                origin_function=f"npc_skills_{npc_id}",
                memory_query=f"{npc.name} available skills",
                memory_context=npc.skills_description,
                dataset_name=dataset_name,
                session_id=session_id,
            )
            # Initial trust as qa
            now_iso = datetime.now(timezone.utc).isoformat()
            await cognee.remember_qa(
                question=f"What is {npc.name}'s initial disposition toward the player?",
                answer=(
                    f"{npc.name} starts with trust score {npc.initial_trust}/100. "
                    f"valid_from={now_iso}, game_day=0."
                ),
                context=f"World init. NPC: {npc_id}.",
                dataset_name=dataset_name,
                session_id=session_id,
            )
            npcs_seeded.append(npc_id)
            logger.info(f"Seeded NPC: {npc_id}")
        except Exception as e:
            logger.error(f"Failed to seed NPC {npc_id}: {e}")

    # 3. Initialize in-memory game state
    init_world_state(world_id)

    return WorldInitResponse(
        world_id=world_id,
        dataset_id=dataset_name,
        status="ready",
        npcs_seeded=npcs_seeded,
    )


# ---------------------------------------------------------------------------
# Core dialogue loop
# ---------------------------------------------------------------------------

@app.post("/dialogue", response_model=dict)
async def dialogue(body: DialogueRequest) -> dict:
    """
    Player sends message to NPC.
    Flow: recall() → Claude → remember(qa+trace+feedback+skill_run) → response + citations
    """
    require_world(body.world_id)
    try:
        result = await process_dialogue(
            npc_id=body.npc_id,
            player_message=body.message,
            world_id=body.world_id,
            ws_manager=ws_manager,
        )
        return result.model_dump()
    except Exception as e:
        logger.error(f"Dialogue error for {body.npc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Player actions
# ---------------------------------------------------------------------------

@app.post("/action", response_model=dict)
async def action(body: ActionRequest) -> dict:
    """
    Record player behavior as feedback typed memory.
    Triggers trust recalculation + stores TrustEdge with bi-temporal timestamps.
    """
    require_world(body.world_id)
    try:
        result = await process_action(
            npc_id=body.npc_id,
            action_type=body.action_type,
            world_id=body.world_id,
            ws_manager=ws_manager,
        )
        return result
    except Exception as e:
        logger.error(f"Action error for {body.npc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Rumor Mill — THE KILLER FEATURE
# ---------------------------------------------------------------------------

@app.post("/rumor-mill", response_model=RumorMillResponse)
async def rumor_mill(body: RumorMillRequest) -> RumorMillResponse:
    """
    Manually trigger the rumor mill.
    1. Inject rumor seed entries for each NPC pair with trust < 40
    2. Call improve() async (fire-and-forget)
    3. Stream graph update events via WebSocket
    """
    require_world(body.world_id)
    try:
        result = await trigger_rumor_mill(
            world_id=body.world_id,
            triggered_by="player_manual",
            ws_manager=ws_manager,
        )
        return RumorMillResponse(**result)
    except Exception as e:
        logger.error(f"Rumor mill error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Memory listing (Amnesia Modal)
# ---------------------------------------------------------------------------

@app.get("/memories/{npc_id}")
async def list_memories(npc_id: str, world_id: str) -> list[dict]:
    """
    Lists all document_ids for this NPC with human-readable descriptions.
    Used by amnesia modal to show player what they can make NPCs forget.
    """
    if npc_id not in NPC_DEFINITIONS:
        raise HTTPException(status_code=404, detail=f"NPC '{npc_id}' not found.")
    require_world(world_id)

    dataset_id = f"world_{world_id}"
    npc = NPC_DEFINITIONS[npc_id]

    try:
        raw_docs = await cognee.list_documents(dataset_id, npc_id)
    except Exception as e:
        logger.error(f"list_documents error for {npc_id}: {e}")
        raw_docs = []

    # Enrich with human-readable descriptions
    formatted: list[dict] = []
    for doc in raw_docs:
        doc_id = doc.get("document_id", "")
        doc_type = _infer_doc_type(doc_id)
        description = _describe_document(doc_id, doc_type, npc.name)
        formatted.append(
            {
                "document_id": doc_id,
                "description": description,
                "type": doc_type,
                "game_day": doc.get("metadata", {}).get("game_day", "?"),
                "timestamp": doc.get("metadata", {}).get("timestamp", ""),
                "content_preview": doc.get("content", "")[:100],
            }
        )

    return formatted


# ---------------------------------------------------------------------------
# Amnesia spell
# ---------------------------------------------------------------------------

@app.delete("/memories/{npc_id}/{document_id}", response_model=AmnesiaResponse)
async def forget_memory(npc_id: str, document_id: str, world_id: str) -> AmnesiaResponse:
    """
    Cast amnesia spell — surgical deletion at document_id level.
    Costs 50 gold. Sends graph node dissolve event via WebSocket.
    """
    if npc_id not in NPC_DEFINITIONS:
        raise HTTPException(status_code=404, detail=f"NPC '{npc_id}' not found.")
    require_world(world_id)

    try:
        result = await cast_amnesia(
            npc_id=npc_id,
            document_id=document_id,
            world_id=world_id,
            ws_manager=ws_manager,
        )
        return AmnesiaResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Amnesia error for {npc_id}/{document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Trust timeline
# ---------------------------------------------------------------------------

@app.get("/trust/{npc_id}", response_model=TrustResponse)
async def trust_timeline(npc_id: str, world_id: str) -> TrustResponse:
    """
    Returns full trust history with event markers for sparkline chart.
    """
    if npc_id not in NPC_DEFINITIONS:
        raise HTTPException(status_code=404, detail=f"NPC '{npc_id}' not found.")
    require_world(world_id)

    history = get_trust_history(world_id, npc_id)
    trajectory = get_trust_trajectory(world_id, npc_id)
    current = get_trust(world_id, npc_id)

    return TrustResponse(
        npc_id=npc_id,
        current_trust=current,
        history=history,
        trajectory=trajectory,
    )


# ---------------------------------------------------------------------------
# Time skip
# ---------------------------------------------------------------------------

@app.post("/time-skip")
async def time_skip(body: TimeskipRequest) -> dict:
    """
    Advance game day counter.
    Auto-triggers rumor mill if new day is multiple of 3.
    """
    require_world(body.world_id)
    new_day = advance_game_day(body.world_id, body.days)

    # Auto-trigger rumor mill on day multiples of 3
    if new_day % 3 == 0:
        import asyncio
        asyncio.create_task(
            trigger_rumor_mill(
                world_id=body.world_id,
                triggered_by="time_skip",
                ws_manager=ws_manager,
            )
        )

    # Broadcast day update
    await ws_manager.broadcast(
        body.world_id,
        {"type": "day_advanced", "game_day": new_day},
    )

    return {
        "game_day": new_day,
        "rumor_mill_triggered": new_day % 3 == 0,
        "gold": get_gold(body.world_id),
    }


# ---------------------------------------------------------------------------
# Live graph proxy
# ---------------------------------------------------------------------------

@app.get("/graph/{world_id}")
async def get_graph(world_id: str) -> dict:
    """
    Proxy Cognee Cloud graph endpoint.
    Transforms response for react-force-graph-2d format with node type metadata.
    """
    require_world(world_id)
    dataset_id = f"world_{world_id}"

    try:
        graph_data = await cognee.get_graph(dataset_id)
    except Exception as e:
        logger.error(f"get_graph error for {world_id}: {e}")
        return {"nodes": [], "links": []}

    # Transform for react-force-graph-2d: edges become "links"
    nodes = []
    for n in graph_data.nodes:
        node_type = _classify_node_type(n)
        nodes.append({
            **n,
            "nodeType": node_type,
            "color": _node_color(node_type),
        })

    links = []
    for e in graph_data.edges:
        edge_type = e.get("type", "event")
        links.append({
            **e,
            "edgeType": edge_type,
            "color": _edge_color(edge_type),
        })

    return {"nodes": nodes, "links": links}


# ---------------------------------------------------------------------------
# WebSocket — live graph events
# ---------------------------------------------------------------------------

@app.websocket("/ws/{world_id}")
async def websocket_endpoint(websocket: WebSocket, world_id: str) -> None:
    await ws_manager.connect(world_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping
    except WebSocketDisconnect:
        ws_manager.disconnect(world_id, websocket)


# ---------------------------------------------------------------------------
# World state snapshot (for frontend hydration on page load)
# ---------------------------------------------------------------------------

@app.get("/world/{world_id}/state")
async def world_state_snapshot(world_id: str) -> dict:
    """Return current world state for frontend hydration."""
    state = require_world(world_id)
    return {
        "world_id": world_id,
        "game_day": state.game_day,
        "gold": state.gold,
        "trust": state.trust,
        "turn_counts": state.turn_counts,
        "npcs": [
            {
                "id": npc_id,
                "name": npc.name,
                "role": npc.role,
                "trust": state.trust.get(npc_id, npc.initial_trust),
                "trajectory": get_trust_trajectory(world_id, npc_id),
            }
            for npc_id, npc in NPC_DEFINITIONS.items()
        ],
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _infer_doc_type(doc_id: str) -> str:
    if doc_id.startswith("qa_"):
        return "qa"
    if doc_id.startswith("feedback_") or doc_id.startswith("trust_"):
        return "feedback"
    if doc_id.startswith("trace_") or doc_id.startswith("amnesia_"):
        return "trace"
    if doc_id.startswith("skill_") or doc_id.startswith("rumor_"):
        return "skill_run"
    if doc_id.startswith("npc_seed_") or doc_id.startswith("npc_skills_"):
        return "trace"
    return "unknown"


def _describe_document(doc_id: str, doc_type: str, npc_name: str) -> str:
    if "betray" in doc_id:
        return f"{npc_name} remembers you betrayed them"
    if "steal" in doc_id:
        return f"{npc_name} remembers you stole from them"
    if "rumor" in doc_id:
        parts = doc_id.split("_to_")
        if len(parts) == 2:
            target = parts[1].split("_")[0]
            return f"{npc_name} was warned about you via rumor"
    if doc_id.startswith("qa_"):
        return f"{npc_name} remembers a conversation with you"
    if doc_id.startswith("trust_"):
        return f"{npc_name} has a trust record from this event"
    if doc_id.startswith("feedback_"):
        return f"{npc_name} remembers your behavior"
    if doc_id.startswith("amnesia_"):
        return f"Record of a previous amnesia spell"
    return f"{npc_name} has a memory: {doc_id}"


def _classify_node_type(node: dict[str, Any]) -> str:
    label = str(node.get("label", node.get("type", ""))).lower()
    doc_id = str(node.get("document_id", node.get("id", ""))).lower()
    if any(k in label for k in ["npc", "silas", "elara", "kael"]):
        return "npc"
    if "player" in label:
        return "player"
    if "rumor" in doc_id or "rumor" in label:
        return "rumor"
    if "trust" in doc_id or "feedback" in doc_id:
        return "trust"
    return "event"


def _node_color(node_type: str) -> str:
    return {
        "npc": "#7C3AED",
        "player": "#F8FAFC",
        "rumor": "#F97316",
        "trust": "#F59E0B",
        "event": "#3B82F6",
    }.get(node_type, "#64748B")


def _edge_color(edge_type: str) -> str:
    return {
        "trust": "#22C55E",
        "rumor": "#F97316",
        "event": "#3B82F6",
    }.get(edge_type, "#64748B")
