import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { startCheckout } from '../lib/checkout';

// Link fragments are local display checks. The server authorizes and prices each order.
const offer = new URLSearchParams(window.location.hash.slice(1));
const accountHash = offer.get('account');
const invoiceHash = offer.get('invoice');
const endsAt = Date.parse(offer.get('until') ?? '');

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function eligible(): Promise<boolean> {
  if (window.location.origin !== 'https://avtorstudio.com' || !Number.isFinite(endsAt) ||
      Date.now() >= endsAt || !accountHash || !invoiceHash) return false;
  const { data, error } = await supabase.auth.getUser();
  return !error && !!data.user && await digest(data.user.id) === accountHash;
}

export default function OneTimeCheckout() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Проверяем доступ к предложению…');

  useEffect(() => {
    let active = true;
    eligible().then(ok => {
      if (!active) return;
      setReady(ok);
      setMessage(ok ? '' : 'Предложение недоступно.');
    }).catch(() => { if (active) setMessage('Не удалось проверить аккаунт.'); });
    return () => { active = false; };
  }, []);

  async function openCheckout() {
    setBusy(true);
    try {
      if (!await eligible()) throw new Error('Предложение недоступно.');
      const url = new URL(await startCheckout('pro', false));
      const params = url.searchParams;
      if (url.origin !== 'https://auth.robokassa.ru' || url.pathname !== '/Merchant/Index.aspx' ||
          url.username || url.password || params.get('OutSum') !== '1.00' || params.has('Recurring') ||
          params.get('IsTest') !== '0' || params.get('Shp_plan') !== 'pro' ||
          await digest(params.get('InvId') ?? '') !== invoiceHash) {
        throw new Error('Условия счёта изменились. Оплата остановлена.');
      }
      window.location.assign(url.href);
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : 'Не удалось открыть оплату.');
    }
  }

  return (
    <main style={{ maxWidth: 500, margin: '12vh auto', padding: 24 }}>
      <Link to="/books">В студию</Link>
      {ready && <>
        <h1>Месяц Pro за 1 ₽</h1>
        <p>Разовая покупка без автопродления.</p>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={openCheckout}>
          {busy ? 'Открываем оплату…' : 'Перейти в Робокассу'}
        </button>
      </>}
      <p role="status">{message}</p>
    </main>
  );
}
