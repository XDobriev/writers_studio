import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { AuthGuard } from './components/AuthGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Outline from './pages/Outline';
import Corkboard from './pages/Corkboard';
import MapScreen from './pages/Map';
import Timeline from './pages/Timeline';
import Characters from './pages/Characters';
import Focus from './pages/Focus';
import Split from './pages/Split';
import Export from './pages/Export';
import Notes from './pages/Notes';
import Admin from './pages/Admin';
import ResetPassword from './pages/ResetPassword';

const queryClient = new QueryClient();

function Guard({ children }: { children: ReactNode }) {
  return <AuthGuard><ErrorBoundary>{children}</ErrorBoundary></AuthGuard>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/books" replace />} />
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
          <Route path="*" element={<Navigate to="/books" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </QueryClientProvider>
  );
}
