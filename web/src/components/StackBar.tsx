export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  display: string;
}

/** Horizontal stacked bar with a legend underneath. */
export function StackBar({ title, aside, segments }: { title: string; aside?: React.ReactNode; segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <section className="stack">
      <div className="stack-head">
        <h3 className="section-title">{title}</h3>
        {aside && <span className="stack-aside">{aside}</span>}
      </div>
      <div className="stack-bar" role="img" aria-label={segments.map((s) => `${s.label} ${s.display}`).join(", ")}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.key}
              className="stack-seg"
              style={{ flexGrow: total > 0 ? s.value / total : 0, background: s.color }}
              title={`${s.label} · ${s.display}`}
            />
          ))}
      </div>
      <ul className="stack-legend">
        {segments.map((s) => (
          <li key={s.key}>
            <span className="square" style={{ background: s.color }} />
            <span className="muted">{s.label}</span>
            <span className="num">{s.display}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
