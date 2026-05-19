export function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onCancel}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '24px 28px', width: 360, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ font: '400 14px/1.6 var(--font-ui)', color: 'var(--ink)', margin: 0 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn btn--ghost">Отмена</button>
          <button onClick={onConfirm} className="btn btn--ghost" style={{ color: 'var(--danger)' }}>Удалить</button>
        </div>
      </div>
    </div>
  );
}
