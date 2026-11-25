import { fmtNum } from "@/lib/format";

interface Props {
  title: string;
  unit: string;
  color: string;
  data: { key: string; label: string; value: number }[];
}

/** Lightweight server-rendered bar chart (no client JS). */
export function BarChart({ title, unit, color, data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <div className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm text-neutral-400">{title}</h3>
        <span className="text-xs text-neutral-500">макс. {fmtNum(max)} {unit}</span>
      </div>
      <div className="flex h-40 items-end gap-[2px]">
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full flex-1 items-end" title={`${d.label}: ${fmtNum(d.value)} ${unit}`}>
            <div
              className="w-full rounded-t-sm opacity-80 transition group-hover:opacity-100"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0, background: color }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-neutral-500">
        {data.map((d, i) => (
          <div key={d.key} className="flex-1 overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 ? d.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
