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
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json

from backend.cognee_client import cognee
from backend.npc_engine import cast_amnesia, process_action, process_dialogue, _build_system_prompt, _save_dialogue_memories, PROVENANCE_TRIGGERS, verify_npc_knowledge
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
    VerifyRequest,
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


@app.exception_handler(ValueError)
async def value_error_handler(request, exc: ValueError):
    """Converts ValueError (like uninitialized worlds or insufficient gold) to HTTP 400."""
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
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

    # Upload ontology schema to Cognee Cloud to enforce graph structure
    try:
        await cognee.upload_ontology(
            ontology_key="ashenvale_ontology",
            file_path="backend/ontology.owl",
            description="Revenant NPC Cognitive Engine OWL Ontology Schema"
        )
    except Exception as e:
        logger.warning(f"Ontology upload failed (continuing): {e}")

    # 1. Collect all NPC seed texts and push via add_text + cognify
    seed_texts: list[str] = []
    for npc_id, npc in NPC_DEFINITIONS.items():
        seed_texts.append(npc.full_backstory)
        seed_texts.append(npc.skills_description)
        seed_texts.append(npc.secret)

    # 2. Write typed memory entries for each NPC in parallel
    import asyncio

    async def seed_npc(npc_id, npc):
        session_id = f"{dataset_name}_{npc_id}_init"
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            await asyncio.gather(
                cognee.remember_trace(
                    origin_function=f"world_init_{npc_id}",
                    memory_query=f"{npc.name} identity",
                    memory_context=npc.full_backstory,
                    dataset_name=dataset_name,
                    session_id=session_id,
                ),
                cognee.remember_trace(
                    origin_function=f"npc_skills_{npc_id}",
                    memory_query=f"{npc.name} available skills",
                    memory_context=npc.skills_description,
                    dataset_name=dataset_name,
                    session_id=session_id,
                ),
                cognee.remember_qa(
                    question=f"What is {npc.name}'s initial disposition toward the player?",
                    answer=(
                        f"{npc.name} starts with trust score {npc.initial_trust}/100. "
                        f"valid_from={now_iso}, game_day=0."
                    ),
                    context=f"World init. NPC: {npc_id}.",
                    dataset_name=dataset_name,
                    session_id=session_id,
                )
            )
            return npc_id
        except Exception as e:
            logger.error(f"Failed to seed NPC {npc_id}: {e}")
            raise e

    # Heavy seeding pipeline run in the background
    async def run_seeding_background():
        try:
            await cognee.init_dataset(dataset_name, seed_texts)
            logger.info(f"Dataset '{dataset_name}' seeded with {len(seed_texts)} texts")
        except Exception as e:
            logger.warning(f"init_dataset failed (continuing): {e}")

        try:
            for npc_id, npc in NPC_DEFINITIONS.items():
                try:
                    res = await seed_npc(npc_id, npc)
                    logger.info(f"Seeded NPC: {res}")
                except Exception as e:
                    logger.error(f"Seeding failed for NPC {npc_id}: {e}")
                await asyncio.sleep(1.0)
        except Exception as e:
            logger.error(f"World init seeding failed: {e}")

    # Fire and forget the background task
    asyncio.create_task(run_seeding_background())

    # 3. Initialize in-memory game state
    init_world_state(world_id)

    return WorldInitResponse(
        world_id=world_id,
        dataset_id=dataset_name,
        status="ready",
        npcs_seeded=list(NPC_DEFINITIONS.keys()),
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


@app.post("/dialogue/stream")
async def dialogue_stream(body: DialogueRequest):
    """
    Server-Sent Events endpoint for streaming NPC responses.
    Client sees text appearing word by word instead of waiting 30s.
    """
    require_world(body.world_id)

    async def event_generator():
        # Step 1: Emit thinking status immediately
        yield f"data: {json.dumps({'type': 'status', 'step': 'querying_graph', 'label': 'Querying memory graph...'})}\n\n"

        # Step 2: Run recall() — this is the slow part (15-25s)
        dataset_name = f"world_{body.world_id}"
        npc = NPC_DEFINITIONS.get(body.npc_id)
        if not npc:
            yield f"data: {json.dumps({'type': 'error', 'message': 'NPC not found'})}\n\n"
            return

        from backend.world_state import get_session_id, get_trust, get_trust_trajectory, increment_turn, get_game_day
        session_id = get_session_id(body.world_id, body.npc_id)
        trust = get_trust(body.world_id, body.npc_id)
        trajectory = get_trust_trajectory(body.world_id, body.npc_id)
        turn_count = increment_turn(body.world_id, body.npc_id)
        game_day = get_game_day(body.world_id)

        try:
            recall_result = await cognee.recall(
                query="What do I know about the player? What have I heard from others? Any trust changes?",
                dataset_name=dataset_name,
                session_id=session_id,
                graph_traversal=True,
            )
        except Exception:
            from backend.schemas import RecallResult
            recall_result = RecallResult()

        # Step 2.5: Provenance chain check
        provenance_chain = None
        message_lower = body.message.lower()
        is_provenance_query = any(trigger in message_lower for trigger in PROVENANCE_TRIGGERS)
        if is_provenance_query:
            try:
                prov_result = await cognee.recall(
                    query=(
                        f"Who is the original source of information about the player being "
                        f"untrustworthy, a thief, or a criminal? "
                        f"Trace the complete information propagation path from origin to {body.npc_id}. "
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
                logger.warning(f"Provenance recall failed in stream: {e}")

        yield f"data: {json.dumps({'type': 'status', 'step': 'generating', 'label': 'Forming response...'})}\n\n"

        # Step 3: Build prompt and stream Gemini
        system_prompt = _build_system_prompt(npc, trust, trajectory, game_day, recall_result, body.message, body.world_id, provenance_chain)

        from backend.llm import stream_npc_response
        final_dialogue = ""
        final_delta = 0
        final_action = "none"

        try:
            async for chunk in stream_npc_response(system_prompt, body.message, npc.name):
                if chunk["type"] == "done":
                    final_dialogue = chunk["dialogue"]
                    final_delta = chunk["trust_delta"]
                    final_action = chunk["action"]
                    # Add citations and provenance to done chunk
                    chunk["citations"] = [
                        {
                            "document_id": c.document_id,
                            "type": c.type,
                            "timestamp": c.timestamp,
                            "content_preview": c.content_preview,
                            "score": c.score,
                            "source_document": c.source_document,
                        }
                        for c in recall_result.citations
                    ]
                    chunk["provenance_chain"] = provenance_chain
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"Gemini streaming generator encountered error: {e}")

        # Step 4: Background — save memories, update trust (fire and forget)
        import asyncio
        asyncio.create_task(
            _save_dialogue_memories(
                npc_id=body.npc_id,
                player_message=body.message,
                recall_result=recall_result,
                world_id=body.world_id,
                session_id=session_id,
                trust=trust,
                turn_count=turn_count,
                game_day=game_day,
                response_text=final_dialogue,
                trust_delta=final_delta,
                action=final_action,
                ws_manager=ws_manager,
            )
        )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/dialogue/verify", response_model=dict)
async def verify_dialogue(body: VerifyRequest) -> dict:
    """
    Verify a statement against the NPC's Cognee memories (Zone of Truth spell).
    Deducts 10 Gold.
    """
    require_world(body.world_id)
    try:
        result = await verify_npc_knowledge(
            world_id=body.world_id,
            npc_id=body.npc_id,
            statement=body.statement,
        )
        return result
    except Exception as e:
        logger.error(f"Verification route error: {e}")
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
            manual=True,
        )
        return RumorMillResponse(**result)
    except Exception as e:
        logger.error(f"Rumor mill error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Sessions details (Cognitive Diagnostics)
# ---------------------------------------------------------------------------

@app.get("/session/{world_id}/{npc_id}")
async def get_session_stats(world_id: str, npc_id: str) -> dict:
    """
    Fetches runtime metadata and LLM tokens/cost auditing from Cognee Cloud for the NPC's active session.
    """
    require_world(world_id)
    if npc_id not in NPC_DEFINITIONS:
        raise HTTPException(status_code=404, detail=f"NPC '{npc_id}' not found.")
    
    from backend.world_state import get_session_id
    session_id = get_session_id(world_id, npc_id)
    details = await cognee.get_session_details(session_id)
    return details


# ---------------------------------------------------------------------------
# Memory listing (Amnesia Modal)
# ---------------------------------------------------------------------------

@app.get("/memories/{npc_id}")
async def list_memories(npc_id: str, world_id: str) -> list[dict]:
    """
    Lists NPC memories registered during this session.
    These are the qa/trace/feedback entries written during dialogue turns.
    Uses the in-process registry (populated by npc_engine after each remember_*)
    so the amnesia modal shows real, per-turn memories — not raw dataset files.
    """
    if npc_id not in NPC_DEFINITIONS:
        raise HTTPException(status_code=404, detail=f"NPC '{npc_id}' not found.")
    require_world(world_id)

    from backend.world_state import get_npc_memories
    memories = get_npc_memories(world_id, npc_id)
    return memories


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
    node_id_map = {}

    # 1. Process Cognee Cloud's returned nodes
    for n in graph_data.nodes:
        node_id = str(n.get("id") or "")
        label = str(n.get("label") or n.get("name") or "").lower()
        node_type = _classify_node_type(n)
        
        # Save mappings for overlays using exact label matches
        label_clean = label.strip().lower()
        if label_clean == "silas" or node_id == "silas":
            node_id_map["silas"] = node_id
        elif label_clean == "elara" or node_id == "elara":
            node_id_map["elara"] = node_id
        elif label_clean == "kael" or node_id == "kael":
            node_id_map["kael"] = node_id
        elif label_clean == "player" or node_id == "player":
            node_id_map["player"] = node_id

        nodes.append({
            **n,
            "nodeType": node_type,
            "color": _node_color(node_type),
        })

    # 2. Inject core nodes if they aren't already present in Cognee's returned data
    if "player" not in node_id_map:
        nodes.append({
            "id": "player",
            "label": "Player",
            "name": "Player",
            "nodeType": "player",
            "color": "#F8FAFC",
        })
        node_id_map["player"] = "player"

    for npc_name, display_name in [("silas", "Silas"), ("elara", "Elara"), ("kael", "Kael")]:
        if npc_name not in node_id_map:
            nodes.append({
                "id": npc_name,
                "label": display_name,
                "name": display_name,
                "nodeType": "npc",
                "color": "#7C3AED",
            })
            node_id_map[npc_name] = npc_name

    # 3. Inject active memory nodes so the Amnesia spell can show them dissolving!
    from backend.world_state import get_npc_memories
    active_mems = []
    for npc_id in ["silas", "elara", "kael"]:
        active_mems.extend(get_npc_memories(world_id, npc_id))

    links = []
    existing_edges = set()

    for mem in active_mems:
        doc_id = mem["document_id"]
        desc = mem["description"]
        if doc_id not in {n["id"] for n in nodes}:
            is_rumor_mem = "rumor" in doc_id or "steal" in desc.lower() or "betray" in desc.lower()
            m_type = "rumor" if is_rumor_mem else "trust"
            nodes.append({
                "id": doc_id,
                "label": f"Memory: {desc[:20]}...",
                "name": desc,
                "nodeType": m_type,
                "color": _node_color(m_type),
            })
            # Connect owner NPC to the memory node
            npc_owner = next((npc for npc in ["silas", "elara", "kael"] if npc in doc_id), None)
            if npc_owner and npc_owner in node_id_map:
                links.append({
                    "source": node_id_map[npc_owner],
                    "target": doc_id,
                    "type": "contains",
                    "edgeType": m_type,
                    "color": _edge_color(m_type),
                })
                existing_edges.add((node_id_map[npc_owner], doc_id))

    # 4. Map Cognee's returned edges
    for e in graph_data.edges:
        src = str(e.get("source") or "")
        tgt = str(e.get("target") or "")
        edge_type = _classify_edge_type(e)
        existing_edges.add((src, tgt))
        links.append({
            **e,
            "edgeType": edge_type,
            "color": _edge_color(edge_type),
        })

    # 5. Dynamic Trust Overlay (Player → NPCs, Green solid lines)
    for npc_id in ["silas", "elara", "kael"]:
        t_val = get_trust(world_id, npc_id)
        src_id = node_id_map["player"]
        tgt_id = node_id_map[npc_id]
        if (src_id, tgt_id) not in existing_edges:
            links.append({
                "source": src_id,
                "target": tgt_id,
                "type": f"trusts_{t_val}",
                "edgeType": "trust",
                "label": f"Trust: {t_val}/100",
                "color": "#22C55E",
            })
            existing_edges.add((src_id, tgt_id))

    # 6. Dynamic Rumor Propagation Overlay (NPC → NPC, Orange dotted links)
    for source_npc in ["silas", "elara", "kael"]:
        t_val = get_trust(world_id, source_npc)
        if t_val < 40:
            for target_npc in ["silas", "elara", "kael"]:
                if target_npc != source_npc:
                    src_id = node_id_map[source_npc]
                    tgt_id = node_id_map[target_npc]
                    if (src_id, tgt_id) not in existing_edges:
                        links.append({
                            "source": src_id,
                            "target": tgt_id,
                            "type": "warns",
                            "edgeType": "rumor",
                            "label": f"{source_npc.capitalize()} warns {target_npc.capitalize()}",
                            "color": "#F97316",
                        })
                        existing_edges.add((src_id, tgt_id))

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
    name = str(node.get("name") or "").lower()
    label = str(node.get("label") or "").lower()
    node_id = str(node.get("id") or "").lower()
    node_type = str(node.get("type") or "").lower()
    doc_id = str(node.get("document_id") or "").lower()

    if any(k in name or k in label or k in node_id for k in ["silas", "elara", "kael"]):
        return "npc"
    if "player" in name or "player" in label or "player" in node_id:
        return "player"
    if "rumor" in name or "rumor" in label or "rumor" in node_id or "rumor" in doc_id or "warn" in name or "warn" in label:
        return "rumor"
    if "trust" in name or "trust" in label or "trust" in node_id or "feedback" in doc_id:
        return "trust"
    if "npc" in node_type or "person" in node_type:
        return "npc"
    return "event"


def _classify_edge_type(edge: dict[str, Any]) -> str:
    rel_type = str(edge.get("type") or edge.get("label") or "").lower()
    if any(k in rel_type for k in ["rumor", "warn", "spread", "betray", "steal", "suspicious"]):
        return "rumor"
    if any(k in rel_type for k in ["trust", "friend", "ally", "favor"]):
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


# ---------------------------------------------------------------------------
# Call log endpoint (Improvement 2 Step B)
# ---------------------------------------------------------------------------
from backend.cognee_client import get_call_log

@app.get("/call-log")
async def call_log() -> list[dict]:
    """
    Returns the last 50 Cognee Cloud API calls with timing.
    Used by the frontend's live call log panel to prove Cognee usage is real.
    """
    return get_call_log()

