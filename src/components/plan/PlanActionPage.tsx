import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePlanDetail, useActions, usePlanActionStats } from '@/hooks/usePlanAction';
import { usePlanActionStore } from '@/stores/planActionStore';
import { useAuthStore } from '@/stores/authStore';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { ActionKanban } from './ActionKanban';
import { ActionCard } from './ActionCard';
import { ActionFormModal } from './ActionFormModal';
import { SuiviTimeline } from './SuiviTimeline';
import { getPlanByEvalId } from '@/services/planActionService';
import type { Action, ActionStatut } from '@/types';

// ── Vue liste compacte ─────────────────────────────────────────────────────────

const PRIORITE_COLOR: Record<string, string> = {
  basse:    'var(--text-muted)',
  moyenne:  'var(--info)',
  haute:    'var(--score-faible)',
  critique: 'var(--danger)',
};

const STATUT_STYLE: Record<ActionStatut, { bg: string; color: string }> = {
  a_faire:  { bg: 'var(--surface-container-high)', color: 'var(--text-secondary)' },
  en_cours: { bg: 'var(--info-light)',              color: 'var(--info)' },
  termine:  { bg: 'var(--success-light)',           color: 'var(--success)' },
  bloque:   { bg: 'var(--danger-light)',            color: 'var(--danger)' },
};

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function isEnRetard(iso: string | undefined, statut: ActionStatut): boolean {
  if (!iso || statut === 'termine') return false;
  return new Date(iso) < new Date();
}

function ActionList({
  actions,
  loadingAction = {},
  onEdit,
  onSuivi,
}: {
  actions: Action[];
  loadingAction?: Record<string, boolean>;
  onEdit?: (a: Action) => void;
  onSuivi?: (a: Action) => void;
}) {
  const { t } = useTranslation();

  if (actions.length === 0) {
    return (
      <div
        style={{
          padding: '48px',
          textAlign: 'center',
          background: 'var(--surface-container-lowest)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          {t('planAction.aucuneAction')}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 100px 90px 80px 120px',
          gap: '8px',
          padding: '10px 20px',
          background: 'var(--surface-container-low)',
        }}
      >
        {['Objectif', 'Priorité', 'Statut', 'Responsable', 'Échéance', ''].map(h => (
          <span
            key={h}
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {actions.map((action, i) => {
          const retard = isEnRetard(action.dateEcheance, action.statut);
          const statut = STATUT_STYLE[action.statut];
          const prioriteColor = PRIORITE_COLOR[action.priorite] ?? 'var(--text-muted)';
          const loading = loadingAction[action.id] ?? false;

          return (
            <div
              key={action.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 100px 90px 80px 120px',
                gap: '8px',
                padding: '12px 20px',
                alignItems: 'center',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                opacity: loading ? 0.5 : 1,
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-low)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {/* Objectif */}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {action.objectif}
                </p>
                {action.critereCode && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {action.critereCode}
                  </p>
                )}
              </div>

              {/* Priorité */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: prioriteColor,
                }}
              >
                {t(`planAction.priorites.${action.priorite}`)}
              </span>

              {/* Statut */}
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  padding: '3px 10px',
                  background: statut.bg,
                  color: statut.color,
                  display: 'inline-block',
                }}
              >
                {t(`planAction.statuts.${action.statut}`)}
              </span>

              {/* Responsable */}
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {action.responsable ?? '—'}
              </span>

              {/* Échéance */}
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: retard ? 600 : 400,
                  color: retard ? 'var(--danger)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDate(action.dateEcheance)}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(action)}
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-lg)',
                      border: 'none',
                      background: 'var(--surface-container)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-container)'; }}
                  >
                    {t('common.modifier')}
                  </button>
                )}
                {onSuivi && (
                  <button
                    type="button"
                    onClick={() => onSuivi(action)}
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-lg)',
                      border: 'none',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary)'; }}
                  >
                    {t('planAction.ajouterSuivi')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Icônes de vue ──────────────────────────────────────────────────────────────

function KanbanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="5" y="0" width="4" height="10" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="10" y="0" width="4" height="7" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="0" y="1" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="6" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="11" width="14" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export function PlanActionPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const evalId = searchParams.get('evalId');
  const planIdParam = searchParams.get('planId');
  const [planId, setPlanId] = useState<string | null>(planIdParam);
  const [resolvingPlan, setResolvingPlan] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const { profile, user } = useAuthStore();
  const { creerDepuisEvaluation, ajouterSuivi } = usePlanActionStore();

  useEffect(() => {
    if (!evalId || planIdParam) return;
    setResolvingPlan(true);
    getPlanByEvalId(evalId)
      .then(async (existing) => {
        if (existing) {
          setPlanId(existing.id);
        } else if (user) {
          const newId = await creerDepuisEvaluation(evalId, user.id);
          setPlanId(newId);
        }
      })
      .catch(() => {})
      .finally(() => setResolvingPlan(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalId, planIdParam]);

  const { plan, loading, error } = usePlanDetail(planId);
  const { actionsFiltrees, filtres, loadingAction, setFiltreStatut } = useActions();
  const stats = usePlanActionStats();

  const [modalOuverte, setModalOuverte] = useState(false);
  const [actionEnEdition, setActionEnEdition] = useState<Action | undefined>();
  const [actionSuivi, setActionSuivi] = useState<Action | null>(null);
  const [commentaireSuivi, setCommentaireSuivi] = useState('');
  const [nouveauStatutSuivi, setNouveauStatutSuivi] = useState<ActionStatut>('en_cours');
  const [suiviSelectFocused, setSuiviSelectFocused] = useState(false);
  const [suiviTextareaFocused, setSuiviTextareaFocused] = useState(false);

  const STATUTS_FILTRE: Array<ActionStatut | 'tous'> = ['tous', 'a_faire', 'en_cours', 'termine', 'bloque'];

  const kpis = [
    { label: t('planAction.kpi.total'), value: stats.total },
    {
      label: t('planAction.kpi.completion'),
      value: `${stats.pourcentageCompletion}%`,
      variant:
        stats.pourcentageCompletion >= 75 ? 'success' as const :
        stats.pourcentageCompletion >= 40 ? 'warning' as const : 'default' as const,
    },
    {
      label: t('planAction.kpi.critiques'),
      value: stats.nbActionsCritiques,
      variant: stats.nbActionsCritiques > 0 ? 'danger' as const : 'success' as const,
    },
    {
      label: t('planAction.kpi.bloquees'),
      value: stats.nbActionsBloquees,
      variant: stats.nbActionsBloquees > 0 ? 'danger' as const : 'success' as const,
    },
  ];

  async function handleSuiviSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!actionSuivi || !profile || !commentaireSuivi.trim()) return;
    await ajouterSuivi(
      actionSuivi.id,
      {
        commentaire: commentaireSuivi.trim(),
        ancienStatut: actionSuivi.statut,
        nouveauStatut: nouveauStatutSuivi,
        createdBy: profile.id,
      },
      profile.id
    );
    setActionSuivi(null);
    setCommentaireSuivi('');
  }

  if (!planId || resolvingPlan) {
    return (
      <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        {resolvingPlan ? (
          <>
            <div
              className="animate-spin"
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                border: '3px solid var(--primary-light)',
                borderTopColor: 'var(--primary)',
              }}
            />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('planAction.chargementPlan')}</p>
          </>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
            {t('planAction.aucunPlanSelectionne')}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div
          style={{
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            fontSize: '13px',
            background: 'var(--danger-light)',
            color: 'var(--danger)',
          }}
        >
          {t('common.erreurChargement')} : {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              fontFamily: 'var(--font-headline)',
              color: 'var(--text)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {t('nav.planAction')}
          </h1>
          {plan && (
            <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--text-secondary)' }}>
              {t('planAction.statut')} :{' '}
              <span style={{ fontWeight: 600 }}>{t(`planAction.planStatuts.${plan.statut}`)}</span>
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Toggle vue */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-lg)',
              padding: '3px',
              boxShadow: 'var(--shadow-xs)',
            }}
          >
            {([['kanban', <KanbanIcon />], ['list', <ListIcon />]] as const).map(([mode, icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode as 'kanban' | 'list')}
                title={mode === 'kanban' ? 'Vue Kanban' : 'Vue Liste'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 150ms ease, color 150ms ease',
                  background: viewMode === mode ? 'var(--primary)' : 'transparent',
                  color: viewMode === mode ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Nouvelle action */}
          <button
            type="button"
            onClick={() => { setActionEnEdition(undefined); setModalOuverte(true); }}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              background: 'var(--gradient-primary)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px -1px rgba(21,35,110,0.35)',
              transition: 'opacity 150ms ease, transform 150ms ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.opacity = '0.9';
              el.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            }}
          >
            + {t('planAction.nouvelleAction')}
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <KpiStrip kpis={kpis} loading={loading} />

      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {STATUTS_FILTRE.map(statut => (
          <button
            key={statut}
            type="button"
            onClick={() => setFiltreStatut(statut)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
              background: filtres.statut === statut ? 'var(--primary)' : 'var(--surface-container)',
              color: filtres.statut === statut ? '#ffffff' : 'var(--text-secondary)',
            }}
            onMouseEnter={e => {
              if (filtres.statut !== statut) {
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)';
              }
            }}
            onMouseLeave={e => {
              if (filtres.statut !== statut) {
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-container)';
              }
            }}
          >
            {statut === 'tous' ? t('campagne.filtreToutes') : t(`planAction.statuts.${statut}`)}
            {statut !== 'tous' && (
              <span style={{ marginLeft: '5px', opacity: 0.65, fontWeight: 400 }}>
                ({stats.parStatut[statut as ActionStatut] ?? 0})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Vue actions ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: '240px',
                borderRadius: 'var(--radius-2xl)',
                background: 'var(--surface-container-low)',
              }}
            />
          ))}
        </div>
      ) : viewMode === 'kanban' ? (
        <ActionKanban
          actions={actionsFiltrees}
          loadingAction={loadingAction}
          onEdit={action => { setActionEnEdition(action); setModalOuverte(true); }}
          onSuivi={action => { setActionSuivi(action); setNouveauStatutSuivi(action.statut); }}
        />
      ) : (
        <ActionList
          actions={actionsFiltrees}
          loadingAction={loadingAction}
          onEdit={action => { setActionEnEdition(action); setModalOuverte(true); }}
          onSuivi={action => { setActionSuivi(action); setNouveauStatutSuivi(action.statut); }}
        />
      )}

      {/* ── Panel suivi ── */}
      {actionSuivi && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(23,28,34,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'var(--shadow-xl)',
              width: '100%',
              maxWidth: '520px',
              overflow: 'hidden',
            }}
            className="animate-fadeIn"
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <h2
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-headline)',
                  color: 'var(--text)',
                }}
              >
                {t('planAction.ajouterSuivi')}
              </h2>
              <button
                type="button"
                onClick={() => setActionSuivi(null)}
                style={{
                  width: '28px', height: '28px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--surface-container)',
                  color: 'var(--text-muted)',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label={t('common.fermer')}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSuiviSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Objectif */}
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {actionSuivi.objectif}
              </p>

              {/* Nouveau statut */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                  }}
                >
                  {t('planAction.nouveauStatut')}
                </label>
                <select
                  value={nouveauStatutSuivi}
                  onChange={e => setNouveauStatutSuivi(e.target.value as ActionStatut)}
                  onFocus={() => setSuiviSelectFocused(true)}
                  onBlur={() => setSuiviSelectFocused(false)}
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px 14px',
                    fontSize: '13px',
                    outline: 'none',
                    background: 'var(--surface-container-highest)',
                    border: `2px solid ${suiviSelectFocused ? 'var(--primary)' : 'transparent'}`,
                    color: 'var(--text)',
                    transition: 'border-color 150ms ease',
                    cursor: 'pointer',
                  }}
                >
                  {(['a_faire', 'en_cours', 'termine', 'bloque'] as ActionStatut[]).map(s => (
                    <option key={s} value={s}>{t(`planAction.statuts.${s}`)}</option>
                  ))}
                </select>
              </div>

              {/* Commentaire */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                  }}
                >
                  {t('planAction.commentaireSuivi')} *
                </label>
                <textarea
                  value={commentaireSuivi}
                  onChange={e => setCommentaireSuivi(e.target.value)}
                  onFocus={() => setSuiviTextareaFocused(true)}
                  onBlur={() => setSuiviTextareaFocused(false)}
                  rows={3}
                  required
                  placeholder={t('planAction.commentaireSuiviPlaceholder')}
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px 14px',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'none',
                    background: 'var(--surface-container-highest)',
                    border: `2px solid ${suiviTextareaFocused ? 'var(--primary)' : 'transparent'}`,
                    color: 'var(--text)',
                    transition: 'border-color 150ms ease',
                  }}
                />
              </div>

              {/* Historique */}
              {plan && (
                <div>
                  <p
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                    }}
                  >
                    {t('planAction.historiquesSuivis')}
                  </p>
                  <SuiviTimeline planId={plan.id} actionId={actionSuivi.id} />
                </div>
              )}

              {/* Boutons */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActionSuivi(null)}
                  style={{
                    flex: 1,
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: 'none',
                    background: 'var(--surface-container)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-container)'; }}
                >
                  {t('common.annuler')}
                </button>
                <button
                  type="submit"
                  disabled={!commentaireSuivi.trim()}
                  style={{
                    flex: 1,
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    background: 'var(--gradient-primary)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    opacity: commentaireSuivi.trim() ? 1 : 0.5,
                    transition: 'opacity 150ms',
                  }}
                >
                  {t('planAction.enregistrerSuivi')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal action ── */}
      <ActionFormModal
        isOpen={modalOuverte}
        onClose={() => { setModalOuverte(false); setActionEnEdition(undefined); }}
        actionExistante={actionEnEdition}
      />
    </div>
  );
}
