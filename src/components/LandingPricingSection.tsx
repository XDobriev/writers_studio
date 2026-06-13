import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { revealVariants } from '../lib/motion';
import { AnimatedPricingCard } from './AnimatedPricingCard';
import { getLifetimeSlotsRemaining } from '../lib/profiles';
import { SectionLabel } from './LandingSectionLabel';

export function LandingPricing() {
  const [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);

  useEffect(() => {
    getLifetimeSlotsRemaining().then((slots) => {
      if (slots !== null) setLifetimeSlots(slots);
    });
  }, []);

  const slotsLabel = lifetimeSlots !== null ? `${lifetimeSlots}` : '…';

  const tiers = [
    {
      name: 'Free', price: '0 ₽', sub: 'навсегда',
      summary: 'Одна книга навсегда — без триала и без ограничений по времени.',
      features: [
        ['Одна книга · редактор · 4 режима', true],
        ['До 3 персонажей (со связями)', true],
        ['Хронология · до 10 событий', true],
        ['Карта мира · заметки', true],
        ['Экспорт: TXT и HTML', true],
        ['Экспорт EPUB, FB2 (для читалок), DOCX', false],
        ['Безлимит персонажей и хронологии', false],
      ] as [string, boolean][],
      cta: 'Начать бесплатно', accent: false, tag: null, signup: true,
    },
    {
      name: 'Pro', price: '399 ₽', sub: 'в месяц · или 3 490 ₽/год',
      summary: 'Для тех, кто работает всерьёз — безлимит персонажей, хронологии и полный экспорт.',
      features: [
        ['Безлимит книг и персонажей', true],
        ['Безлимит хронологии', true],
        ['Экспорт EPUB, FB2 (для читалок), DOCX', true],
        ['История версий глав без лимита', true],
        ['Сводка · карта активности · серия дней', true],
        ['Приоритетная поддержка', true],
        ['Доступ к закрытому чату автора', true],
      ] as [string, boolean][],
      cta: 'Перейти на Pro', accent: true, tag: 'Чаще выбирают', signup: true,
    },
    {
      name: 'Lifetime', price: '4 990 ₽', sub: 'один раз · навсегда',
      summary: `Разовая оплата. Все обновления Pro — на всю жизнь. Осталось ${slotsLabel} мест.`,
      features: [
        ['Всё из тарифа Pro', true],
        ['Все будущие обновления', true],
        ['Никаких подписок', true],
        ['Приоритетная поддержка', true],
        ['Имя в титрах беты', true],
        ['Закрытое сообщество авторов', true],
        [`Только первые 50 покупателей`, true],
      ] as [string, boolean][],
      cta: 'Купить Lifetime', accent: false, tag: `${slotsLabel} мест · ранний доступ`, signup: true,
    },
  ];

  const visibleTiers = lifetimeSlots === 0 ? tiers.filter(t => t.name !== 'Lifetime') : tiers;

  return (
    <section id="pricing" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <SectionLabel align="center" kicker="Тарифы" title="Начните бесплатно." subtitle="Бесплатный план — не «пробный период на 14 дней». Одна книга навсегда. Переходите на Pro, когда проект вырастет." />
        <div className="lnd-prices">
          {visibleTiers.map((t) => (
            <motion.div
              key={t.name}
              variants={revealVariants}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: '-80px' }}
            >
              <AnimatedPricingCard
                featured={t.accent}
                className={`lnd-price-card${t.accent ? ' lnd-price-card--accent' : ''}`}
                style={{ position: 'relative', background: t.accent ? 'var(--surface)' : 'var(--bg)', border: t.accent ? '1px solid var(--accent)' : '1px solid var(--border-soft)', borderRadius: 14, padding: '32px 28px 28px', display: 'flex', flexDirection: 'column', boxShadow: t.accent ? '0 20px 60px oklch(0 0 0 / 0.3),0 0 0 4px var(--accent-soft)' : 'none' }}
              >
              {t.tag && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '4px 12px', borderRadius: 999, background: t.accent ? 'var(--accent)' : 'var(--surface-2)', color: t.accent ? 'oklch(0.98 0 0)' : 'var(--ink-2)', font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', border: t.accent ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap' }}>{t.tag}</div>}
              <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: t.accent ? 'var(--accent)' : 'var(--ink-3)', marginBottom: 14 }}>{t.name}</div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ font: '600 48px var(--font-serif)', letterSpacing: '-0.018em', color: 'var(--ink)' }}>{t.price}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 18 }}>{t.sub}</div>
              <p style={{ font: '400 14px/1.5 var(--font-serif)', color: 'var(--ink-2)', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border-soft)' }}>{t.summary}</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                {t.features.map(([l, on], fi) => (
                  <li key={fi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: on ? 'var(--ink)' : 'var(--ink-4)' }}>
                    <span style={{ flexShrink: 0, marginTop: 3, color: on ? 'var(--accent-2)' : 'var(--ink-4)' }}>
                      {on
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="12" x2="18" y2="12"/></svg>
                      }
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
              <Link to={t.signup ? '/login?tab=signup' : '/login'} className={t.accent ? 'btn btn--primary' : 'btn'} style={{ height: 42, fontSize: 14, justifyContent: 'center', width: '100%', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>{t.cta}</Link>
              {t.name !== 'Free' && (
                <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', lineHeight: 1.5 }}>
                  Нажимая кнопку, вы соглашаетесь с{' '}
                  <Link to="/offer" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>условиями оферты</Link>
                </p>
              )}
              </AnimatedPricingCard>
            </motion.div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'var(--ink-3)' }}>
          <span style={{ color: 'var(--ink-2)' }}>Возврат — 14 дней без вопросов.</span>
        </p>
      </div>
    </section>
  );
}
