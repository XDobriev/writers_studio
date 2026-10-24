// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorToolbar } from './EditorToolbar';
import type { Editor } from './RichEditor';

const calls: string[] = [];
function fakeEditor(): Editor {
  const chain: unknown = new Proxy(() => chain, {
    get: (_t, name: string) => (name === 'run' ? () => true : (...a: unknown[]) => { calls.push(`${name}(${a.map(String).join(',')})`); return chain; }),
  });
  return {
    chain: () => chain,
    can: () => ({ undo: () => true, redo: () => true }),
    isActive: () => false,
    getAttributes: () => ({}),
  } as unknown as Editor;
}

let root: Root | null = null;
function mount(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root!.render(createElement(EditorToolbar, { editor: fakeEditor(), showModes: false })));
  return el;
}
afterEach(() => { act(() => root?.unmount()); calls.length = 0; document.body.innerHTML = ''; });

const byLabel = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

describe('EditorToolbar с клавиатуры', () => {
  it('click (Enter/Space на кнопке) выполняет действие', () => {
    mount();
    act(() => { byLabel('Жирный (Ctrl+B)').click(); });
    expect(calls).toContain('toggleBold()');
  });

  it('mousedown не уводит фокус из текста', () => {
    mount();
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => { byLabel('Жирный (Ctrl+B)').dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(calls).not.toContain('toggleBold()');
  });

  it('дропдаун: click открывает, aria-expanded, Escape закрывает', () => {
    mount();
    const trigger = byLabel('Уровень текста');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => { trigger.click(); });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('Заголовок 1');
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.textContent).not.toContain('Заголовок 1');
  });
});
