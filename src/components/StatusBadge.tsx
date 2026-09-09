export function StatusBadge({ label, color }: { label: string; color?: string | null }) {
  return (
    <span className="badge" style={{ background: color || "#6b7280" }}>
      {label}
    </span>
  );
}

export function PriorityPill({ value }: { value: string }) {
  return <span className={`pill ${value}`}>{value}</span>;
}
