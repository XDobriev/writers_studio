// Ошибки загрузки ленивого чанка: после деплоя открытая вкладка просит старый файл,
// которого уже нет, либо оборвалась сеть. Лечится перезагрузкой страницы.
// Формулировки у браузеров разные: Chrome/Edge, Safari/iOS, Firefox, webpack-совместимая.
const CHUNK_ERROR_RE =
  /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk|unable to preload css/i;

export function isChunkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(e.message);
}

const RELOAD_KEY = 'chunk-reload-at';

/**
 * Перезагружает страницу один раз. Метка в sessionStorage защищает от петли:
 * повторный авторелоад — не раньше чем через 15 с. Возвращает true, если релоад начат.
 */
export function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last <= 15_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function resetChunkReloadGuard(): void {
  try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* приватный режим */ }
}
