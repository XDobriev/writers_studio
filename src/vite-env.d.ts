/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SENTRY_DSN?: string;
  /** 'vps' в сборке Timeweb (deploy-timeweb.yml); у Vercel не задаётся — определяется по хосту. */
  readonly VITE_DEPLOY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
