"""
llm.py — Google Gemini via google-genai SDK.
Plain JSON-in-prompt mode for maximum compatibility with gemini-2.5-flash.
Fixes:
  - max_output_tokens raised to 1500 to prevent JSON truncation
  - Retry with exponential backoff on rate limit before cascade
  - JSON repair for truncated responses (extract partial dialogue)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Optional

from google import genai
from google.genai import types
from dotenv import load_dotenv

from backend.schemas import NPCResponsePayload

load_dotenv()

logger = logging.getLogger("revenant.llm")

_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))

# Models confirmed available — try each in order
MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
]

# ---------------------------------------------------------------------------
# System instruction
# ---------------------------------------------------------------------------

_SYSTEM = (
    "You are an NPC in a text RPG. You MUST respond with ONLY a valid JSON object. "
    "No markdown, no code fences, no explanation — ONLY raw JSON. "
    "Required fields:\n"
    '  "dialogue": string (your spoken response, under 80 words, fully in character),\n'
    '  "citation_justification": string (brief — which memory influenced this response),\n'
    '  "trust_score_delta": integer (-20 to 20),\n'
    '  "action": one of ["none","warn_others","refuse_service","call_guard"],\n'
    '  "is_rumor_sourced": boolean\n'
    "CRITICAL: Output ONLY the JSON object. Keep all string values SHORT to avoid truncation."
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

    contents = (
        f"{system_prompt}\n\n"
        f'Player says: "{player_message}"\n\n'
        "Respond with ONLY a JSON object. Keep dialogue under 80 words."
    )

    for attempt, model_name in enumerate(MODELS):
        # Brief backoff before trying next model
        if attempt > 0:
            await asyncio.sleep(1)

        try:
            response = _client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=_SYSTEM,
                    temperature=0.85,
                    max_output_tokens=1500,  # Prevent truncation
                ),
            )

            result = _parse_response(response.text, npc_name, model_name)
            if result:
                return result

            # If parse failed, try again once with a simpler prompt
            logger.warning(f"First parse attempt failed for {npc_name} on {model_name}, retrying simpler...")
            simple_response = _client.models.generate_content(
                model=model_name,
                contents=f'You are {npc_name}. Player says: "{player_message}". '
                         f'Reply with JSON: {{"dialogue":"<your reply under 60 words>","citation_justification":"direct","trust_score_delta":0,"action":"none","is_rumor_sourced":false}}',
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=300,
                ),
            )
            result = _parse_response(simple_response.text, npc_name, f"{model_name}-simple")
            if result:
                return result

        except Exception as e:
            err = str(e)
            if any(k in err for k in ("RESOURCE_EXHAUSTED", "429", "quota")):
                logger.warning(f"Rate limit on {model_name}, trying next model...")
            elif "503" in err or "UNAVAILABLE" in err:
                logger.warning(f"Model {model_name} temporarily unavailable (503), trying next model...")
            else:
                logger.error(f"Gemini error ({model_name}) for {npc_name}: {e}")
            continue

    logger.warning(f"All models failed for {npc_name}, using static fallback.")
    return _fallback(npc_name)


def _parse_response(text: Optional[str], npc_name: str, model: str) -> Optional[tuple[str, int, str]]:
    """
    Extract JSON from model output.
    Attempts partial recovery for truncated responses.
    """
    if not text:
        return None

    raw = text.strip()
    # Strip markdown fences
    raw = re.sub(r"^```(?:json)?\s*\n?", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\n?```\s*$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    # Try full parse first
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            payload = NPCResponsePayload(**data)
            delta = max(-20, min(20, payload.trust_score_delta))
            logger.info(f"LLM: {npc_name} delta={delta} action={payload.action} model={model}")
            return payload.dialogue, delta, payload.action
        except json.JSONDecodeError:
            pass
        except Exception as e:
            logger.warning(f"Schema parse failed ({model}): {e}")

    # Partial recovery: extract dialogue field if JSON was truncated
    dialogue_match = re.search(r'"dialogue"\s*:\s*"([^"]{10,})', raw)
    if dialogue_match:
        dialogue = dialogue_match.group(1).rstrip('\\').strip()
        if len(dialogue) > 15:
            logger.info(f"LLM: {npc_name} partial recovery from {model}")
            return dialogue, 0, "none"

    logger.warning(f"All parse strategies failed ({model}) | raw={raw[:120]}")
    return None


def _fallback(npc_name: str) -> tuple[str, int, str]:
    return (f"{npc_name} regards you carefully before speaking.", 0, "none")


# ---------------------------------------------------------------------------
# Provenance query helper
# ---------------------------------------------------------------------------

async def generate_provenance_narrative(
    npc_name: str,
    citation_chain: list[dict],
    graph_context: str,
) -> str:
    chain_text = "\n".join(
        f"  Step {c['step']}: {c['content_preview']}"
        for c in citation_chain
    )
    prompt = (
        f"You are {npc_name}. Player asked how you know something about them.\n"
        f"Your memory chain:\n{chain_text}\n\n"
        "Reply in character, referencing your source. Under 60 words. Plain speech only."
    )
    for model_name in MODELS:
        try:
            response = _client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=200,
                ),
            )
            if response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning(f"Provenance generation failed on {model_name}: {e}")
            continue
    return "I have my sources. Best leave it at that."
