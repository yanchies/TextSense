import type { AnalysisResult, TopicSummary } from "./types";

interface Structured {
  summary: string;
  key_concerns: string;
  suggestions: string;
  positive_feedback?: string;
}

function parseSummary(raw: string): Structured | null {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && "summary" in p) return p as Structured;
  } catch {}
  return null;
}

function cleanField(text: string): string {
  if (!text) return text;
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(
      /^.+?[-–]\s*(?:feedback\s+)?(?:summary|key concerns?|suggestions?|positive feedback|improvements?)[:\s]*/i,
      "",
    )
    .trim();
}

function sentimentColor(score: number): string {
  if (score >= 6.5) return "#10b981";
  if (score >= 4.0) return "#f59e0b";
  return "#ef4444";
}

function sentimentBg(score: number): string {
  if (score >= 6.5) return "#ecfdf5";
  if (score >= 4.0) return "#fffbeb";
  return "#fef2f2";
}

function renderSections(llm_summary: string): string {
  const structured = parseSummary(llm_summary);
  const sections: [string, string][] = structured
    ? [
        ["Summary", structured.summary],
        ["Key Concerns", structured.key_concerns],
        ["Suggestions for Improvement", structured.suggestions],
        ["Positive Feedback", structured.positive_feedback ?? ""],
      ]
    : [["Summary", llm_summary]];

  return sections
    .filter(([, body]) => body)
    .map(
      ([heading, body]) => `
      <div class="section">
        <p class="section-label">${heading}</p>
        <p class="section-body">${cleanField(body)}</p>
      </div>`,
    )
    .join("");
}

const CARD_COLORS = [
  { bg: "#f0f9ff", border: "#bae6fd" },
  { bg: "#f5f3ff", border: "#ddd6fe" },
  { bg: "#ecfdf5", border: "#a7f3d0" },
  { bg: "#fffbeb", border: "#fde68a" },
  { bg: "#fff1f2", border: "#fecdd3" },
  { bg: "#ecfeff", border: "#a5f3fc" },
];

export function generateHtml(result: AnalysisResult): string {
  const n = result.total_responses;
  const avg = (result.responses.reduce((s, r) => s + r.sentiment, 0) / n).toFixed(1);
  const pos = result.responses.filter((r) => r.sentiment_label === "positive").length;
  const neg = result.responses.filter((r) => r.sentiment_label === "negative").length;
  const neu = n - pos - neg;

  const topicsSorted = [...result.topics].sort((a, b) => b.count - a.count);

  const distributionRows = topicsSorted
    .map((t) => {
      const pct = ((t.count / n) * 100).toFixed(1);
      const barW = Math.round((t.count / topicsSorted[0].count) * 100);
      const col = sentimentColor(t.avg_sentiment);
      return `
      <tr>
        <td>${t.label}</td>
        <td style="text-align:right">${t.count}</td>
        <td style="text-align:right">${pct}%</td>
        <td style="text-align:right;color:${col};font-weight:600">${t.avg_sentiment.toFixed(1)}/10</td>
        <td style="width:120px">
          <div style="background:#e2e8f0;border-radius:4px;height:8px">
            <div style="background:${col};width:${barW}%;height:8px;border-radius:4px"></div>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const topicCards = topicsSorted
    .map((t, i) => {
      const col = CARD_COLORS[i % CARD_COLORS.length];
      const pct = ((t.count / n) * 100).toFixed(1);
      const sc = sentimentColor(t.avg_sentiment);
      const sbg = sentimentBg(t.avg_sentiment);
      return `
    <div class="card" style="background:${col.bg};border-color:${col.border}">
      <div class="card-header">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="card-title">${t.label}</span>
            <span class="badge" style="color:${sc};background:${sbg};border:1px solid ${sc}40">
              ${t.avg_sentiment.toFixed(1)} / 10
            </span>
          </div>
          <p class="card-meta">${t.count} responses · ${pct}% of total</p>
        </div>
      </div>
      <div class="divider"></div>
      <div class="section">
        <p class="section-label">Working Definition</p>
        <p class="section-body" style="font-style:italic">${t.description}</p>
      </div>
      <div class="divider"></div>
      ${renderSections(t.llm_summary)}
      ${
        t.sample_responses.length
          ? `<div class="section">
        <p class="section-label">Sample Responses</p>
        ${t.sample_responses
          .slice(0, 3)
          .map((r) => `<blockquote>${r}</blockquote>`)
          .join("")}
      </div>`
          : ""
      }
    </div>`;
    })
    .join("");

  const snapshotRows = result.responses
    .slice(0, 10)
    .map((r) => {
      const sc = sentimentColor(r.sentiment);
      return `<tr>
      <td style="color:#94a3b8">${r.id}</td>
      <td>${r.topic_label}</td>
      <td style="color:${sc};font-weight:600;white-space:nowrap">${r.sentiment.toFixed(1)} (${r.sentiment_label})</td>
      <td>${r.text.length > 120 ? r.text.slice(0, 120) + "…" : r.text}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TextSense Results</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
         line-height: 1.6; color: #1e293b; background: #f8fafc;
         padding: 32px 24px; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
  h2 { font-size: 15px; font-weight: 700; color: #1e293b; margin: 32px 0 12px; }
  .meta { color: #94a3b8; font-size: 12px; margin-top: 2px; margin-bottom: 24px; }

  /* Stats */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .stat-label { font-size: 9px; font-weight: 600; text-transform: uppercase;
                letter-spacing: .06em; color: #94a3b8; }
  .stat-value { font-size: 22px; font-weight: 700; margin-top: 2px; }
  .breakdown { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
  .breakdown-sub { font-size: 9px; margin-top: 2px; display:flex; gap:4px; }

  /* Distribution table */
  table { width: 100%; border-collapse: collapse; background: #fff;
          border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  th { background: #f8fafc; font-size: 10px; font-weight: 600; text-transform: uppercase;
       letter-spacing: .05em; color: #64748b; padding: 8px 12px; text-align: left;
       border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
       color: #334155; font-size: 12px; }
  tr:last-child td { border-bottom: none; }

  /* Cards */
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { border: 1px solid; border-radius: 10px; padding: 16px; }
  .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .card-title { font-size: 13px; font-weight: 600; color: #0f172a; }
  .card-meta { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .badge { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; }
  .divider { border: none; border-top: 1px solid rgba(0,0,0,.06); margin: 10px 0; }
  .section { margin-bottom: 8px; }
  .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase;
                   letter-spacing: .06em; color: #94a3b8; margin-bottom: 3px; }
  .section-body { font-size: 12px; color: #475569; line-height: 1.6; }
  blockquote { border-left: 2px solid #cbd5e1; padding: 4px 10px; color: #64748b;
               font-size: 11px; margin: 4px 0; }

  @media print {
    body { background: white; padding: 16px; }
    .cards { grid-template-columns: 1fr 1fr; }
    .card { break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<h1>TextSense Results</h1>
<p class="meta">${n.toLocaleString()} responses · ${result.topics.length} topics</p>

<!-- Stats -->
<div class="stats">
  <div class="stat">
    <div class="stat-label">Responses</div>
    <div class="stat-value">${n.toLocaleString()}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Topics</div>
    <div class="stat-value">${result.topics.length}</div>
  </div>
  <div class="stat">
    <div class="stat-label">Avg Sentiment</div>
    <div class="stat-value">${avg} / 10</div>
  </div>
  <div class="stat">
    <div class="stat-label">Breakdown</div>
    <div class="breakdown">
      <span class="stat-value" style="color:#10b981">${pos}</span>
      <span style="color:#e2e8f0;font-size:18px;margin:0 2px">|</span>
      <span class="stat-value" style="color:#f59e0b">${neu}</span>
      <span style="color:#e2e8f0;font-size:18px;margin:0 2px">|</span>
      <span class="stat-value" style="color:#ef4444">${neg}</span>
    </div>
    <div class="breakdown-sub">
      <span style="color:#10b981">pos</span>
      <span style="color:#e2e8f0">|</span>
      <span style="color:#f59e0b">neu</span>
      <span style="color:#e2e8f0">|</span>
      <span style="color:#ef4444">neg</span>
    </div>
  </div>
</div>

<!-- Topic Distribution -->
<h2>Topic Distribution</h2>
<table>
  <thead>
    <tr>
      <th>Topic</th>
      <th style="text-align:right">Responses</th>
      <th style="text-align:right">% of Total</th>
      <th style="text-align:right">Avg Sentiment</th>
      <th></th>
    </tr>
  </thead>
  <tbody>${distributionRows}</tbody>
</table>

<!-- Topic Cards -->
<h2>Topics</h2>
<div class="cards">${topicCards}</div>

<!-- Response Snapshot -->
<h2>Response Snapshot <span style="font-size:11px;font-weight:400;color:#94a3b8">— showing 10 of ${n.toLocaleString()}</span></h2>
<table>
  <thead>
    <tr><th>#</th><th>Topic</th><th>Sentiment</th><th>Response</th></tr>
  </thead>
  <tbody>${snapshotRows}</tbody>
</table>

</body>
</html>`;
}
