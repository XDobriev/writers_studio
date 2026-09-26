interface SkeletonProps {
  lines?: number;
  height?: number;
  widths?: number[];
  /** `paper` — на светлом листе редактора */
  tone?: 'surface' | 'paper';
  gap?: number;
}

export function Skeleton({ lines = 4, height = 14, widths, tone = 'surface', gap = 8 }: SkeletonProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={tone === 'paper' ? 'skeleton skeleton--paper' : 'skeleton'}
          style={{ height, width: `${widths?.[i % widths.length] ?? (i % 3 === 0 ? 80 : i % 3 === 1 ? 65 : 72)}%` }}
        />
      ))}
    </div>
  );
}
