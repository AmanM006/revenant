"""
cognee_client.py — Single source of truth for ALL Cognee Cloud REST calls.
Shapes verified against /openapi.json on tenant instance.
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

_SHORT = 30.0
_RECALL = 60.0
_COGNIFY = 120.0


class CogneeClient:

    _dataset_uuid_cache: dict[str, str] = {}

    async def _get_dataset_uuid(self, dataset_name: str) -> Optional[str]:
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
    # World init
    # ------------------------------------------------------------------

    async def init_dataset(self, dataset_name: str, seed_texts: list[str]) -> dict:
        logger.info(f"Seeding dataset '{dataset_name}' with {len(seed_texts)} texts")
        result = {}
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/add_text",
                headers=HEADERS,
                json={"text_data": seed_texts, "datasetName": dataset_name},
                timeout=_SHORT,
            )
            self._log_response("add_text", r)
            result["add"] = r.json() if r.content else {}

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
    # Typed memory entries
    # ------------------------------------------------------------------

    async def remember_qa(
        self,
        question: str,
        answer: str,
        dataset_name: str,
        session_id: str,
        context: str = "",
    ) -> str:
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
    # recall — always CHUNKS (vector similarity, no internal LLM needed)
    # ------------------------------------------------------------------

    async def recall(
        self,
        query: str,
        dataset_name: str,
        session_id: Optional[str] = None,
        graph_traversal: bool = True,  # param kept for API compat, ignored
    ) -> RecallResult:
        """
        POST /api/v1/recall with search_type=CHUNKS.

        Why CHUNKS and not GRAPH_COMPLETION:
          GRAPH_COMPLETION requires the Cognee tenant to have an LLM configured.
          If no LLM is set, Cognee returns HTTP 200 with an error body:
            {"error": "model output must contain either output text or tool calls..."}
          This silently produces empty context and breaks dialogue.
          CHUNKS uses pure vector similarity — always works, no LLM dependency.
        """
        search_type = "CHUNKS"

        payload: dict = {
            "query": query,
            "search_type": search_type,
            "datasets": [dataset_name],
            "top_k": 10,
        }
        if session_id:
            payload["session_id"] = session_id

        logger.info(f"recall() query='{query[:60]}' search={search_type}")

        try:
            async with httpx.AsyncClient(follow_redirects=True) as c:
                r = await c.post(
                    f"{COGNEE_BASE}/api/v1/recall",
                    headers=HEADERS,
                    json=payload,
                    timeout=_RECALL,
                )
            self._log_response("recall", r)
            if r.status_code >= 400:
                logger.error(f"Cognee recall HTTP {r.status_code}: {r.text[:300]}")
                return RecallResult()
            return self._parse_recall_response(r, search_type)

        except Exception as e:
            logger.error(f"recall() exception: {e}")
            return RecallResult()

    def _parse_recall_response(self, r: httpx.Response, search_type: str) -> RecallResult:
        if not r.content:
            return RecallResult()
        data = r.json()

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("results", data.get("nodes", [data]))
        else:
            items = []

        texts = [
            item.get("text", item.get("raw", {}).get("value", ""))
            for item in items
            if isinstance(item, dict)
        ]
        graph_context = "\n\n".join(t for t in texts if t)
        citations = self._extract_citations(items, search_type)

        return RecallResult(
            nodes=items,
            graph_context=graph_context,
            citations=citations,
        )

    def _extract_citations(self, items: list, search_type: str = "chunk") -> list[CitationEntry]:
        """
        FIX: Each citation now gets a unique document_id.
        Uses chunk_id → id → content-hash fallback to prevent all-same-ID bug.
        """
        citations: list[CitationEntry] = []
        seen: set[str] = set()

        for i, item in enumerate(items[:5]):
            if not isinstance(item, dict):
                continue

            text = item.get("text", item.get("raw", {}).get("value", ""))

            # Try every possible unique ID field
            doc_id = (
                item.get("chunk_id")
                or item.get("document_id")
                or item.get("data_id")
                or item.get("id")
                or item.get("node_id")
            )

            # Unique fallback: position + content hash (never collides)
            if not doc_id or doc_id in seen:
                content_hash = abs(hash(str(text)[:50])) % 99999
                doc_id = f"{search_type}_{i}_{content_hash:05d}"

            # Still collides? append index
            if doc_id in seen:
                doc_id = f"{doc_id}_{i}"

            seen.add(str(doc_id))

            citations.append(
                CitationEntry(
                    document_id=str(doc_id)[:40],
                    type=item.get("kind", item.get("search_type", search_type)),
                    timestamp=str(item.get("metadata", {}).get("timestamp", "")),
                    content_preview=str(text)[:100],
                    score=float(item.get("score") or 0.0),
                )
            )
        return citations

    # ------------------------------------------------------------------
    # improve — THE RUMOR MILL
    # ------------------------------------------------------------------

    async def improve(self, dataset_name: str) -> dict:
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
    # graph
    # ------------------------------------------------------------------

    async def get_graph(self, dataset_name: str) -> GraphData:
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
    # list documents (kept for graph display, NOT used for amnesia)
    # ------------------------------------------------------------------

    async def list_documents(self, dataset_name: str, npc_id: str) -> list[dict]:
        """
        NOTE: This is NOT used for the amnesia modal anymore.
        Amnesia modal uses world_state.get_npc_memories() registry instead.
        This is kept for potential graph-level document inspection.
        """
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
            logger.error(f"Cognee {method} HTTP {resp.status_code}: {resp.text[:300]}")
        else:
            logger.debug(f"Cognee {method} HTTP {resp.status_code}")


cognee = CogneeClient()