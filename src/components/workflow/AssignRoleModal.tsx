/**
 * AssignRoleModal — Modal for assigning a user to an evaluator/reviewer/approver role
 * on a campaign.
 *
 * Loads users via adminService.listUsers, filtered by search input.
 * Persists assignment via campagneStore.update.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listUsers } from '@/services/adminService';
import { useCampagneStore } from '@/stores/campagneStore';
import { useAuthStore } from '@/stores/authStore';
import { createNotification } from '@/services/notificationService';
import { writeAuditEntry } from '@/services/auditService';
import type { UserProfile } from '@/types';
import type { AssignmentRole } from '@/types/workflow';

// ── Icon helper ──────────────────────────────────────────────────────────────

function MIcon({ name, size = 20, fill = 0 }: { name: string; size?: number | undefined; fill?: 0 | 1 | undefined }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill ?? 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface AssignRoleModalProps {
  isOpen: boolean;
  role: AssignmentRole;
  campaignId: string;
  currentUserId?: string | undefined;
  onClose: () => void;
  onAssigned: () => void;
}

// ── Role title keys ─────────────────────────────────────────────────────────

const ROLE_TITLE_KEYS: Record<AssignmentRole, string> = {
  evaluateur: 'workflow.assignEvaluateur',
  reviewer: 'workflow.assignReviewer',
  approbateur: 'workflow.assignApprobateur',
};

// ── Component ───────────────────────────────────────────────────────────────

export function AssignRoleModal({ isOpen, role, campaignId, currentUserId, onClose, onAssigned }: AssignRoleModalProps) {
  const { t } = useTranslation();
  const { role: callerRole, orgId: callerOrgId, user: callerUser, profile: callerProfile } = useAuthStore();
  const { update } = useCampagneStore();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load users when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingUsers(true);
    setError(null);
    setSelectedUser(null);
    setSearch('');

    listUsers(callerRole, callerOrgId)
      .then((result) => {
        if (cancelled) return;
        setUsers(result);
        if (currentUserId) {
          const current = result.find(u => u.id === currentUserId);
          if (current) setSelectedUser(current);
        }
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, callerRole, callerOrgId]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap: focus the dialog when it opens
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // Click outside to close
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }, [onClose]);

  // Confirm assignment
  const handleConfirm = useCallback(async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError(null);
    try {
      const fieldId = `${role}Id` as const;
      const fieldName = `${role}Name` as const;
      const userName = `${selectedUser.prenom} ${selectedUser.nom}`.trim();
      await update(campaignId, {
        [fieldId]: selectedUser.id,
        [fieldName]: userName,
      });

      // Audit log — silencieux, ne doit pas bloquer le workflow
      writeAuditEntry({
        userId: callerUser?.id ?? '',
        userEmail: callerUser?.email ?? '',
        action: 'update',
        resource: 'campagne',
        resourceId: campaignId,
        metadata: {
          action: 'assign_role',
          role: role,
          assignedUserId: selectedUser.id,
          assignedUserName: selectedUser.nom + ' ' + selectedUser.prenom,
        },
      }).catch(() => {});

      // Notifier l'utilisateur assigné
      const callerName = callerProfile
        ? `${callerProfile.prenom} ${callerProfile.nom}`.trim()
        : (callerUser?.email ?? '');
      const roleLabelMap: Record<AssignmentRole, string> = {
        evaluateur: 'évaluateur',
        reviewer: 'réviseur',
        approbateur: 'approbateur',
      };
      createNotification({
        type: 'workflow_assigned',
        title: 'Rôle assigné',
        message: `Vous avez été désigné ${roleLabelMap[role]} pour le cycle de campagne.`,
        recipientId: selectedUser.id,
        senderId: callerUser?.id,
        senderName: callerName,
        resourceType: 'campagne',
        resourceId: campaignId,
      }).catch(() => {});

      onAssigned();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [selectedUser, role, campaignId, update, onAssigned, callerUser, callerProfile]);

  // Filter users by search
  const searchLower = search.toLowerCase();
  const filteredUsers = search.trim()
    ? users.filter((u) => {
        const fullName = `${u.prenom} ${u.nom}`.toLowerCase();
        return fullName.includes(searchLower) || u.email.toLowerCase().includes(searchLower);
      })
    : users;

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t(ROLE_TITLE_KEYS[role])}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg mx-4 outline-none"
        style={{
          background: 'var(--surface-container-lowest)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{
            borderBottom: '1px solid var(--outline-variant)',
          }}
        >
          <h3
            className="text-lg font-bold"
            style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
          >
            {t(ROLE_TITLE_KEYS[role])}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--on-surface-variant)',
              padding: '4px',
            }}
            aria-label={t('common.close')}
          >
            <MIcon name="close" size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{
              background: 'var(--surface-container-highest)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid transparent',
            }}
          >
            <MIcon name="search" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('workflow.searchUser')}
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: 'var(--on-surface)', border: 'none' }}
            />
          </div>
        </div>

        {/* User list */}
        <div
          className="flex-1 overflow-y-auto px-6 py-2"
          style={{ minHeight: 0 }}
        >
          {loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <MIcon name="sync" size={24} />
              <span className="ml-2 text-sm" style={{ color: 'var(--outline)' }}>
                {t('common.loading')}
              </span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-sm" style={{ color: 'var(--outline)' }}>
                {t('admin.utilisateurs.aucun')}
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((u) => {
                const fullName = `${u.prenom} ${u.nom}`.trim();
                const initials = fullName
                  .split(' ')
                  .map((p) => p.charAt(0))
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                const isSelected = selectedUser?.id === u.id;

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUser(isSelected ? null : u)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors"
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      border: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                      background: isSelected ? 'var(--primary-fixed)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        background: isSelected ? 'var(--gradient-primary)' : 'var(--surface-container-highest)',
                        color: isSelected ? 'white' : 'var(--on-surface-variant)',
                        borderRadius: '50%',
                      }}
                    >
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--on-surface)' }}
                      >
                        {fullName}
                      </div>
                      <div
                        className="text-xs truncate"
                        style={{ color: 'var(--on-surface-variant)' }}
                      >
                        {u.email}
                      </div>
                    </div>

                    {/* Role badge */}
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 flex-shrink-0"
                      style={{
                        background: 'var(--surface-container)',
                        color: 'var(--on-surface-variant)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      {t(`admin.roles.${u.role}`)}
                    </span>

                    {/* Check icon */}
                    {isSelected && (
                      <MIcon name="check_circle" size={20} fill={1} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="mx-6 mb-2 p-3 text-xs flex items-center gap-2"
            style={{
              background: 'var(--error-container)',
              color: 'var(--on-error-container)',
              borderRadius: 'var(--radius-lg)',
            }}
            role="alert"
          >
            <MIcon name="error" size={14} />
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{
            borderTop: '1px solid var(--outline-variant)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{
              background: 'var(--surface-container-highest)',
              color: 'var(--on-surface)',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedUser || saving}
            className="px-5 py-2.5 text-sm font-bold transition-all"
            style={{
              background: selectedUser && !saving ? 'var(--gradient-primary)' : 'var(--surface-container-highest)',
              color: selectedUser && !saving ? 'white' : 'var(--outline)',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: selectedUser && !saving ? 'pointer' : 'not-allowed',
              boxShadow: selectedUser && !saving ? '0 4px 12px rgba(21,35,110,0.25)' : 'none',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? t('common.loading') : t('workflow.confirmAssignment')}
          </button>
        </div>
      </div>
    </div>
  );
}
