import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopicSummary } from "@/lib/types";

const COLORS = [
  "#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#a855f7", "#22c55e", "#f97316", "#ec4899",
];

const Y_WIDTH = 180;

function WrapTick({ x, y, payload }: any) {
  const words: string[] = payload.value.split(" ");
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(" ");
  const line2 = words.slice(mid).join(" ");
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={-6}
        y={line2 ? -6 : 0}
        textAnchor="end"
        fill="#475569"
        fontSize={11}
      >
        {line1}
      </text>
      {line2 && (
        <text x={-6} y={10} textAnchor="end" fill="#475569" fontSize={11}>
          {line2}
        </text>
      )}
    </g>
  );
}

interface Props {
  topics: TopicSummary[];
  totalResponses: number;
}

export function TopicChart({ topics, totalResponses }: Props) {
  const data = [...topics]
    .sort((a, b) => b.count - a.count)
    .map((t, i) => ({
      name: t.label,
      count: t.count,
      pct: Math.round((t.count / totalResponses) * 100),
      color: COLORS[i % COLORS.length],
    }));

  const chartHeight = Math.max(280, data.length * 38);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Topic Distribution</h2>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} />
          <YAxis
            type="category"
            dataKey="name"
            width={Y_WIDTH}
            tick={<WrapTick />}
          />
          <Tooltip
            formatter={(value: number, _name, props) => [
              `${value} responses (${props.payload.pct}%)`,
              "Count",
            ]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
