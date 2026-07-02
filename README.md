<div align="center">

# ⚔ REVENANT

### *The first NPC engine where rumors are graph edges, trust is bi-temporal, and forgetting costs 50 gold.*

[![WeMakeDevs × Cognee Hackathon 2026](https://img.shields.io/badge/WeMakeDevs%20%C3%97%20Cognee-Hackathon%202026-7C3AED?style=for-the-badge)](https://github.com/AmanM006/revenant)
[![Best Use of Cognee Cloud](https://img.shields.io/badge/Category-Best%20Use%20of%20Cognee%20Cloud-F97316?style=for-the-badge)](https://cognee.ai)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Cognee Cloud](https://img.shields.io/badge/Cognee-Cloud-F59E0B?style=for-the-badge)](https://cognee.ai)

</div>

---

> **Framing for judges:** Do NOT think of this as "a game." Think of it as **Cognitive Middleware for Living Game Worlds** — a proof-of-concept NPC social memory layer that demonstrates every non-trivial surface of the Cognee Cloud API through gameplay mechanics.

---

## The Problem

The $200B gaming industry runs on stateless NPCs. No Skyrim guard remembers you murdered that shop owner last week. No Cyberpunk fixer knows you betrayed their contact. Every NPC resets on reload. Every session is amnesiac.

Scripted dialogue trees cannot scale to real social memory. They never could.

## The Solution

**3 NPCs. 1 shared Cognee Cloud knowledge graph. Zero scripted logic.**

Every interaction, every rumor, every trust shift — lives in a hybrid graph-vector memory layer that persists, evolves, and propagates. When Silas tells Kael you're a thief, that's a real `skill_run` memory entry seeding Cognee's `improve()` pipeline. When Kael remembers it three sessions later, that's a real `GRAPH_COMPLETION` traversal over the injected edge.

---

## Why This Is Impossible Without Cognee

| Game Mechanic | Without Cognee | With Cognee |
|:---|:---|:---|
| NPC remembers a betrayal | Scripted flag hardcoded in save file | `feedback` typed memory — persists bi-temporally forever |
| Rumors spread between NPCs | Manual per-NPC-pair scripting | `improve()` creates cross-NPC graph edges from seeds |
| *"Who told you I was a thief?"* | Impossible to implement | `GRAPH_COMPLETION` multi-hop traversal + citation chain |
| Surgical amnesia | Delete entire save file | `forget()` at `document_id` granularity — one node at a time |
| Trust over time | Plain integer variable | COGXFact with `valid_from` / `valid_until` bi-temporal fields |
| NPC talks to NPC about player | Per-interaction scripted triggers | Rumor seed → `improve()` → emergent graph enrichment |

---

## Demo

https://github.com/user-attachments/assets/placeholder-demo-video

*(3-minute demo: betray Silas → trigger rumor mill → Kael learns → "who told you?" → amnesia spell)*

---

## Cognee API Surface Used

| Feature | Endpoint | Game Mechanic |
|:---|:---|:---|
| **4 typed memory entries** | `POST /api/v1/remember/entry` | `qa` = dialogue · `trace` = NPC reasoning · `feedback` = trust update · `skill_run` = action/rumor seed |
| **Multi-hop recall** | `POST /api/v1/recall` + `graph_traversal=true` | Context retrieval + "who told you?" provenance chain |
| **`improve()` enrichment** | `POST /api/v1/improve` | **The Rumor Mill** — post-ingestion graph edge creation |
| **Surgical `forget()`** | `DELETE /api/v1/datasets/{id}/documents/{doc_id}` | **Amnesia Spell** — 50 gold removes one specific memory node |
| **OWL ontology** | `POST /api/v1/ontology/apply` | Entity grounding on world init — NPC, TrustEdge, Rumor, etc. |
| **Live graph** | `GET /api/v1/graph` | Visualized in real-time via `react-force-graph-2d` |
| **Multi-tenancy** | `dataset_id` + `session_id` + `document_id` | All 3 Cognee scoping levels active simultaneously |
| **Bi-temporal trust** | COGXFact `valid_from` / `valid_until` | Every trust change has game-day timestamps |
| **Redis session cache** | `session_id` routing | Active dialogue → fast short-term NPC session memory |
| **Ranked citations** | `recall()` node metadata | Citation log shows real `document_id` + similarity score |

---

## The Three NPCs

<table>
<tr>
<td width="33%" valign="top">

### 🔨 Silas — Blacksmith
> *"Proud craftsman. Holds grudges indefinitely."*

**Trust:** 50/100  
**Personality:** Blunt, fair but unforgiving  
**Rumor behavior:** Reports thefts to Kael  
**Secret:** Owes Elara a life-debt *(discoverable via graph traversal)*  
**Skills:** `forge_weapon` · `repair_armor` · `refuse_service` · `report_to_guard`

</td>
<td width="33%" valign="top">

### ✦ Elara — Mage
> *"Forgives once. Remembers always."*

**Trust:** 65/100  
**Personality:** Cryptic, observant, patient  
**Rumor behavior:** Warns Silas about stolen enchantments  
**Secret:** Has a complete magical record of every spell cast in the region  
**Skills:** `enchant_item` · `reveal_graph` · `teach_spell` · `memory_wipe_curse`

</td>
<td width="33%" valign="top">

### ⚔ Kael — Guard Captain
> *"Never forgets a crime. Has a price."*

**Trust:** 40/100  
**Personality:** Stern, corruptible under pressure  
**Rumor behavior:** Shares crime summaries with both NPCs  
**Secret:** Accepted a bribe 2 years ago *(ask: "Have you ever broken your own rules?")*  
**Skills:** `arrest_player` · `issue_fine` · `grant_permit` · `clear_record`

</td>
</tr>
</table>

---

## The Three Core Mechanics

### 🌐 Rumor Mill — `improve()` as game mechanic

```
Player steals from Silas
    → Silas trust -50
    → skill_run entry written: "rumor_silas_kael_{timestamp}"
    → POST /api/v1/improve (async, non-blocking)
    → Cognee enriches: Silas→Kael rumor edge created
    → WebSocket broadcasts graph_updated
    → Orange dashed edge animates in UI
    → Kael's next recall() surfaces the rumor node
    → Kael: "I've heard things about you."
```

**The rumor mill IS the `improve()` call. Not scripted. Not faked.**

---

### 🧠 Amnesia Spell — `forget()` at `document_id` granularity

```
Player spends 50 gold
    → UI shows live document list from GET /memories/{npc_id}
    → Player selects a specific document_id
    → DELETE /api/v1/datasets/world_ashenvale/documents/{doc_id}
    → WebSocket broadcasts node_dissolve
    → Graph node fades and shrinks in UI
    → Forgetting itself recorded as trace entry
    → NPC's next recall() no longer surfaces erased memory
```

**Surgical deletion — only that node. The rest of their memory is intact.**

---

### ⛓ Multi-hop Provenance — `GRAPH_COMPLETION` traversal

```
Player: "Who told you I was a thief?"
    → recall(graph_traversal=True)
    → Cognee traverses: Player → theft_event → Silas → rumor_edge → Kael
    → Citation chain returned: step-by-step document_id path
    → NPC: "Silas came to me this morning. Said you stole from him."
    → UI shows full traversal chain in Citation Log
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (port 3000)                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ NPCPanel │  │ DialogPanel  │  │   GraphPanel      │ │
│  │ trust    │  │ chat + cites │  │ react-force-graph │ │
│  │ sparkline│  │ provenance   │  │ live WS updates   │ │
│  └──────────┘  └──────────────┘  └───────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │ REST + WebSocket
┌─────────────────────────▼───────────────────────────────┐
│                  FastAPI (port 8000)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ npc_engine   │  │ rumor_mill   │  │ WSManager    │  │
│  │ dialogue loop│  │ improve() +  │  │ live events  │  │
│  │ amnesia      │  │ async task   │  │ to frontend  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         └────────┬─────────┘                           │
│  ┌──────────────▼────────────────────────────────────┐ │
│  │            cognee_client.py                       │ │
│  │  All 7 Cognee Cloud endpoints — single source     │ │
│  └──────────────┬────────────────────────────────────┘ │
│  ┌──────────────▼────────────────────────────────────┐ │
│  │                  llm.py                           │ │
│  │  Gemini 2.0 Flash — JSON mode structured output  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS + X-Api-Key
┌─────────────────────────▼───────────────────────────────┐
│              Cognee Cloud (AWS tenant)                  │
│  dataset: world_ashenvale                               │
│  • remember()  • recall()  • improve()  • forget()      │
│  • apply_ontology()  • graph()  • list_docs()           │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Non-blocking `improve()`** — runs via `asyncio.create_task()`. Request returns immediately; graph update arrives via WebSocket when cloud pipeline completes
- **Gemini JSON mode** — `NPCResponsePayload` schema enforced via `response_schema`, eliminating JSON parse failures from conversational text
- **3-level Cognee scoping** — `dataset_id` (world), `session_id` (NPC dialogue session → Redis), `document_id` (per-event surgical forget)
- **Bi-temporal trust** — every trust state has `valid_from` (event timestamp) + game day, stored as Cognee facts and visualized as sparklines

---

## Project Structure

```
revenant/
├── backend/
│   ├── __init__.py
│   ├── cognee_client.py   # All 7 Cognee Cloud REST endpoints
│   ├── llm.py             # Gemini 2.0 Flash, JSON mode structured output
│   ├── main.py            # 11 FastAPI routes + WebSocket manager
│   ├── npc_engine.py      # Dialogue loop, amnesia, provenance tracing
│   ├── ontology.ttl       # OWL ontology — NPC, TrustEdge, Rumor, etc.
│   ├── rumor_mill.py      # improve() scheduler + rumor seed injection
│   ├── schemas.py         # All Pydantic v2 models
│   └── world_state.py     # In-memory NPC state, trust history, gold
├── frontend/
│   ├── app/
│   │   ├── globals.css    # Design system — color tokens, animations
│   │   ├── layout.tsx     # Root layout + Google Fonts
│   │   └── page.tsx       # 3-panel layout, all state management
│   ├── components/
│   │   ├── AmnesiaModal.tsx    # document_id picker for forget()
│   │   ├── CitationLog.tsx     # Ranked citations + provenance chain
│   │   ├── DialoguePanel.tsx   # Chat UI + quick actions
│   │   ├── EngineControls.tsx  # Rumor Mill, Amnesia, Time Skip buttons
│   │   ├── GraphPanel.tsx      # react-force-graph-2d live graph
│   │   ├── NPCPanel.tsx        # NPC selector + trust sparklines
│   │   └── TrustSparkline.tsx  # Recharts mini trust chart
│   └── lib/
│       ├── api.ts             # Typed fetch client for all endpoints
│       ├── types.ts           # TypeScript mirrors of Pydantic schemas
│       └── useGameSocket.ts   # WebSocket hook with auto-reconnect
├── .env.example
├── Dockerfile.backend
├── docker-compose.yml
└── requirements.txt
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- [Cognee Cloud account](https://cognee.ai) — API key + tenant URL
- [Google AI Studio](https://aistudio.google.com) — Gemini API key

### 1. Clone and configure

```bash
git clone https://github.com/AmanM006/revenant.git
cd revenant
cp .env.example .env
# Edit .env with your keys
```

### 2. Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 4. Or — one command with Docker

```bash
docker-compose up --build
```

---

## Environment Variables

```bash
# .env
COGNEE_CLOUD_BASE=https://tenant-<your-id>.aws.cognee.ai
COGNEE_API_KEY=<your-cognee-api-key>
COGNEE_TENANT_ID=<your-tenant-id>
GEMINI_API_KEY=<your-gemini-api-key>
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Demo Script (3 minutes for judges)

| Time | Action | What Cognee Does |
|:---|:---|:---|
| 0:00 | World loads | `apply_ontology()` + 3× `remember("trace")` + `remember("skill_run")` seeds |
| 0:15 | Pay Silas fairly | `remember("feedback")` trust +10 · `remember("qa")` dialogue stored |
| 0:45 | Steal from Silas | Trust -50 · `remember("skill_run")` rumor seed written |
| 1:15 | **Trigger Rumor Mill** | `improve()` fires async · Orange edge Silas→Kael appears in graph |
| 1:45 | Talk to Kael | `recall(graph_traversal=True)` surfaces rumor node · "I've heard things..." |
| 2:10 | **"Who told you?"** | Multi-hop traversal: Player→theft→Silas→rumor→Kael · Chain in UI |
| 2:40 | **Cast Amnesia** | `DELETE .../documents/rumor_silas_to_kael_...` · Node dissolves in graph |
| 3:00 | Talk to Kael again | `recall()` clean · "Can't quite recall what I was worried about..." |

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Memory | **Cognee Cloud** — hybrid graph-vector, all calls live |
| LLM | **Gemini 2.0 Flash** — JSON mode, `response_schema` enforcement |
| Backend | **FastAPI** + **Uvicorn** + Python 3.11 |
| Frontend | **Next.js 14** + **TypeScript** + **Tailwind CSS** |
| Graph viz | **react-force-graph-2d** — canvas rendering, custom node/edge draw |
| Charts | **Recharts** — bi-temporal trust sparklines |
| Real-time | **WebSocket** — live graph events from backend to UI |

---

<div align="center">

*Built with ❤ for WeMakeDevs × Cognee Hackathon 2026*  
*Powered by Cognee Cloud · Gemini 2.0 Flash · Next.js 14 · FastAPI*

</div>
