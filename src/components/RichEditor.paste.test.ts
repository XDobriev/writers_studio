import { describe, it, expect } from 'vitest';
import { stripSoftHyphensFromHtml, stripSoftHyphensFromText } from './RichEditor';

describe('RichEditor paste hygiene (soft hyphens)', () => {
  it('stripSoftHyphensFromText удаляет U+00AD без вставки пробелов и не трогает обычные дефисы', () => {
    expect(stripSoftHyphensFromText('пе\u00ADре\u00ADнос Ростов-на-Дону')).toBe('перенос Ростов-на-Дону');
  });

  it('stripSoftHyphensFromHtml удаляет U+00AD, &shy;, &#173;, &#0173;, &#xAD; в любом регистре', () => {
    expect(
      stripSoftHyphensFromHtml('<p>пе\u00ADре&shy;но&#173;сы &#0173;и &#xAD;сло&#x00ad;ва &SHY;из-за</p>'),
    ).toBe('<p>переносы и слова из-за</p>');
  });
});
