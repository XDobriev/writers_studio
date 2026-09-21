import { useEffect, useState, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { AuthProvider, useAuth } from './lib/auth';
import { AuthGuard } from './components/AuthGuard';
import { PageMotion } from './components/PageMotion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { CookieBanner } from './components/CookieBanner';
import { useFeatureFlag } from './lib/useFeatureFlag';

function MaintenancePage() {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', gap: 12, padding: 24 }}>
      <div>
        <div style={{ font: '600 18px var(--font-ui)', color: 'var(--ink)', marginBottom: 8 }}>Технические работы</div>
        <div style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)', maxWidth: 320 }}>
          Авторская студия временно недоступна. Заходите чуть позже — скоро всё будет готово.
        </div>
      </div>
    </div>
  );
}

// Все страницы — lazy: браузер скачает чанк только при переходе на маршрут
const Auth          = lazy(() => import('./pages/Auth'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Landing    = lazy(() => import('./pages/Landing'));
const Demo       = lazy(() => import('./pages/Demo'));
const Home       = lazy(() => import('./pages/Home'));
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const Editor     = lazy(() => import('./pages/Editor'));
const Outline    = lazy(() => import('./pages/Outline'));
const Corkboard  = lazy(() => import('./pages/Corkboard'));
const MapScreen  = lazy(() => import('./pages/Map'));
const Timeline   = lazy(() => import('./pages/Timeline'));
const Characters = lazy(() => import('./pages/Characters'));
const Focus      = lazy(() => import('./pages/Focus'));
const Split      = lazy(() => import('./pages/Split'));
const Export     = lazy(() => import('./pages/Export'));
const Notes      = lazy(() => import('./pages/Notes'));
const Admin           = lazy(() => import('./pages/Admin'));
const AdminUserDetail = lazy(() => import('./pages/AdminUserDetail'));
const Privacy    = lazy(() => import('./pages/Privacy'));
const Terms      = lazy(() => import('./pages/Terms'));
const Changelog  = lazy(() => import('./pages/Changelog'));
const Offer      = lazy(() => import('./pages/Offer'));
const ShareBook  = lazy(() => import('./pages/ShareBook'));
const Dictionary     = lazy(() => import('./pages/Dictionary'));
const NotFound       = lazy(() => import('./pages/NotFound'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));

function PageFallback() {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
      <span style={{ color: 'var(--ink-3)', fontSize: '0.875rem' }}>Загрузка…</span>
    </div>
  );
}

function Guard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <AuthGuard><ErrorBoundary key={pathname}>{children}</ErrorBoundary></AuthGuard>;
}

// Не рендерим маршруты пока auth не определён (нет session из localStorage И getSession ещё не вернул ответ).
// Это предотвращает краткий флэш лендинга при обновлении страниц авторизованных разделов.
function AppContent() {
  const { initializing, session } = useAuth();
  const { pathname } = useLocation();
  const { enabled: maintenance } = useFeatureFlag('maintenance_mode', false);

  if (initializing && !session) return <PageFallback />;
  if (maintenance && !pathname.startsWith('/admin')) return <MaintenancePage />;
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <AnimatedRoutes />
      </Suspense>
    </ErrorBoundary>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="sync">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageMotion><Landing /></PageMotion>} />
        <Route path="/demo" element={<PageMotion><Demo /></PageMotion>} />
        <Route path="/login" element={<PageMotion><Auth /></PageMotion>} />
        <Route path="/reset-password" element={<PageMotion><ResetPassword /></PageMotion>} />

        <Route path="/books" element={<PageMotion><Guard><Home /></Guard></PageMotion>} />
        <Route path="/books/:id" element={<PageMotion><Guard><Dashboard /></Guard></PageMotion>} />
        <Route path="/books/:id/editor" element={<PageMotion><Guard><Editor /></Guard></PageMotion>} />
        <Route path="/books/:id/outline" element={<PageMotion><Guard><Outline /></Guard></PageMotion>} />
        <Route path="/books/:id/corkboard" element={<PageMotion><Guard><Corkboard /></Guard></PageMotion>} />
        <Route path="/books/:id/map" element={<PageMotion><Guard><MapScreen /></Guard></PageMotion>} />
        <Route path="/books/:id/timeline" element={<PageMotion><Guard><Timeline /></Guard></PageMotion>} />
        <Route path="/books/:id/characters" element={<PageMotion><Guard><Characters /></Guard></PageMotion>} />
        <Route path="/books/:id/focus" element={<PageMotion><Guard><Focus /></Guard></PageMotion>} />
        <Route path="/books/:id/split" element={<PageMotion><Guard><Split /></Guard></PageMotion>} />
        <Route path="/books/:id/notes" element={<PageMotion><Guard><Notes /></Guard></PageMotion>} />
        <Route path="/books/:id/export" element={<PageMotion><Guard><Export /></Guard></PageMotion>} />

        <Route path="/share/:token" element={<PageMotion><ShareBook /></PageMotion>} />
        <Route path="/admin" element={<PageMotion><Guard><Admin /></Guard></PageMotion>} />
        <Route path="/admin/users/:userId" element={<PageMotion><Guard><AdminUserDetail /></Guard></PageMotion>} />
        <Route path="/privacy" element={<PageMotion><Privacy /></PageMotion>} />
        <Route path="/terms" element={<PageMotion><Terms /></PageMotion>} />
        <Route path="/changelog" element={<PageMotion><Changelog /></PageMotion>} />
        <Route path="/offer" element={<PageMotion><Offer /></PageMotion>} />
        <Route path="/payment-success" element={<PageMotion><Guard><PaymentSuccess /></Guard></PageMotion>} />
        <Route path="/dictionary" element={<PageMotion><Guard><Dictionary /></Guard></PageMotion>} />
        <Route path="*" element={<PageMotion><NotFound /></PageMotion>} />
      </Routes>
    </AnimatePresence>
  );
}

// Сбрасывает кэш React Query при выходе/истечении сессии,
// чтобы запросы с протухшим токеном не долетали до рендера.
function AuthQuerySync() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!session) {
      // setDefaultOptions(enabled:false) закрывает race condition:
      // новые запросы не стартуют пока сессии нет, уже летящие отменяются.
      queryClient.setDefaultOptions({ queries: { enabled: false } });
      queryClient.cancelQueries();
      queryClient.clear();
    } else {
      queryClient.setDefaultOptions({ queries: { enabled: true } });
    }
  }, [session, queryClient]);
  return null;
}

const persister = createSyncStoragePersister({ storage: window.localStorage });

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 24 * 60 * 60_000,
        retry: (count, error) => {
          const code = (error as { code?: string })?.code;
          if (code === 'PGRST301' || code === 'PGRST116' || code === 'NOT_FOUND') return false;
          const status = (error as { status?: number })?.status;
          if (status === 401 || status === 406) return false;
          return count < 2;
        },
      },
    },
  }));
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
          persister,
          maxAge: 24 * 60 * 60_000,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              const key = query.queryKey[0];
              return key !== 'chapter-content' && key !== 'chapter-versions';
            },
          },
        }}
    >
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthQuerySync />
        <OfflineBanner />
        <CookieBanner />
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
    </PersistQueryClientProvider>
  );
}
