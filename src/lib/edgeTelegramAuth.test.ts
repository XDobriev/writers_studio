import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isTelegramAuthData, isTelegramAuthDateValid, verifyTelegramSignature } from '../../supabase/functions/_shared/telegramAuth';

const botToken = 'test-only-bot-token';
const now = 1793743200;
const signed = { id: '123456789', auth_date: String(now), first_name: 'Иван + & =', last_name: '', photo_url: 'https://t.me/i/a?x=1&y=2' };
// Independent Node implementation of Telegram's documented data-check-string.
const hash = createHmac('sha256', createHash('sha256').update(botToken).digest())
  .update(`auth_date=${now}\nfirst_name=Иван + & =\nid=123456789\nlast_name=\nphoto_url=https://t.me/i/a?x=1&y=2`).digest('hex');
const data = { ...signed, hash };

describe('Telegram server validation', () => {
  it('accepts official redirect strings and the existing numeric widget payload', async () => {
    expect(isTelegramAuthData(data)).toBe(true);
    expect(await verifyTelegramSignature(data, botToken)).toBe(true);
    const numeric = { ...data, id: 123456789, auth_date: now };
    expect(isTelegramAuthData(numeric)).toBe(true);
    expect(await verifyTelegramSignature(numeric, botToken)).toBe(true);
    expect(await verifyTelegramSignature({ ...data, hash: hash.toUpperCase() }, botToken)).toBe(true);
  });

  it('rejects changed signed data, wrong bot and forged hash', async () => {
    expect(await verifyTelegramSignature({ ...data, first_name: 'attacker' }, botToken)).toBe(false);
    expect(await verifyTelegramSignature(data, 'another-bot')).toBe(false);
    expect(await verifyTelegramSignature({ ...data, hash: '0'.repeat(64) }, botToken)).toBe(false);
  });

  it.each([null, [], {}, { ...data, id: -1 }, { ...data, id: '01' }, { ...data, id: '1e3' },
    { ...data, id: '9007199254740993' }, { ...data, auth_date: 'NaN' }, { ...data, auth_date: 1.5 },
    { ...data, hash: 'a' }, { ...data, username: {} }, { ...data, state: 'unsigned' }])('rejects invalid payload %j', (payload) => {
    expect(isTelegramAuthData(payload)).toBe(false);
  });

  it.each([[900, true], [901, false], [-60, true], [-61, false], [0, true]])('auth_date age %s seconds: %s', (age, valid) => {
    expect(isTelegramAuthDateValid({ ...data, auth_date: String(now - Number(age)) }, now)).toBe(valid);
  });
});
