import { Icon } from './Icon';

export const COVERS = [
  '#7c1d1d', '#3d4a2e', '#1c3a4a', '#4a2e3c',
  '#2a4a3a', '#4a3a2a', '#1e2a4a', '#3a2a4a',
  '#4a2a1e', '#2a3a4a', '#1c4a32', '#4a1c3a',
];

export const isImageUrl = (v: string) => v.startsWith('http') || v.startsWith('blob:');

export function CoverPicker({
  value, onChange, uploading, onFileSelect,
}: {
  value: string;
  onChange: (c: string) => void;
  uploading?: boolean;
  onFileSelect?: (f: File) => void;
}) {
  const hasImage = isImageUrl(value);
  return (
    <div>
      <label className="label">Обложка</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
        {COVERS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="cover-swatch"
            style={{
              cursor: 'pointer', padding: 0,
              background: `linear-gradient(160deg, ${c}, oklch(0.20 0.02 50))`,
              border: !hasImage && value === c ? '2px solid var(--accent)' : '2px solid transparent',
              outline: !hasImage && value === c ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'outline 0.12s, border-color 0.12s',
            }}
          >
            {!hasImage && value === c && (
              <span style={{ color: 'oklch(0.97 0.01 80)', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>✓</span>
            )}
          </button>
        ))}

        {onFileSelect && (
          <label
            title="Загрузить изображение"
            className="cover-upload-tile"
            style={{
              borderRadius: 8, cursor: uploading ? 'default' : 'pointer',
              border: hasImage ? '2px solid var(--accent)' : '2px dashed var(--border)',
              outline: hasImage ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hasImage ? `url(${value}) center/cover` : 'var(--surface-2)',
              color: 'var(--ink-3)',
              transition: 'border-color 0.12s',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {!hasImage && !uploading && <Icon name="camera" size={16} />}
            {uploading && (
              <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>…</span>
            )}
            {hasImage && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'oklch(0 0 0 / 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: 'oklch(0.98 0 0)', fontSize: 15, fontWeight: 700 }}>✓</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileSelect(f);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {hasImage && (
        <button
          type="button"
          onClick={() => onChange(COVERS[0])}
          style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Удалить изображение
        </button>
      )}
    </div>
  );
}
