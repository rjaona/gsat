/**
 * TrackingPage -- Suivi du Plan d'Action (editorial design)
 *
 * Route: /action-plan
 * Design: Stitch template -- summary card, KPI bento, editorial table,
 *         evidence management, activity timeline.
 * Data: planActionStore (Supabase Realtime)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePlanDetail, useActions, usePlanActionStats } from '@/hooks/usePlanAction';
import { usePlanActionStore } from '@/stores/planActionStore';
import { useAuthStore } from '@/stores/authStore';
import { getPlanByEvalId } from '@/services/planActionService';
import { ActionFormModal } from '@/components/plan/ActionFormModal';
import { SuiviTimeline } from '@/components/plan/SuiviTimeline';
import type { Action, ActionStatut } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function progressForAction(action: Action): number {
  switch (action.statut) {
    case 'termine': return 100;
    case 'en_cours': return 55;
    case 'bloque': return 30;
    case 'a_faire': return 0;
    default: return 0;
  }
}

const STATUT_PILL: Record<ActionStatut, { bg: string; color: string }> = {
  termine:  { bg: 'var(--secondary-container)', color: 'var(--secondary)' },
  en_cours: { bg: 'var(--primary-container)',   color: '#ffffff' },
  bloque:   { bg: 'var(--error-container)',     color: 'var(--on-error-container)' },
  a_faire:  { bg: 'var(--surface-container-highest)', color: 'var(--on-surface-variant)' },
};

const PROGRESS_COLOR: Record<ActionStatut, string> = {
  termine:  'var(--secondary)',
  en_cours: 'var(--primary)',
  bloque:   'var(--error)',
  a_faire:  'var(--outline-variant)',
};

// ── Icon components (inline SVG, no deps) ────────────────────────────────────

function IconFilter() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconPending() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconError() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2 }}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}


// ── Main Page ────────────────────────────────────────────────────────────────

export function TrackingPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const evalId = searchParams.get('evalId');
  const planIdParam = searchParams.get('planId');
  const [planId, setPlanId] = useState<string | null>(planIdParam);
  const [resolvingPlan, setResolvingPlan] = useState(false);

  const { profile, user, role } = useAuthStore();
  const { creerDepuisEvaluation, ajouterSuivi } = usePlanActionStore();

  const canWrite = role !== 'lecteur';

  const [createError, setCreateError] = useState<string | null>(null);

  // Resolve plan from evalId
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
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setCreateError(msg || t('planAction.erreurCreationPlan'));
      })
      .finally(() => setResolvingPlan(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalId, planIdParam]);

  const { plan, loading, error } = usePlanDetail(planId);
  const { actionsFiltrees, loadingAction } = useActions();
  const stats = usePlanActionStats();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | undefined>();
  const [suiviAction, setSuiviAction] = useState<Action | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [nouveauStatut, setNouveauStatut] = useState<ActionStatut>('en_cours');

  // Computed values
  const weightedProgress = useMemo(() => {
    if (actionsFiltrees.length === 0) return 0;
    const sum = actionsFiltrees.reduce((acc, a) => acc + progressForAction(a), 0);
    return Math.round(sum / actionsFiltrees.length);
  }, [actionsFiltrees]);

  const lastUpdate = useMemo(() => {
    if (actionsFiltrees.length === 0) return '--';
    const sorted = [...actionsFiltrees].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return formatDate(sorted[0]?.createdAt);
  }, [actionsFiltrees]);

  const computedStats = useMemo(() => ({
    enCours: stats.parStatut.en_cours,
    bloques: stats.nbActionsBloquees,
    total: stats.total,
    termines: stats.parStatut.termine,
  }), [stats]);

  const handleSuiviSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suiviAction || !profile || !commentaire.trim()) return;
    await ajouterSuivi(
      suiviAction.id,
      {
        commentaire: commentaire.trim(),
        ancienStatut: suiviAction.statut,
        nouveauStatut,
        createdBy: profile.id,
      },
      profile.id
    );
    setSuiviAction(null);
    setCommentaire('');
  }, [suiviAction, profile, commentaire, nouveauStatut, ajouterSuivi]);

  // ── Loading state ──
  if (resolvingPlan) {
    return (
      <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div
          className="animate-spin"
          style={{
            width: '32px', height: '32px', borderRadius: '50%',
            border: '3px solid var(--primary-light)',
            borderTopColor: 'var(--primary)',
          }}
        />
        <p style={{ fontSize: '13px', color: 'var(--outline)' }}>{t('planAction.chargementPlan')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ borderRadius: '12px', padding: '14px 16px', fontSize: '13px', background: 'var(--error-container)', color: 'var(--error)' }}>
          {error}
        </div>
      </div>
    );
  }

  const displayActions = actionsFiltrees.map(a => ({
    id: a.id,
    objectif: a.objectif,
    domaineAmelioration: a.domaineAmelioration,
    statut: a.statut,
    dateEcheance: a.dateEcheance,
  }));

  return (
    <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ═══ ERREUR CRÉATION PLAN ═══ */}
      {createError && (
        <div
          role="alert"
          style={{
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '13px',
            background: 'var(--error-container)',
            color: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>{createError}</span>
          <button
            type="button"
            onClick={() => setCreateError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--error)',
              fontSize: '16px',
              lineHeight: 1,
              padding: '0 4px',
              flexShrink: 0,
            }}
            aria-label={t('common.fermer')}
          >
            ×
          </button>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              fontStyle: 'italic',
              fontFamily: 'var(--font-headline)',
              color: '#4B2E83',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              marginBottom: '8px',
            }}
          >
            {t('tracking.title')}
          </h1>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--on-surface-variant)' }}>
            {t('tracking.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '9px 18px',
              borderRadius: '2rem',
              border: 'none',
              fontSize: '12px', fontWeight: 600,
              background: 'var(--surface-container-lowest)',
              color: 'var(--on-surface-variant)',
              boxShadow: 'var(--shadow-xs)',
              cursor: 'pointer',
            }}
          >
            <IconFilter />
            {t('tracking.advancedFilters')}
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => { setEditingAction(undefined); setModalOpen(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 18px',
                borderRadius: '2rem',
                border: 'none',
                fontSize: '12px', fontWeight: 700,
                background: 'var(--gradient-wosm-purple)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px -1px rgba(75, 46, 131, 0.35)',
              }}
            >
              <IconPlus />
              {t('tracking.newTask')}
            </button>
          )}
        </div>
      </div>

      {/* ═══ BENTO GRID: Summary + KPIs ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '20px',
        }}
      >
        {/* ── Summary Card (WOSM purple, spans 4 cols on lg) ── */}
        <section
          style={{
            gridColumn: 'span 12',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '2rem',
            background: '#4B2E83',
            padding: '32px',
            color: '#ffffff',
            boxShadow: '0 8px 32px -4px rgba(75, 46, 131, 0.25)',
            minHeight: '340px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Decorative bg circles */}
          <div
            style={{
              position: 'absolute', right: '-30px', top: '-30px',
              width: '200px', height: '200px', borderRadius: '50%',
              background: 'rgba(253, 183, 20, 0.08)',
            }}
          />
          <div
            style={{
              position: 'absolute', right: '40px', bottom: '-40px',
              width: '140px', height: '140px', borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.04)',
            }}
          />
          {/* Decorative analytics icon */}
          <div style={{ position: 'absolute', right: '24px', top: '24px' }}>
            <IconAnalytics />
          </div>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Badge */}
            <span
              style={{
                display: 'inline-block',
                alignSelf: 'flex-start',
                fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '4px 14px',
                borderRadius: '2rem',
                background: 'var(--secondary-container)',
                color: 'var(--on-secondary-container)',
              }}
            >
              {t('tracking.planHealth')}
            </span>

            {/* Title */}
            <h2
              style={{
                fontSize: '16px', fontWeight: 600,
                fontFamily: 'var(--font-headline)',
                opacity: 0.85,
              }}
            >
              {t('tracking.globalProgress')}
            </h2>

            {/* Score */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
              <span
                style={{
                  fontSize: '3rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                {loading ? '--' : `${weightedProgress}%`}
              </span>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '12px', fontWeight: 600,
                  color: 'var(--secondary-fixed)',
                  marginBottom: '6px',
                }}
              >
                <IconTrend />
                +12% {t('tracking.vsLastMonth')}
              </span>
            </div>

            {/* Description */}
            <p style={{ fontSize: '12px', opacity: 0.7, maxWidth: '380px', lineHeight: 1.5 }}>
              {t('tracking.realtimeAnalysis')}
            </p>

            {/* Progress bar */}
            <div
              style={{
                width: '100%', maxWidth: '400px', height: '12px',
                borderRadius: '2rem',
                background: 'rgba(255, 255, 255, 0.10)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: loading ? '0%' : `${weightedProgress}%`,
                  height: '100%',
                  borderRadius: '2rem',
                  background: 'var(--secondary-fixed)',
                  transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>
          </div>
        </section>

        {/* ── KPI Box 1: Tasks in progress ── */}
        <div
          style={{
            gridColumn: 'span 12',
            background: 'var(--surface-container-lowest)',
            borderRadius: '2rem',
            padding: '24px',
            boxShadow: 'var(--shadow-card)',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-variant)' }}>
              {t('tracking.tasksInProgress')}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-fixed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <IconPending />
            </div>
          </div>
          <span style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-headline)', color: 'var(--primary)', letterSpacing: '-0.04em' }}>
            {loading ? '--' : String(computedStats.enCours).padStart(2, '0')}
          </span>
        </div>

        {/* ── KPI Box 2: Blocking issues ── */}
        <div
          style={{
            gridColumn: 'span 12',
            background: 'rgba(255, 218, 214, 0.30)',
            borderRadius: '2rem',
            padding: '24px',
            boxShadow: 'var(--shadow-card)',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-variant)' }}>
              {t('tracking.blockers')}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--error-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
              <IconError />
            </div>
          </div>
          <span style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-headline)', color: 'var(--error)', letterSpacing: '-0.04em' }}>
            {loading ? '--' : String(computedStats.bloques).padStart(2, '0')}
          </span>
        </div>

        {/* ── KPI Box 3: Last update ── */}
        <div
          style={{
            gridColumn: 'span 12',
            background: 'var(--surface-container-low)',
            borderRadius: '2rem',
            padding: '24px',
            boxShadow: 'var(--shadow-card)',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-variant)' }}>
              {t('tracking.lastUpdate')}
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--wosm-purple-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wosm-purple)' }}>
              <IconClock />
            </div>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)', marginTop: '4px' }}>
            {loading ? '--' : lastUpdate}
          </span>
          <button
            type="button"
            style={{
              fontSize: '11px', fontWeight: 600,
              color: 'var(--wosm-purple)',
              background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left',
              padding: 0, marginTop: '4px',
            }}
          >
            {t('tracking.viewLog')} &rarr;
          </button>
        </div>
      </div>

      {/* ═══ ACTION REGISTER TABLE (editorial) ═══ */}
      <div
        style={{
          background: 'var(--surface-container-lowest)',
          borderRadius: '2rem',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        {/* Table header bar */}
        <div
          style={{
            padding: '20px 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--surface-container)',
          }}
        >
          <h3
            style={{
              fontSize: '16px', fontWeight: 700,
              fontFamily: 'var(--font-headline)',
              color: 'var(--on-surface)',
            }}
          >
            {t('tracking.actionRegistry')}
          </h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { key: 'all', label: t('tracking.filterAll') },
              { key: 'priority', label: t('tracking.filterPriority') },
              { key: 'deadline', label: t('tracking.filterDeadline') },
            ].map(f => (
              <button
                key={f.key}
                type="button"
                style={{
                  fontSize: '11px', fontWeight: 600,
                  padding: '5px 14px',
                  borderRadius: '2rem',
                  border: 'none',
                  background: f.key === 'all' ? 'var(--wosm-purple)' : 'var(--surface-container-high)',
                  color: f.key === 'all' ? '#ffffff' : 'var(--on-surface-variant)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 110px 130px 100px 80px 90px',
            gap: '8px',
            padding: '12px 28px',
            background: 'var(--surface-container-high)',
          }}
        >
          {[
            t('planAction.tracking.colActionTache'),
            t('planAction.tracking.colStatut'),
            t('planAction.tracking.colProgression'),
            t('planAction.tracking.colEcheance'),
            t('planAction.tracking.colPreuves'),
            t('planAction.tracking.colAction'),
          ].map(h => (
            <span
              key={h}
              style={{
                fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--on-surface-variant)',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <div
              className="animate-spin"
              style={{
                width: '24px', height: '24px', borderRadius: '50%', margin: '0 auto',
                border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary)',
              }}
            />
          </div>
        ) : displayActions.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--outline)' }}>{t('planAction.aucuneAction')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayActions.map((row, i) => {
              const days = daysUntil(row.dateEcheance);
              const isOverdue = days !== null && days < 0 && row.statut !== 'termine';
              const progress = progressForAction({ statut: row.statut } as Action);
              const pill = STATUT_PILL[row.statut];
              const isRowLoading = loadingAction[row.id] ?? false;
              const dateStr = formatDate(row.dateEcheance);

              return (
                <div
                  key={row.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 110px 130px 100px 80px 90px',
                    gap: '8px',
                    padding: '14px 28px',
                    alignItems: 'center',
                    borderTop: i === 0 ? 'none' : '1px solid var(--surface-container)',
                    opacity: isRowLoading ? 0.5 : 1,
                    background: i % 2 === 1 ? 'var(--surface-container-low)' : 'transparent',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-container)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? 'var(--surface-container-low)' : 'transparent'; }}
                >
                  {/* Action / Task */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.objectif}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--outline)', marginTop: '2px' }}>
                      {row.domaineAmelioration}
                    </p>
                  </div>

                  {/* Status pill */}
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '10px', fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: '2rem',
                      background: pill.bg,
                      color: pill.color,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(`planAction.statuts.${row.statut}`).toUpperCase()}
                  </span>

                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        flex: 1, height: '6px',
                        borderRadius: '2rem',
                        background: 'var(--surface-container-highest)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          borderRadius: '2rem',
                          background: PROGRESS_COLOR[row.statut],
                          transition: 'width 400ms ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--outline)', minWidth: '28px', textAlign: 'right' }}>
                      {progress}%
                    </span>
                  </div>

                  {/* Due date with countdown */}
                  <div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: isOverdue ? 700 : 400,
                        color: isOverdue ? 'var(--error)' : 'var(--on-surface-variant)',
                      }}
                    >
                      {dateStr}
                    </span>
                    {days !== null && row.statut !== 'termine' && (
                      <span
                        style={{
                          display: 'block',
                          fontSize: '10px',
                          fontWeight: 700,
                          marginTop: '2px',
                          color: isOverdue ? 'var(--error)' : days <= 7 ? 'var(--warning)' : 'var(--outline)',
                        }}
                      >
                        {isOverdue
                          ? t('tracking.overdue')
                          : t('tracking.daysLeft', { days })}
                      </span>
                    )}
                  </div>

                  {/* Evidence */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--outline)', display: 'flex' }}><IconDoc /></span>
                    <button
                      type="button"
                      style={{
                        fontSize: '10px', fontWeight: 600,
                        color: 'var(--wosm-purple)',
                        background: 'none', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px',
                        padding: 0,
                      }}
                    >
                      <IconUpload /> {t('tracking.upload')}
                    </button>
                  </div>

                  {/* Action button */}
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => {
                        const realAction = actionsFiltrees.find(a => a.id === row.id);
                        if (realAction) {
                          setSuiviAction(realAction);
                          setNouveauStatut(realAction.statut);
                        }
                      }}
                      style={{
                        fontSize: '11px', fontWeight: 600,
                        padding: '5px 12px',
                        borderRadius: '2rem',
                        border: 'none',
                        background: 'var(--wosm-purple-container)',
                        color: 'var(--wosm-purple)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('planAction.tracking.voirSuivi')}
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--outline)', whiteSpace: 'nowrap' }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ EVIDENCE + ACTIVITY (2 cols) ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Evidence management */}
        <div
          style={{
            background: 'var(--surface-container-lowest)',
            borderRadius: '2rem',
            boxShadow: 'var(--shadow-card)',
            padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--on-surface)' }}>
              {t('tracking.evidence')}
            </h3>
            <button
              type="button"
              style={{
                fontSize: '11px', fontWeight: 600,
                color: 'var(--wosm-purple)',
                background: 'none', border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('tracking.viewAll')} &rarr;
            </button>
          </div>

          {/* Empty state — documents not yet connected to Storage */}
          <div
            style={{
              padding: '24px',
              borderRadius: '12px',
              background: 'var(--surface-container-low)',
              textAlign: 'center',
            }}
          >
            <span style={{ color: 'var(--outline)', display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><IconDoc /></span>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--on-surface-variant)' }}>
              {t('tracking.noDocuments')}
            </p>
          </div>

          {/* Drop zone */}
          <div
            style={{
              border: '2px dashed var(--outline-variant)',
              borderRadius: '16px',
              padding: '28px',
              textAlign: 'center',
              background: 'var(--surface-container-low)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px', color: 'var(--outline)' }}>
              <IconUpload />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--on-surface-variant)' }}>
              {t('tracking.dragDrop')}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--outline)', marginTop: '4px' }}>
              {t('tracking.dragDropSub')}
            </p>
          </div>
        </div>

        {/* Activity timeline */}
        <div
          style={{
            background: 'var(--surface-container-lowest)',
            borderRadius: '2rem',
            boxShadow: 'var(--shadow-card)',
            padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--on-surface)' }}>
              {t('tracking.recentActivity')}
            </h3>
            <button
              type="button"
              style={{
                fontSize: '11px', fontWeight: 600,
                color: 'var(--wosm-purple)',
                background: 'none', border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('tracking.viewFullLog')} &rarr;
            </button>
          </div>

          {plan && actionsFiltrees.length > 0 ? (
            <SuiviTimeline planId={plan.id} actionId={actionsFiltrees[0]!.id} />
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--outline)', textAlign: 'center', padding: '24px 0' }}>
              {t('planAction.tracking.aucuneActivite')}
            </p>
          )}
        </div>
      </div>

      {/* ═══ FAB -- Floating Action Button ═══ */}
      {canWrite && (
        <button
          type="button"
          onClick={() => { setEditingAction(undefined); setModalOpen(true); }}
          aria-label={t('tracking.newTask')}
          style={{
            position: 'fixed',
            bottom: '40px',
            right: '40px',
            width: '64px', height: '64px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(to bottom right, #3b6934, #3f6d38)',
            color: '#ffffff',
            boxShadow: '0 8px 28px -4px rgba(59, 105, 52, 0.45)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            fontWeight: 300,
            zIndex: 60,
            transition: 'transform 150ms ease, box-shadow 150ms ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget;
            el.style.transform = 'scale(1.10)';
            el.style.boxShadow = '0 10px 32px -4px rgba(59, 105, 52, 0.55)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget;
            el.style.transform = 'scale(1)';
            el.style.boxShadow = '0 8px 28px -4px rgba(59, 105, 52, 0.45)';
          }}
        >
          +
        </button>
      )}

      {/* ═══ SUIVI PANEL (bottom sheet) ═══ */}
      {suiviAction && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '16px',
            background: 'rgba(23,28,34,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: '2rem',
              boxShadow: 'var(--shadow-modal)',
              width: '100%', maxWidth: '520px',
              overflow: 'hidden',
            }}
            className="animate-fadeIn"
          >
            <div
              style={{
                padding: '18px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--surface-container)',
              }}
            >
              <h2 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-headline)', color: 'var(--on-surface)' }}>
                {t('planAction.ajouterSuivi')}
              </h2>
              <button
                type="button"
                onClick={() => setSuiviAction(null)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: 'none', background: 'var(--surface-container)',
                  color: 'var(--outline)', fontSize: '16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label={t('common.fermer')}
              >
                x
              </button>
            </div>

            <form onSubmit={handleSuiviSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {suiviAction.objectif}
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--outline)', marginBottom: '6px' }}>
                  {t('planAction.nouveauStatut')}
                </label>
                <select
                  value={nouveauStatut}
                  onChange={e => setNouveauStatut(e.target.value as ActionStatut)}
                  style={{
                    width: '100%', borderRadius: '12px', padding: '10px 14px',
                    fontSize: '13px', outline: 'none',
                    background: 'var(--surface-container-highest)',
                    border: '2px solid transparent', color: 'var(--on-surface)',
                    cursor: 'pointer',
                  }}
                >
                  {(['a_faire', 'en_cours', 'termine', 'bloque'] as ActionStatut[]).map(s => (
                    <option key={s} value={s}>{t(`planAction.statuts.${s}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--outline)', marginBottom: '6px' }}>
                  {t('planAction.commentaireSuivi')} *
                </label>
                <textarea
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  rows={3}
                  required
                  placeholder={t('planAction.commentaireSuiviPlaceholder')}
                  style={{
                    width: '100%', borderRadius: '12px', padding: '10px 14px',
                    fontSize: '13px', outline: 'none', resize: 'none',
                    background: 'var(--surface-container-highest)',
                    border: '2px solid transparent', color: 'var(--on-surface)',
                  }}
                />
              </div>

              {plan && (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--outline)', marginBottom: '8px' }}>
                    {t('planAction.historiquesSuivis')}
                  </p>
                  <SuiviTimeline planId={plan.id} actionId={suiviAction.id} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--surface-container)' }}>
                <button
                  type="button"
                  onClick={() => setSuiviAction(null)}
                  style={{
                    flex: 1, borderRadius: '12px', padding: '10px',
                    fontSize: '13px', fontWeight: 500, border: 'none',
                    background: 'var(--surface-container)', color: 'var(--on-surface-variant)',
                    cursor: 'pointer',
                  }}
                >
                  {t('common.annuler')}
                </button>
                <button
                  type="submit"
                  disabled={!commentaire.trim()}
                  style={{
                    flex: 1, borderRadius: '12px', padding: '10px',
                    fontSize: '13px', fontWeight: 700, border: 'none',
                    background: 'var(--gradient-wosm-cta)', color: '#ffffff',
                    cursor: 'pointer',
                    opacity: commentaire.trim() ? 1 : 0.5,
                  }}
                >
                  {t('planAction.enregistrerSuivi')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ ACTION FORM MODAL ═══ */}
      <ActionFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAction(undefined); }}
        actionExistante={editingAction}
      />
    </div>
  );
}
