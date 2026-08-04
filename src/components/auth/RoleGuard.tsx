import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
}

/**
 * Protects a route element by required roles.
 * Renders an access-denied message if the user's role is not in the allowed list.
 */
export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { t } = useTranslation();
  const { role } = useAuthStore();

  if (!role || !roles.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <span
          className="material-symbols-outlined text-6xl"
          style={{ color: 'var(--error)' }}
          aria-hidden="true"
        >
          lock
        </span>
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
        >
          {t('auth.accessDeniedTitle', 'Access denied')}
        </h2>
        <p
          className="text-sm max-w-md text-center"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          {t(
            'auth.accessDeniedMessage',
            'You do not have the required permissions to access this page. Please contact your administrator if you believe this is an error.',
          )}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
