export function StatCard({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold" style={accent ? { color: accent } : undefined}>
          {value}
        </span>
        {unit && <span className="text-sm text-neutral-400">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}
