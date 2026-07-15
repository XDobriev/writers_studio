import { useEffect, useState } from 'react';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { fetchActivationFunnel, fetchCancellations, type ActivationFunnel, type AdminCancellations } from '../lib/admin';
import { ActivationFunnelPanel } from '../components/admin/ActivationFunnelPanel';
import { CancellationsPanel } from '../components/admin/CancellationsPanel';

const C_ACCENT = 'oklch(0.63 0.16 30)';
const C_BORDER = 'oklch(0.28 0.010 50)';
const C_INK4   = 'oklch(0.46 0.012 60)';
const C_OK     = 'oklch(0.72 0.14 145)';
const C_WARN   = 'oklch(0.80 0.14 80)';
const C_DANGER = 'oklch(0.65 0.18 25)';

interface DauPoint { day: string; dau: number; }
interface RetentionData { eligible_7d: number; active_7d: number; eligible_30d: number; active_30d: number; }
interface AnomalyUser { id: string; email: string; created_at: string; last_active?: string | null; }
interface AnomaliesData { no_books: AnomalyUser[]; inactive_60d: AnomalyUser[]; }

export interface TopUser { email: string; words_total: number; }
interface Props { topUsers: TopUser[]; }

function fmtDay(iso: string): string {
  const normalized = iso.length === 10 ? iso + 'T12:00:00' : iso;
  return new Date(normalized).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function fmtDate(iso: string): string {
  const normalized = iso.length === 10 ? iso + 'T12:00:00' : iso;
  return new Date(normalized).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс`;
  return String(n);
}

function SectionTitle({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: 'var(--accent)', marginBottom: 12, marginTop: first ? 0 : 32,
    }}>
      {children}
    </div>
  );
}

interface DauTooltipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string; }
function DauTooltip({ active, payload, label }: DauTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '8px 12px' }}>
      <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', marginBottom: 4 }}>
        {label ? fmtDay(label) : ''}
      </div>
      <div style={{ font: '600 16px var(--font-serif)', color: 'var(--ink)' }}>
        {payload[0].value} юзеров
      </div>
    </div>
  );
}

function RetentionCard({ label, eligible, active, color }: { label: string; eligible: number; active: number; color: string }) {
  const pct = eligible > 0 ? Math.round((active / eligible) * 100) : 0;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '20px 24px' }}>
      <div style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        {label}
      </div>
      <div style={{ font: '600 36px var(--font-serif)', letterSpacing: '-0.02em', margin: '8px 0 12px', color }}>
        {pct}%
      </div>
      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>
        из {eligible} юзеров — {active} были активны
      </div>
    </div>
  );
}

function AnomalyCard({
  title, dot, items, renderSub,
}: {
  title: string;
  dot: string;
  items: AnomalyUser[];
  renderSub: (u: AnomalyUser) => string;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ font: '500 12px var(--font-ui)', color: 'var(--ink-2)' }}>{title}</span>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', marginLeft: 'auto' }}>
          {items.length} юзеров
        </span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '16px', font: '400 12px var(--font-ui)', color: 'var(--ink-4)', textAlign: 'center' }}>Нет</div>
      ) : items.map((u, i) => (
        <div
          key={u.id}
          style={{
            padding: '9px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: i < items.length - 1 ? '1px solid oklch(0.28 0.010 50 / 0.5)' : 'none',
          }}
        >
          <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
            {u.email}
          </span>
          <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', flexShrink: 0 }}>
            {renderSub(u)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalytics({ topUsers }: Props) {
  const [dau, setDau] = useState<DauPoint[] | null>(null);
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [anomalies, setAnomalies] = useState<AnomaliesData | null>(null);
  const [funnel, setFunnel] = useState<ActivationFunnel | null>(null);
  const [cancellations, setCancellations] = useState<AdminCancellations | null>(null);
  const { error: err, setError: setErr } = useErrorState();

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_admin_dau_trend'),
      supabase.rpc('get_admin_retention'),
      supabase.rpc('get_admin_anomalies'),
    ]).then(([dauRes, retRes, anRes]) => {
      const firstErr = dauRes.error?.message ?? retRes.error?.message ?? anRes.error?.message ?? null;
      if (firstErr) setErr(firstErr);
      if (!dauRes.error) setDau((dauRes.data as DauPoint[]) ?? []);
      if (!retRes.error) setRetention(retRes.data as unknown as RetentionData);
      if (!anRes.error) setAnomalies(anRes.data as unknown as AnomaliesData);
    });
  }, [setErr]);

  useEffect(() => {
    fetchActivationFunnel()
      .then(setFunnel)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Не удалось загрузить воронку'));
    fetchCancellations()
      .then(setCancellations)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Не удалось загрузить причины отмен'));
  }, [setErr]);

  const maxWords = topUsers[0]?.words_total || 1;

  return (
    <div>
      {err && (
        <ErrorBanner message={err} style={{ marginBottom: 16 }} />
      )}

      <SectionTitle first>Активация — без тестовых аккаунтов</SectionTitle>
      <ActivationFunnelPanel data={funnel} />

      <SectionTitle>Тренд активности (30 дней)</SectionTitle>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '20px 24px 12px' }}>
        <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 16 }}>
          DAU — уникальных пишущих в день
        </div>
        {dau == null ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            Загрузка…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={dau} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C_BORDER} vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={fmtDay}
                tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', fill: C_INK4 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', fill: C_INK4 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<DauTooltip />} cursor={{ stroke: C_BORDER, strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="dau"
                stroke={C_ACCENT}
                strokeWidth={2}
                fill={C_ACCENT}
                fillOpacity={0.12}
                dot={false}
                activeDot={{ r: 4, fill: C_ACCENT, stroke: 'none' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <SectionTitle>Причины отмен</SectionTitle>
      <CancellationsPanel data={cancellations} />

      <SectionTitle>Retention</SectionTitle>
      {retention == null ? (
        <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Загрузка…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <RetentionCard label="Retention 7 дней" eligible={retention.eligible_7d} active={retention.active_7d} color={C_OK} />
          <RetentionCard label="Retention 30 дней" eligible={retention.eligible_30d} active={retention.active_30d} color={C_WARN} />
        </div>
      )}

      <SectionTitle>Топ-10 по написанному</SectionTitle>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '16px 20px' }}>
        {topUsers.length === 0 ? (
          <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', textAlign: 'center', padding: '8px 0' }}>Нет данных</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topUsers.map((u) => (
              <div key={u.email} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-2)', width: 200, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.email}
                </span>
                <div style={{ flex: 1, height: 20, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((u.words_total / maxWords) * 100)}%`,
                    background: 'oklch(0.63 0.16 30 / 0.18)',
                    borderRight: `2px solid ${C_ACCENT}`,
                    borderRadius: 4,
                    minWidth: 4,
                  }} />
                </div>
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', width: 52, textAlign: 'right', flexShrink: 0 }}>
                  {fmtWords(u.words_total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionTitle>Аномалии</SectionTitle>
      {anomalies == null ? (
        <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Загрузка…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <AnomalyCard
            title="Без книг (>7 дней)"
            dot={C_WARN}
            items={anomalies.no_books}
            renderSub={(u) => `зарег. ${fmtDate(u.created_at)}`}
          />
          <AnomalyCard
            title="Неактивны 60+ дней"
            dot={C_DANGER}
            items={anomalies.inactive_60d}
            renderSub={(u) => u.last_active ? `посл. вход ${fmtDate(u.last_active)}` : 'не заходил(а)'}
          />
        </div>
      )}
    </div>
  );
}
