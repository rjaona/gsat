/**
 * NotificationCenter — Centre d'alertes & notifications, vue globale
 * Real-time Supabase notifications with filtering and KPI sidebar
 */
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/types/notification';

function Icon({ name, size = 20, fill = 0 }: { name: string; size?: number; fill?: 0 | 1 }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

const TYPE_ICON: Record<string, string> = {
  evaluation_submitted: 'assignment',
  evaluation_validated: 'verified',
  evaluation_rejected: 'cancel',
  campagne_opened: 'event_available',
  campagne_closed: 'event_busy',
  action_overdue: 'pending_actions',
  user_created: 'person_add',
  comment_added: 'chat_bubble',
  system: 'settings_suggest',
};

const TYPE_STYLE: Record<string, { color: string; bg: string }> = {
  evaluation_submitted: { color: 'var(--primary)',    bg: 'var(--primary-fixed)' },
  evaluation_validated: { color: 'var(--secondary)',  bg: 'var(--secondary-container)' },
  evaluation_rejected:  { color: 'var(--error)',      bg: 'var(--error-container)' },
  campagne_opened:      { color: 'var(--secondary)',  bg: 'var(--secondary-container)' },
  campagne_closed:      { color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
  action_overdue:       { color: 'var(--error)',      bg: 'var(--error-container)' },
  user_created:         { color: 'var(--primary)',    bg: 'var(--primary-fixed)' },
  comment_added:        { color: 'var(--primary)',    bg: 'var(--primary-fixed)' },
  system:               { color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
};

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `${diffDays}j`;
  return date.toLocaleDateString();
}

export function NotificationCenter() {
  const { t } = useTranslation();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotificationStore();

  const critical = notifications.filter(
    (n) => n.type === 'evaluation_rejected' || n.type === 'action_overdue',
  ).length;

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <header className="mb-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="label-caps block mb-2">Executive Overview</span>
            <h1
              className="text-4xl font-extrabold tracking-tight"
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
            >
              {t('notifications.title')}
            </h1>
          </div>
        </div>
      </header>

      {/* Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Feed (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Feed items */}
          <section className="space-y-3">
            {loading && (
              <div
                className="p-8 text-center text-sm"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                {t('common.loading')}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div
                className="p-12 text-center"
                style={{
                  background: 'var(--surface-container-lowest)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <Icon name="notifications_off" size={48} />
                <p
                  className="mt-4 text-sm font-medium"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  {t('notifications.noNotifications')}
                </p>
              </div>
            )}

            {notifications.map((item: Notification) => {
              const style = TYPE_STYLE[item.type] ?? TYPE_STYLE['system']!;
              const icon = TYPE_ICON[item.type] ?? 'notifications';

              return (
                <div
                  key={item.id}
                  className="p-5 flex gap-4 transition-all"
                  style={{
                    background: 'var(--surface-container-lowest)',
                    boxShadow: 'var(--shadow-card)',
                    borderRadius: 'var(--radius-xl)',
                    borderLeft: `4px solid ${item.read ? 'transparent' : style.color}`,
                    opacity: item.read ? 0.85 : 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (!item.read) {
                      void markAsRead(item.id);
                    }
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.transform = 'translateX(4px)')
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.transform = 'translateX(0)')
                  }
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: style.bg,
                      color: style.color,
                      borderRadius: 'var(--radius-xl)',
                    }}
                  >
                    <Icon name={icon} size={20} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                        {!item.read && (
                          <span
                            className="inline-block w-1.5 h-1.5 mr-1.5 align-middle"
                            style={{ background: style.color, borderRadius: '50%' }}
                          />
                        )}
                        {item.title}
                      </h3>
                      <span
                        className="text-[10px] font-medium flex-shrink-0"
                        style={{ color: 'var(--outline)' }}
                      >
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--on-surface-variant)' }}>
                      {item.message}
                    </p>
                    <div className="flex items-center gap-3">
                      <span
                        className="px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          background: style.bg,
                          color: style.color,
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        {t(`notifications.types.${item.type}` as const)}
                      </span>
                      {item.senderName && (
                        <span className="text-xs" style={{ color: 'var(--outline)' }}>
                          {item.senderName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        {/* Sidebar KPIs (4 cols) */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Summary stats */}
          {[
            {
              label: t('notifications.unread'),
              value: unreadCount,
              icon: 'mark_email_unread',
              color: 'var(--primary)',
            },
            {
              label: t('notifications.types.action_overdue'),
              value: critical,
              icon: 'report_problem',
              color: 'var(--error)',
            },
            {
              label: 'Total',
              value: notifications.length,
              icon: 'notifications',
              color: 'var(--secondary)',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="p-5 flex items-center gap-4"
              style={{
                background: 'var(--surface-container-lowest)',
                boxShadow: 'var(--shadow-card)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                style={{
                  background: s.color + '15',
                  color: s.color,
                  borderRadius: 'var(--radius-xl)',
                }}
              >
                <Icon name={s.icon} size={24} />
              </div>
              <div>
                <p className="label-caps">{s.label}</p>
                <p
                  className="text-3xl font-extrabold"
                  style={{ color: s.color, fontFamily: 'var(--font-headline)' }}
                >
                  {s.value}
                </p>
              </div>
            </div>
          ))}

          {/* Quick actions */}
          <div
            className="p-5 space-y-2"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h4
              className="text-sm font-bold mb-3"
              style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
            >
              Actions rapides
            </h4>
            <button
              onClick={() => void markAllAsRead()}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors"
              style={{
                background: 'transparent',
                color: 'var(--on-surface-variant)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  'var(--surface-container-low)';
                (e.currentTarget as HTMLElement).style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--on-surface-variant)';
              }}
            >
              <Icon name="done_all" size={18} />
              {t('notifications.markAllRead')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
