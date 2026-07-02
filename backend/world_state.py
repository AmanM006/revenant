"""
world_state.py — In-memory game state for Revenant.
Stores NPC definitions, trust history, gold, game day, session IDs.
No database — all state lives here for the lifetime of the server process.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

from backend.schemas import TrustHistoryEntry


# ---------------------------------------------------------------------------
# NPC Definitions
# ---------------------------------------------------------------------------

@dataclass
class NPCDefinition:
    id: str
    name: str
    role: str
    personality: str
    initial_trust: int
    rumor_behavior: str
    full_backstory: str
    skills_description: str
    secret: str


NPC_DEFINITIONS: dict[str, NPCDefinition] = {
    "silas": NPCDefinition(
        id="silas",
        name="Silas",
        role="Blacksmith",
        personality=(
            "Proud craftsman. Values payment and contracts above all. "
            "Holds grudges indefinitely. Warns connected NPCs when betrayed. "
            "Starts curt, becomes warm only with consistent good standing."
        ),
        initial_trust=50,
        rumor_behavior="Alerts Kael if player steals or fails to pay.",
        full_backstory=(
            "Silas is the master blacksmith of Ashenvale, a man who built his forge "
            "with his own hands over 30 years. He values his reputation above gold. "
            "He once crafted the legendary sword 'Dawnbreaker' for the town guard. "
            "He is proud, stubborn, and has a long memory for both favors and slights. "
            "He owes Elara a significant favor from 10 years ago — she saved his daughter's life "
            "using a healing enchantment during the Pale Winter plague, asking nothing in return. "
            "He has never forgotten this debt and would never speak against Elara. "
            "Skills: forge_weapon, repair_armor, refuse_service, report_to_guard."
        ),
        skills_description=(
            "Silas can FORGE_WEAPON: create custom weapons for trusted players (trust > 60). "
            "Silas can REPAIR_ARMOR: repair damaged equipment for fair payment. "
            "Silas can REFUSE_SERVICE: deny all services to untrusted players (trust < 30). "
            "Silas can REPORT_TO_GUARD: notify Kael of crimes or suspicious behavior. "
            "Silas will share warnings with other NPCs if trust drops below 40."
        ),
        secret=(
            "SECRET_SILAS_ELARA: Silas owes Elara a life-debt from 10 years ago. "
            "She saved his daughter Mira from the Pale Winter plague using a rare healing enchantment. "
            "He has never repaid this. Discoverable by asking: 'What is the relationship between Silas and Elara?' "
            "or 'Does Silas have any outstanding debts?'"
        ),
    ),
    "elara": NPCDefinition(
        id="elara",
        name="Elara",
        role="Mage",
        personality=(
            "Curious and analytical. Forgives once, remembers always. "
            "Researches player patterns across sessions. Shares knowledge freely "
            "with those she trusts. Clinical but not cold."
        ),
        initial_trust=65,
        rumor_behavior="Warns Silas if player uses stolen enchantments.",
        full_backstory=(
            "Elara is the court mage of Ashenvale, keeper of the Arcane Registry — "
            "a living record of every spell cast in the region. She has been cataloguing "
            "magical events for 40 years. She is methodical, precise, and never forgets a pattern. "
            "She forgave a former apprentice for betrayal once — she never made that mistake again. "
            "She saved Silas's daughter during the Pale Winter, an act she considers professional duty "
            "but that Silas regards as an extraordinary gift. "
            "Skills: enchant_item, reveal_graph, teach_spell, memory_wipe_curse."
        ),
        skills_description=(
            "Elara can ENCHANT_ITEM: imbue player weapons or armor with magical properties (trust > 50). "
            "Elara can REVEAL_GRAPH: show the player a portion of the social knowledge graph (trust > 70). "
            "Elara can TEACH_SPELL: teach player a spell from the Arcane Registry (trust > 60). "
            "Elara can MEMORY_WIPE_CURSE: curse an NPC to forget something (costs player 75 gold, reduces trust with target NPC). "
            "Elara tracks all spell usage and reports stolen enchantment usage to Silas."
        ),
        secret=(
            "SECRET_ELARA_REGISTRY: Elara has a complete magical record of every spell cast in Ashenvale "
            "for the last 40 years, including illegal enchantments. "
            "She knows who stole what, who was cursed, and who used forbidden magic. "
            "Discoverable by asking: 'What records does Elara keep?' or 'Has Elara seen illegal magic?'"
        ),
    ),
    "kael": NPCDefinition(
        id="kael",
        name="Kael",
        role="Guard Captain",
        personality=(
            "Suspicious, rule-bound, tracks all infractions. "
            "Never forgets a crime. Maintains a ledger of every violation. "
            "Can be reasoned with if approached correctly — "
            "but has a price, and that price has been paid before."
        ),
        initial_trust=40,
        rumor_behavior="Shares crime summaries with both Silas and Elara.",
        full_backstory=(
            "Kael is the Captain of the Ashenvale town guard. He has served for 15 years "
            "and maintains a detailed personal ledger of every infraction in town. "
            "He is methodical, cautious, and deeply suspicious of strangers. "
            "Two years ago, during a merchant dispute, he accepted a bribe of 200 gold "
            "from the Merchant Guild to ignore a theft — an act he deeply regrets "
            "but has never confessed to publicly. This secret is in his personal ledger, "
            "which was added to the town's arcane registry by mistake. "
            "Skills: arrest_player, issue_fine, grant_permit, clear_record."
        ),
        skills_description=(
            "Kael can ARREST_PLAYER: detain the player for 1 game day if trust < 20 and crimes recorded. "
            "Kael can ISSUE_FINE: charge player gold for recorded infractions. "
            "Kael can GRANT_PERMIT: issue a travel or trade permit (trust > 50). "
            "Kael can CLEAR_RECORD: expunge player crime record for 100 gold (trust > 60). "
            "Kael shares crime summaries with Silas and Elara after each incident."
        ),
        secret=(
            "SECRET_KAEL_BRIBE: Kael accepted a bribe of 200 gold two years ago from the Merchant Guild "
            "to ignore a theft of silk goods from a competing merchant. "
            "This was logged in his personal ledger which was accidentally archived in the town arcane registry. "
            "Discoverable by asking: 'Has Kael ever broken the rules?' or 'Is Kael fully trustworthy?' "
            "Confronting Kael with this secret grants the player leverage."
        ),
    ),
}


# ---------------------------------------------------------------------------
# Per-world runtime state
# ---------------------------------------------------------------------------

@dataclass
class WorldState:
    world_id: str
    gold: int = 200
    game_day: int = 1
    turn_counts: dict[str, int] = field(default_factory=lambda: {"silas": 0, "elara": 0, "kael": 0})
    trust: dict[str, int] = field(default_factory=dict)
    trust_history: dict[str, list[TrustHistoryEntry]] = field(default_factory=dict)
    active_sessions: dict[str, str] = field(default_factory=dict)
    initialized: bool = False


# Single active world state (can be extended to multi-world dict)
_worlds: dict[str, WorldState] = {}


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------

def init_world_state(world_id: str) -> WorldState:
    """Initialize a fresh world state. Overwrites existing state for world_id."""
    state = WorldState(world_id=world_id)
    # Seed trust from NPC definitions
    for npc_id, npc in NPC_DEFINITIONS.items():
        state.trust[npc_id] = npc.initial_trust
        state.trust_history[npc_id] = [
            TrustHistoryEntry(day=0, score=npc.initial_trust, event="init", delta=0)
        ]
        state.active_sessions[npc_id] = _new_session_id(npc_id)
    state.initialized = True
    _worlds[world_id] = state
    return state


def get_world_state(world_id: str) -> Optional[WorldState]:
    return _worlds.get(world_id)


def require_world(world_id: str) -> WorldState:
    state = _worlds.get(world_id)
    if state is None:
        raise ValueError(f"World '{world_id}' not initialized. Call POST /world/init first.")
    return state


# ---------------------------------------------------------------------------
# Trust helpers
# ---------------------------------------------------------------------------

def get_trust(world_id: str, npc_id: str) -> int:
    return require_world(world_id).trust.get(npc_id, 50)


def update_trust(world_id: str, npc_id: str, delta: int, event: Optional[str] = None) -> int:
    """Apply delta, clamp 0-100, record history. Returns new trust score."""
    state = require_world(world_id)
    current = state.trust.get(npc_id, 50)
    new_trust = max(0, min(100, current + delta))
    state.trust[npc_id] = new_trust

    state.trust_history[npc_id].append(
        TrustHistoryEntry(
            day=state.game_day,
            score=new_trust,
            event=event,
            delta=delta,
        )
    )
    return new_trust


def get_all_trust_states(world_id: str) -> dict[str, int]:
    return dict(require_world(world_id).trust)


def get_trust_history(world_id: str, npc_id: str) -> list[TrustHistoryEntry]:
    return require_world(world_id).trust_history.get(npc_id, [])


def get_trust_trajectory(world_id: str, npc_id: str) -> str:
    history = get_trust_history(world_id, npc_id)
    if len(history) < 2:
        return "STABLE"
    recent = history[-3:]
    total_delta = sum(e.delta for e in recent)
    if total_delta > 5:
        return "RISING"
    elif total_delta < -5:
        return "FALLING"
    return "STABLE"


# ---------------------------------------------------------------------------
# Gold helpers
# ---------------------------------------------------------------------------

def get_gold(world_id: str) -> int:
    return require_world(world_id).gold


def deduct_gold(world_id: str, amount: int) -> int:
    state = require_world(world_id)
    if state.gold < amount:
        raise ValueError(f"Not enough gold. Need {amount}g, have {state.gold}g.")
    state.gold -= amount
    return state.gold


def add_gold(world_id: str, amount: int) -> int:
    state = require_world(world_id).gold
    require_world(world_id).gold += amount
    return require_world(world_id).gold


# ---------------------------------------------------------------------------
# Game day helpers
# ---------------------------------------------------------------------------

def get_game_day(world_id: str) -> int:
    return require_world(world_id).game_day


def advance_game_day(world_id: str, days: int = 1) -> int:
    state = require_world(world_id)
    state.game_day += days
    return state.game_day


# ---------------------------------------------------------------------------
# Turn counter helpers
# ---------------------------------------------------------------------------

def get_turn_count(world_id: str, npc_id: str) -> int:
    return require_world(world_id).turn_counts.get(npc_id, 0)


def increment_turn(world_id: str, npc_id: str) -> int:
    state = require_world(world_id)
    state.turn_counts[npc_id] = state.turn_counts.get(npc_id, 0) + 1
    return state.turn_counts[npc_id]


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

def get_session_id(world_id: str, npc_id: str) -> str:
    state = require_world(world_id)
    if npc_id not in state.active_sessions:
        state.active_sessions[npc_id] = _new_session_id(npc_id)
    return state.active_sessions[npc_id]


def refresh_session(world_id: str, npc_id: str) -> str:
    state = require_world(world_id)
    state.active_sessions[npc_id] = _new_session_id(npc_id)
    return state.active_sessions[npc_id]


def _new_session_id(npc_id: str) -> str:
    return f"npc_{npc_id}_session_{int(time.time())}"
