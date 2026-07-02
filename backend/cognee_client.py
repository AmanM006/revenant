"""
cognee_client.py — Single source of truth for ALL Cognee Cloud REST calls.
Shapes verified against /openapi.json on tenant instance.

Endpoint corrections vs original assumptions:
  - recall()        → returns list[ResultItem], not dict
  - remember_entry()→ {"entry": {...}, "dataset_name": str, "session_id": str}
  - QAEntry         → {type, question, answer, context}
  - TraceEntry      → {type, origin_function, status, memory_query, memory_context}
  - FeedbackEntry   → {type, qa_id, feedback_text, feedback_score}
  - SkillRunEntry   → {type, run_id, selected_skill_id, task_text, result_summary}
  - graph           → GET /api/v1/datasets/{uuid}/graph  (needs real UUID)
  - forget          → POST /api/v1/forget {dataset, dataId?}
  - add content     → POST /api/v1/add_text {text_data: [...], datasetName}
  - process graph   → POST /api/v1/cognify {datasets: [name]}
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

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
_COGNIFY = 120.0


class CogneeClient:
    """Async Cognee Cloud REST client — all shapes verified from /openapi.json."""

    # ------------------------------------------------------------------
    # Dataset UUID cache (name → UUID)
    # ------------------------------------------------------------------
    _dataset_uuid_cache: dict[str, str] = {}

    async def _get_dataset_uuid(self, dataset_name: str) -> Optional[str]:
        """Resolve dataset name → UUID for graph endpoint."""
        if dataset_name in self._dataset_uuid_cache:
            return self._dataset_uuid_cache[dataset_name]
        try:
            async with httpx.AsyncClient(follow_redirects=True) as c:
                r = await c.get(
                    f"{COGNEE_BASE}/api/v1/datasets/",
                    headers=HEADERS,
                    timeout=_SHORT,
                )
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list):
                    for ds in data:
                        if isinstance(ds, dict):
                            name = ds.get("name", "") or ds.get("dataset_name", "")
                            uid = ds.get("id", "") or ds.get("dataset_id", "")
                            if name and uid:
                                self._dataset_uuid_cache[name] = uid
                return self._dataset_uuid_cache.get(dataset_name)
        except Exception as e:
            logger.warning(f"Could not resolve dataset UUID for {dataset_name}: {e}")
        return None

    # ------------------------------------------------------------------
    # World init — add_text + cognify to build initial graph
    # ------------------------------------------------------------------

    async def init_dataset(self, dataset_name: str, seed_texts: list[str]) -> dict:
        """
        POST /api/v1/add_text — ingest NPC backstory text into the dataset.
        POST /api/v1/cognify  — build knowledge graph from ingested text.
        Called once on world init to seed the graph with NPC knowledge.
        """
        logger.info(f"Seeding dataset '{dataset_name}' with {len(seed_texts)} texts")
        result = {}
        async with httpx.AsyncClient(follow_redirects=True) as c:
            # Add text
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/add_text",
                headers=HEADERS,
                json={"text_data": seed_texts, "datasetName": dataset_name},
                timeout=_SHORT,
            )
            self._log_response("add_text", r)
            result["add"] = r.json() if r.content else {}

            # Cognify — build knowledge graph
            r2 = await c.post(
                f"{COGNEE_BASE}/api/v1/cognify",
                headers=HEADERS,
                json={"datasets": [dataset_name]},
                timeout=_COGNIFY,
            )
            self._log_response("cognify", r2)
            result["cognify"] = r2.json() if r2.content else {}

        return result

    # ------------------------------------------------------------------
    # remember/entry — typed memory writes (4 types)
    # ------------------------------------------------------------------

    async def remember_qa(
        self,
        question: str,
        answer: str,
        dataset_name: str,
        session_id: str,
        context: str = "",
    ) -> str:
        """
        POST /api/v1/remember/entry — QAEntry
        Stores a dialogue exchange. Returns entry_id for chaining feedback.
        """
        payload = {
            "entry": {
                "type": "qa",
                "question": question,
                "answer": answer,
                "context": context,
            },
            "dataset_name": dataset_name,
            "session_id": session_id,
        }
        resp = await self._post_remember(payload)
        return resp.get("entry_id", resp.get("qa_id", ""))

    async def remember_trace(
        self,
        origin_function: str,
        memory_query: str,
        memory_context: str,
        dataset_name: str,
        session_id: str,
        status: str = "success",
    ) -> str:
        """
        POST /api/v1/remember/entry — TraceEntry
        Records NPC reasoning + which memory nodes were used for this turn.
        """
        payload = {
            "entry": {
                "type": "trace",
                "origin_function": origin_function,
                "status": status,
                "memory_query": memory_query,
                "memory_context": memory_context,
            },
            "dataset_name": dataset_name,
            "session_id": session_id,
        }
        resp = await self._post_remember(payload)
        return resp.get("entry_id", "")

    async def remember_feedback(
        self,
        qa_id: str,
        feedback_text: str,
        feedback_score: int,
        dataset_name: str,
        session_id: str,
    ) -> dict:
        """
        POST /api/v1/remember/entry — FeedbackEntry (bi-temporal trust update)
        Chained to an existing qa_id — the trust delta is the feedback_score.
        """
        payload = {
            "entry": {
                "type": "feedback",
                "qa_id": qa_id,
                "feedback_text": feedback_text,
                "feedback_score": feedback_score,
            },
            "dataset_name": dataset_name,
            "session_id": session_id,
        }
        return await self._post_remember(payload)

    async def remember_skill_run(
        self,
        run_id: str,
        skill_id: str,
        task_text: str,
        result_summary: str,
        dataset_name: str,
        session_id: Optional[str] = None,
        success_score: float = 1.0,
    ) -> dict:
        """
        POST /api/v1/remember/entry — SkillRunEntry
        Records NPC actions and rumor seeds. No session required.
        """
        payload: dict = {
            "entry": {
                "type": "skill_run",
                "run_id": run_id,
                "selected_skill_id": skill_id,
                "task_text": task_text,
                "result_summary": result_summary,
                "success_score": success_score,
            },
            "dataset_name": dataset_name,
        }
        if session_id:
            payload["session_id"] = session_id
        return await self._post_remember(payload)

    async def _post_remember(self, payload: dict) -> dict:
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/remember/entry",
                headers=HEADERS,
                json=payload,
                timeout=_SHORT,
            )
        self._log_response("remember_entry", r)
        if r.content:
            try:
                return r.json()
            except Exception:
                pass
        return {}

    # ------------------------------------------------------------------
    # recall — multi-hop graph retrieval
    # ------------------------------------------------------------------

    async def recall(
        self,
        query: str,
        dataset_name: str,
        session_id: Optional[str] = None,
        graph_traversal: bool = True,
    ) -> RecallResult:
        """
        POST /api/v1/recall
        Uses CHUNKS search (vector similarity) by default.
        GRAPH_COMPLETION is avoided — it triggers Cognee's internal LLM which
        can fail with 'model output must contain either output text or tool calls'.
        We enrich the context ourselves via Gemini.
        """
        # Always use CHUNKS — reliable, fast, no internal LLM dependency
        search_type = "CHUNKS"

        payload: dict = {
            "query": query,
            "dataset_name": dataset_name,
            "search_type": search_type,
        }
        if session_id:
            payload["session_id"] = session_id

        logger.info(f"recall() query='{query[:60]}...' dataset={dataset_name} search={search_type}")
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/recall",
                headers=HEADERS,
                json=payload,
                timeout=_RECALL,
            )
        self._log_response("recall", r)

        if not r.content:
            return RecallResult()

        data = r.json()

        # Cognee recall returns a list of result items
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("results", data.get("nodes", [data]))
        else:
            items = []

        # Build graph context from text fields
        texts = [
            item.get("text", item.get("raw", {}).get("value", ""))
            for item in items
            if isinstance(item, dict)
        ]
        graph_context = "\n\n".join(t for t in texts if t)

        citations = self._extract_citations(items)
        return RecallResult(
            nodes=items,
            graph_context=graph_context,
            citations=citations,
        )

    def _extract_citations(self, items: list) -> list[CitationEntry]:
        """Build citation log entries from recall result items."""
        citations: list[CitationEntry] = []
        for item in items[:5]:
            if not isinstance(item, dict):
                continue
            text = item.get("text", item.get("raw", {}).get("value", ""))
            doc_id = (
                item.get("document_id")
                or item.get("data_id")
                or item.get("dataset_id", "")
                or "graph_node"
            )
            citations.append(
                CitationEntry(
                    document_id=str(doc_id),
                    type=item.get("kind", item.get("search_type", "graph_completion")),
                    timestamp=str(item.get("metadata", {}).get("timestamp", "")),
                    content_preview=str(text)[:100],
                    score=float(item.get("score") or 0.0),
                )
            )
        return citations

    # ------------------------------------------------------------------
    # cognify — THE RUMOR MILL (build/enrich knowledge graph)
    # ------------------------------------------------------------------

    async def improve(self, dataset_name: str) -> dict:
        """
        POST /api/v1/cognify  — triggers post-ingestion graph enrichment.
        THE RUMOR MILL. Called via asyncio.create_task() — fire-and-forget.
        Creates cross-NPC edges from structured rumor seed text.
        """
        logger.info(f"Invoking cognify (rumor mill) for dataset: {dataset_name}")
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/cognify",
                headers=HEADERS,
                json={"datasets": [dataset_name]},
                timeout=_COGNIFY,
            )
        self._log_response("cognify/improve", r)
        return r.json() if r.content else {}

    # ------------------------------------------------------------------
    # forget — AMNESIA SPELL
    # ------------------------------------------------------------------

    async def forget_document(self, dataset_name: str, data_id: str) -> dict:
        """
        POST /api/v1/forget — surgical forget by data_id within a dataset.
        Severs only the targeted memory node. Does NOT nuke entire dataset.
        """
        logger.info(f"forget_document() dataset={dataset_name} data_id={data_id}")
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/forget",
                headers=HEADERS,
                json={"dataset": dataset_name, "dataId": data_id},
                timeout=_SHORT,
            )
        self._log_response("forget", r)
        return r.json() if r.content else {"status": "forgotten"}

    # ------------------------------------------------------------------
    # graph — live visualization
    # ------------------------------------------------------------------

    async def get_graph(self, dataset_name: str) -> GraphData:
        """
        GET /api/v1/datasets/{uuid}/graph — returns nodes + edges for visualization.
        Resolves dataset name → UUID first.
        """
        logger.info(f"get_graph() dataset={dataset_name}")
        uid = await self._get_dataset_uuid(dataset_name)
        if not uid:
            logger.warning(f"No UUID found for dataset '{dataset_name}', returning empty graph")
            return GraphData()

        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.get(
                f"{COGNEE_BASE}/api/v1/datasets/{uid}/graph",
                headers=HEADERS,
                timeout=_SHORT,
            )
        self._log_response("get_graph", r)

        if not r.content or r.status_code == 404:
            return GraphData()

        data = r.json()
        if isinstance(data, dict):
            return GraphData(
                nodes=data.get("nodes", []),
                edges=data.get("edges", data.get("links", [])),
            )
        return GraphData()

    # ------------------------------------------------------------------
    # list documents for Amnesia Modal
    # ------------------------------------------------------------------

    async def list_documents(self, dataset_name: str, npc_id: str) -> list[dict]:
        """
        GET /api/v1/datasets/{uuid}/data — list data items for a dataset.
        Filtered to items belonging to this NPC.
        """
        logger.info(f"list_documents() dataset={dataset_name} npc={npc_id}")
        uid = await self._get_dataset_uuid(dataset_name)
        if not uid:
            return []

        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.get(
                f"{COGNEE_BASE}/api/v1/datasets/{uid}/data",
                headers=HEADERS,
                timeout=_SHORT,
            )
        self._log_response("list_documents", r)

        if not r.content or r.status_code >= 400:
            return []

        data = r.json()
        items = data if isinstance(data, list) else data.get("data", [])
        return [
            d for d in items
            if isinstance(d, dict)
            and npc_id in str(d.get("name", "") + str(d.get("id", "")))
        ][:20]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _log_response(self, method: str, resp: httpx.Response) -> None:
        if resp.status_code >= 400:
            logger.error(
                f"Cognee {method} HTTP {resp.status_code}: {resp.text[:300]}"
            )
        else:
            logger.debug(f"Cognee {method} HTTP {resp.status_code}")


# Singleton instance — import this everywhere
cognee = CogneeClient()
