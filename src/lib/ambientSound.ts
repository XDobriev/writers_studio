import { useSyncExternalStore } from 'react';

// Фоновые звуки живут на уровне модуля, а не компонента: плеер переживает смену страницы
// (редактор ↔ /focus), пока его не остановят кнопкой или выходом из аккаунта.

export const SOUNDS = [
  { id: 'cafe' as const, label: 'Кафе', file: '/sounds/cafe.mp3' },
  { id: 'rain' as const, label: 'Дождь', file: '/sounds/rain.mp3' },
  { id: 'fire' as const, label: 'Костёр', file: '/sounds/fire.mp3' },
  { id: 'forest' as const, label: 'Лес', file: '/sounds/forest.mp3' },
  { id: 'waves' as const, label: 'Волны', file: '/sounds/waves.mp3' },
  { id: 'train' as const, label: 'Поезд', file: '/sounds/train.mp3' },
  { id: 'library' as const, label: 'Библиотека', file: '/sounds/library.mp3' },
  { id: 'noise' as const, label: 'Белый шум', file: '/sounds/noise.mp3' },
];

export type SoundId = typeof SOUNDS[number]['id'];

interface AmbientState {
  activeSound: SoundId | null;
  isPlaying: boolean;
  volume: number;
}

const FADE_STEPS = 20;
const FADE_MS = 500;
const SOUND_KEY = 'ambient-sound';
const VOLUME_KEY = 'ambient-volume';

function readStoredSound(): SoundId | null {
  const id = localStorage.getItem(SOUND_KEY);
  return SOUNDS.some((s) => s.id === id) ? (id as SoundId) : null;
}

function readStoredVolume(): number {
  const v = localStorage.getItem(VOLUME_KEY);
  return v !== null ? parseFloat(v) : 0.4;
}

let state: AmbientState | null = null;
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let fadeTimer: number | null = null;
// Отдельно от state.isPlaying: сбрасывается сразу в начале fade-out,
// чтобы visibilitychange не возобновил звук, пока он затухает.
let playingNow = false;
let visibilityBound = false;

function getState(): AmbientState {
  if (!state) state = { activeSound: readStoredSound(), isPlaying: false, volume: readStoredVolume() };
  return state;
}

function setState(patch: Partial<AmbientState>) {
  state = { ...getState(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  bindVisibility();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function bindVisibility() {
  if (visibilityBound || typeof document === 'undefined') return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    if (!audio || document.hidden || !playingNow) return;
    audio.play().catch(() => {});
  });
}

function clearFade() {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function fadeIn(a: HTMLAudioElement, target: number) {
  clearFade();
  a.volume = 0;
  let step = 0;
  fadeTimer = window.setInterval(() => {
    step++;
    a.volume = Math.min(target, target * (step / FADE_STEPS));
    if (step >= FADE_STEPS) clearFade();
  }, FADE_MS / FADE_STEPS);
}

function fadeOut(a: HTMLAudioElement, onDone: () => void) {
  clearFade();
  const start = a.volume;
  if (start === 0) { onDone(); return; }
  let step = 0;
  fadeTimer = window.setInterval(() => {
    step++;
    a.volume = Math.max(0, start * (1 - step / FADE_STEPS));
    if (step >= FADE_STEPS) { clearFade(); onDone(); }
  }, FADE_MS / FADE_STEPS);
}

function forgetSound() {
  localStorage.removeItem(SOUND_KEY);
  setState({ activeSound: null, isPlaying: false });
}

function startNew(id: SoundId) {
  const sound = SOUNDS.find((s) => s.id === id)!;
  const a = new Audio(sound.file);
  a.loop = true;
  a.volume = 0;
  audio = a;
  a.play().then(() => {
    // Быстрое переключение: этот audio мог уже устареть
    if (audio !== a) { a.pause(); return; }
    playingNow = true;
    setState({ isPlaying: true });
    fadeIn(a, getState().volume);
  }).catch(() => {
    // autoplay заблокирован — сбрасываем состояние
    if (audio === a) {
      audio = null;
      forgetSound();
    }
  });
}

export function selectSound(id: SoundId) {
  const current = audio;
  if (getState().activeSound === id && playingNow) {
    if (current) {
      playingNow = false;
      fadeOut(current, () => {
        current.pause();
        audio = null;
        forgetSound();
      });
    }
    return;
  }

  setState({ activeSound: id });
  localStorage.setItem(SOUND_KEY, id);

  if (current && playingNow) {
    fadeOut(current, () => {
      current.pause();
      startNew(id);
    });
  } else {
    clearFade();
    if (current) { current.pause(); audio = null; }
    startNew(id);
  }
}

export function stopAmbientSound() {
  const current = audio;
  if (current && playingNow) {
    playingNow = false;
    fadeOut(current, () => {
      current.pause();
      audio = null;
      forgetSound();
    });
  } else {
    clearFade();
    current?.pause();
    audio = null;
    playingNow = false;
    forgetSound();
  }
}

export function setAmbientVolume(v: number) {
  localStorage.setItem(VOLUME_KEY, String(v));
  setState({ volume: v });
  if (audio && playingNow) {
    clearFade();
    audio.volume = v;
  }
}

export function useAmbientSound() {
  return useSyncExternalStore(subscribe, getState);
}
