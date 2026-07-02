"""
llm.py — Google Gemini integration for NPC response generation.
Uses google-generativeai with structured JSON output mode to guarantee
parse-safe NPC responses matching NPCResponsePayload schema.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import google.generativeai as genai
from dotenv import load_dotenv

from backend.schemas import NPCResponsePayload

load_dotenv()

logger = logging.getLogger("revenant.llm")

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

MODEL = "gemini-2.0-flash"

# ---------------------------------------------------------------------------
# JSON schema for structured Gemini output
# ---------------------------------------------------------------------------

NPC_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "dialogue": {
            "type": "string",
            "description": (
                "The character's spoken response. In-character, sharp, "
                "under 120 words. No markdown, no asterisks, no stage directions."
            ),
        },
        "citation_justification": {
            "type": "string",
            "description": (
                "Internal narrative: which memory node / document_id or "
                "recalled event influenced this response."
            ),
        },
        "trust_score_delta": {
            "type": "integer",
            "description": (
                "Trust change this turn. Range -20 to +20. "
                "Negative = hostile. Positive = friendly."
            ),
        },
        "action": {
            "type": "string",
            "enum": ["none", "warn_others", "refuse_service", "call_guard"],
            "description": "NPC reactive action beyond dialogue.",
        },
        "is_rumor_sourced": {
            "type": "boolean",
            "description": (
                "True if the NPC is drawing on a rumor rather than "
                "a direct personal interaction."
            ),
        },
    },
    "required": [
        "dialogue",
        "citation_justification",
        "trust_score_delta",
        "action",
        "is_rumor_sourced",
    ],
}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_npc_response(
    system_prompt: str,
    player_message: str,
    npc_name: str,
) -> tuple[str, int, str]:
    """
    Generate a structured NPC response using Gemini JSON mode.
    Returns: (dialogue_text, trust_delta, action)
    Never raises on parse failure — falls back gracefully.
    """
    logger.info(f"LLM: generating response for {npc_name} via Gemini")

    full_prompt = (
        f"{system_prompt}\n\n"
        f"Player says: {player_message}\n\n"
        "Respond as this NPC using the structured JSON format. "
        "Keep dialogue under 120 words and fully in character."
    )

    try:
        model = genai.GenerativeModel(
            model_name=MODEL,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=NPC_RESPONSE_SCHEMA,
                temperature=0.85,
                max_output_tokens=512,
            ),
        )

        response = model.generate_content(full_prompt)
        raw = response.text.strip()

        data = json.loads(raw)
        payload = NPCResponsePayload(**data)

        # Clamp trust delta to valid range
        clamped_delta = max(-20, min(20, payload.trust_score_delta))

        logger.info(
            f"LLM: {npc_name} delta={clamped_delta} "
            f"action={payload.action} rumor={payload.is_rumor_sourced}"
        )
        return payload.dialogue, clamped_delta, payload.action

    except json.JSONDecodeError as e:
        logger.error(f"Gemini JSON parse error for {npc_name}: {e}")
        return _fallback_response(npc_name)
    except Exception as e:
        logger.error(f"Gemini API error for {npc_name}: {e}")
        return _fallback_response(npc_name)


def _fallback_response(npc_name: str) -> tuple[str, int, str]:
    """Safe fallback when LLM call fails — never crashes the game loop."""
    return (
        f"{npc_name} regards you in silence for a moment.",
        0,
        "none",
    )


# ---------------------------------------------------------------------------
# Provenance query helper
# ---------------------------------------------------------------------------

async def generate_provenance_narrative(
    npc_name: str,
    citation_chain: list[dict],
    graph_context: str,
) -> str:
    """
    Generate a narrative NPC response for 'who told you?' queries.
    Uses the graph traversal citation chain to craft a believable in-world explanation.
    """
    chain_text = "\n".join(
        f"  Step {c['step']}: [{c['type']}] {c['document_id']} — {c['content_preview']}"
        for c in citation_chain
    )

    prompt = (
        f"You are {npc_name}. A player has asked how you know something suspicious about them.\n"
        f"You have traced the information through this memory chain:\n\n"
        f"{chain_text}\n\n"
        f"Respond in character. Reference your source naturally "
        f"(e.g. 'Silas came to me this morning...''). "
        f"Keep it under 60 words. Speak only dialogue — no stage directions, no asterisks."
    )

    try:
        model = genai.GenerativeModel(
            model_name=MODEL,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                max_output_tokens=150,
            ),
        )
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Provenance narrative error: {e}")
        return "I have my sources. Let's leave it at that."
