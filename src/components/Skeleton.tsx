interface SkeletonProps {
  lines?: number;
  height?: number;
  widths?: number[];
}

export function Skeleton({ lines = 4, height = 14, widths }: SkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height, width: `${widths?.[i % widths.length] ?? (i % 3 === 0 ? 80 : i % 3 === 1 ? 65 : 72)}%` }}
        />
      ))}
    </div>
  );
}
