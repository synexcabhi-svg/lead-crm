export interface BarItem {
  label: string;
  count: number;
  color?: string;
}

export function BarList({ items, empty = "No data" }: { items: BarItem[]; empty?: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return (
    <div className="bar-list">
      {items.map((it) => {
        const pct = total > 0 ? Math.round((it.count / total) * 100) : 0;
        return (
          <div className="bar-row" key={it.label}>
            <span className="bar-label" title={it.label}>
              {it.label}
            </span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{
                  width: `${(it.count / max) * 100}%`,
                  background: it.color,
                }}
              />
            </span>
            <span className="num">
              {it.count}
              {total > 0 ? <span className="pct">{pct}%</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
