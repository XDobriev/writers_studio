import { useState, lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { AuthGuard } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { CookieBanner } from './components/CookieBanner';

// Критический путь — eager: эти страницы нужны до любой навигации
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';

// Всё остальное — lazy: браузер скачает чанк только при переходе на маршрут
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

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
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
