"""
llm.py — Google Gemini via google-genai SDK.
Uses plain JSON-in-prompt mode (no response_schema) for maximum compatibility.
response_schema + thinking_budget=0 conflicts on gemini-2.5-flash — avoid it.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

from google import genai
from google.genai import types
from dotenv import load_dotenv

from backend.schemas import NPCResponsePayload

load_dotenv()

logger = logging.getLogger("revenant.llm")

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))

# All confirmed available for this key
MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]

# ---------------------------------------------------------------------------
# System instruction — shared across all NPC calls
# ---------------------------------------------------------------------------

_SYSTEM = (
    "You are an NPC in a text RPG. You MUST respond with ONLY a valid JSON object. "
    "No markdown, no code fences, no explanation — just raw JSON. "
    "The JSON must have these exact fields:\n"
    '  "dialogue": string (your spoken response, under 120 words, fully in character),\n'
    '  "citation_justification": string (which memory influenced this),\n'
    '  "trust_score_delta": integer (-20 to 20, negative = hostile),\n'
    '  "action": one of ["none","warn_others","refuse_service","call_guard"],\n'
    '  "is_rumor_sourced": boolean\n'
    "Output ONLY the JSON. Nothing before or after it."
)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_npc_response(
    system_prompt: str,
    player_message: str,
    npc_name: str,
) -> tuple[str, int, str]:
    """
    Generate a structured NPC response. Never raises — always returns a tuple.
    """
    logger.info(f"LLM: generating response for {npc_name}")

    contents = f"{system_prompt}\n\nPlayer says: \"{player_message}\"\n\nRespond with ONLY a JSON object."

    last_err = ""
    for model_name in MODELS:
        try:
            response = _client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=_SYSTEM,
                    temperature=0.9,
                    max_output_tokens=600,
                ),
            )
            result = _parse_response(response.text, npc_name, model_name)
            if result:
                return result
        except Exception as e:
            last_err = str(e)
            if any(k in last_err for k in ("RESOURCE_EXHAUSTED", "429", "quota")):
                logger.warning(f"Rate limit on {model_name}, trying next...")
                continue
            logger.error(f"Gemini error ({model_name}) for {npc_name}: {e}")
            # Try next model on any error
            continue

    logger.warning(f"All models failed for {npc_name}. Last error: {last_err[:200]}")
    return _fallback(npc_name)


def _parse_response(text: Optional[str], npc_name: str, model: str) -> Optional[tuple[str, int, str]]:
    """Extract JSON from model output. Returns None if unparseable."""
    if not text:
        logger.warning(f"Empty response from {model} for {npc_name}")
        return None

    raw = text.strip()
    # Strip markdown code fences
    raw = re.sub(r"^```(?:json)?\s*\n?", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\n?```\s*$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    # Extract first JSON object if there's extra text
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        raw = match.group(0)

    try:
        data = json.loads(raw)
        payload = NPCResponsePayload(**data)
        delta = max(-20, min(20, payload.trust_score_delta))
        logger.info(f"LLM: {npc_name} delta={delta} action={payload.action} model={model}")
        return payload.dialogue, delta, payload.action
    except Exception as e:
        logger.warning(f"JSON parse failed ({model}) for {npc_name}: {e} | raw={raw[:150]}")
        return None


def _fallback(npc_name: str) -> tuple[str, int, str]:
    return (f"{npc_name} eyes you carefully, then speaks in measured tones.", 0, "none")


# ---------------------------------------------------------------------------
# Provenance query helper
# ---------------------------------------------------------------------------

async def generate_provenance_narrative(
    npc_name: str,
    citation_chain: list[dict],
    graph_context: str,
) -> str:
    """Generate 'who told you?' response from citation chain."""
    chain_text = "\n".join(
        f"  Step {c['step']}: {c['content_preview']}"
        for c in citation_chain
    )
    prompt = (
        f"You are {npc_name}. A player asked how you know something suspicious about them.\n"
        f"Your memory chain:\n{chain_text}\n\n"
        "Reply in character, referencing your source (e.g. 'Silas came to me this morning...'). "
        "Under 60 words. Plain speech only."
    )
    for model_name in MODELS:
        try:
            response = _client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=150,
                ),
            )
            if response.text:
                return response.text.strip()
        except Exception as e:
            if any(k in str(e) for k in ("RESOURCE_EXHAUSTED", "429", "quota")):
                continue
            break
    return "I have my sources. Best leave it at that."
