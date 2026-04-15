"""
Batched LLM sentiment scoring.
Sends groups of 25 responses per LLM call to balance cost and latency.
Returns a score from 1 (very negative) to 10 (very positive) per response.
"""
import asyncio
import json
import re

from .llm import LLMProvider

_BATCH_SIZE = 25

_SYSTEM = (
    "You are a sentiment analyser. Score each piece of feedback on a scale "
    "from 1 (extremely negative) to 10 (extremely positive). "
    "Return only a JSON array of numbers in the same order as the input. "
    "No other text."
)


def _sentiment_label(score: float) -> str:
    if score >= 6.5:
        return "positive"
    if score >= 4.0:
        return "neutral"
    return "negative"


async def _score_batch(responses: list[str], llm: LLMProvider) -> list[float]:
    numbered = "\n".join(f"{i+1}. {r}" for i, r in enumerate(responses))
    raw = await llm.complete(
        messages=[
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Score the following {len(responses)} responses:\n\n{numbered}"
                ),
            },
        ],
        max_tokens=len(responses) * 6,  # ~4 chars per score + commas
        temperature=0,
    )

    # Strip markdown code fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]

    try:
        scores = json.loads(raw)
        if isinstance(scores, list) and len(scores) == len(responses):
            return [max(1.0, min(10.0, float(s))) for s in scores]
    except (json.JSONDecodeError, ValueError, TypeError):
        pass

    # Fallback: extract numbers from the raw string
    numbers = re.findall(r"\b(?:10|[1-9])(?:\.\d+)?\b", raw)
    if len(numbers) == len(responses):
        return [max(1.0, min(10.0, float(n))) for n in numbers]

    # Last resort: neutral score for the whole batch
    return [5.0] * len(responses)


async def score_all(
    responses: list[str],
    llm: LLMProvider,
    progress_cb=None,
) -> list[tuple[float, str]]:
    """
    Score all responses in batches.

    Returns a list of (score, label) tuples aligned to the input list.
    """
    batches = [
        responses[i : i + _BATCH_SIZE]
        for i in range(0, len(responses), _BATCH_SIZE)
    ]
    n_batches = len(batches)
    all_scores: list[float] = []

    for idx, batch in enumerate(batches):
        scores = await _score_batch(batch, llm)
        all_scores.extend(scores)
        if progress_cb:
            pct = int((idx + 1) / n_batches * 100)
            await progress_cb(
                f"Scoring sentiment: batch {idx+1}/{n_batches}", pct
            )

    return [(s, _sentiment_label(s)) for s in all_scores]
