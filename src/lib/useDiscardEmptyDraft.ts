import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDiscardEmptyDraftOptions {
  /** Запись открыта у пользователя прямо сейчас. Пока false — следим молча; по умолчанию открыта всегда. */
  isViewing?: (id: string) => boolean;
  /** Актуальное состояние записи: «не тронута» — только тогда её можно удалить. */
  isEmpty: (id: string) => boolean;
  discard: (id: string) => Promise<void> | void;
}

// Быстрые действия («Создать персонажа», `?create=true`) сразу заводят запись в БД. Если
// пользователь ушёл, ничего не введя, пустая запись остаётся навсегда (B-4). Хук запоминает
// только что созданную запись (`markDraft`) и удаляет её, когда пользователь её покинул:
// закрыл/сменил карточку, создал следующую или ушёл со страницы. Тронутую запись не удаляет.
export function useDiscardEmptyDraft({ isViewing, isEmpty, discard }: UseDiscardEmptyDraftOptions) {
  const [draftId, setDraftId] = useState<string | null>(null);
  const isEmptyRef = useRef(isEmpty);
  const discardRef = useRef(discard);
  isEmptyRef.current = isEmpty;
  discardRef.current = discard;

  const viewing = !!draftId && (isViewing ? isViewing(draftId) : true);

  useEffect(() => {
    if (!draftId || !viewing) return;
    return () => {
      if (isEmptyRef.current(draftId)) void discardRef.current(draftId);
      // Тронутая запись больше не черновик: вернувшись и стерев текст, пользователь не потеряет её.
      setDraftId((cur) => (cur === draftId ? null : cur));
    };
  }, [draftId, viewing]);

  const markDraft = useCallback((id: string) => setDraftId(id), []);
  return { markDraft };
}
