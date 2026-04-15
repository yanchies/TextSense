"""
GET /results/{session_id}  — return completed analysis result.
GET /results/{session_id}/status  — lightweight status poll.
"""
from fastapi import APIRouter, HTTPException

from ..models.schemas import AnalysisResult
from ..session import get_session

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/{session_id}/status")
async def get_status(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"session_id": session_id, "status": session.status, "error": session.error}


@router.get("/{session_id}", response_model=AnalysisResult)
async def get_result(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status != "complete":
        raise HTTPException(
            status_code=425,
            detail=f"Analysis not yet complete. Status: {session.status}",
        )
    return session.result
