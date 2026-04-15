"""
Parse uploaded CSV, JSON, or plain text into a list of column-selectable rows.
Returns (columns, rows) where rows is a list of dicts.
"""
import io
import json

import pandas as pd


def parse_csv(content: bytes) -> tuple[list[str], list[dict]]:
    df = pd.read_csv(io.BytesIO(content))
    df.columns = [str(c).strip() for c in df.columns]
    return list(df.columns), df.where(pd.notna(df), None).to_dict(orient="records")


def parse_json(content: bytes) -> tuple[list[str], list[dict]]:
    data = json.loads(content)

    if isinstance(data, list):
        # List of objects — standard case
        if not data:
            raise ValueError("JSON array is empty.")
        if not isinstance(data[0], dict):
            # List of plain strings — wrap them
            return ["text"], [{"text": str(item)} for item in data]
        df = pd.DataFrame(data)
        return list(df.columns), df.where(pd.notna(df), None).to_dict(orient="records")

    if isinstance(data, dict):
        # Single object with array values — try to flatten
        df = pd.DataFrame(data)
        return list(df.columns), df.where(pd.notna(df), None).to_dict(orient="records")

    raise ValueError("Unsupported JSON structure. Expected an array of objects.")


def parse_text(content: str) -> tuple[list[str], list[dict]]:
    """Each non-empty line becomes one response."""
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        raise ValueError("No non-empty lines found in pasted text.")
    return ["text"], [{"text": line} for line in lines]


def extract_column(rows: list[dict], column: str) -> list[str]:
    """Pull the chosen column, drop empty values, deduplicate."""
    seen: set[str] = set()
    result: list[str] = []
    for row in rows:
        val = row.get(column)
        if val is None:
            continue
        text = str(val).strip()
        if text and text not in seen:
            seen.add(text)
            result.append(text)
    return result
