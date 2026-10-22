// Баннеры состояния автосохранения главы: ошибка записи и информационное уведомление
// (восстановленный черновик, конфликт правок между окнами). Общие для Editor/Focus/Split.

export function UnsavedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="save-banner save-banner--error" role="alert">
      <span>Последнее изменение ещё не на сервере — нет соединения. Текст сохранён в этом браузере и отправится сам.</span>
      <button type="button" className="save-banner__btn" onClick={onRetry}>Повторить</button>
    </div>
  );
}

export function SaveNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="save-banner save-banner--info" role="status">
      <span>{message}</span>
      <button type="button" className="save-banner__btn" onClick={onDismiss} aria-label="Закрыть уведомление">×</button>
    </div>
  );
}
