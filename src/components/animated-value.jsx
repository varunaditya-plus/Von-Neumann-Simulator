export function AnimatedValue({ before, after, progress, duration }) {
  const previous = String(before ?? "-");
  const next = String(after ?? "-");

  if (previous === next) return <span>{next}</span>;

  // Roll the value only during the fixed 180 ms arrival phase.
  const arrival = Math.max(0, Math.min(1, (progress * duration - (duration - 180)) / 180));
  const value = arrival < 0.5 ? previous : next;

  return (
    <span className="inline-grid overflow-hidden align-middle" aria-label={value}>
      <span
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          opacity: 1 - arrival,
          transform: `translateY(${-arrival * 100}%)`,
        }}
      >
        {previous}
      </span>
      <span
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          opacity: arrival,
          transform: `translateY(${(1 - arrival) * 100}%)`,
        }}
      >
        {next}
      </span>
    </span>
  );
}