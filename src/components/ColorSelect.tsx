"use client";

/**
 * A native <select> with a colour swatch for the current value and per-option
 * coloured text. Used for the Source and Sales Team pickers.
 */
export interface ColorOption {
  value: string;
  label: string;
  color?: string | null;
}

export function ColorSelect({
  value,
  onChange,
  options,
  placeholder,
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ColorOption[];
  placeholder?: string;
  compact?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <span style={{ position: "relative", display: "block", width: "100%" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: 10,
          transform: "translateY(-50%)",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: current?.color || "transparent",
          border: current?.color ? "none" : "1px solid var(--border)",
          pointerEvents: "none",
        }}
      />
      <select
        className="select"
        style={{ paddingLeft: 25, ...(compact ? { padding: "3px 6px 3px 25px", fontSize: "0.78rem" } : {}) }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={o.color ? { color: o.color } : undefined}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Small coloured pill - reuse for Source / Sales Team read-only display. */
export function ColorTag({ label, color }: { label: string; color?: string | null }) {
  return (
    <span
      className="badge"
      style={{ background: color || "#6b7280" }}
    >
      {label}
    </span>
  );
}
