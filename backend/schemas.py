"""
schemas.py — All Pydantic v2 models for Revenant.
Single source of truth for request/response shapes.
"""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class WorldInitRequest(BaseModel):
    world_name: str = Field(default="ashenvale", description="Unique game world identifier")


class DialogueRequest(BaseModel):
    npc_id: Literal["silas", "elara", "kael"]
    message: str = Field(min_length=1, max_length=500)
    world_id: str


class VerifyRequest(BaseModel):
    npc_id: Literal["silas", "elara", "kael"]
    statement: str = Field(min_length=1, max_length=500)
    world_id: str


class ActionRequest(BaseModel):
    npc_id: Literal["silas", "elara", "kael"]
    action_type: Literal["betray", "steal", "help", "pay", "insult", "compliment", "bribe"]
    world_id: str


class TimeskipRequest(BaseModel):
    world_id: str
    days: int = Field(default=1, ge=1, le=30)


class RumorMillRequest(BaseModel):
    world_id: str


# ---------------------------------------------------------------------------
# Cognee memory / recall
# ---------------------------------------------------------------------------

class MemoryEntry(BaseModel):
    entry_type: Literal["qa", "skill_run", "feedback", "trace"]
    content: str
    dataset_id: str
    document_id: str
    session_id: Optional[str] = None


class CitationEntry(BaseModel):
    document_id: str
    type: str
    timestamp: str
    content_preview: str
    score: float = 0.0
    source_document: str = ""


class RecallResult(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    graph_context: str = ""
    citations: list[CitationEntry] = Field(default_factory=list)


class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # "npc" | "player" | "event" | "rumor" | "trust"
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str
    type: str  # "trust" | "rumor" | "event"
    weight: float = 1.0


class GraphData(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class DocumentListing(BaseModel):
    document_id: str
    description: str
    type: str
    game_day: int
    timestamp: str


# ---------------------------------------------------------------------------
# Trust timeline
# ---------------------------------------------------------------------------

class TrustHistoryEntry(BaseModel):
    day: int
    score: int
    event: Optional[str] = None
    delta: int = 0


class TrustResponse(BaseModel):
    npc_id: str
    current_trust: int
    history: list[TrustHistoryEntry]
    trajectory: Literal["RISING", "STABLE", "FALLING"]


# ---------------------------------------------------------------------------
# LLM structured output (Claude tool-calling schema)
# ---------------------------------------------------------------------------

class NPCResponsePayload(BaseModel):
    dialogue: str = Field(
        description="The character's spoken response — in-character, sharp, under 120 words."
    )
    citation_justification: str = Field(
        description="Internal narrative: which memory node / document_id influenced this response."
    )
    trust_score_delta: int = Field(
        ge=-20, le=20,
        description="Trust change this turn. Negative = hostile interaction, positive = friendly."
    )
    action: Literal["none", "warn_others", "refuse_service", "call_guard"] = Field(
        default="none",
        description="NPC reactive action beyond dialogue."
    )
    is_rumor_sourced: bool = Field(
        default=False,
        description="True if the NPC is drawing on a rumor (not a direct interaction)."
    )


# ---------------------------------------------------------------------------
# API responses
# ---------------------------------------------------------------------------

class WorldInitResponse(BaseModel):
    world_id: str
    dataset_id: str
    status: str
    npcs_seeded: list[str]


class DialogueResponse(BaseModel):
    response: str
    trust_delta: int
    new_trust: int
    citations: list[CitationEntry]
    action: str
    turn_count: int
    provenance_chain: Optional[list[dict[str, Any]]] = None


class ActionResponse(BaseModel):
    new_trust: int
    trust_history: list[TrustHistoryEntry]
    message: str
    action_type: str
    npc_id: str


class RumorMillResponse(BaseModel):
    status: str
    rumors_propagated: int
    message: str


class AmnesiaResponse(BaseModel):
    success: bool
    document_id_erased: str
    gold_remaining: int
    message: str
