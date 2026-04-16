"""
LLM-based topic labelling in two passes:

  Pass 1 — per-cluster: sample up to 15 responses, ask LLM for a
            short label and one-sentence description.
  Pass 2 — global merge: send all labels to LLM, ask if any are
            near-duplicates that should be merged.
  Pass 3 — per-topic summary: brief human-readable summary for the dashboard.
"""
import asyncio
import json
import random
from typing import NamedTuple

from .llm import LLMProvider

_SAMPLE_SIZE = 15
_RANDOM_SEED = 42


class TopicLabel(NamedTuple):
    id: int
    label: str
    description: str
    summary: str


async def _label_cluster(
    cluster_id: int,
    responses: list[str],
    llm: LLMProvider,
) -> TopicLabel:
    random.seed(_RANDOM_SEED)
    sample = random.sample(responses, min(_SAMPLE_SIZE, len(responses)))
    numbered = "\n".join(f"{i+1}. {r}" for i, r in enumerate(sample))

    result = await llm.complete_json(
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert at analysing qualitative feedback. "
                    "Your responses are concise and domain-agnostic."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Here are {len(sample)} survey responses from the same cluster:\n\n"
                    f"{numbered}\n\n"
                    "Identify the specific SUBJECT MATTER these responses share — "
                    "what concrete aspect, process, or area of experience are they about?\n\n"
                    "Rules:\n"
                    "- The label must describe the TOPIC (what it is about), "
                    "NOT the sentiment or emotional tone.\n"
                    "- 'Positive Feedback', 'Satisfaction', 'Negative Experience', "
                    "'General Praise' and similar sentiment labels are NOT acceptable.\n"
                    "- If responses are mostly positive but share a subject, label the subject: "
                    "e.g. 'Staff Helpfulness', not 'Positive Staff Comments'.\n"
                    "- Be specific: 'Cafeteria Food Quality' beats 'Food'.\n\n"
                    "Return a JSON object with exactly two keys:\n"
                    '  "label": a 2-5 word topic label (title case)\n'
                    '  "description": one sentence describing the shared subject matter\n'
                    "No other text."
                ),
            },
        ],
        max_tokens=120,
    )

    label = str(result.get("label", f"Topic {cluster_id}")).strip()
    description = str(result.get("description", "")).strip()
    return TopicLabel(id=cluster_id, label=label, description=description, summary="")


async def _merge_pass(
    topics: list[TopicLabel],
    llm: LLMProvider,
) -> dict[int, int]:
    """
    Ask LLM if any topics should be merged.
    Returns a mapping {old_id: canonical_id} (identity entries included).
    """
    if len(topics) <= 1:
        return {t.id: t.id for t in topics}

    lines = "\n".join(
        f"  {t.id}: {t.label} — {t.description}" for t in topics
    )

    result = await llm.complete_json(
        messages=[
            {
                "role": "system",
                "content": "You are a careful analyst reviewing topic taxonomy.",
            },
            {
                "role": "user",
                "content": (
                    "Below is a list of topic IDs, labels, and descriptions derived "
                    "from clustering survey responses:\n\n"
                    f"{lines}\n\n"
                    "Identify any pairs or groups that are near-duplicates or "
                    "should be merged into one topic. For each merge, choose the "
                    "most descriptive label as the canonical one.\n\n"
                    "Return a JSON object: a mapping where each key is a topic ID "
                    "(as a string) and each value is the canonical topic ID it should "
                    "map to. Topics that should NOT be merged map to themselves.\n"
                    "Example: {\"0\": 0, \"1\": 0, \"2\": 2} means topics 0 and 1 merge into 0."
                ),
            },
        ],
        max_tokens=300,
    )

    mapping: dict[int, int] = {}
    for k, v in result.items():
        try:
            mapping[int(k)] = int(v)
        except (ValueError, TypeError):
            pass

    # Fill in any topics the LLM omitted (map to themselves)
    for t in topics:
        mapping.setdefault(t.id, t.id)

    return mapping


async def _ask(prompt: str, llm: LLMProvider) -> str:
    """Single focused question → plain text answer, hard-capped at 60 tokens."""
    raw = await llm.complete(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=60,
        temperature=0,
    )
    text = raw.strip()
    if text.lower().startswith("none"):
        return ""
    return text


async def _summarise_topic(
    label: str,
    responses: list[str],
    llm: LLMProvider,
) -> str:
    """
    Returns a JSON string: {summary, key_concerns, suggestions, positive_feedback}.
    Uses four separate focused questions run in parallel — one per field.
    This is more reliable than asking the model to fill a multi-field JSON at once.
    """
    random.seed(_RANDOM_SEED)
    sample = random.sample(responses, min(20, len(responses)))
    context = "\n".join(f"- {r}" for r in sample)
    base = f"These are survey responses about '{label}':\n{context}\n\n"

    rules = ("One sentence only — under 30 words. "
             "No lists, no enumerations. "
             "Name the overall theme, not individual items. "
             "No heading or label at the start.")

    summary, concerns, suggestions, positive = await asyncio.gather(
        _ask(base + "What is this topic broadly about? Give a high-level overview only — "
             f"no complaints or suggestions. {rules}", llm),
        _ask(base + "What are the main problems or complaints respondents raised? "
             f"Start with 'None mentioned.' if there are none. {rules}", llm),
        _ask(base + "What are the main improvements or changes respondents requested? "
             f"Start with 'None mentioned.' if there are none. {rules}", llm),
        _ask(base + "What did respondents explicitly praise or express satisfaction about? "
             f"Start with 'None mentioned.' if there are none. {rules}", llm),
    )

    return json.dumps({
        "summary":           summary,
        "key_concerns":      concerns,
        "suggestions":       suggestions,
        "positive_feedback": positive,
    })


_MAX_CONCURRENT_LLM = 3  # cap simultaneous API connections


async def label_topics(
    cluster_to_responses: dict[int, list[str]],
    llm: LLMProvider,
    progress_cb=None,
) -> dict[int, TopicLabel]:
    """
    Full two-pass labelling.

    Args:
        cluster_to_responses: {cluster_id: [response_text, ...]}
        llm: provider instance
        progress_cb: optional async callable(message, progress_pct)

    Returns:
        {final_topic_id: TopicLabel}
    """
    cluster_ids = sorted(cluster_to_responses.keys())
    n = len(cluster_ids)
    sem = asyncio.Semaphore(_MAX_CONCURRENT_LLM)

    async def labelled(cid: int) -> TopicLabel:
        async with sem:
            return await _label_cluster(cid, cluster_to_responses[cid], llm)

    # Pass 1 — label each cluster with bounded concurrency
    if progress_cb:
        await progress_cb("Generating topic labels", 0)

    raw_labels: list[TopicLabel] = await asyncio.gather(
        *[labelled(cid) for cid in cluster_ids]
    )

    if progress_cb:
        await progress_cb(f"Labelled {n} clusters, checking for duplicates", 60)

    # Pass 2 — merge near-duplicates
    merge_map = await _merge_pass(list(raw_labels), llm)

    # Build canonical topic list (keeping one TopicLabel per canonical id)
    canonical_ids = sorted(set(merge_map.values()))
    canonical_labels: dict[int, TopicLabel] = {}

    # Re-index canonically (0, 1, 2, ...)
    old_to_new: dict[int, int] = {}
    for new_id, old_id in enumerate(canonical_ids):
        original = next(t for t in raw_labels if t.id == old_id)
        old_to_new[old_id] = new_id
        canonical_labels[new_id] = TopicLabel(
            id=new_id,
            label=original.label,
            description=original.description,
            summary="",
        )

    # Map every original cluster id → new canonical id
    final_cluster_map: dict[int, int] = {}
    for orig_id in cluster_ids:
        canonical_old = merge_map.get(orig_id, orig_id)
        final_cluster_map[orig_id] = old_to_new.get(canonical_old, 0)

    # Rebuild responses per canonical topic
    canonical_responses: dict[int, list[str]] = {cid: [] for cid in canonical_labels}
    for old_cid, responses in cluster_to_responses.items():
        new_cid = final_cluster_map[old_cid]
        canonical_responses[new_cid].extend(responses)

    if progress_cb:
        await progress_cb("Generating topic summaries", 80)

    # Pass 3 — generate per-topic summaries with bounded concurrency
    async def summarised(cid: int) -> str:
        async with sem:
            return await _summarise_topic(
                canonical_labels[cid].label,
                canonical_responses[cid],
                llm,
            )

    summaries = await asyncio.gather(
        *[summarised(cid) for cid in sorted(canonical_labels.keys())]
    )

    for cid, summary in zip(sorted(canonical_labels.keys()), summaries):
        t = canonical_labels[cid]
        canonical_labels[cid] = TopicLabel(
            id=t.id, label=t.label, description=t.description, summary=summary
        )

    return canonical_labels, final_cluster_map
