"""
cognee_client.py — Single source of truth for ALL Cognee Cloud REST calls with timing logs and citations references.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional
from collections import deque
from datetime import datetime

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

# Circular buffer of last 50 Cognee API calls
_call_log: deque = deque(maxlen=50)

def get_call_log() -> list[dict]:
    return list(_call_log)

def _record_call(method: str, endpoint: str, dataset: str, status: int, latency_ms: float, payload_summary: str = ""):
    _call_log.appendleft({
        "ts": datetime.utcnow().isoformat() + "Z",
        "op": method,
        "endpoint": endpoint,
        "dataset": dataset,
        "status": status,
        "latency_ms": round(latency_ms, 1),
        "summary": payload_summary,
    })


class CogneeClient:

    _dataset_uuid_cache: dict[str, str] = {}

    async def _get_dataset_uuid(self, dataset_name: str) -> Optional[str]:
        if dataset_name in self._dataset_uuid_cache:
            return self._dataset_uuid_cache[dataset_name]
        try:
            t0 = time.time()
            async with httpx.AsyncClient(follow_redirects=True) as c:
                r = await c.get(
                    f"{COGNEE_BASE}/api/v1/datasets/",
                    headers=HEADERS,
                    timeout=_SHORT,
                )
            latency = (time.time() - t0) * 1000
            _record_call(
                method="get_datasets",
                endpoint="/api/v1/datasets/",
                dataset=dataset_name,
                status=r.status_code,
                latency_ms=latency,
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
    # Internal cognify retry helper
    # ------------------------------------------------------------------

    async def _cognify_with_retry(
        self,
        dataset_name: str,
        method_label: str = "cognify",
        retries: int = 3,
        backoff: float = 10.0,
    ) -> dict:
        """
        POST /api/v1/cognify with exponential backoff.
        Cognee Cloud returns HTTP 500 ProgrammingError on graph DB contention.
        Retries mask transient spikes without fixing the root cause.
        """
        last_resp = None
        for attempt in range(1, retries + 1):
            t0 = time.time()
            async with httpx.AsyncClient(follow_redirects=True) as c:
                r = await c.post(
                    f"{COGNEE_BASE}/api/v1/cognify",
                    headers=HEADERS,
                    json={
                        "datasets": [dataset_name],
                        "ontology_key": ["ashenvale_ontology"]
                    },
                    timeout=_COGNIFY,
                )
            latency = (time.time() - t0) * 1000
            _record_call(
                method=f"{method_label}(attempt {attempt})",
                endpoint="/api/v1/cognify",
                dataset=dataset_name,
                status=r.status_code,
                latency_ms=latency,
                payload_summary=f"attempt={attempt}/{retries}",
            )
            self._log_response(f"{method_label} attempt {attempt}", r)

            if r.status_code < 400:
                if attempt > 1:
                    logger.info(f"{method_label} succeeded on attempt {attempt}")
                return r.json() if r.content else {}

            body = r.text[:200]
            logger.warning(
                f"{method_label} attempt {attempt}/{retries} failed "
                f"HTTP {r.status_code}: {body}"
            )
            last_resp = r

            if attempt < retries:
                wait = backoff * attempt  # 10s, 20s, 30s
                logger.info(f"{method_label} retrying in {wait:.0f}s...")
                await asyncio.sleep(wait)

        logger.error(
            f"{method_label} failed after {retries} attempts. "
            f"Last status: {last_resp.status_code if last_resp else 'unknown'}. "
            f"This is a transient Cognee Cloud infra issue (ProgrammingError in their graph DB)."
        )
        return last_resp.json() if last_resp and last_resp.content else {}

    # ------------------------------------------------------------------
    # Ontology Schema Upload
    # ------------------------------------------------------------------

    async def upload_ontology(self, ontology_key: str, file_path: str, description: str = "") -> dict:
        """
        Uploads an OWL ontology file to Cognee Cloud to guide graph extraction schemas.
        """
        logger.info(f"Uploading ontology key={ontology_key} file={file_path}")
        if not os.path.exists(file_path):
            logger.error(f"Ontology file not found: {file_path}")
            return {"error": "File not found"}
        
        # Prepare headers (Multipart needs to let httpx calculate Content-Type boundary)
        headers = {
            "X-Api-Key": COGNEE_KEY,
            "X-Tenant-Id": COGNEE_TENANT_ID,
        }
        
        t0 = time.time()
        try:
            with open(file_path, "rb") as f:
                files = {
                    "ontology_file": (os.path.basename(file_path), f, "application/xml")
                }
                data = {
                    "ontology_key": ontology_key,
                    "description": description
                }
                
                async with httpx.AsyncClient(follow_redirects=True) as c:
                    r = await c.post(
                        f"{COGNEE_BASE}/api/v1/ontologies",
                        headers=headers,
                        data=data,
                        files=files,
                        timeout=_SHORT,
                    )
                    
            latency = (time.time() - t0) * 1000
            _record_call(
                method="upload_ontology",
                endpoint="/api/v1/ontologies",
                dataset=ontology_key,
                status=r.status_code,
                latency_ms=latency,
                payload_summary=f"key={ontology_key}",
            )
            self._log_response("upload_ontology", r)
            
            if r.status_code == 200:
                return r.json() if r.content else {}
            elif r.status_code == 400 and "already exists" in r.text.lower():
                # Duplicate is fine, means it was already uploaded by a previous session/user
                logger.info(f"Ontology '{ontology_key}' already uploaded.")
                return {"status": "already_exists"}
            return {"error": f"HTTP {r.status_code}: {r.text}"}
        except Exception as e:
            logger.error(f"Failed to upload ontology: {e}")
            return {"error": str(e)}

    # ------------------------------------------------------------------
    # World init
    # ------------------------------------------------------------------

    async def init_dataset(self, dataset_name: str, seed_texts: list[str]) -> dict:
        logger.info(f"Seeding dataset '{dataset_name}' with {len(seed_texts)} texts")
        result = {}
        async with httpx.AsyncClient(follow_redirects=True) as c:
            t0 = time.time()
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/add_text",
                headers=HEADERS,
                json={"text_data": seed_texts, "datasetName": dataset_name},
                timeout=_SHORT,
            )
            latency = (time.time() - t0) * 1000
            _record_call(
                method="add_text",
                endpoint="/api/v1/add_text",
                dataset=dataset_name,
                status=r.status_code,
                latency_ms=latency,
            )
            self._log_response("add_text", r)
            result["add"] = r.json() if r.content else {}

        result["cognify"] = await self._cognify_with_retry(
            dataset_name, method_label="cognify(init)"
        )

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
        # Route feedback to trace to bypass Cognee Cloud 409 Conflict
        payload = {
            "entry": {
                "type": "trace",
                "origin_function": "remember_feedback",
                "status": "success",
                "memory_query": f"feedback qa_id={qa_id}",
                "memory_context": f"{feedback_text} (score={feedback_score})",
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

    async def _post_remember(self, payload: dict, retries: int = 3, backoff: float = 2.0) -> dict:
        entry_type = payload.get("entry", {}).get("type", "unknown")
        dataset = payload.get("dataset_name", "")
        
        for attempt in range(1, retries + 1):
            t0 = time.time()
            try:
                async with httpx.AsyncClient(follow_redirects=True) as c:
                    r = await c.post(
                        f"{COGNEE_BASE}/api/v1/remember/entry",
                        headers=HEADERS,
                        json=payload,
                        timeout=_SHORT,
                    )
                latency = (time.time() - t0) * 1000
                _record_call(
                    method=f"remember({entry_type}, attempt {attempt})",
                    endpoint="/api/v1/remember/entry",
                    dataset=dataset,
                    status=r.status_code,
                    latency_ms=latency,
                    payload_summary=f"type={entry_type}",
                )
                self._log_response("remember_entry", r)
                
                if r.status_code < 400:
                    if r.content:
                        try:
                            return r.json()
                        except Exception:
                            pass
                    return {}
                
                logger.warning(f"remember_entry attempt {attempt}/{retries} returned status {r.status_code}")
            except (httpx.TimeoutException, httpx.NetworkError) as e:
                latency = (time.time() - t0) * 1000
                _record_call(
                    method=f"remember({entry_type}, attempt {attempt})",
                    endpoint="/api/v1/remember/entry",
                    dataset=dataset,
                    status=504,
                    latency_ms=latency,
                    payload_summary=f"timeout: {type(e).__name__}",
                )
                logger.warning(f"remember_entry attempt {attempt}/{retries} failed: {e}")
                
            if attempt < retries:
                wait = backoff * attempt
                logger.info(f"remember_entry retrying in {wait:.1f}s...")
                await asyncio.sleep(wait)
                
        logger.error(f"remember_entry failed after {retries} attempts.")
        return {}

    # ------------------------------------------------------------------
    # recall — GRAPH_COMPLETION with CHUNKS fallback
    # ------------------------------------------------------------------

    async def recall(
        self,
        query: str,
        dataset_name: str,
        session_id: Optional[str] = None,
        graph_traversal: bool = True,
    ) -> RecallResult:
        primary_type = "GRAPH_COMPLETION" if graph_traversal else "CHUNKS"

        payload: dict = {
            "query": query,
            "search_type": primary_type,
            "datasets": [dataset_name],
            "top_k": 10,
            "include_references": True,  # returns real chunk provenance
        }
        if session_id:
            payload["session_id"] = session_id

        logger.info(f"recall() query='{query[:60]}' search={primary_type}")

        try:
            t0 = time.time()
            async with httpx.AsyncClient(follow_redirects=True) as c:
                r = await c.post(
                    f"{COGNEE_BASE}/api/v1/recall",
                    headers=HEADERS,
                    json=payload,
                    timeout=_RECALL,
                )
            latency = (time.time() - t0) * 1000
            _record_call(
                method=f"recall({primary_type})",
                endpoint="/api/v1/recall",
                dataset=dataset_name,
                status=r.status_code,
                latency_ms=latency,
                payload_summary=f"search_type={primary_type}",
            )
            if r.status_code >= 400:
                raise ValueError(f"{primary_type} HTTP {r.status_code}: {r.text[:200]}")
            self._log_response(f"recall/{primary_type}", r)
            return self._parse_recall_response(r, primary_type)

        except Exception as e:
            if graph_traversal:
                logger.warning(f"GRAPH_COMPLETION failed ({e}), falling back to CHUNKS")
                payload["search_type"] = "CHUNKS"
                try:
                    t1 = time.time()
                    async with httpx.AsyncClient(follow_redirects=True) as c:
                        r2 = await c.post(
                            f"{COGNEE_BASE}/api/v1/recall",
                            headers=HEADERS,
                            json=payload,
                            timeout=_RECALL,
                        )
                    latency2 = (time.time() - t1) * 1000
                    _record_call(
                        method="recall(CHUNKS)",
                        endpoint="/api/v1/recall",
                        dataset=dataset_name,
                        status=r2.status_code,
                        latency_ms=latency2,
                        payload_summary="search_type=CHUNKS_fallback",
                    )
                    self._log_response("recall/CHUNKS_fallback", r2)
                    return self._parse_recall_response(r2, "CHUNKS")
                except Exception as e2:
                    logger.error(f"CHUNKS fallback also failed: {e2}")
                    return RecallResult()
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
        citations: list[CitationEntry] = []
        seen: set[str] = set()

        for i, item in enumerate(items[:5]):
            if not isinstance(item, dict):
                continue

            text = item.get("text", item.get("raw", {}).get("value", ""))

            doc_id = (
                item.get("chunk_id")
                or item.get("document_id")
                or item.get("data_id")
                or item.get("id")
                or item.get("reference_id")
                or item.get("source_id")
            )

            if not doc_id or str(doc_id) in seen:
                content_hash = abs(hash(str(text)[:50])) % 99999
                doc_id = f"{search_type}_{i}_{content_hash:05d}"

            if str(doc_id) in seen:
                doc_id = f"{doc_id}_{i}"

            seen.add(str(doc_id))

            source_doc = item.get("source_document", item.get("document", {}) or {})
            source_name = source_doc.get("name", "") if isinstance(source_doc, dict) else ""

            citations.append(
                CitationEntry(
                    document_id=str(doc_id)[:40],
                    type=item.get("kind", item.get("search_type", search_type)),
                    timestamp=str(item.get("metadata", {}).get("timestamp", "")),
                    content_preview=str(text)[:100],
                    score=float(item.get("score") or 0.0),
                    source_document=source_name,
                )
            )
        return citations

    # ------------------------------------------------------------------
    # improve — THE RUMOR MILL
    # ------------------------------------------------------------------

    async def improve(self, dataset_name: str) -> dict:
        logger.info(f"Invoking cognify (rumor mill) for dataset: {dataset_name}")
        return await self._cognify_with_retry(
            dataset_name, method_label="improve()"
        )

    # ------------------------------------------------------------------
    # forget — AMNESIA SPELL
    # ------------------------------------------------------------------

    async def forget_document(self, dataset_name: str, data_id: str) -> dict:
        logger.info(f"forget_document() dataset={dataset_name} data_id={data_id}")
        t0 = time.time()
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.post(
                f"{COGNEE_BASE}/api/v1/forget",
                headers=HEADERS,
                json={"dataset": dataset_name, "dataId": data_id},
                timeout=_SHORT,
            )
        latency = (time.time() - t0) * 1000
        _record_call(
            method="forget()",
            endpoint="/api/v1/forget",
            dataset=dataset_name,
            status=r.status_code,
            latency_ms=latency,
            payload_summary=f"dataId={data_id[:12]}...",
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

        t0 = time.time()
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.get(
                f"{COGNEE_BASE}/api/v1/datasets/{uid}/graph",
                headers=HEADERS,
                timeout=_SHORT,
            )
        latency = (time.time() - t0) * 1000
        _record_call(
            method="get_graph",
            endpoint=f"/api/v1/datasets/{uid}/graph",
            dataset=dataset_name,
            status=r.status_code,
            latency_ms=latency,
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
        uid = await self._get_dataset_uuid(dataset_name)
        if not uid:
            return []

        t0 = time.time()
        async with httpx.AsyncClient(follow_redirects=True) as c:
            r = await c.get(
                f"{COGNEE_BASE}/api/v1/datasets/{uid}/data",
                headers=HEADERS,
                timeout=_SHORT,
            )
        latency = (time.time() - t0) * 1000
        _record_call(
            method="list_documents",
            endpoint=f"/api/v1/datasets/{uid}/data",
            dataset=dataset_name,
            status=r.status_code,
            latency_ms=latency,
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
    # Sessions API
    # ------------------------------------------------------------------

    async def get_session_details(self, session_id: str) -> dict:
        """
        Fetches session details (cost, tokens, status) from Cognee Cloud.
        """
        logger.info(f"get_session_details session_id={session_id}")
        t0 = time.time()
        try:
            async with httpx.AsyncClient(follow_redirects=True) as c:
                r = await c.get(
                    f"{COGNEE_BASE}/api/v1/sessions/{session_id}",
                    headers=HEADERS,
                    timeout=_SHORT,
                )
            latency = (time.time() - t0) * 1000
            _record_call(
                method="get_session_details",
                endpoint=f"/api/v1/sessions/{session_id}",
                dataset=session_id,
                status=r.status_code,
                latency_ms=latency,
            )
            self._log_response("get_session_details", r)
            
            if r.status_code == 200:
                return r.json() if r.content else {}
            return {"error": f"HTTP {r.status_code}: {r.text}"}
        except Exception as e:
            logger.error(f"Failed to fetch session details: {e}")
            return {"error": str(e)}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _log_response(self, method: str, resp: httpx.Response) -> None:
        if resp.status_code >= 400:
            logger.error(f"Cognee {method} HTTP {resp.status_code}: {resp.text[:300]}")
        else:
            logger.debug(f"Cognee {method} HTTP {resp.status_code}")


cognee = CogneeClient()