import { describe, expect, it } from 'vitest';
import { clip, escapeHtml, md5hex, sha256hex, timingSafeEqual } from './crypto.ts';

describe('md5hex', () => {
  // RFC 1321, Appendix A.5 standard test vectors
  it.each([
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
  ])('RFC 1321: md5(%j)', (input, expected) => {
    expect(md5hex(input)).toBe(expected);
  });

  it('строка подписи оплаты по примеру из документации Robokassa', () => {
    expect(md5hex('demo:990.00:12:password_1')).toBe('6c9d6eb96b82e643b343c26a85349a37');
  });

  it('строка подписи с Shp_ по примеру из документации Robokassa', () => {
    expect(md5hex('demo:8.96:12345:password_1:Shp_item=digital')).toBe('db432af8baaaa7e18ba51c0e6e7297e2');
  });

  it('строка подписи ResultURL с несколькими Shp_', () => {
    expect(md5hex('100.000000:450009:password_2:Shp_login=Vasya:Shp_oplata=1')).toBe(
      '4adcef23deded52faef69a96efdf67e8',
    );
  });

  it('кириллица хешируется как UTF-8', () => {
    expect(md5hex('тест')).toBe('ebb5e89e8a94e9dd22abf5d915d112b2');
    expect(md5hex('Авторская студия')).toBe('499a4b6c99b5f7b54c4f4d78d3a082fc');
  });
});

describe('sha256hex', () => {
  // NIST / RFC 6234 standard test vectors
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['message digest', 'f7846f55cf23e14eebeab5b4e1550cad5b509e3348fbc4efa3a1413d393cb650'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
  ])('RFC 6234: sha256(%j)', async (input, expected) => {
    expect(await sha256hex(input)).toBe(expected);
  });

  it('кириллица и символы UTF-8 хешируются в SHA-256', async () => {
    expect(await sha256hex('тест')).toBe('e34f6dec12c4f4599eba078f31ae8139420d21b1bd2d7ced7d22b09c2074fb48');
  });
});

describe('timingSafeEqual', () => {
  it('идентичные строки возвращают true', () => {
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('a', 'a')).toBe(true);
    expect(timingSafeEqual('secret123', 'secret123')).toBe(true);
    expect(timingSafeEqual('4adcef23deded52faef69a96efdf67e8', '4adcef23deded52faef69a96efdf67e8')).toBe(true);
  });

  it('разное содержимое одинаковой длины возвращает false', () => {
    // Различие в первом символе
    expect(timingSafeEqual('xbcdef1234567890', 'abcdef1234567890')).toBe(false);
    // Различие в середине
    expect(timingSafeEqual('abcdef12x4567890', 'abcdef1234567890')).toBe(false);
    // Различие в последнем символе
    expect(timingSafeEqual('abcdef123456789x', 'abcdef1234567890')).toBe(false);
  });

  it('разная длина строк возвращает false', () => {
    expect(timingSafeEqual('', 'a')).toBe(false);
    expect(timingSafeEqual('a', '')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('longstring1', 'longstring12')).toBe(false);
  });

  it('корректно обрабатывает многобайтовые символы UTF-8', () => {
    expect(timingSafeEqual('тест', 'тест')).toBe(true);
    expect(timingSafeEqual('тест', 'тост')).toBe(false);
    expect(timingSafeEqual('é', 'e')).toBe(false);
    expect(timingSafeEqual('🔥', '🔥')).toBe(true);
    expect(timingSafeEqual('🔥', '💧')).toBe(false);
  });

  it('защита от timing-атак: цикл проверки проходит по всем байтам', () => {
    // Проверяем, что даже когда первый байт не совпадает, функция сравнивает все байты
    // без раннего выхода (bitwise OR накапливает разницу diff |= aBytes[i] ^ bBytes[i]).
    const a = '0'.repeat(1000);
    const bDiffAtStart = '1' + '0'.repeat(999);
    const bDiffAtEnd = '0'.repeat(999) + '1';

    expect(timingSafeEqual(a, bDiffAtStart)).toBe(false);
    expect(timingSafeEqual(a, bDiffAtEnd)).toBe(false);
    expect(timingSafeEqual(a, a)).toBe(true);
  });
});

describe('escapeHtml', () => {
  it('экранирует все 5 опасных HTML-символов', () => {
    expect(escapeHtml('<script>alert("XSS" & \'test\')</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot; &amp; &#39;test&#39;)&lt;/script&gt;',
    );
  });

  it('оставляет безопасный текст без изменений', () => {
    expect(escapeHtml('Hello world 123! Привет!')).toBe('Hello world 123! Привет!');
  });
});

describe('clip', () => {
  it('обрезает текст длиннее max и добавляет многоточие', () => {
    expect(clip('12345', 5)).toBe('12345');
    expect(clip('1234567890', 5)).toBe('1234…');
  });

  it('не обрезает текст короче или равный max', () => {
    expect(clip('123', 5)).toBe('123');
  });

  it('схлопывает переводы строк и табуляции в один пробел', () => {
    expect(clip("  первая строка\nвторая строка\r\n\tтретья  ", 100)).toBe(
      'первая строка вторая строка третья',
    );
  });
});
