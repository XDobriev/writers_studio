import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

async function hexDigest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

const consentText = 'Согласен на контрольную покупку Pro за 1 ₽ и не более двух тестовых автосписаний по 1 ₽ в течение прогона. По окончании проверки автопродление отключается.';

function getOffer() {
  const values = new URLSearchParams(window.location.hash.slice(1));
  const account = values.get('account');
  const invoice = values.get('invoice');
  const deadline = Date.parse(values.get('until') ?? '');
  if (window.location.origin !== 'https://avtorstudio.com' || !account || !invoice ||
      !Number.isFinite(deadline) || Date.now() >= deadline) return null;
  return { account, invoice };
}

async function eligible() {
  const offer = getOffer();
  if (!offer) return null;
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user && (await hexDigest(data.user.id)) === offer.account ? offer : null;
}

export default function RecurringCheck() {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Проверяем аккаунт…');

  useEffect(() => {
    let mounted = true;
    eligible().then(offer => {
      if (!mounted) return;
      setReady(!!offer);
      setMessage(offer ? '' : 'Предложение недоступно.');
    }).catch(() => { if (mounted) setMessage('Не удалось проверить аккаунт.'); });
    return () => { mounted = false; };
  }, []);

  async function openCheckout() {
    if (!consent || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const offer = await eligible();
      if (!offer) throw new Error('Предложение недоступно.');
      const { data, error } = await supabase.functions.invoke('create-payment-url', {
        body: { plan: 'pro', consent: true, qa_recurring: true },
      });
      if (error || typeof data?.url !== 'string') throw new Error('Не удалось подготовить контрольный счёт.');
      const url = new URL(data.url);
      const params = url.searchParams;
      if (url.origin !== 'https://auth.robokassa.ru' || url.pathname !== '/Merchant/Index.aspx' ||
          url.username || url.password || params.get('OutSum') !== '1.00' ||
          params.get('Recurring') !== 'true' || params.get('IsTest') !== '0' || params.get('Shp_plan') !== 'pro' ||
          await hexDigest(params.get('InvId') ?? '') !== offer.invoice) {
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
        <h1>Проверка автопродления Pro</h1>
        <p>Сегодня 1 ₽. В рамках этой проверки возможны ещё два тестовых списания по 1 ₽.</p>
        <p><label><input type="checkbox" checked={consent} disabled={busy}
          onChange={event => setConsent(event.currentTarget.checked)} /> {consentText}</label></p>
        <button type="button" className="btn btn--primary" disabled={!consent || busy} onClick={openCheckout}>
          {busy ? 'Открываем оплату…' : 'Перейти в Робокассу'}
        </button>
      </>}
      <p role="status">{message}</p>
    </main>
  );
}
