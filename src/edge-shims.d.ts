// Edge-код (Deno) импортирует ts-md5 по URL; tsc и vitest берут тот же пакет из npm (см. alias в vitest.config.ts).
declare module 'https://esm.sh/ts-md5@1.3.1' {
  export { Md5 } from 'ts-md5';
}

// Edge-код читает секреты через Deno.env; в тестах глобал подменяется vi.stubGlobal.
declare const Deno: { env: { get(key: string): string | undefined } };
