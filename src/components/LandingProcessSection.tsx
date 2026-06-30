import { motion } from 'framer-motion';
import { revealVariants } from '../lib/motion';
import { SectionLabel } from './LandingSectionLabel';

export function LandingProcess() {
  const steps = [
    { n: 1, t: 'Откройте проект', s: 'Создайте книгу — название, жанр, цель по словам. Дальше всё открывается из неё: рукопись, картотека, карта.' },
    { n: 2, t: 'Напишите главу', s: 'Форматирование без отвлечений. Автоснимки каждые два часа — даже если случайно всё удалите, черновик можно восстановить. Заметки прямо рядом с абзацем.' },
    { n: 3, t: 'Соберите мир', s: 'Привяжите персонажа к главе — он появится в её обзоре. Поставьте пин на карте, поместите событие на хронологию. Всё связано.' },
    { n: 4, t: 'Отдайте книгу', s: 'Экспорт в EPUB, FB2 (для электронных читалок) или DOCX. С титульной страницей, оглавлением, опционально — со списком персонажей в конце книги.' },
  ];
  return (
    <section id="process" style={{ padding: 'clamp(36px,5vw,64px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <SectionLabel title="От пустого листа до экспорта." subtitle="Каждый шаг — на своём месте. Не нужно жонглировать четырьмя приложениями и папками с файлами." />
        <div className="lnd-manifesto">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              className="lnd-manifesto-row"
              variants={revealVariants}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: Math.min(i, 3) * 0.1 }}
            >
              <div style={{ font: '600 clamp(28px,3vw,40px)/1 var(--font-serif)', color: 'var(--accent)', letterSpacing: '-0.02em', paddingTop: 6 }}>
                {String(s.n).padStart(2, '0')}
              </div>
              <div>
                <h3 style={{ font: '600 clamp(20px,2.5vw,28px)/1.15 var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.012em', marginBottom: 10 }}>{s.t}</h3>
                <p style={{ font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 620, margin: 0 }}>{s.s}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
