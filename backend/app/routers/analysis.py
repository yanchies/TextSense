"""
POST /analysis/start  — kick off the pipeline (returns immediately).
GET  /analysis/stream/{session_id}  — SSE stream of ProgressEvents.
"""
import asyncio
import json
import logging
import traceback

from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
from fastapi.responses import StreamingResponse

from ..models.schemas import AnalysisResult, AnalysisStartRequest, ResponseRecord, TopicSummary
from ..services import embedder as svc_embed
from ..services import clusterer as svc_cluster
from ..services import topic_labeller as svc_label
from ..services import sentiment as svc_sentiment
from ..services.llm import LLMProvider
from ..services.parser import extract_column
from ..session import get_session

router = APIRouter(prefix="/analysis", tags=["analysis"])


async def _run_pipeline(session_id: str) -> None:
    """Background task — drives the full pipeline and pushes SSE events."""
    session = get_session(session_id)
    if session is None:
        return

    q = session.progress_queue

    async def push(step: str, message: str, progress: int) -> None:
        await q.put({"step": step, "message": message, "progress": progress})

    try:
        session.status = "running"

        # 1. Extract responses from the chosen column
        await push("parsing", "Extracting responses from selected column", 2)
        rows = getattr(session, "raw_rows", [])
        responses = extract_column(rows, session.column)
        if not responses:
            raise ValueError(f"Column '{session.column}' has no non-empty values.")

        session.raw_responses = responses
        n = len(responses)

        # 2. Embed
        await push("embedding", f"Embedding {n} responses (local model)", 5)
        embeddings = await asyncio.get_event_loop().run_in_executor(
            None, svc_embed.embed, responses
        )
        await push("embedding", "Embeddings complete", 30)

        # 3. Cluster
        await push("clustering", "Running HDBSCAN clustering", 32)
        labels, _ = await asyncio.get_event_loop().run_in_executor(
            None, svc_cluster.run_pipeline, embeddings
        )
        n_clusters = len(set(labels))
        await push("clustering", f"Found {n_clusters} clusters", 45)

        # 4. Build cluster→responses mapping
        cluster_to_responses: dict[int, list[str]] = {}
        for text, cid in zip(responses, labels):
            cluster_to_responses.setdefault(int(cid), []).append(text)

        # 5. LLM topic labelling
        llm = LLMProvider(
            provider=session.provider,
            api_key=session.api_key,
            model=session.model,
        )

        await push("labelling", "Generating topic labels", 47)

        async def label_progress(message: str, pct: int) -> None:
            mapped = 47 + int(pct * 0.23)  # 47–70
            await push("labelling", message, mapped)

        topic_labels, cluster_map = await svc_label.label_topics(
            cluster_to_responses, llm, progress_cb=label_progress
        )
        await push("labelling", f"Topics finalised: {len(topic_labels)}", 70)

        # 6. Sentiment scoring
        await push("sentiment", "Scoring sentiment", 72)

        async def sentiment_progress(message: str, pct: int) -> None:
            mapped = 72 + int(pct * 0.23)  # 72–95
            await push("sentiment", message, mapped)

        sentiment_results = await svc_sentiment.score_all(
            responses, llm, progress_cb=sentiment_progress
        )
        await push("sentiment", "Sentiment scoring complete", 95)

        # 7. Assemble result
        await push("assembling", "Assembling results", 96)

        response_records: list[ResponseRecord] = []
        for idx, (text, raw_cid) in enumerate(zip(responses, labels)):
            topic_id = cluster_map[int(raw_cid)]
            topic = topic_labels[topic_id]
            score, label = sentiment_results[idx]
            response_records.append(
                ResponseRecord(
                    id=idx,
                    text=text,
                    topic_id=topic_id,
                    topic_label=topic.label,
                    sentiment=round(score, 1),
                    sentiment_label=label,
                )
            )

        topic_summaries: list[TopicSummary] = []
        for tid, tl in sorted(topic_labels.items()):
            topic_responses = [r for r in response_records if r.topic_id == tid]
            avg_sent = (
                sum(r.sentiment for r in topic_responses) / len(topic_responses)
                if topic_responses
                else 0.0
            )
            topic_summaries.append(
                TopicSummary(
                    id=tid,
                    label=tl.label,
                    description=tl.description,
                    count=len(topic_responses),
                    avg_sentiment=round(avg_sent, 1),
                    sample_responses=[r.text for r in topic_responses[:5]],
                    llm_summary=tl.summary,
                )
            )

        session.result = AnalysisResult(
            session_id=session_id,
            total_responses=n,
            responses=response_records,
            topics=topic_summaries,
        )
        session.status = "complete"
        await push("complete", "Analysis complete", 100)

    except Exception as exc:
        session.status = "error"
        session.error = str(exc)
        logger.error("Pipeline failed for session %s:\n%s", session_id, traceback.format_exc())
        await q.put({"step": "error", "message": str(exc), "progress": 0})
    finally:
        await q.put(None)  # sentinel — signals SSE generator to close


@router.post("/start")
async def start_analysis(request: AnalysisStartRequest):
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status == "running":
        raise HTTPException(status_code=409, detail="Analysis already running.")

    session.column = request.column
    session.provider = request.provider
    session.api_key = request.api_key
    session.model = request.model

    asyncio.create_task(_run_pipeline(request.session_id))
    return {"session_id": request.session_id, "status": "started"}


@router.get("/stream/{session_id}")
async def stream_progress(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    async def event_generator():
        while True:
            event = await session.progress_queue.get()
            if event is None:
                # Pipeline finished — send a final close event
                yield "event: close\ndata: {}\n\n"
                break
            payload = json.dumps(event)
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
