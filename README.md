# 🧠 REVENANT
### Cognitive Middleware Infrastructure for Multi-Agent Systems

> Revenant proves that graph-vector memory can power emergent social AI at zero scripting cost — a pattern applicable to any multi-agent system where agents must share evolving context.

**[▶ Play Live](https://revenant.vercel.app)** · **[Demo Video →](https://www.youtube.com/watch?v=MPwkMDQzNWQ)** · WeMakeDevs × Cognee Hackathon 2026

---

## What Is This?

**Revenant** is a cognitive middleware architecture demonstrating how hybrid graph-vector memory pipelines can replace brittle, hardcoded script state in multi-agent environments. Using a living medieval game world as its target demonstration vehicle, it proves that autonomous agents can dynamically acquire, propagate, and forget social context without handwritten dialogue trees or database flags.

Every interaction — a betrayal, a bribe, a secret shared — is written into a hybrid graph-vector knowledge store powered by [Cognee Cloud](https://cognee.ai). Rumors propagate across the NPC agent network through Cognee's graph enrichment pipeline. A player or external coordinator can surgically prune a specific memory vector from an agent's mind for a resource cost (50 gold), verifying the wipe dynamically.

There are two interfaces to interact with the engine:

- **`/world`** — The 3D isometric simulation (Three.js + React Three Fiber). Walk around Ashenvale, approach agents, and trigger interactions. The knowledge graph, chat log, rumor mill, and memory pruning controls are overlaid as a simulation HUD.
- **`/play`** — The full analytical dashboard. Three-panel layout: agent interaction loop with streaming responses, live force-directed knowledge graph, engine controls, and Cognee API call monitor.

---

## The Problem

Autonomous agents in multi-agent systems are typically stateless or locked into narrow, isolated vector retrieval pipelines. Establishing relational trust, tracing rumor propagation, and targeted memory pruning (forgetting) traditionally require complex orchestration, custom databases, and brittle hardcoded state triggers. This does not scale to complex, emergent social networks.

---

## How It Works

### The Cognee Memory Loop

Every time you talk to an NPC, four things happen in sequence:

```
Player message
      │
      ▼
1. recall(GRAPH_COMPLETION)      — NPC queries its own memory graph for context
      │                            Multi-hop traversal: Player→events→NPCs
      ▼
2. Gemini 2.0 Flash (streaming)  — NPC responds in-character using recalled context
      │                            Structured JSON: {dialogue, trust_delta, action}
      ▼
3. remember() × 4 typed entries  — The interaction is written back to Cognee Cloud:
      │                            · qa          → the dialogue exchange itself
      │                            · feedback    → trust delta & behavioral note
      │                            · trace       → reasoning trace for GRAPH_COMPLETION
      │                            · skill_run   → action taken (betray/help/bribe…)
      ▼
4. Trust update + WebSocket push — Trust score updates live in the UI
```

### The Three Core Mechanics

#### 🌐 Rumor Mill — `improve()` as a game mechanic
When a player betrays Silas:
1. A `skill_run` typed memory is seeded into Cognee as a rumor entry
2. `POST /api/v1/cognify` fires (Cognee's `improve()`) — async, non-blocking
3. Cognee's graph enrichment creates cross-NPC edges (Silas → Kael)
4. Kael's next `recall()` surfaces the rumor: *"I've heard things about you…"*
5. A WebSocket event pushes the orange animated edge to the live graph

This is **not scripted**. The rumor propagation topology emerges from Cognee's graph enrichment, not from handwritten trigger logic.

#### 🫧 Amnesia Spell — `forget()` at `document_id` granularity
1. Player opens the Amnesia modal and browses an NPC's memories (typed: `qa`, `feedback`, `trace`, `skill_run`)
2. Player selects a specific memory and pays the gold cost
3. `DELETE /memories/{npc}/{document_id}` issues `POST /api/v1/forget` with the `dataId`
4. A follow-up `recall()` verifies the memory is gone — returns `verified_deleted: bool`
5. The graph node dissolves in the UI with a CSS animation
6. The NPC's next `recall()` returns clean — it genuinely does not remember

#### ⛓ Provenance Chain — `GRAPH_COMPLETION` multi-hop traversal
When you ask *"Who told you about me?"*:
1. The backend detects provenance trigger phrases
2. `recall(search_type=GRAPH_COMPLETION)` traverses the graph: Player → event node → Silas → rumor edge → Kael
3. The citation chain is returned with real `source_document` chunk provenance IDs
4. The NPC answers with a traced, graph-grounded response

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser                                     │
│                                                                 │
│  /world  (Three.js isometric game)                             │
│  ├─ Canvas: Player, NPCs, World tiles (React Three Fiber)       │
│  ├─ OrbitControls: right-click camera rotation, scroll zoom     │
│  ├─ HUD overlay: chat log, trust bars, graph, rumor/amnesia     │
│  └─ Zustand: playerPos, activeNpc shared between canvas & HUD   │
│                                                                 │
│  /play  (analytical 3-panel UI)                                 │
│  ├─ NPCPanel: trust sparklines, trajectory, per-NPC history     │
│  ├─ DialoguePanel: SSE streaming, citation log                  │
│  ├─ GraphPanel: react-force-graph-2d, dissolve/pulse animations  │
│  └─ EngineControls: rumor mill, time skip, amnesia modal        │
│                                                                 │
│              REST + SSE + WebSocket                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                   FastAPI Backend                               │
│                                                                 │
│  main.py          — All HTTP routes + WebSocket manager         │
│  npc_engine.py    — recall() → Gemini stream → remember() × 4  │
│  rumor_mill.py    — seed injection → improve() → WS broadcast   │
│  cognee_client.py — All Cognee Cloud REST calls, timed & logged │
│  world_state.py   — In-memory trust, gold, day, session state   │
│  llm.py           — Gemini 2.0 Flash integration (streaming)    │
│  schemas.py       — Pydantic models for all request/response    │
│  ontology.ttl     — OWL ontology: NPC, TrustEdge, Rumor, Event  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS REST
┌───────────────────────▼─────────────────────────────────────────┐
│                  Cognee Cloud (AWS tenant)                      │
│                                                                 │
│  dataset_id   →  world_{session_id}       (per browser tab)     │
│  session_id   →  world_{id}_{npc_id}      (per NPC channel)     │
│  document_id  →  per interaction event   (amnesia target unit)  │
│                                                                 │
│  POST /api/v1/remember/entry  →  4 typed memory writes          │
│  POST /api/v1/recall          →  GRAPH_COMPLETION search        │
│  POST /api/v1/cognify         →  improve() graph enrichment     │
│  POST /api/v1/forget          →  surgical document deletion     │
│  POST /api/v1/ontology/apply  →  OWL schema enforcement         │
│  GET  /api/v1/datasets/{id}/graph  →  live graph data           │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/world/init` | Seed all 3 NPC backstories into Cognee Cloud. Must be called first. |
| `GET` | `/world/{id}/state` | Full snapshot: trust scores, gold, game day, NPC trajectories |
| `POST` | `/dialogue/stream` | SSE streaming dialogue. recall → Gemini → remember × 4 |
| `POST` | `/action` | Direct player action (betray/help/bribe). Bypasses LLM, writes memory directly |
| `POST` | `/rumor-mill` | Trigger `improve()` — seeds rumors, fires Cognee enrichment pipeline |
| `POST` | `/time-skip` | Advance game day. May auto-trigger rumor mill at thresholds |
| `GET` | `/trust/{npc_id}` | Trust score, trajectory (RISING/STABLE/FALLING), full history |
| `GET` | `/memories/{npc_id}` | List all memory documents for an NPC (for Amnesia modal) |
| `DELETE` | `/memories/{npc_id}/{doc_id}` | Cast Amnesia — `forget()` + verification recall |
| `GET` | `/graph/{world_id}` | Graph nodes + edges for react-force-graph-2d |
| `GET` | `/call-log` | Last 50 Cognee API calls with endpoint, latency, status |
| `WS` | `/ws/{world_id}` | Real-time events: `trust_update`, `rumor_injected`, `graph_updated`, `day_advanced` |

---

## Cognee Cloud Integration

All 10 Cognee API surfaces are used:

| Cognee API | How Revenant Uses It |
|---|---|
| `POST /api/v1/remember/entry` (type: `qa`) | Stores every dialogue exchange verbatim |
| `POST /api/v1/remember/entry` (type: `feedback`) | Stores trust deltas with behavioral annotation |
| `POST /api/v1/remember/entry` (type: `trace`) | Stores reasoning traces for GRAPH_COMPLETION traversal |
| `POST /api/v1/remember/entry` (type: `skill_run`) | Stores player actions + rumor seeds |
| `POST /api/v1/recall` (`GRAPH_COMPLETION`) | Multi-hop graph traversal for NPC context + provenance |
| `POST /api/v1/cognify` | `improve()` — graph enrichment pipeline, the Rumor Mill engine |
| `POST /api/v1/forget` | Surgical `document_id`-level deletion for the Amnesia spell |
| `POST /api/v1/ontologies` | Uploads OWL ontology schema (`ontology.owl`) to enforce graph entity extraction |
| `GET /api/v1/datasets/{id}/graph` | Live graph nodes + edges for the force-directed visualization |
| `GET /api/v1/sessions/{id}` | Cognitive diagnostics panel: Audits tokens, status, model, cost in real-time |
| `POST /dialogue/verify` | Zone of Truth truth-checker: Validates statements against Cognee knowledge base |
| `dataset_id` + `session_id` + `document_id` | All 3 Cognee scoping levels used simultaneously for multi-tenancy |

### Multi-tenancy Scoping
Every browser tab gets a unique `world_id` stored in `sessionStorage`. This maps to:
- `dataset_id = world_{world_id}` — isolates the entire world
- `session_id = world_{world_id}_{npc_id}` — isolates per-NPC memory channels
- `document_id = {npc_id}_{timestamp}_{type}` — enables surgical `forget()` targeting

---

## Cognee Cloud Console: Visualizing the Ontological Architecture

Revenant leverages Cognee Cloud's advanced console to visualize and audit the emergent graph state of our multi-agent world. The database structures memory and interactions into a strict, multi-layered semantic hierarchy:

### 1. Memory Schema (Semantic Extraction Mapping)
The console's **Memory Schema** tab shows how unstructured text events are parsed, categorized, and linked under `ashenvale_ontology` constraints:
* **Documents (TEXTDOCUMENT)**: The raw, immutable log entries of dialogues, actions, or skip-day events.
* **Chunks (DOCUMENTCHUNK)**: Segmented, semantic sentences containing facts or capabilities (e.g., `"Elara can ENCHANT_ITEM..."`, `"Kael is the Captain of the Guard..."`, `"Kael can ARREST_PLAYER..."`).
* **Entities (CONCEPT / CURRENCYAMOUNT / DOCUMENT)**: Concrete extracted arguments and instances (e.g., Concept: `"illegal enchantments"`, `"forbidden magic"`; CurrencyAmount: `"200 gold"`; Document: `"kaels personal ledger"`).
* **Types (ENTITYTYPE)**: Schema classes classifying the concepts (e.g., `ability`, `person`, `organization`, `event`, `location`, `document`, `currencyamount`).
* **Summaries (TEXTSUMMARY)**: High-level summaries mapping chunks back to their parent document.

### 2. Mindmap (Emergent Relational Graph)
The **Mindmap** view renders a structured, force-directed graph of the entire world state (e.g., **77 nodes**, **196 edges**), organizing nodes into clear visual columns representing the data hierarchy:
* **Documents column** $\rightarrow$ **Chunks column** $\rightarrow$ **Entities column** $\rightarrow$ **Types column** $\rightarrow$ **Summaries column**.
* **Edge Semantics**: Edges represent explicit semantic relations (e.g., `contains`, `is_part_of`, `is_a`, `recorded_bribe_amount`, `covers_location`).
* **Cross-linking**: Select an instance chunk (e.g., `"Elara is the court mage..."`) to trace its connections to entities like `"silass daughter"` or types like `"person"`, showing how Cognee generates multi-hop context for agent reasoning.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Memory & Knowledge | Cognee Cloud | Hybrid graph-vector store, `improve()`, `forget()`, multi-hop recall |
| LLM | Gemini 2.0 Flash | Streaming SSE, JSON structured output, NPC persona injection |
| Backend | FastAPI + Python 3.11 | Async from ground up, WebSocket support, Pydantic validation |
| Frontend | Next.js 14 + TypeScript | SSR + client components, dynamic imports for Three.js |
| 3D World | Three.js + React Three Fiber + Drei | Isometric voxel world, OrbitControls, camera-relative movement |
| Graph Viz | react-force-graph-2d | Canvas-based force graph, custom node painters, dissolve + pulse animations |
| Game State | Zustand | Shared state between 3D canvas and HUD overlay without prop drilling |
| Real-time | WebSocket + SSE | Streaming NPC dialogue tokens + live graph/trust event broadcast |
| Styling | Tailwind CSS + Vanilla CSS | Tailwind for /play, hand-crafted RuneScape-style CSS for /world HUD |

---

## Engineering Highlights

### Custom Schema Grounding via OWL Ontology
Revenant compiles its custom game ontology (`ontology.ttl`) into RDF/XML (`ontology.owl`) and uploads it to Cognee Cloud on startup using `POST /api/v1/ontologies`. During `cognify` runs, we pass `ontology_key: ["ashenvale_ontology"]` to constrain the LLM's graph building, ensuring all extracted entities strictly conform to our gameplay model (`NPC`, `Player`, `TrustEdge`, `Rumor`, `InteractionEvent`).

### Robust Sequential World Seeding
To shield Cognee Cloud from resource contention and database locks during concurrent world initialization, NPC seeding is run **sequentially with a 1-second delay** between them. Furthermore, we equipped `_post_remember` with an **exponential backoff retry loop** that transparently absorbs transient rate limits or timeout spikes, making initialization 100% fail-safe.

### Real-time Session Telemetry & Cost Audit
Querying Cognee Cloud's `/api/v1/sessions/{session_id}` endpoint, the frontend exposes a real-time **Cloud Audit** diagnostics panel. Clicking it displays active session status, tokens used (input vs output), estimated USD API cost, and model types directly from the Cognee Cloud metrics database.

### Streaming Dialogue & Live Evidence Overlay
`/dialogue/stream` is a Server-Sent Events endpoint that streams Gemini tokens in real-time. In the same done payload, it returns the exact semantic citations and provenance steps Cognee recalled. In the 3D HUD, players can click `[📎 Source]` on any dialogue bubble to expand a medieval parchment panel showing Cognee's evidence trail.

### Verified Amnesia Deletion
`cast_amnesia()` issues a follow-up `recall()` after `forget()` and returns `verified_deleted: bool`. The UI shows *"✓ Memory erased and verified gone"* vs *"Deletion pending"* based on Cognee Cloud graph propagation speed.

### Zone of Truth (Lore Fact-Checker)
Players can cast the **Zone of Truth** spell (costs 10 Gold) directly on any statement. It runs `cognee.recall` to fetch relevant graph context, uses Gemini 2.0 to judge it as `TRUE`, `FALSE`, or `UNKNOWN` against the NPC's actual memory graph, and commits a `trace` audit event back to Cognee Cloud so the NPC remembers being questioned.

### Camera-Relative WASD Movement
The 3D world uses `useThree()` to read the camera's live forward direction each frame, then projects WASD inputs onto that direction using cross-products. W always moves "into the screen" regardless of how you've rotated the camera with right-click drag — exactly like RuneScape.

### Live Cognee Call Monitor
Every Cognee REST call is recorded in a module-level `deque(maxlen=50)` with endpoint, latency, and HTTP status. Accessible at `GET /call-log` and displayed in the `/play` graph panel under "COGNEE CALL MONITOR".

### Bi-temporal Trust
Every trust change is annotated with `valid_from` ISO timestamp and `game_day`. Trust history is tracked as a time-series and displayed as a sparkline on the NPC panel.

### Dynamic RPG Reputation Title
Calculates the player's average social standing across all NPCs in real-time and renders a gold-framed rank badge (🏆 Hero, Outlaw, or Wanderer) inside the game HUD.

---

## Project Structure

```
revenant/
├── backend/
│   ├── main.py           # FastAPI app, all routes, WebSocket manager
│   ├── npc_engine.py     # Core dialogue loop: recall → Gemini → remember × 4
│   ├── rumor_mill.py     # improve() mechanic, cross-NPC seed injection
│   ├── cognee_client.py  # All Cognee Cloud REST calls, timed + logged
│   ├── world_state.py    # In-memory game state: trust, gold, day, sessions
│   ├── llm.py            # Gemini 2.0 Flash integration, streaming + JSON mode
│   ├── schemas.py        # Pydantic request/response models
│   └── ontology.ttl      # OWL ontology: NPC, Player, TrustEdge, Rumor, Event
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── play/page.tsx     # 3-panel analytical game UI
│   │   ├── world/page.tsx    # 3D isometric game entry point
│   │   ├── globals.css       # Design system, Tailwind base
│   │   └── world-hud.css     # RuneScape-style HUD overlay CSS
│   │
│   ├── components/
│   │   ├── game/
│   │   │   ├── World.tsx         # Three.js Canvas, lights, OrbitControls
│   │   │   ├── WorldTiles.tsx    # Voxel world: grass, buildings, trees, paths
│   │   │   ├── Player.tsx        # Armored knight, camera-relative WASD
│   │   │   ├── NPCCharacter.tsx  # Animated NPC voxel characters
│   │   │   ├── HUD.tsx           # Full game HUD: chat, graph, actions
│   │   │   └── store.ts          # Zustand: playerPos, activeNpc
│   │   │
│   │   ├── GraphPanel.tsx        # react-force-graph-2d, node painters
│   │   ├── DialoguePanel.tsx     # SSE streaming dialogue, citation log
│   │   ├── NPCPanel.tsx          # Trust sparklines, trajectories
│   │   ├── AmnesiaModal.tsx      # Memory browser + forget() UI
│   │   ├── EngineControls.tsx    # Rumor mill, time skip buttons
│   │   └── CallLogPanel.tsx      # Live Cognee API call monitor
│   │
│   └── lib/
│       ├── api.ts            # Typed API client for all backend routes
│       ├── types.ts          # Shared TypeScript types
│       └── useGameSocket.ts  # WebSocket hook for real-time events
│
├── scripts/
│   └── smoke_test.py     # Verifies Cognee Cloud connectivity before deploy
│
├── .env.example          # Required env vars template
├── docker-compose.yml    # One-command local deployment
└── requirements.txt      # Python dependencies
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Cognee Cloud account with API key
- A Google Gemini API key

### Environment Variables
```bash
cp .env.example .env
```

Fill in `.env`:
```env
COGNEE_CLOUD_BASE=https://api.cognee.ai
COGNEE_API_KEY=your_cognee_api_key
COGNEE_TENANT_ID=your_tenant_id
GEMINI_API_KEY=your_gemini_api_key
```

### Run Locally

```bash
# Backend
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000/world** for the 3D game or **http://localhost:3000/play** for the full UI.

### Docker

```bash
docker-compose up --build
```

### Verify Cognee Connection
```bash
python scripts/smoke_test.py
```

Runs HARD checks (remember, add_text, GRAPH_COMPLETION recall) against live Cognee Cloud. Latest result: **4/4 HARD checks pass**.

> Soft failures (`cognify` 500 `ProgrammingError`, `recall CHUNKS` 409) are transient Cognee Cloud infrastructure issues in their async graph indexing pipeline. The backend handles them with automatic fallback: `GRAPH_COMPLETION → CHUNKS → empty context`.

---

## Controls (3D World)

| Input | Action |
|---|---|
| `WASD` | Move player (camera-relative) |
| Right-click drag | Rotate camera |
| Scroll wheel | Zoom in/out |
| Walk near NPC | Opens dialogue panel |
| `Enter` | Send message to NPC |
| 🌐 Rumor button | Trigger rumor mill — spread info between NPCs |
| ⏩ Day+1 button | Advance game day, update gold |
| 🫧 Amnesia button | Browse and erase NPC memories |
| 📊 Graph button | Toggle knowledge graph panel |

---

*Built for WeMakeDevs × Cognee Hackathon 2026. AI assistance declared per hackathon rules.*
