# Единый мастер создания книги и онбординг-развилка (G-7 v2) — План реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать единый элегантный мастер создания книги на базе развилки G-7: выбор способа старта на Шаге 1 (Импорт / Новая книга / Пример романа), полноценный паспорт книги на Шаге 2 (Название, Жанры с авторским вводом через «Другое», Литературная форма с автоподстановкой цели, Обложка с палитрой и загрузкой, Серия) и упразднение старой конфликтующей модалки в `Home.tsx`.

**Architecture:** 
- `src/lib/onboardingTemplates.ts`: модель `LiteraryForm` (`novel`, `novella`, `short_story`, `free`), определяющая литературный формат и рекомендуемый объём слов.
- `src/components/OnboardingForkModal.tsx`: двухшаговый диалог, объединяющий развилку стратегии (Шаг 1) и паспорт книги с `GenrePicker`, `CoverPicker`, селектором формата и `SeriesTransferPicker` (Шаг 2).
- `src/pages/Home.tsx`: кнопка «+ Создать книгу» всегда открывает `OnboardingForkModal`. Старый дублирующий `showCreate` удаляется.

**Tech Stack:** React, TypeScript, Vitest, Playwright, Tailwind/CSS Variables (design-system.css), Supabase client.

---

### Task 1: Обновление модели данных литературных форм и тестов

**Files:**
- Modify: `src/lib/onboardingTemplates.ts`
- Test: `src/lib/onboardingTemplates.test.ts`

- [ ] **Step 1: Написать падающие тесты для `LITERARY_FORMS` и `createBookFromLiteraryForm`**
- [ ] **Step 2: Запустить тест и убедиться, что он падает**
- [ ] **Step 3: Реализовать `LITERARY_FORMS` и `createBookFromLiteraryForm` в `src/lib/onboardingTemplates.ts`**
- [ ] **Step 4: Запустить тесты и убедиться, что они проходят**
- [ ] **Step 5: Закоммитить изменения**

---

### Task 2: Обновление модалки `OnboardingForkModal.tsx`

**Files:**
- Modify: `src/components/OnboardingForkModal.tsx`
- Test: `src/components/OnboardingForkModal.test.tsx`

- [ ] **Step 1: Написать падающие тесты на новый Шаг 2 модалки**
- [ ] **Step 2: Запустить тест и убедиться в падении**
- [ ] **Step 3: Реализовать обновлённый Шаг 2 в `OnboardingForkModal.tsx`**
- [ ] **Step 4: Запустить тесты компонента**
- [ ] **Step 5: Закоммитить изменения**

---

### Task 3: Интеграция в `Home.tsx` и удаление дублирующей модалки

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Обновить логику открытия в `Home.tsx`**
- [ ] **Step 2: Запустить проверку типов и линтер**
- [ ] **Step 3: Закоммитить изменения**

---

### Task 4: Верификация в браузере, Playwright и Hand-off

**Files:**
- Modify/Run: `scripts/verify-onboarding-fork.mjs`

- [ ] **Step 1: Обновить скрипт `scripts/verify-onboarding-fork.mjs`**
- [ ] **Step 2: Запустить `scripts/verify-onboarding-fork.mjs`**
- [ ] **Step 3: Запустить полный набор тестов (`npm.cmd test`)**
- [ ] **Step 4: Запустить `typecheck` и `lint`**
- [ ] **Step 5: Обновить handoff (`agent-handoff.mjs save`)**
