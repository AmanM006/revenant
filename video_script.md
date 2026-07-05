# 🎬 Revenant — 3-Minute Hackathon Demo Script

This script and storyboard are optimized to fit exactly under the **3-minute limit** while showcasing every feature, our architecture, and our open-source contribution to Cognee.

---

## ⏱️ Video Breakdown

*   **0:00 - 0:30**: Hook & The Core Problem
*   **0:30 - 0:55**: Tech Stack & Cognitive Architecture
*   **0:55 - 2:35**: Live Feature Demo (Dialogue, Rumors, Provenance, Zone of Truth, Amnesia, Cost Audit)
*   **2:35 - 3:00**: Open-Source Contribution & Outro

---

## 📽️ Scene-by-Scene Script & Storyboard

### **Part 1: The Hook & The Problem (0:00 - 0:30)**

| 📺 What to Show on Screen | 🎙️ What to Say (Vocal Narration) |
| :--- | :--- |
| **[0:00 - 0:10]**<br>Open on the beautiful landing page (`revenant-game.vercel.app`), then scroll down slightly to show Silas's portrait. | *"Ever since 1980, video game NPCs have shared a common affliction: eternal amnesia. No matter how many times you save their village or betray their trust, reloading a session resets their memory to zero."* |
| **[0:10 - 0:30]**<br>Transition into the **3D World Interface** (`/world`). Walk the player character up to Silas's forge in the isometric voxel town. | *"Meet **Revenant**—a cognitive state engine that gives NPCs persistent, evolving, and interconnected memories. Built for the Cognee Hackathon, it turns game worlds into living knowledge graphs where actions propagate and memories persist across sessions."* |

---

### **Part 2: Tech Stack & Architecture (0:30 - 0:55)**

| 📺 What to Show on Screen | 🎙️ What to Say (Vocal Narration) |
| :--- | :--- |
| **[0:30 - 0:40]**<br>Briefly display the architecture diagram or highlight the **API Telemetry log** at the right side of the screen. | *"Revenant’s architecture links **Next.js** and a **FastAPI** backend directly to **Cognee Cloud**. Every event, dialogue, and player action is structured as semantic ontology entries (QA, traces, and feedback) and fed into Cognee's vector-graph pipeline."* |
| **[0:40 - 0:50]**<br>Switch tabs to the **Cognee Cloud Console** under `world_ashenvale`. In **Memory Schema**, point out the extraction pipeline: `TEXTDOCUMENT` (raw inputs) $\rightarrow$ `DOCUMENTCHUNK` (factual statements like *"Elara can ENCHANT_ITEM..."*) $\rightarrow$ `CONCEPT`/`CURRENCYAMOUNT` (like *"200 gold"*). Then, switch to the **Mindmap** view to show the 77-node, 196-edge structured layout, hovering over the `contains` relationship edge between the chunk *"Elara is the court mage..."* and the entity node `"silass daughter"`. | *"Here is the live Cognee Cloud console. It automatically parses our raw text events into a structured 5-column ontology—mapping raw documents to semantic chunks like Elara's magical abilities, extracting entity values like '200 gold', and grounding them under our custom schema. Under the Mindmap tab, we can trace all 196 relationships live, showing how a specific dialogue chunk dynamically links to Silas's daughter in the graph."* |
| **[0:50 - 1:00]**<br>Hover over a live node in the game's **Real-Time Knowledge Graph** panel on the page. | *"NPCs use Gemini 2.5 for context-aware dialogue, querying their Cognee graph via multi-tenant sessions to determine how much they trust you before they speak."* |

---

### **Part 3: Live Feature Demo (0:55 - 2:35)**

| 📺 What to Show on Screen | 🎙️ What to Say (Vocal Narration) |
| :--- | :--- |
| **[0:55 - 1:15]**<br>**1. PERSISTENT DIALOGUE**<br>Click Silas the Blacksmith. Type a message like: *"I will pay you double next week if you forge a sword now."* Show the dialogue streaming in real-time, pointing out the **Cognee API Log** capturing `remember` entries. | *"Let's test Silas. We ask him to forge a sword on credit. The backend streams a structured Gemini dialogue response while writing a QA entry directly into Silas's session memory. His trust score fluctuates dynamically based on our promise."* |
| **[1:15 - 1:35]**<br>**2. RUMOR MILL & PROPAGATION**<br>Click Silas's action panel and select **Steal Gold** or run an action that drops trust below 40. Show the **2D Knowledge Graph** panel dynamically draw new orange edges spreading from Silas to Elara. | *"But what if we betray him? If our trust score drops below 40, Silas triggers the **Rumor Mill**. An asynchronous Cognee pipeline propagates our crime across graph edges, warning Elara and Kael. You can watch the warning links form live on the interactive graph."* |
| **[1:35 - 1:55]**<br>**3. PROVENANCE CHAIN**<br>Walk to Kael the Guard Captain. Open chat and ask: *"Why are you looking at me like that?"* Kael confronts the player. Click **`[🔗 Source]`** under his text to reveal the exact Cognee reference paths. | *"When we approach Kael, he's already hostile. Asking how he knows this invokes a Cognee `recall` with `GRAPH_COMPLETION` multi-hop traversal. The engine resolves the citation path (Player -> Silas -> Kael) showing exactly who told who, when, and why."* |
| **[1:55 - 2:15]**<br>**4. ZONE OF TRUTH SPELL**<br>Type a lore query like: *"Silas owes Elara a favor."* Click **`⚖️ Truth (10g)`**. Show the verdict pop up as **`TRUE`** with the explanation from his backstory. | *"We also built the **Zone of Truth** fact-checker. For 10 gold, you can test any statement. The backend queries Silas's memories and backstory, returning a verified verdict of True, False, or Unknown with reasoning. Silas owes Elara a life-debt, and the spell proves it."* |
| **[2:15 - 2:25]**<br>**5. AMNESIA SPELL & COST AUDIT**<br>Click **`🧠 Cloud Audit`** to open the diagnostics drawer. Show the cumulative USD cost and token usages. Then, click **`Forget Memory`** next to the theft. Show the node dissolve. | *"If things go sideways, cast the **Amnesia Spell**. By paying 50 gold, Cognee severs the memory's `document_id`. The node dissolves on our graph, and a re-verification check confirms the wipe. Open the **Cloud Audit** to see real-time Cognee session telemetry and cumulative API costs!"* |
| **[2:25 - 2:35]**<br>**6. CHAT UI MODE**<br>Quickly switch tabs or load the `/play` page. Show a mobile-friendly conversational interface. | *"If you prefer a direct text interface, we also built a clean, conversational Chat UI mode. It integrates all the same Cognee memory paths, session telemetry logs, and graph visualization in a distraction-free screen layout."* |

---

### **Part 4: Open-Source Contribution & Outro (2:35 - 3:00)**

| 📺 What to Show on Screen | 🎙️ What to Say (Vocal Narration) |
| :--- | :--- |
| **[2:35 - 2:48]**<br>Show **GitHub Pull Request #3854** on the screen (the fix in Cognee's `pipeline.py`). | *"During development, we hit a race condition when calling forget followed by cognify, locking datasets in error states. We raised Issue #3853 and contributed a Pull Request directly to Cognee's main repository to auto-recover errored pipeline runs."* |
| **[2:48 - 2:58]**<br>Highlight the **ontology file (ontology.owl)** or backend schema files on the screen. | *"This hackathon taught us how to model complex OWL ontologies and handle real-world asynchronous database lockups, ensuring game systems remain robust and cost-transparent even under heavy LLM load."* |
| **[2:58 - 3:08]**<br>Zoom out to show the whole screen dashboard. Display the GitHub repo URL and the deployed link. | *"Revenant shows how Cognee Cloud changes NPC behaviors from scripted machines to evolving minds. Check out our repository and deploy your own cognitive worlds today. Thank you!"* |

---

## 💡 Pro-Tips for Recording the Demo

1.  **Zoom In**: Zoom your browser to about 110% or 120% so the text on the panels, graph nodes, and API logs is readable in 1080p.
2.  **Run Locally or Live**: You can record on the live URL `https://revenant-game.vercel.app` or your local `http://localhost:3000`. Both run the same production-grade features.
3.  **Prepare a Seeded State**: Before you hit record, initialize the world, run 1-2 interactions, and have some gold ready, so you don't waste precious video seconds waiting for initial seeds to complete.
