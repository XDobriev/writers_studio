import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildReceipt,
  classifyRefundCreate,
  fetchOpKey,
  fetchOpState,
  newInvId,
} from '../../supabase/functions/_shared/robokassa.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const xml = (result: number, state?: number, opKey?: string) =>
  `<OperationStateResponse><Result><Code>${result}</Code></Result>` +
  (state === undefined ? '' : `<State><Code>${state}</Code></State>`) +
  (opKey ? `<Info><OpKey>${opKey}</OpKey></Info>` : '') +
  `</OperationStateResponse>`;

const okResponse = (body: string) => new Response(body, { status: 200 });

// Receipt по ФЗ-54: ошибка в полях = чек не пробьётся или платёж отклонят.
describe('buildReceipt', () => {
  it('одна позиция: услуга, полная оплата, без НДС', () => {
    const { json } = buildReceipt('Pro на месяц', '299.00');
    expect(JSON.parse(json)).toEqual({
      items: [{
        name: 'Pro на месяц',
        quantity: 1,
        sum: 299,
        payment_method: 'full_payment',
        payment_object: 'service',
        tax: 'none',
      }],
    });
  });

  it('email добавляется только если передан', () => {
    expect(JSON.parse(buildReceipt('x', '1').json)).not.toHaveProperty('email');
    expect(JSON.parse(buildReceipt('x', '1', null).json)).not.toHaveProperty('email');
    expect(JSON.parse(buildReceipt('x', '1', 'a@b.ru').json).email).toBe('a@b.ru');
  });

  // B-1: Робокасса спросит адрес на странице оплаты, чек дочернего уйдёт на адрес материнской.
  it('синтетический адрес Telegram/VK в Receipt не попадает', () => {
    expect(JSON.parse(buildReceipt('x', '1', 'tg_1@telegram.local').json)).not.toHaveProperty('email');
    expect(JSON.parse(buildReceipt('x', '1', 'not-an-email').json)).not.toHaveProperty('email');
  });

  // Две формы одного объекта: raw — в подпись, encoded — в URL (docs/features/payments.md).
  it('encoded = encodeURIComponent(json), json не кодирован', () => {
    const { json, encoded } = buildReceipt('Pro', '10.50', 'a@b.ru');
    expect(encoded).toBe(encodeURIComponent(json));
    expect(json).toContain('"name":"Pro"');
    expect(decodeURIComponent(encoded)).toBe(json);
  });

  it('сумма — число из строки', () => {
    expect(JSON.parse(buildReceipt('x', '1990.50').json).items[0].sum).toBe(1990.5);
  });
});

// InvId обязан быть целым и уникальным — иначе Робокасса отклонит счёт.
describe('newInvId', () => {
  it('Date.now() + три цифры суффикса, только цифры', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    expect(newInvId(7)).toBe('1700000000000007');
    expect(newInvId(123)).toBe('1700000000000123');
  });

  it('случайный суффикс — всегда ровно 3 цифры', () => {
    for (let i = 0; i < 50; i++) expect(newInvId()).toMatch(/^\d{13}\d{3}$/);
  });
});

// Разбор ответа OpStateExt: от State зависит, можно ли повторно списывать (billingRetry).
describe('fetchOpState', () => {
  it('разбирает Result, State и OpKey', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(xml(0, 100, 'KEY-123'))));
    expect(await fetchOpState('shop', '42', 'pw2')).toEqual({ resultCode: 0, stateCode: 100, opKey: 'KEY-123' });
  });

  it('оплата не картой: OpKey нет — null в поле, состояние разобрано', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(xml(0, 100))));
    expect(await fetchOpState('shop', '42', 'pw2')).toEqual({ resultCode: 0, stateCode: 100, opKey: null });
  });

  it('операции нет (Result != 0): resultCode разобран, state null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(xml(3))));
    expect(await fetchOpState('shop', '42', 'pw2')).toEqual({ resultCode: 3, stateCode: null, opKey: null });
  });

  it('мусор вместо XML — все поля null, не исключение', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('<html>oops</html>')));
    expect(await fetchOpState('shop', '42', 'pw2')).toEqual({ resultCode: null, stateCode: null, opKey: null });
  });

  it('запрос подписан MD5(login:invId:password2), параметры закодированы', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(xml(0, 100)));
    vi.stubGlobal('fetch', fetchMock);
    await fetchOpState('my shop', '42', 'pw2');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt');
    expect(url.searchParams.get('MerchantLogin')).toBe('my shop');
    expect(url.searchParams.get('InvoiceID')).toBe('42');
    // md5('my shop:42:pw2') — посчитано независимо (node:crypto)
    expect(url.searchParams.get('Signature')).toBe('de6be8af3afa8584daa45faa563aa4ab');
  });

  it('HTTP-ошибка при одной попытке — null (статус неизвестен → scheduler откладывает)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    expect(await fetchOpState('shop', '42', 'pw2')).toBeNull();
  });

  it('сетевой сбой — null, не исключение', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await fetchOpState('shop', '42', 'pw2')).toBeNull();
  });

  it('повторяет, пока не появится OpKey (Робокасса отдаёт его с задержкой)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(xml(0, 50)))
      .mockResolvedValueOnce(okResponse(xml(0, 100, 'K')));
    vi.stubGlobal('fetch', fetchMock);
    const p = fetchOpState('shop', '42', 'pw2', 3);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await p).toEqual({ resultCode: 0, stateCode: 100, opKey: 'K' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('OpKey так и не пришёл — на последней попытке возвращает последний разбор', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(okResponse(xml(0, 50))));
    vi.stubGlobal('fetch', fetchMock);
    const p = fetchOpState('shop', '42', 'pw2', 2);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await p).toEqual({ resultCode: 0, stateCode: 50, opKey: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('fetchOpKey', () => {
  it('возвращает OpKey', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(xml(0, 100, 'KEY'))));
    expect(await fetchOpKey('shop', '42', 'pw2', 1)).toBe('KEY');
  });

  it('нет ключа или нет ответа — null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(xml(0, 100))));
    expect(await fetchOpKey('shop', '42', 'pw2', 1)).toBeNull();
  });
});

// Повтор Refund/Create по уже возвращённому OpKey (ответ поддержки Робокассы, 23.10.2026).
describe('classifyRefundCreate', () => {
  it('success + requestId — возврат создан', () => {
    expect(classifyRefundCreate({ success: true, message: null as unknown as string, requestId: 'r-1' }))
      .toEqual({ kind: 'created', requestId: 'r-1' });
  });

  it('NotEnoughOperationFunds — возврат по OpKey уже создан', () => {
    expect(classifyRefundCreate({ success: false, message: 'NotEnoughOperationFunds', requestId: null }))
      .toEqual({ kind: 'already_created' });
  });

  it('прочие отказы — rejected с текстом', () => {
    expect(classifyRefundCreate({ success: false, message: 'InvalidToken', requestId: null }))
      .toEqual({ kind: 'rejected', message: 'InvalidToken' });
  });

  it('success без requestId не считается созданием', () => {
    expect(classifyRefundCreate({ success: true })).toEqual({ kind: 'rejected', message: 'unknown' });
  });

  it('Refund error 8401 в message — на балансе не хватает денег', () => {
    expect(classifyRefundCreate({ success: false, message: 'Refund error 8401', requestId: null }))
      .toEqual({ kind: 'insufficient_balance' });
  });

  it('8401 только в сыром теле (не JSON) — тоже нехватка баланса', () => {
    expect(classifyRefundCreate({}, 'Refund error 8401')).toEqual({ kind: 'insufficient_balance' });
  });

  it('8401 внутри другого числа — не нехватка баланса', () => {
    expect(classifyRefundCreate({ success: false, message: 'Refund error 184012' }))
      .toEqual({ kind: 'rejected', message: 'Refund error 184012' });
  });

  it('NotEnoughOperationFunds при success: true не перекрывает успех', () => {
    expect(classifyRefundCreate({ success: true, message: 'NotEnoughOperationFunds', requestId: 'r-2' }))
      .toEqual({ kind: 'created', requestId: 'r-2' });
  });
});
