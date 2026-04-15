from typing import Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    session_id: str
    columns: list[str]          # column names the user can choose from
    row_count: int
    preview: list[dict]         # first 5 rows as list of dicts


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

class AnalysisStartRequest(BaseModel):
    session_id: str
    column: str
    provider: Literal["anthropic", "openai"]
    api_key: str
    model: str


class ProgressEvent(BaseModel):
    step: str
    message: str
    progress: int = Field(ge=0, le=100)


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

class ResponseRecord(BaseModel):
    id: int
    text: str
    topic_id: int
    topic_label: str
    sentiment: float            # 1–10
    sentiment_label: Literal["positive", "neutral", "negative"]


class TopicSummary(BaseModel):
    id: int
    label: str
    description: str
    count: int
    avg_sentiment: float
    sample_responses: list[str]
    llm_summary: str


class AnalysisResult(BaseModel):
    session_id: str
    total_responses: int
    responses: list[ResponseRecord]
    topics: list[TopicSummary]


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

class ExportFormat(BaseModel):
    format: Literal["csv", "markdown", "pdf"]
