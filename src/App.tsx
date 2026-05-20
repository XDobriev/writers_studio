import { useEffect, useState, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { AuthGuard } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { CookieBanner } from './components/CookieBanner';

// Все страницы — lazy: браузер скачает чанк только при переходе на маршрут
const Auth          = lazy(() => import('./pages/Auth'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Landing    = lazy(() => import('./pages/Landing'));
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
const Admin      = lazy(() => import('./pages/Admin'));
const Privacy    = lazy(() => import('./pages/Privacy'));
const Terms      = lazy(() => import('./pages/Terms'));
const ShareBook  = lazy(() => import('./pages/ShareBook'));
const NotFound   = lazy(() => import('./pages/NotFound'));

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

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 15 * 60_000,
        retry: (count, error) => {
          const code = (error as { code?: string })?.code;
          if (code === 'PGRST301' || code === 'PGRST116') return false;
          if ((error as { status?: number })?.status === 401) return false;
          return count < 2;
        },
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <AuthQuerySync />
        <OfflineBanner />
        <CookieBanner />
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/books" element={<Guard><Home /></Guard>} />
          <Route path="/books/:id" element={<Guard><Dashboard /></Guard>} />
          <Route path="/books/:id/editor" element={<Guard><Editor /></Guard>} />
          <Route path="/books/:id/outline" element={<Guard><Outline /></Guard>} />
          <Route path="/books/:id/corkboard" element={<Guard><Corkboard /></Guard>} />
          <Route path="/books/:id/map" element={<Guard><MapScreen /></Guard>} />
          <Route path="/books/:id/timeline" element={<Guard><Timeline /></Guard>} />
          <Route path="/books/:id/characters" element={<Guard><Characters /></Guard>} />
          <Route path="/books/:id/focus" element={<Guard><Focus /></Guard>} />
          <Route path="/books/:id/split" element={<Guard><Split /></Guard>} />
          <Route path="/books/:id/notes" element={<Guard><Notes /></Guard>} />
          <Route path="/books/:id/export" element={<Guard><Export /></Guard>} />

          <Route path="/share/:token" element={<ShareBook />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </QueryClientProvider>
  );
}
