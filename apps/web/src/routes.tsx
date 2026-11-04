import React from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router';

import { useAuth } from '@jot/core/auth';

import { Shell } from './components/Shell';
import { GraphPage } from './pages/Graph';
import { NotePage } from './pages/Note';
import { NotebookPage } from './pages/Notebook';
import { Onboarding, onboardingSeen } from './pages/Onboarding';
import { ProfilePage } from './pages/Profile';
import { SearchPage } from './pages/Search';
import { SetupPage } from './pages/Setup';
import { SharePage } from './pages/Share';
import { ShelfPage } from './pages/Shelf';
import { SignIn } from './pages/SignIn';
import { TagsPage } from './pages/Tags';
import { TodayPage } from './pages/Today';

/** Signed-in screens; everyone else is sent to set-up, onboarding or sign-in. */
function Private() {
  const { ready, session, configured } = useAuth();
  const location = useLocation();
  if (!configured) return <Navigate to="/setup" replace />;
  if (!ready) return <div className="boot" aria-busy="true" />;
  if (!session) {
    const next = location.pathname === '/' ? '' : `?next=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={(onboardingSeen() ? '/sign-in' : '/onboarding') + next} replace />;
  }
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

/** Signed-out screens step aside once a session exists. */
function Public({ children }: { children: React.ReactNode }) {
  const { ready, session, configured } = useAuth();
  if (!configured) return <Navigate to="/setup" replace />;
  if (ready && session) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next?.startsWith('/') ? next : '/today'} replace />;
  }
  return <>{children}</>;
}

function EditorRedirect() {
  const { id } = useParams();
  return <Navigate to={`/note/${id}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/share/:kind/:id" element={<SharePage />} />
      <Route path="/onboarding" element={<Public><Onboarding /></Public>} />
      <Route path="/sign-in" element={<Public><SignIn /></Public>} />
      <Route element={<Private />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/shelf" element={<ShelfPage />} />
        <Route path="/notebook/:id" element={<NotebookPage />} />
        <Route path="/note/:id" element={<NotePage />} />
        <Route path="/editor/:id" element={<EditorRedirect />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
