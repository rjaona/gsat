import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import type { UserRole } from '@/types';

interface PrivateRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[] | undefined;
}

export function PrivateRoute({ children, requiredRoles }: PrivateRouteProps) {
  const { user, role, loading, initialized } = useAuthStore();

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = useNotificationStore.getState().subscribe(user.id);
    return unsubscribe;
  }, [user?.id]);

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && (!role || !requiredRoles.includes(role))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Accès non autorisé.</div>
      </div>
    );
  }

  return <>{children}</>;
}
