import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { ResponseRecord, TopicSummary } from "@/lib/types";
import { cn, sentimentBg } from "@/lib/utils";

type SortKey = "id" | "topic_label" | "sentiment";
type SortDir = "asc" | "desc";

interface Props {
  responses: ResponseRecord[];
  topics: TopicSummary[];
}

export function ResponseTable({ responses, topics }: Props) {
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const topicLabels = useMemo(
    () => Array.from(new Set(topics.map((t) => t.label))).sort(),
    [topics],
  );

  const filtered = useMemo(() => {
    let rows = responses;
    if (topicFilter !== "all") rows = rows.filter((r) => r.topic_label === topicFilter);
    if (sentimentFilter !== "all") rows = rows.filter((r) => r.sentiment_label === sentimentFilter);
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : Number(va) - Number(vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [responses, topicFilter, sentimentFilter, sortKey, sortDir]);

  const page_rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const total_pages = Math.ceil(filtered.length / PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown size={13} className="text-slate-300" />;
    return sortDir === "asc"
      ? <ChevronUp size={13} className="text-brand-500" />
      : <ChevronDown size={13} className="text-brand-500" />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 border-b border-slate-100">
        <select
          value={topicFilter}
          onChange={(e) => { setTopicFilter(e.target.value); setPage(0); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="all">All topics</option>
          {topicLabels.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={sentimentFilter}
          onChange={(e) => { setSentimentFilter(e.target.value); setPage(0); }}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <option value="all">All sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>

        <span className="ml-auto self-center text-xs text-slate-400">
          {filtered.length} response{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th
                className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none w-12"
                onClick={() => toggleSort("id")}
              >
                <span className="flex items-center gap-1">#<SortIcon k="id" /></span>
              </th>
              <th className="px-4 py-3 font-medium text-slate-500">Response</th>
              <th
                className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none whitespace-nowrap"
                onClick={() => toggleSort("topic_label")}
              >
                <span className="flex items-center gap-1">Topic<SortIcon k="topic_label" /></span>
              </th>
              <th
                className="px-4 py-3 font-medium text-slate-500 cursor-pointer select-none"
                onClick={() => toggleSort("sentiment")}
              >
                <span className="flex items-center gap-1">Sentiment<SortIcon k="sentiment" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {page_rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{r.id}</td>
                <td className="px-4 py-3 text-slate-700 max-w-sm">
                  <p className="line-clamp-2">{r.text}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {r.topic_label}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded", sentimentBg(r.sentiment_label))}>
                    {r.sentiment.toFixed(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total_pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-slate-400">
            Page {page + 1} of {total_pages}
          </span>
          <button
            disabled={page >= total_pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
