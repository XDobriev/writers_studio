// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Плеер звуков живёт на уровне модуля (B-2): смена страницы не должна его обрывать.
class FakeAudio {
  static instances: FakeAudio[] = [];
  loop = false;
  volume = 1;
  paused = true;
  constructor(public src: string) { FakeAudio.instances.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

async function load() {
  vi.resetModules();
  return import('./ambientSound');
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ambientSound', () => {
  it('выбор звука запускает зацикленный audio и плавно поднимает громкость до сохранённой', async () => {
    localStorage.setItem('ambient-volume', '0.5');
    const player = await load();
    player.selectSound('rain');
    await vi.advanceTimersByTimeAsync(600);
    const [audio] = FakeAudio.instances;
    expect(audio.src).toBe('/sounds/rain.mp3');
    expect(audio.loop).toBe(true);
    expect(audio.paused).toBe(false);
    expect(audio.volume).toBeCloseTo(0.5);
    expect(localStorage.getItem('ambient-sound')).toBe('rain');
  });

  it('звук играет, пока на состояние никто не подписан, — как после размонтирования StatusBar при переходе в /focus', async () => {
    const player = await load();
    player.selectSound('fire');
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(5000);
    expect(FakeAudio.instances[0].paused).toBe(false);
  });

  it('повторный выбор того же звука глушит его и забывает выбор', async () => {
    const player = await load();
    player.selectSound('rain');
    await vi.advanceTimersByTimeAsync(600);
    player.selectSound('rain');
    await vi.advanceTimersByTimeAsync(600);
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(localStorage.getItem('ambient-sound')).toBeNull();
  });

  it('смена звука затухает старый и запускает новый', async () => {
    const player = await load();
    player.selectSound('rain');
    await vi.advanceTimersByTimeAsync(600);
    player.selectSound('cafe');
    await vi.advanceTimersByTimeAsync(1200);
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(FakeAudio.instances[1].src).toBe('/sounds/cafe.mp3');
    expect(FakeAudio.instances[1].paused).toBe(false);
  });

  it('stopAmbientSound (выход из аккаунта) останавливает звук', async () => {
    const player = await load();
    player.selectSound('waves');
    await vi.advanceTimersByTimeAsync(600);
    player.stopAmbientSound();
    await vi.advanceTimersByTimeAsync(600);
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(localStorage.getItem('ambient-sound')).toBeNull();
  });

  it('заблокированный autoplay сбрасывает выбор', async () => {
    const player = await load();
    vi.spyOn(FakeAudio.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));
    player.selectSound('rain');
    await vi.advanceTimersByTimeAsync(10);
    expect(localStorage.getItem('ambient-sound')).toBeNull();
  });

  it('громкость сохраняется и применяется к играющему звуку сразу', async () => {
    const player = await load();
    player.selectSound('rain');
    await vi.advanceTimersByTimeAsync(600);
    player.setAmbientVolume(0.9);
    expect(FakeAudio.instances[0].volume).toBeCloseTo(0.9);
    expect(localStorage.getItem('ambient-volume')).toBe('0.9');
  });
});
