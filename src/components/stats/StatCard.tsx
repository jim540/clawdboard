export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-surface"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-1">
        {label}
      </p>
      <p className="font-display text-xl font-bold text-foreground sm:text-2xl">
        {value}
      </p>
      <p className="font-mono text-[11px] text-dim mt-0.5">{sub}</p>
    </div>
  );
}
