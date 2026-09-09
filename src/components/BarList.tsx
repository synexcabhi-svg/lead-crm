export interface BarItem {
  label: string;
  count: number;
  color?: string;
}

export function BarList({ items, empty = "No data" }: { items: BarItem[]; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="bar-list">
      {items.map((it) => (
        <div className="bar-row" key={it.label}>
          <span title={it.label} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {it.label}
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${(it.count / max) * 100}%`, background: it.color }}
            />
          </span>
          <span className="num">{it.count}</span>
        </div>
      ))}
    </div>
  );
}
