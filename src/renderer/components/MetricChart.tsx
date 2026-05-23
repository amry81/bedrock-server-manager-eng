interface Props {
  data: number[];
  /** Fixed max for the Y axis; if omitted, scales to the data max. */
  max?: number;
  color: string;
  unit: string;
  label: string;
  current: number;
}

const W = 320;
const H = 80;

export default function MetricChart({ data, max, color, unit, label, current }: Props) {
  const peak = Math.max(max ?? 0, ...data, 1);
  const n = data.length;

  const coords =
    n > 1
      ? data.map((v, i) => {
          const x = (i / (n - 1)) * W;
          const y = H - (v / peak) * H;
          return { x, y };
        })
      : [];

  const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `M0,${H} ` + coords.map((c) => `L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') + ` L${W},${H} Z`
      : '';

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-neutral-400">{label}</span>
        <span className="text-lg font-semibold" style={{ color }}>
          {current.toFixed(1)}
          <span className="ml-1 text-xs text-neutral-500">{unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none">
        {n > 1 && (
          <>
            <path d={areaPath} fill={color} opacity={0.12} />
            <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
          </>
        )}
      </svg>
    </div>
  );
}
