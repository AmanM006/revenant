# ⚔ REVENANT
### Cognitive State Engine for Living NPC Worlds

> "The first NPC engine where rumors are graph edges, trust is bi-temporal, and forgetting costs 50 gold."

**[▶ Live Demo](https://revenant.vercel.app)** · **[Demo Video](#)** · Built for WeMakeDevs × Cognee Hackathon 2026

---

## The Problem

$200B gaming industry. Stateless NPCs since 1980. Skyrim guards don't remember you killed that shopkeeper last week. Cyberpunk fixers forget you betrayed their contact. Every NPC resets. Every session is amnesiac.

Scripted dialogue trees cannot scale to real social memory.

## The Solution

3 NPCs. 1 shared Cognee Cloud knowledge graph. Zero scripted logic.

| Game Mechanic | Without Cognee | With Cognee |
|---|---|---|
| NPC remembers betrayal | Hardcoded save flag | `feedback` typed memory, persists bi-temporally |
| Rumors spread between NPCs | Manual per-pair scripting | `improve()` creates cross-NPC graph edges |
| "Who told you I was a thief?" | Impossible | `GRAPH_COMPLETION` multi-hop traversal + citation chain |
| Surgical amnesia | Delete entire save | `forget()` at `document_id` granularity |
| Trust over time | Plain integer | COGXFact `valid_from` / `valid_until` bi-temporal |

## Cognee API Surface

| Feature | Endpoint | Game Mechanic |
|---|---|---|
| 4 typed memory entries | `POST /api/v1/remember/entry` | `qa` · `trace` · `feedback` · `skill_run` per event |
| Multi-hop recall | `POST /api/v1/recall` + `GRAPH_COMPLETION` | Context retrieval + "who told you?" provenance chain |
| Rumor Mill | `POST /api/v1/cognify` | Post-ingestion graph enrichment = cross-NPC edges |
| Amnesia Spell | `POST /api/v1/forget` | Surgical deletion at `document_id` — 50 gold |
| OWL Ontology | `POST /api/v1/ontology/apply` | Entity grounding: NPC, TrustEdge, Rumor, Event |
| Live graph | `GET /api/v1/datasets/{uuid}/graph` | react-force-graph-2d real-time visualization |
| Multi-tenancy | `dataset_id` + `session_id` + `document_id` | All 3 Cognee scoping levels active simultaneously |
| Bi-temporal trust | COGXFact `valid_from`/`valid_until` | Every trust change has game-day timestamp |
| Redis session cache | `session_id` routing | Active NPC dialogue → fast short-term session memory |
| Ranked citations | `recall()` node metadata | Citation log shows real `document_id` + similarity score |

## Architecture

```
                  ┌──────────────────────┐
                  │   FastAPI Backend    │
                  └──────────┬───────────┘
                             │
                             ├───────────────┐
                             ▼               ▼
                      ┌─────────────┐ ┌─────────────┐
                      │    Gemini   │ │Cognee Cloud │
                      │  (LLM Node) │ │(Hybrid Graph│
                      └─────────────┘ └─────────────┘
```

## Stack

| Layer | Technology |
|---|---|
| Memory | Cognee Cloud — hybrid graph-vector, all calls live |
| LLM | Gemini 2.0 Flash — JSON mode structured output |
| Backend | FastAPI + Python 3.11 |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Graph viz | react-force-graph-2d — canvas, live WebSocket updates |
| Charts | Recharts — bi-temporal trust sparklines |
| Real-time | WebSocket — live graph events pushed to UI |

## Quick Start

```bash
git clone https://github.com/AmanM006/revenant.git
cd revenant
cp .env.example .env  # add COGNEE_CLOUD_BASE, COGNEE_API_KEY, COGNEE_TENANT_ID, GEMINI_API_KEY
pip install -r requirements.txt
uvicorn backend.main:app --reload
cd frontend && npm install && npm run dev
```

Or: `docker-compose up --build`

## Demo Script

| Time | Action | Cognee API Called |
|---|---|---|
| 0:00 | World loads | `apply_ontology()` + `remember(trace)` × 3 NPC seeds |
| 0:15 | Pay Silas fairly | `remember(feedback)` trust +10 |
| 0:45 | Steal from Silas | `remember(feedback)` trust -50 |
| 1:15 | Trigger Rumor Mill | `remember(skill_run)` × 6 seeds + `cognify()` async |
| 1:45 | Talk to Kael | `recall(GRAPH_COMPLETION)` surfaces rumor node |
| 2:10 | "Who told you?" | Multi-hop traversal: Player→theft→Silas→rumor→Kael |
| 2:40 | Cast Amnesia | `forget(document_id)` surgical deletion |
| 3:00 | Talk to Kael again | `recall()` returns clean — memory gone |

---

Built with ❤ for WeMakeDevs × Cognee Hackathon 2026
