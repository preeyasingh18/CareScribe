import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AdminGate from './AdminGate';
import AdminDashboard from './AdminDashboard';
import { adminLogout, checkAdminSession } from './adminApi';

/**
 * /admin.
 *
 * Which of the two screens renders is decided by asking the server whether the
 * request carries a valid admin cookie — not by anything this component could
 * be talked into believing. Even if the dashboard were forced to render, every
 * endpoint behind it independently rejects an unauthenticated request, so it
 * would show nothing.
 *
 * Nothing is fetched until the session check comes back, so no data can appear
 * before authorisation is settled.
 */
export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A refresh inside the session window returns straight to the dashboard;
    // outside it, the cookie is expired and this answers false.
    checkAdminSession()
      .then(r => !cancelled && setAuthenticated(r.authenticated))
      .catch(() => !cancelled && setAuthenticated(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(() => {
    setAuthenticated(false);
    // Best-effort: the screen has already changed, and the cookie expires on
    // its own regardless.
    void adminLogout().catch(() => {});
  }, []);

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={20} className="animate-spin text-brand-600" />
      </div>
    );
  }

  if (!authenticated) return <AdminGate onUnlocked={() => setAuthenticated(true)} />;

  return <AdminDashboard onSignOut={signOut} />;
}
