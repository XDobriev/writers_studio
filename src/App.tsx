import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { AuthGuard } from './components/AuthGuard';
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/books" replace />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/books"
            element={<AuthGuard><Home /></AuthGuard>}
          />
          <Route
            path="/books/:id"
            element={<AuthGuard><Dashboard /></AuthGuard>}
          />
          <Route
            path="/books/:id/editor"
            element={<AuthGuard><Editor /></AuthGuard>}
          />
          <Route
            path="/books/:id/outline"
            element={<AuthGuard><Outline /></AuthGuard>}
          />
          <Route
            path="/books/:id/corkboard"
            element={<AuthGuard><Corkboard /></AuthGuard>}
          />
          <Route
            path="/books/:id/map"
            element={<AuthGuard><MapScreen /></AuthGuard>}
          />
          <Route
            path="/books/:id/timeline"
            element={<AuthGuard><Timeline /></AuthGuard>}
          />
          <Route
            path="/books/:id/characters"
            element={<AuthGuard><Characters /></AuthGuard>}
          />
          <Route
            path="/books/:id/focus"
            element={<AuthGuard><Focus /></AuthGuard>}
          />
          <Route
            path="/books/:id/split"
            element={<AuthGuard><Split /></AuthGuard>}
          />
          <Route
            path="/books/:id/notes"
            element={<AuthGuard><Notes /></AuthGuard>}
          />
          <Route
            path="/books/:id/export"
            element={<AuthGuard><Export /></AuthGuard>}
          />

          <Route path="/admin" element={<Admin />} />

          <Route path="*" element={<Navigate to="/books" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
