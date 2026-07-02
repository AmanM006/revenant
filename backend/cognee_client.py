"""
cognee_client.py — Single source of truth for ALL Cognee Cloud REST calls.
Never call Cognee API from anywhere else in the codebase.
"""
from __future__ import annotations

import logging
import os
from typing import Literal, Optional

import httpx
from dotenv import load_dotenv

from backend.schemas import CitationEntry, GraphData, RecallResult

load_dotenv()

logger = logging.getLogger("revenant.cognee")

COGNEE_BASE = os.getenv("COGNEE_CLOUD_BASE", "").rstrip("/")
COGNEE_KEY = os.getenv("COGNEE_API_KEY", "")
COGNEE_TENANT_ID = os.getenv("COGNEE_TENANT_ID", "")

HEADERS = {
    "X-Api-Key": COGNEE_KEY,
    "X-Tenant-Id": COGNEE_TENANT_ID,
    "Content-Type": "application/json",
}

# Timeout config (seconds)
_SHORT = 30.0
_RECALL = 45.0
_IMPROVE = 120.0  # improve() is a heavy cloud pipeline


class CogneeClient:
    """Async Cognee Cloud REST client."""

    # ------------------------------------------------------------------
    # Ontology
    # ------------------------------------------------------------------

    async def apply_ontology(self, ttl_content: str, dataset_id: str) -> dict:
        """
        POST /api/v1/ontology/apply
        Apply OWL ontology to ground NPC entities. Called once on world init.
        """
        logger.info(f"Applying ontology to dataset: {dataset_id}")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{COGNEE_BASE}/api/v1/ontology/apply",
                headers=HEADERS,
                json={"ontology": ttl_content, "dataset_id": dataset_id},
                timeout=_SHORT,
            )
        self._log_response("apply_ontology", resp)
        return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # remember/entry — core typed memory writes
    # ------------------------------------------------------------------

    async def remember_entry(
        self,
        entry_type: Literal["qa", "skill_run", "feedback", "trace"],
        content: str,
        dataset_id: str,
        document_id: str,
        session_id: Optional[str] = None,
    ) -> dict:
        """
        POST /api/v1/remember/entry
        Typed memory entry — all 4 types used throughout the game:
          qa        → dialogue turns
          skill_run → NPC actions + rumor seeds
          feedback  → trust updates + player behavior records
          trace     → NPC reasoning + amnesia records
        """
        payload: dict = {
            "type": entry_type,
            "content": content,
            "dataset_id": dataset_id,
            "document_id": document_id,
        }
        if session_id:
            payload["session_id"] = session_id

        logger.debug(
            f"remember_entry type={entry_type} doc_id={document_id} dataset={dataset_id}"
        )
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{COGNEE_BASE}/api/v1/remember/entry",
                headers=HEADERS,
                json=payload,
                timeout=_SHORT,
            )
        self._log_response("remember_entry", resp)
        return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # recall — multi-hop GRAPH_COMPLETION retrieval
    # ------------------------------------------------------------------

    async def recall(
        self,
        query: str,
        dataset_id: str,
        session_id: Optional[str] = None,
        graph_traversal: bool = True,
    ) -> RecallResult:
        """
        POST /api/v1/recall
        Returns ranked nodes with metadata for citation log.
        graph_traversal=True enables multi-hop GRAPH_COMPLETION.
        """
        payload: dict = {
            "query": query,
            "dataset_id": dataset_id,
            "graph_traversal": graph_traversal,
        }
        if session_id:
            payload["session_id"] = session_id

        logger.info(f"recall() query='{query[:60]}...' dataset={dataset_id} traversal={graph_traversal}")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{COGNEE_BASE}/api/v1/recall",
                headers=HEADERS,
                json=payload,
                timeout=_RECALL,
            )
        self._log_response("recall", resp)

        if not resp.content:
            return RecallResult()

        data = resp.json()
        citations = self._extract_citations(data)
        return RecallResult(
            nodes=data.get("nodes", []),
            graph_context=data.get("graph_context", data.get("context", "")),
            citations=citations,
        )

    def _extract_citations(self, recall_response: dict) -> list[CitationEntry]:
        """Extract top-5 ranked, citable nodes for the citation log UI."""
        citations: list[CitationEntry] = []
        for node in recall_response.get("nodes", [])[:5]:
            citations.append(
                CitationEntry(
                    document_id=node.get("document_id", node.get("id", "unknown")),
                    type=node.get("type", "unknown"),
                    timestamp=str(node.get("metadata", {}).get("timestamp", "")),
                    content_preview=str(node.get("content", ""))[:80],
                    score=float(node.get("score", node.get("relevance", 0.0))),
                )
            )
        return citations

    # ------------------------------------------------------------------
    # improve — THE RUMOR MILL (post-ingestion graph enrichment)
    # ------------------------------------------------------------------

    async def improve(self, dataset_id: str) -> dict:
        """
        POST /api/v1/improve
        Triggers post-ingestion graph enrichment on Cognee Cloud.
        Creates cross-NPC rumor edges from structured rumor seed entries.
        Heavy pipeline — called via asyncio.create_task() (fire-and-forget).
        """
        logger.info(f"Invoking improve() for dataset: {dataset_id}")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{COGNEE_BASE}/api/v1/improve",
                headers=HEADERS,
                json={"dataset_id": dataset_id},
                timeout=_IMPROVE,
            )
        self._log_response("improve", resp)
        return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # forget — AMNESIA SPELL (surgical document_id deletion)
    # ------------------------------------------------------------------

    async def forget_document(self, dataset_id: str, document_id: str) -> dict:
        """
        DELETE /api/v1/datasets/{dataset_id}/documents/{document_id}
        Surgical forget at document_id granularity.
        Does NOT nuke entire dataset — severs only this specific memory node.
        """
        logger.info(f"forget_document() dataset={dataset_id} doc_id={document_id}")
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{COGNEE_BASE}/api/v1/datasets/{dataset_id}/documents/{document_id}",
                headers=HEADERS,
                timeout=_SHORT,
            )
        self._log_response("forget_document", resp)
        return resp.json() if resp.content else {"status": "deleted"}

    # ------------------------------------------------------------------
    # graph — Live graph for react-force-graph-2d
    # ------------------------------------------------------------------

    async def get_graph(self, dataset_id: str) -> GraphData:
        """
        GET /api/v1/graph?dataset_id=...
        Returns nodes + edges with types and metadata for visualization.
        """
        logger.info(f"get_graph() dataset={dataset_id}")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{COGNEE_BASE}/api/v1/graph",
                headers=HEADERS,
                params={"dataset_id": dataset_id},
                timeout=_SHORT,
            )
        self._log_response("get_graph", resp)

        if not resp.content:
            return GraphData()

        data = resp.json()
        return GraphData(
            nodes=data.get("nodes", []),
            edges=data.get("edges", data.get("links", [])),
        )

    # ------------------------------------------------------------------
    # documents — list forgettable document_ids (Amnesia Modal)
    # ------------------------------------------------------------------

    async def list_documents(self, dataset_id: str, npc_id: str) -> list[dict]:
        """
        GET /api/v1/datasets/{dataset_id}/documents
        Lists document_ids for a specific NPC (filtered by npc_id prefix).
        Used by amnesia modal to show what the player can make NPCs forget.
        """
        logger.info(f"list_documents() dataset={dataset_id} npc_id={npc_id}")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{COGNEE_BASE}/api/v1/datasets/{dataset_id}/documents",
                headers=HEADERS,
                params={"prefix": f"{npc_id}_"},
                timeout=_SHORT,
            )
        self._log_response("list_documents", resp)

        if not resp.content:
            return []

        docs = resp.json()
        if isinstance(docs, dict):
            docs = docs.get("documents", [])

        # Filter: only return documents owned by this NPC
        return [
            d for d in docs
            if isinstance(d, dict)
            and d.get("document_id", "").startswith(npc_id)
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _log_response(self, method: str, resp: httpx.Response) -> None:
        """Log every Cognee response for debugging — never suppress errors."""
        if resp.status_code >= 400:
            logger.error(
                f"Cognee {method} returned HTTP {resp.status_code}: {resp.text[:300]}"
            )
        else:
            logger.debug(f"Cognee {method} HTTP {resp.status_code}")


# Singleton instance — import this everywhere
cognee = CogneeClient()
