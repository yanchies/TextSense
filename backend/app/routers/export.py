"""
POST /export/{session_id}/{format}  — generate and stream an export file.
Formats: csv | markdown | pdf
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..services import exporter as svc_export
from ..session import get_session

router = APIRouter(prefix="/export", tags=["export"])

_MEDIA_TYPES = {
    "csv": "text/csv",
    "markdown": "text/markdown",
    "pdf": "application/pdf",
}

_FILENAMES = {
    "csv": "textsense_results.csv",
    "markdown": "textsense_report.md",
    "pdf": "textsense_report.pdf",
}


@router.post("/{session_id}/{fmt}")
async def export(session_id: str, fmt: str):
    if fmt not in _MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown format: {fmt!r}")

    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.status != "complete" or session.result is None:
        raise HTTPException(status_code=425, detail="Analysis not yet complete.")

    if fmt == "csv":
        content = svc_export.to_csv(session.result)
    elif fmt == "markdown":
        content = svc_export.to_markdown(session.result).encode("utf-8")
    else:
        content = svc_export.to_pdf(session.result)

    return Response(
        content=content,
        media_type=_MEDIA_TYPES[fmt],
        headers={
            "Content-Disposition": f'attachment; filename="{_FILENAMES[fmt]}"'
        },
    )
