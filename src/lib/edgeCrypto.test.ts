import { describe, expect, it } from 'vitest';
import { clip, escapeHtml, md5hex, timingSafeEqual } from '../../supabase/functions/_shared/crypto.ts';

// Подпись Робокассы — MD5 от строки с «:». Если md5hex ошибётся, все платежи отклонятся (или хуже — пройдут чужие).
describe('md5hex', () => {
  // Векторы RFC 1321, приложение A.5 — проверяют сам алгоритм.
  it.each([
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
  ])('RFC 1321: md5(%j)', (input, expected) => {
    expect(md5hex(input)).toBe(expected);
  });

  // Строка и значения — из docs.robokassa.ru/ru/pay-interface (пример кнопки: demo / password_1 / 12 / 990.00).
  // Готовый хеш в документации не приведён — он посчитан независимо (node:crypto), не выдуман.
  it('строка подписи оплаты по примеру из документации', () => {
    expect(md5hex('demo:990.00:12:password_1')).toBe('6c9d6eb96b82e643b343c26a85349a37');
  });

  it('строка подписи с Shp_ по примеру из документации', () => {
    expect(md5hex('demo:8.96:12345:password_1:Shp_item=digital')).toBe('db432af8baaaa7e18ba51c0e6e7297e2');
  });

  // Строка из docs.robokassa.ru/ru/notifications-and-redirects (ResultURL; «Пароль#2» заменён на password_2).
  it('строка подписи ResultURL с Shp_ по примеру из документации', () => {
    expect(md5hex('100.000000:450009:password_2:Shp_login=Vasya:Shp_oplata=1')).toBe(
      '4adcef23deded52faef69a96efdf67e8',
    );
  });

  it('кириллица хешируется как UTF-8 (в Receipt бывают русские названия)', () => {
    expect(md5hex('тест')).toBe('ebb5e89e8a94e9dd22abf5d915d112b2');
  });
});

// Сверка подписи вебхука: ложное «равно» = подделка платежа, ложное «не равно» = потерянная оплата.
describe('timingSafeEqual', () => {
  it('равные строки', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('разное содержимое той же длины', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('разная длина — false без исключения', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', 'a')).toBe(false);
  });

  it('пустые строки равны', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('сравнивает по байтам UTF-8', () => {
    expect(timingSafeEqual('é', 'e')).toBe(false);
    expect(timingSafeEqual('щ', 'щ')).toBe(true);
  });
});

// Пользовательский текст попадает в HTML писем — без экранирования это инъекция.
describe('escapeHtml', () => {
  it('экранирует все пять опасных символов', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    );
  });

  it('амперсанд экранируется первым — без двойного экранирования', () => {
    expect(escapeHtml('<')).toBe('&lt;');
  });

  it('обычный текст не меняется', () => {
    expect(escapeHtml('Авторская студия')).toBe('Авторская студия');
  });
});

// Имя книги/пользователя в письме не должно ломать вёрстку переводами строк и раздувать тему.
describe('clip', () => {
  it('переводы строк и табы → пробел, края обрезаются', () => {
    expect(clip('  a\r\nb\tc  ')).toBe('a b c');
  });

  it('короткая строка не обрезается', () => {
    expect(clip('abc', 3)).toBe('abc');
  });

  it('длинная обрезается до max с многоточием, итоговая длина = max', () => {
    const out = clip('x'.repeat(100), 10);
    expect(out).toBe('x'.repeat(9) + '…');
    expect(out).toHaveLength(10);
  });

  it('лимит по умолчанию — 80', () => {
    expect(clip('y'.repeat(200))).toHaveLength(80);
  });
});
