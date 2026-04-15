"""
In-memory session store keyed by UUID.
Each session holds raw data, pipeline status, progress queue, and results.
"""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from .models.schemas import AnalysisResult


@dataclass
class Session:
    id: str
    status: Literal["idle", "running", "complete", "error"] = "idle"
    raw_responses: list[str] = field(default_factory=list)
    column: str = ""
    provider: str = ""
    api_key: str = ""
    model: str = ""
    result: AnalysisResult | None = None
    progress_queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    error: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)


# Global store — single-process local app, no persistence needed
_store: dict[str, Session] = {}


def create_session() -> Session:
    sid = str(uuid.uuid4())
    session = Session(id=sid)
    _store[sid] = session
    return session


def get_session(session_id: str) -> Session | None:
    return _store.get(session_id)


def delete_session(session_id: str) -> None:
    _store.pop(session_id, None)
