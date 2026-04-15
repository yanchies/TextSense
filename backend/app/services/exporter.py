"""
Generate export artefacts from an AnalysisResult:
  - Enriched CSV
  - Markdown report
  - PDF (rendered from Markdown via weasyprint)
"""
import io
import json
import textwrap
from datetime import datetime

import pandas as pd

from ..models.schemas import AnalysisResult


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

def to_csv(result: AnalysisResult) -> bytes:
    rows = [
        {
            "id": r.id,
            "response": r.text,
            "topic": r.topic_label,
            "sentiment_score": r.sentiment,
            "sentiment": r.sentiment_label,
        }
        for r in result.responses
    ]
    df = pd.DataFrame(rows)
    return df.to_csv(index=False).encode("utf-8")


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def to_markdown(result: AnalysisResult) -> str:
    n = result.total_responses
    avg_sentiment = sum(r.sentiment for r in result.responses) / n if result.responses else 0

    positive = sum(1 for r in result.responses if r.sentiment_label == "positive")
    negative = sum(1 for r in result.responses if r.sentiment_label == "negative")
    neutral  = n - positive - negative

    lines: list[str] = []

    # ── H1: Title ─────────────────────────────────────────────────────────────
    lines.append("# TextSense Results")
    lines.append(f"\n_{n:,} responses · {len(result.topics)} topics_\n")

    # ── H2: Overview ──────────────────────────────────────────────────────────
    lines.append("## Overview\n")
    lines.append("| Responses | Topics | Avg Sentiment | Positive | Neutral | Negative |")
    lines.append("|----------:|-------:|--------------:|---------:|--------:|---------:|")
    lines.append(
        f"| {n:,} | {len(result.topics)} | {avg_sentiment:.1f} / 10"
        f" | {positive} | {neutral} | {negative} |"
    )

    # ── H2: Topic Distribution ────────────────────────────────────────────────
    lines.append("\n## Topic Distribution\n")
    lines.append("| Topic | Responses | % of Total | Avg Sentiment |")
    lines.append("|-------|----------:|-----------:|--------------:|")
    for topic in sorted(result.topics, key=lambda t: t.count, reverse=True):
        pct = topic.count / n * 100
        lines.append(
            f"| {topic.label} | {topic.count} | {pct:.1f}% | {topic.avg_sentiment:.1f} / 10 |"
        )

    # ── H2: Topics ────────────────────────────────────────────────────────────
    lines.append("\n## Topics\n")
    for topic in sorted(result.topics, key=lambda t: t.count, reverse=True):
        pct = topic.count / n * 100

        # H3: topic name + meta on one line
        lines.append(f"### {topic.label}")
        lines.append(
            f"\n_{topic.count} responses · {pct:.1f}% of total · "
            f"avg sentiment {topic.avg_sentiment:.1f}/10_\n"
        )

        # H4: Working definition
        lines.append("#### Working Definition\n")
        lines.append(f"_{topic.description}_\n")

        # H4 sub-sections from structured JSON, or plain fallback
        try:
            structured = json.loads(topic.llm_summary)
        except (ValueError, TypeError):
            structured = None

        if structured and isinstance(structured, dict):
            for heading, key in [
                ("Summary", "summary"),
                ("Key Concerns", "key_concerns"),
                ("Suggestions", "suggestions"),
            ]:
                body = structured.get(key, "")
                if body:
                    lines.append(f"#### {heading}\n")
                    lines.append(f"{body}\n")
        else:
            lines.append("#### Summary\n")
            lines.append(f"{topic.llm_summary}\n")

        # H4: Sample responses
        if topic.sample_responses:
            lines.append("#### Sample Responses\n")
            for sample in topic.sample_responses[:5]:
                truncated = textwrap.shorten(sample, width=200, placeholder="…")
                lines.append(f"> {truncated}\n")
        lines.append("")

    # ── H2: Response Snapshot ─────────────────────────────────────────────────
    lines.append("---\n")
    lines.append("## Response Snapshot\n")
    lines.append(f"_Showing 10 of {n:,} responses._\n")
    lines.append("| # | Topic | Sentiment | Response |")
    lines.append("|--:|-------|----------:|----------|")
    for r in result.responses[:10]:
        text = textwrap.shorten(r.text, width=120, placeholder="…")
        lines.append(
            f"| {r.id} | {r.topic_label} | {r.sentiment:.1f} ({r.sentiment_label}) | {text} |"
        )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

# Sentinel colour for the brand accent (RGB)
_BRAND = (14, 165, 233)   # sky-500
_DARK  = (30, 41, 59)     # slate-800
_MID   = (71, 85, 105)    # slate-600
_MUTED = (148, 163, 184)  # slate-400
_POS   = (16, 185, 129)   # emerald-500
_NEU   = (245, 158, 11)   # amber-500
_NEG   = (239, 68, 68)    # red-500


def _sentiment_color(score: float) -> tuple[int, int, int]:
    if score >= 6.5:
        return _POS
    if score >= 4.0:
        return _NEU
    return _NEG


def to_pdf(result: AnalysisResult) -> bytes:
    """Render the dashboard to PDF using fpdf2 (pure Python, no native deps)."""
    from fpdf import FPDF

    n = result.total_responses
    avg_sentiment = sum(r.sentiment for r in result.responses) / n if result.responses else 0
    positive = sum(1 for r in result.responses if r.sentiment_label == "positive")
    negative = sum(1 for r in result.responses if r.sentiment_label == "negative")
    neutral  = n - positive - negative

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()
    pdf.set_margins(16, 16, 16)

    W = pdf.epw  # effective page width

    # ── Title ──────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*_DARK)
    pdf.cell(0, 10, "Results", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 6, f"{n:,} responses  \u00b7  {len(result.topics)} topics",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # ── Stats row ──────────────────────────────────────────────────────────
    col_w = W / 4
    stats = [
        ("RESPONSES", f"{n:,}", _DARK),
        ("TOPICS", str(len(result.topics)), _DARK),
        ("AVG SENTIMENT", f"{avg_sentiment:.1f} / 10", _DARK),
    ]
    # draw first three stat boxes
    for label, value, col in stats:
        x, y = pdf.get_x(), pdf.get_y()
        pdf.set_draw_color(226, 232, 240)
        pdf.rect(x, y, col_w - 2, 18)
        pdf.set_xy(x + 2, y + 2)
        pdf.set_font("Helvetica", "", 6)
        pdf.set_text_color(*_MUTED)
        pdf.cell(col_w - 4, 4, label, new_x="LEFT", new_y="NEXT")
        pdf.set_x(x + 2)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(*col)
        pdf.cell(col_w - 4, 7, value, new_x="RIGHT", new_y="TOP")
        pdf.set_xy(x + col_w, y)

    # breakdown box with colours
    x, y = pdf.get_x(), pdf.get_y()
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(x, y, col_w - 2, 18)
    pdf.set_xy(x + 2, y + 2)
    pdf.set_font("Helvetica", "", 6)
    pdf.set_text_color(*_MUTED)
    pdf.cell(col_w - 4, 4, "BREAKDOWN", new_x="LEFT", new_y="NEXT")
    pdf.set_x(x + 2)
    pdf.set_font("Helvetica", "B", 11)
    for val, col, sep in [(str(positive), _POS, "  |  "), (str(neutral), _NEU, "  |  "), (str(negative), _NEG, "")]:
        pdf.set_text_color(*col)
        pdf.cell(0, 7, val, new_x="END", new_y="TOP")
        if sep:
            pdf.set_text_color(*_MUTED)
            pdf.cell(0, 7, sep, new_x="END", new_y="TOP")

    pdf.ln(22)

    # ── Topic distribution table ────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*_DARK)
    pdf.cell(0, 8, "Topic Distribution", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    col_widths = [W * 0.45, W * 0.18, W * 0.18, W * 0.19]
    headers = ["Topic", "Responses", "% of Total", "Avg Sentiment"]
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(226, 232, 240)
    pdf.set_text_color(*_MID)
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 7, h, border=1, fill=True,
                 align="R" if i > 0 else "L")
    pdf.ln()

    pdf.set_font("Helvetica", "", 8)
    pdf.set_fill_color(255, 255, 255)
    for topic in sorted(result.topics, key=lambda t: t.count, reverse=True):
        pct = topic.count / n * 100
        pdf.set_text_color(*_DARK)
        pdf.cell(col_widths[0], 6, textwrap.shorten(topic.label, 40, placeholder="…"),
                 border=1)
        pdf.cell(col_widths[1], 6, str(topic.count), border=1, align="R")
        pdf.cell(col_widths[2], 6, f"{pct:.1f}%", border=1, align="R")
        sent_col = _sentiment_color(topic.avg_sentiment)
        pdf.set_text_color(*sent_col)
        pdf.cell(col_widths[3], 6, f"{topic.avg_sentiment:.1f} / 10", border=1, align="R")
        pdf.set_text_color(*_DARK)
        pdf.ln()
    pdf.ln(6)

    # ── Topic cards ─────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*_DARK)
    pdf.cell(0, 8, "Topics", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    for topic in sorted(result.topics, key=lambda t: t.count, reverse=True):
        pct = topic.count / n * 100
        sent_col = _sentiment_color(topic.avg_sentiment)

        # Card header
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*_DARK)
        pdf.cell(0, 6, topic.label, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*_MUTED)
        pdf.cell(0, 5,
                 f"{topic.count} responses  \u00b7  {pct:.1f}% of total  "
                 f"\u00b7  Avg sentiment: ",
                 new_x="END", new_y="TOP")
        pdf.set_text_color(*sent_col)
        pdf.cell(0, 5, f"{topic.avg_sentiment:.1f} / 10", new_x="LMARGIN", new_y="NEXT")

        # Working definition
        pdf.set_font("Helvetica", "BI", 7)
        pdf.set_text_color(*_MUTED)
        pdf.cell(0, 4, "WORKING DEFINITION", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(*_MID)
        pdf.multi_cell(0, 5, topic.description)

        # Summary / structured content
        import json as _json
        try:
            structured = _json.loads(topic.llm_summary)
        except (ValueError, TypeError):
            structured = None

        if structured and isinstance(structured, dict):
            sections = [
                ("Summary", structured.get("summary", "")),
                ("Key Concerns", structured.get("key_concerns", "")),
                ("Suggestions", structured.get("suggestions", "")),
            ]
            for heading, body in sections:
                if not body:
                    continue
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_text_color(*_MID)
                pdf.cell(0, 5, heading, new_x="LMARGIN", new_y="NEXT")
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*_MID)
                pdf.multi_cell(0, 5, body)
        else:
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*_MID)
            pdf.multi_cell(0, 5, topic.llm_summary)

        pdf.ln(4)
        pdf.set_draw_color(226, 232, 240)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + W, pdf.get_y())
        pdf.ln(4)

    # ── Response snapshot ───────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*_DARK)
    pdf.cell(0, 8, "Response Snapshot", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 5, f"Showing 10 of {n:,} responses.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    snap_cols = [W * 0.06, W * 0.28, W * 0.13, W * 0.53]
    snap_headers = ["#", "Topic", "Sentiment", "Response"]
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(226, 232, 240)
    pdf.set_text_color(*_MID)
    for i, h in enumerate(snap_headers):
        pdf.cell(snap_cols[i], 6, h, border=1, fill=True)
    pdf.ln()

    pdf.set_font("Helvetica", "", 7)
    for r in result.responses[:10]:
        pdf.set_text_color(*_DARK)
        text = textwrap.shorten(r.text, width=80, placeholder="…")
        pdf.cell(snap_cols[0], 5, str(r.id), border=1)
        pdf.cell(snap_cols[1], 5, textwrap.shorten(r.topic_label, 30, placeholder="…"), border=1)
        sent_col = _sentiment_color(r.sentiment)
        pdf.set_text_color(*sent_col)
        pdf.cell(snap_cols[2], 5, f"{r.sentiment:.1f} ({r.sentiment_label})", border=1)
        pdf.set_text_color(*_DARK)
        pdf.cell(snap_cols[3], 5, text, border=1)
        pdf.ln()

    return bytes(pdf.output())
