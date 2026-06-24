import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { revealVariants } from '../lib/motion';
import { AnimatedPricingCard } from './AnimatedPricingCard';
import { getLifetimeSlotsRemaining, getProfile } from '../lib/profiles';
import { SectionLabel } from './LandingSectionLabel';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function LandingPricing() {
  const [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<'pro' | 'lifetime' | null>(null);
  const { session } = useAuth();
  const navigate = useNavigate();
  const isGrandfatheringActive = new Date() < new Date('2026-09-01');

  useEffect(() => {
    getLifetimeSlotsRemaining().then((slots) => {
      if (slots !== null) setLifetimeSlots(slots);
    });
  }, []);

  const handleCtaClick = async (planKey: 'pro' | 'lifetime' | null) => {
    if (!planKey) {
      navigate('/login');
      return;
    }
    if (!session) {
      sessionStorage.setItem('pending_plan', planKey);
      navigate(`/login?tab=signup&plan=${planKey}`);
      return;
    }
    setLoadingPlan(planKey);
    try {
      const profile = await getProfile(session.user.id);
      if (profile && (profile.plan === 'pro' || profile.plan === 'pro_annual' || profile.plan === 'lifetime')) {
        navigate('/books');
        return;
      }
      const { data, error } = await supabase.functions.invoke('create-payment-url', {
        body: { plan: planKey },
      });
      if (error || !data?.url) throw error ?? new Error('no url');
      window.location.href = data.url as string;
    } catch {
      setLoadingPlan(null);
      navigate('/books');
    }
  };

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
      cta: 'Начать бесплатно', accent: false, tag: null, planKey: null as 'pro' | 'lifetime' | null,
    },
    {
      name: 'Pro',
      price: isGrandfatheringActive ? '290 ₽' : '399 ₽',
      priceOld: isGrandfatheringActive ? '399 ₽' : undefined,
      sub: isGrandfatheringActive ? 'в месяц' : 'в месяц · или 3 490 ₽/год',
      subAnnualOld: isGrandfatheringActive ? '3 490 ₽' : undefined,
      subAnnualNew: isGrandfatheringActive ? '2 900 ₽/год' : undefined,
      promoBadge: isGrandfatheringActive ? '⏰ Ранняя цена · до 1 сентября' : undefined,
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
      cta: 'Перейти на Pro', accent: true, tag: 'Чаще выбирают', planKey: 'pro' as 'pro' | 'lifetime' | null,
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
      cta: 'Купить Lifetime', accent: false, tag: `${slotsLabel} мест · ранний доступ`, planKey: 'lifetime' as 'pro' | 'lifetime' | null,
    },
  ];

  // null = загружается; 0 = слоты кончились → скрываем Lifetime
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
                {'priceOld' in t && t.priceOld && (
                  <span style={{ display: 'block', font: '400 15px var(--font-serif)', color: 'var(--ink-4)', textDecoration: 'line-through', marginBottom: 2 }}>
                    {t.priceOld}
                  </span>
                )}
                <span style={{ font: '600 48px var(--font-serif)', letterSpacing: '-0.018em', color: 'var(--ink)' }}>{t.price}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 'promoBadge' in t && t.promoBadge ? 8 : 18 }}>
                {'subAnnualOld' in t && t.subAnnualOld
                  ? <>{t.sub} · или <s style={{ color: 'var(--ink-4)' }}>{t.subAnnualOld}</s> {'subAnnualNew' in t ? t.subAnnualNew : ''}</>
                  : t.sub
                }
              </div>
              {'promoBadge' in t && t.promoBadge && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'oklch(0.80 0.14 80 / 0.10)', border: '1px solid oklch(0.80 0.14 80 / 0.28)', borderRadius: 999, font: '500 10px var(--font-mono)', color: 'oklch(0.80 0.14 80)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
                  {t.promoBadge}
                </div>
              )}
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
              <button
                onClick={() => void handleCtaClick(t.planKey)}
                disabled={loadingPlan !== null || (t.planKey === 'lifetime' && lifetimeSlots === null)}
                className={t.accent ? 'btn btn--primary' : 'btn'}
                style={{ height: 42, fontSize: 14, justifyContent: 'center', width: '100%', display: 'flex', alignItems: 'center' }}
              >
                {loadingPlan !== null && loadingPlan === t.planKey ? 'Подождите…' : t.cta}
              </button>
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
