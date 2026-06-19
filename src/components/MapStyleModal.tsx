import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import { MAP_TEMPLATES, type MapTemplateId } from '../lib/mapTemplates';

interface MapStyleModalProps {
  open: boolean;
  onClose: () => void;
  activeTemplateId: MapTemplateId;
  hasCustomBg: boolean;
  bgUrl: string | null;
  onSelectTemplate: (id: MapTemplateId) => void;
  onPickFile: () => void;
  onRemoveBg: () => void;
}

export function MapStyleModal({
  open, onClose, activeTemplateId, hasCustomBg, bgUrl,
  onSelectTemplate, onPickFile, onRemoveBg,
}: MapStyleModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Стиль карты"
            tabIndex={-1}
            variants={modalPanelVariants}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', width: 360, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 8px 40px oklch(0 0 0 / 0.6)', outline: 'none' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                const focusable = e.currentTarget.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
                const first = focusable[0]; const last = focusable[focusable.length - 1];
                if (!first) return;
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                  e.preventDefault(); (e.shiftKey ? last : first).focus();
                }
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ font: '500 14px var(--font-ui)', color: 'var(--ink)' }}>Стиль карты</span>
              <button type="button" onClick={onClose} aria-label="Закрыть" title="Закрыть" className="icon-close-btn" style={{ fontSize: 20, padding: '0 2px' }}>×</button>
            </div>

            {/* Template picker */}
            <div style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Шаблон</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {MAP_TEMPLATES.map(t => {
                const active = activeTemplateId === t.id && !hasCustomBg;
                return (
                  <button
                    key={t.id}
                    aria-pressed={active}
                    onClick={() => onSelectTemplate(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                      borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-soft)',
                      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    }}
                  >
                    <span style={{
                      width: 32, height: 20, borderRadius: 4, flexShrink: 0,
                      background: t.swatchBg,
                      border: `1px solid ${t.swatchBorder}`,
                      display: 'inline-block',
                    }} />
                    <div>
                      <div style={{ font: '500 12px var(--font-ui)', color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{t.label}</div>
                      <div style={{ font: '400 10px var(--font-ui)', color: 'var(--ink-4)', marginTop: 1 }}>{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom background */}
            <div style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Свой фон</div>
            {hasCustomBg && bgUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                  src={bgUrl}
                  alt="Фон карты"
                  style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border-soft)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Загружено
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={onPickFile}>
                      Заменить
                    </button>
                    <button className="btn btn--ghost" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }} onClick={onRemoveBg}>
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 10px' }}>
                  Нарисуйте карту в <strong style={{ color: 'var(--ink-2)' }}>Inkarnate</strong> или другом редакторе и загрузите как фон поверх шаблона.
                </p>
                <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-4)', marginBottom: 12 }}>
                  JPG / PNG / WebP · до 5 МБ · рекомендуется 1600×900 px
                </div>
                <button className="btn" style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 6 }} onClick={onPickFile}>
                  <span>🖼</span> Выбрать файл
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
