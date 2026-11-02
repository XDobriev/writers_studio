import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildReceipt,
  buildSignatureString,
  calculateSignature,
  calculateSignatureMd5,
  calculateSignatureSha256,
  classifyRefundCreate,
  extractShpParams,
  fetchOpKey,
  fetchOpState,
  newInvId,
  parseAmount,
  validateSignature,
  validateWebhookSignature,
  validateWebhookSignatureMd5,
} from './robokassa.ts';

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

describe('parseAmount', () => {
  it('парсит числа и строки с точкой', () => {
    expect(parseAmount(299)).toBe(299);
    expect(parseAmount(299.5)).toBe(299.5);
    expect(parseAmount('299')).toBe(299);
    expect(parseAmount('299.00')).toBe(299);
    expect(parseAmount('299.50')).toBe(299.5);
    expect(parseAmount('  3490.99  ')).toBe(3490.99);
  });

  it('корректно обрабатывает суммы с запятой (русская локаль / ввод пользователя)', () => {
    expect(parseAmount('299,00')).toBe(299);
    expect(parseAmount('299,50')).toBe(299.5);
    expect(parseAmount('1990,99')).toBe(1990.99);
    expect(parseAmount('0,5')).toBe(0.5);
  });

  it('возвращает NaN для невалидных данных', () => {
    expect(Number.isNaN(parseAmount('abc'))).toBe(true);
    expect(Number.isNaN(parseAmount(''))).toBe(true);
    expect(Number.isNaN(parseAmount(null as unknown as string))).toBe(true);
    expect(Number.isNaN(parseAmount(undefined as unknown as string))).toBe(true);
    expect(Number.isNaN(parseAmount(Infinity))).toBe(true);
  });
});

describe('extractShpParams', () => {
  it('извлекает только параметры Shp_ и сортирует их по алфавиту', () => {
    const params = {
      OutSum: '100.00',
      InvId: '42',
      Shp_user_id: 'usr-1',
      Shp_plan: 'pro',
      Shp_client: 'web',
      SignatureValue: 'abcdef',
    };

    const shp = extractShpParams(params);
    expect(shp).toEqual({
      Shp_client: 'web',
      Shp_plan: 'pro',
      Shp_user_id: 'usr-1',
    });
    // Порядок ключей в Object.keys строго алфавитный
    expect(Object.keys(shp)).toEqual(['Shp_client', 'Shp_plan', 'Shp_user_id']);
  });

  it('поддерживает URLSearchParams как источник параметров', () => {
    const urlParams = new URLSearchParams();
    urlParams.set('Shp_b', '2');
    urlParams.set('Other', 'x');
    urlParams.set('Shp_a', '1');

    const shp = extractShpParams(urlParams);
    expect(shp).toEqual({
      Shp_a: '1',
      Shp_b: '2',
    });
    expect(Object.keys(shp)).toEqual(['Shp_a', 'Shp_b']);
  });

  it('пустой источник или отсутствие Shp_ возвращает пустой объект', () => {
    expect(extractShpParams(undefined)).toEqual({});
    expect(extractShpParams({})).toEqual({});
    expect(extractShpParams({ OutSum: '10' })).toEqual({});
  });
});

describe('buildSignatureString', () => {
  it('строит строку для ResultURL вебхука (OutSum:InvId:Password:Shp_...)', () => {
    const s = buildSignatureString('100.00', '42', 'pass2', {
      Shp_user_id: 'u-1',
      Shp_plan: 'pro',
    });
    expect(s).toBe('100.00:42:pass2:Shp_plan=pro:Shp_user_id=u-1');
  });

  it('строит строку для Merchant checkout с MerchantLogin и Receipt', () => {
    const s = buildSignatureString({
      merchantLogin: 'test_shop',
      outSum: '299.00',
      invId: '1001',
      password: 'pass1',
      receiptJson: '{"items":[]}',
      shp: { Shp_plan: 'pro' },
    });
    expect(s).toBe('test_shop:299.00:1001:{"items":[]}:pass1:Shp_plan=pro');
  });

  it('строит строку для Merchant checkout без Receipt', () => {
    const s = buildSignatureString({
      merchantLogin: 'test_shop',
      outSum: '299.00',
      invId: '1001',
      password: 'pass1',
      shp: { Shp_plan: 'pro' },
    });
    expect(s).toBe('test_shop:299.00:1001:pass1:Shp_plan=pro');
  });
});

describe('calculateSignature and validateSignature', () => {
  const params = {
    outSum: '100.000000',
    invId: '450009',
    password: 'password_2',
    shp: {
      Shp_oplata: '1',
      Shp_login: 'Vasya',
    },
  };

  it('MD5 подпись совпадает с примером документации Робокассы', () => {
    const sig = calculateSignatureMd5(params);
    expect(sig).toBe('4adcef23deded52faef69a96efdf67e8');
  });

  it('SHA-256 подпись рассчитывается корректно', async () => {
    const sig = await calculateSignatureSha256(params);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('calculateSignature выбирает алгоритм по умолчанию MD5 или SHA256', async () => {
    expect(calculateSignature(params)).toBe('4adcef23deded52faef69a96efdf67e8');
    expect(calculateSignature(params, 'MD5')).toBe('4adcef23deded52faef69a96efdf67e8');
    expect(await calculateSignature(params, 'SHA256')).toHaveLength(64);
  });

  it('validateSignature: нечувствителен к регистру хеша (lowercase vs UPPERCASE)', () => {
    const lower = '4adcef23deded52faef69a96efdf67e8';
    const upper = '4ADCEF23DEDED52FAEF69A96EFDF67E8';
    const mixed = '4aDcEf23DeDeD52fAeF69a96EfDf67E8';

    expect(validateSignature(lower, upper)).toBe(true);
    expect(validateSignature(upper, lower)).toBe(true);
    expect(validateSignature(mixed, lower)).toBe(true);
  });

  it('validateSignature: отклоняет несовпадающие подписи и пустые значения', () => {
    expect(validateSignature('abc123', 'abc124')).toBe(false);
    expect(validateSignature('', 'abc')).toBe(false);
    expect(validateSignature('abc', '')).toBe(false);
  });
});

describe('validateWebhookSignature and validateWebhookSignatureMd5', () => {
  const validOpts = {
    outSum: '299.00',
    invId: '123456',
    password2: 'secret_pass_2',
    shp: {
      Shp_plan: 'pro',
      Shp_user_id: 'usr-99',
    },
  };
  const expectedSig = calculateSignatureMd5({
    outSum: validOpts.outSum,
    invId: validOpts.invId,
    password: validOpts.password2,
    shp: validOpts.shp,
  });

  it('успешная валидация валидного вебхука', async () => {
    const res = await validateWebhookSignature({
      ...validOpts,
      signatureValue: expectedSig,
    });
    expect(res).toEqual({ valid: true, paidAmount: 299 });

    const syncRes = validateWebhookSignatureMd5({
      ...validOpts,
      signatureValue: expectedSig,
    });
    expect(syncRes).toEqual({ valid: true, paidAmount: 299 });
  });

  it('успешная валидация с хешем в верхнем регистре', async () => {
    const res = await validateWebhookSignature({
      ...validOpts,
      signatureValue: expectedSig.toUpperCase(),
    });
    expect(res.valid).toBe(true);
  });

  it('успешная валидация при сумме с запятой в OutSum (нормализация суммы для проверки)', async () => {
    const commaSum = '299,00';
    // Внимание: подпись Робокассы считается по точному значению OutSum из запроса
    const sigForComma = calculateSignatureMd5({
      outSum: commaSum,
      invId: validOpts.invId,
      password: validOpts.password2,
      shp: validOpts.shp,
    });

    const res = await validateWebhookSignature({
      ...validOpts,
      outSum: commaSum,
      signatureValue: sigForComma,
      expectedAmount: 299,
    });
    expect(res).toEqual({ valid: true, paidAmount: 299 });
  });

  it('отклоняет вебхук с невалидной подписью (bad_signature)', async () => {
    const res = await validateWebhookSignature({
      ...validOpts,
      signatureValue: 'wrong_signature_hash',
    });
    expect(res).toEqual({ valid: false, reason: 'bad_signature', paidAmount: 299 });
  });

  it('отклоняет вебхук с несовпадающей суммой (amount_mismatch)', async () => {
    const res = await validateWebhookSignature({
      ...validOpts,
      signatureValue: expectedSig,
      expectedAmount: 399, // ожидалось 399, пришло 299
    });
    expect(res).toEqual({ valid: false, reason: 'amount_mismatch', paidAmount: 299 });
  });

  it('отклоняет вебхук с суммой ниже минимальной (amount_below_min)', async () => {
    const res = await validateWebhookSignature({
      ...validOpts,
      signatureValue: expectedSig,
      minAmount: 350, // минимально 350, пришло 299
    });
    expect(res).toEqual({ valid: false, reason: 'amount_below_min', paidAmount: 299 });
  });

  it('отклоняет вебхук при невалидной сумме (invalid_amount)', async () => {
    const res = await validateWebhookSignature({
      ...validOpts,
      outSum: 'not-a-number',
      signatureValue: expectedSig,
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('invalid_amount');
  });

  it('отклоняет вебхук при отсутствии обязательных параметров (missing_params)', async () => {
    const res = await validateWebhookSignature({
      ...validOpts,
      outSum: '',
      signatureValue: expectedSig,
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('missing_params');
  });

  it('поддерживает валидацию SHA-256 вебхука', async () => {
    const sha256Sig = await calculateSignatureSha256({
      outSum: validOpts.outSum,
      invId: validOpts.invId,
      password: validOpts.password2,
      shp: validOpts.shp,
    });

    const res = await validateWebhookSignature({
      ...validOpts,
      signatureValue: sha256Sig,
      algorithm: 'SHA256',
    });
    expect(res).toEqual({ valid: true, paidAmount: 299 });
  });
});

// Тесты существующих функций: buildReceipt, newInvId, fetchOpState, fetchOpKey, classifyRefundCreate
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

  it('поддерживает сумму с запятой в buildReceipt', () => {
    const { json } = buildReceipt('Pro на месяц', '299,50');
    expect(JSON.parse(json).items[0].sum).toBe(299.5);
  });

  it('email добавляется только если передан', () => {
    expect(JSON.parse(buildReceipt('x', '1').json)).not.toHaveProperty('email');
    expect(JSON.parse(buildReceipt('x', '1', null).json)).not.toHaveProperty('email');
    expect(JSON.parse(buildReceipt('x', '1', 'a@b.ru').json).email).toBe('a@b.ru');
  });

  it('синтетический адрес Telegram/VK в Receipt не попадает', () => {
    expect(JSON.parse(buildReceipt('x', '1', 'tg_1@telegram.local').json)).not.toHaveProperty('email');
    expect(JSON.parse(buildReceipt('x', '1', 'not-an-email').json)).not.toHaveProperty('email');
  });

  it('encoded = encodeURIComponent(json), json не кодирован', () => {
    const { json, encoded } = buildReceipt('Pro', '10.50', 'a@b.ru');
    expect(encoded).toBe(encodeURIComponent(json));
    expect(json).toContain('"name":"Pro"');
    expect(decodeURIComponent(encoded)).toBe(json);
  });
});

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
    expect(url.searchParams.get('Signature')).toBe('de6be8af3afa8584daa45faa563aa4ab');
  });

  it('HTTP-ошибка при одной попытке — null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    expect(await fetchOpState('shop', '42', 'pw2')).toBeNull();
  });

  it('сетевой сбой — null, не исключение', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await fetchOpState('shop', '42', 'pw2')).toBeNull();
  });

  it('повторяет, пока не появится OpKey', async () => {
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

  it('Refund error 8401 в message или в raw — на балансе не хватает денег', () => {
    expect(classifyRefundCreate({ success: false, message: 'Refund error 8401', requestId: null }))
      .toEqual({ kind: 'insufficient_balance' });
    expect(classifyRefundCreate({}, 'Refund error 8401')).toEqual({ kind: 'insufficient_balance' });
  });
});
