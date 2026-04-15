"""
POST /upload  — accepts a file (CSV or JSON) or raw text.
Returns session_id, detected columns, row count, and a preview.
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from ..models.schemas import UploadResponse
from ..services import parser as svc_parser
from ..session import create_session, get_session

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("", response_model=UploadResponse)
async def upload(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
):
    if file is None and not text:
        raise HTTPException(status_code=400, detail="Provide a file or pasted text.")

    try:
        if file is not None:
            content = await file.read()
            filename = file.filename or ""
            if filename.lower().endswith(".csv"):
                columns, rows = svc_parser.parse_csv(content)
            elif filename.lower().endswith(".json"):
                columns, rows = svc_parser.parse_json(content)
            else:
                # Try CSV first, then JSON
                try:
                    columns, rows = svc_parser.parse_csv(content)
                except Exception:
                    columns, rows = svc_parser.parse_json(content)
        else:
            columns, rows = svc_parser.parse_text(text)  # type: ignore[arg-type]

    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    session = create_session()
    # Store the raw rows on the session so analysis can pull any column
    session.raw_rows = rows  # type: ignore[attr-defined]  # dynamic attr

    preview = rows[:5]

    return UploadResponse(
        session_id=session.id,
        columns=columns,
        row_count=len(rows),
        preview=preview,
    )
