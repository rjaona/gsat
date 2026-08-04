import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Activity, Award, AlertCircle, TrendingUp, Plus, BarChart2 } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { ScoreGaugeChart } from './ScoreGaugeChart';
import { DimensionRadarChart } from './DimensionRadarChart';
import { EvaluationRecenteCard } from './EvaluationRecenteCard';
import { KpiStrip, type KpiItem } from './KpiStrip';
import { AsnBarChart } from './AsnBarChart';
import { Button, Badge } from '@/components/ui';

// ── Bento card — no border, ambient shadow only ────────────────────────────────

function BentoCard({
  title,
  badge,
  badgeVariant = 'default',
  loading,
  skeletonHeight = 200,
  children,
  action,
  noPad = false,
}: {
  title?: string;
  badge?: string | undefined;
  badgeVariant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
  skeletonHeight?: number;
  children: ReactNode;
  action?: ReactNode;
  noPad?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        transition: 'box-shadow 200ms ease',
      }}
    >
      {title && (
        <div
          style={{
            padding: '18px 22px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-headline)',
                color: 'var(--text)',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h3>
            {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
          </div>
          {action}
        </div>
      )}

      <div style={noPad ? {} : { padding: '22px' }}>
        {loading ? (
          <div
            style={{
              height: skeletonHeight,
              background: 'var(--surface-container-low)',
              borderRadius: 'var(--radius-lg)',
            }}
            className="animate-pulse"
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div
      style={{
        height: '200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      <BarChart2 size={32} style={{ color: 'var(--border)' }} />
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{message}</p>
    </div>
  );
}

function EmptyDashboard({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-2xl)',
        padding: '60px 40px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          background: 'var(--primary-light)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}
      >
        <Activity size={32} style={{ color: 'var(--primary)' }} />
      </div>
      <h2
        style={{
          fontSize: '20px',
          fontWeight: 700,
          fontFamily: 'var(--font-headline)',
          color: 'var(--text)',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
        }}
      >
        Aucune donnée d'évaluation
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          maxWidth: '360px',
          margin: '0 auto 32px',
          lineHeight: 1.6,
        }}
      >
        Commencez votre première évaluation GSAT V3.0 pour voir vos métriques
        de performance organisationnelle.
      </p>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '32px',
          flexWrap: 'wrap',
        }}
      >
        {["Créer une campagne", "Lancer l'évaluation", 'Suivre les résultats'].map(
          (step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface-container-low)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              {step}
            </div>
          )
        )}
      </div>
      <Button size="lg" icon={<Plus size={16} />} onClick={onStart}>
        Démarrer une évaluation
      </Button>
    </div>
  );
}

function EmptyEvaluations({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
      <div
        style={{
          width: '48px',
          height: '48px',
          background: 'var(--primary-light)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Award size={22} style={{ color: 'var(--primary)' }} />
      </div>
      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
        Aucune évaluation récente
      </p>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Les évaluations apparaîtront ici une fois lancées.
      </p>
      <Button variant="secondary" size="sm" onClick={onStart}>
        Démarrer une évaluation
      </Button>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, role, orgId: storeOrgId, orgType } = useAuthStore();

  const {
    stats,
    evaluationsRecentes,
    loading,
    loadingEvals,
    error,
    subscriberStats,
    chargerEvaluationsRecentes,
    chargerEvaluationsRecentesGlobal,
  } = useDashboardStore();

  const isAdminGlobal = role === 'admin_global';
  const orgId = storeOrgId ?? '';

  useEffect(() => {
    if (!orgId && !isAdminGlobal) return;
    const targetOrgId = isAdminGlobal ? 'global' : orgId;
    const unsubscribe = subscriberStats(targetOrgId);
    if (isAdminGlobal) {
      chargerEvaluationsRecentesGlobal(8);
    } else {
      chargerEvaluationsRecentes(orgId, 5);
    }
    return unsubscribe;
  }, [orgId, isAdminGlobal, subscriberStats, chargerEvaluationsRecentes, chargerEvaluationsRecentesGlobal]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  })();

  const trendScore =
    stats?.scoreGlobal != null ? { value: +8, label: 'vs cycle précédent' } : undefined;
  const trendKO =
    (stats?.criteresEssentielsKO?.length ?? 0) === 0
      ? { value: 0, label: 'aucun blocage' }
      : { value: stats?.criteresEssentielsKO?.length ?? 0, label: 'à corriger' };
  const trendCompletion =
    stats?.tauxCompletionEval != null
      ? { value: stats.tauxCompletionEval - 80, label: 'vs objectif 80%' }
      : undefined;

  type KpiVariant = 'default' | 'success' | 'warning' | 'danger';

  const scoreMoyenVariant: KpiVariant =
    stats?.scoreGlobal == null ? 'default'
    : stats.scoreGlobal >= 75 ? 'success'
    : stats.scoreGlobal >= 50 ? 'warning'
    : 'danger';

  const criteresKOVariant: KpiVariant =
    (stats?.criteresEssentielsKO?.length ?? 0) === 0 ? 'success' : 'danger';

  const kpis: KpiItem[] = [
    {
      label: t('dashboard.kpi.nbEvaluations'),
      value: evaluationsRecentes.length,
      variant: 'default',
      trend:
        evaluationsRecentes.length > 0
          ? { value: evaluationsRecentes.length, label: 'en cours ou récentes' }
          : undefined,
      icon: <Activity size={16} />,
    },
    {
      label: t('dashboard.kpi.scoreMoyen'),
      value: stats?.scoreGlobal != null ? `${stats.scoreGlobal}%` : '—',
      variant: scoreMoyenVariant,
      trend: trendScore,
      icon: <TrendingUp size={16} />,
    },
    {
      label: t('dashboard.kpi.criteresKO'),
      value: stats?.criteresEssentielsKO?.length ?? 0,
      variant: criteresKOVariant,
      trend: trendKO,
      icon: <AlertCircle size={16} />,
    },
    {
      label: t('dashboard.kpi.tauxCompletion'),
      value: stats?.tauxCompletionEval != null ? `${stats.tauxCompletionEval}%` : '—',
      variant: 'default',
      trend: trendCompletion,
      subLabel:
        isAdminGlobal || orgType === 'OSN'
          ? t('dashboard.kpi.tauxCompletionSubLabel')
          : undefined,
      icon: <Award size={16} />,
    },
  ];

  if (error) {
    return (
      <div className="p-6">
        <div
          className="rounded-lg p-4 text-sm"
          style={{
            background: 'var(--danger-light)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
          }}
          role="alert"
        >
          {t('common.erreurChargement')} : {error}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ padding: '28px', maxWidth: '1280px', margin: '0 auto' }}
      className="animate-fadeIn"
    >
      {/* ── HEADER ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: '4px',
            }}
          >
            {greeting},{' '}
            <span style={{ color: 'var(--primary)', textTransform: 'none', letterSpacing: 'normal', fontSize: '13px' }}>
              {profile?.prenom ?? '—'}
            </span>
          </p>
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
            {isAdminGlobal ? "Vue d'ensemble globale" : 'Tableau de bord'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xs)',
              padding: '7px 14px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          {!loading && !stats && (
            <Button icon={<Plus size={14} />} onClick={() => navigate('/evaluation')}>
              Nouvelle évaluation
            </Button>
          )}
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {!loading && !stats && evaluationsRecentes.length === 0 && (
        <EmptyDashboard onStart={() => navigate('/evaluation')} />
      )}

      {/* ── CONTENU si données ── */}
      {(loading || stats) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Row 1: KPI Strip (4 cols) */}
          <KpiStrip kpis={kpis} loading={loading} />

          {/* Row 2: Score hero + Dimensions (bento 2-col) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.8fr)',
              gap: '20px',
              alignItems: 'start',
            }}
            className="lg:grid-cols-2"
          >
            {/* Score hero */}
            <BentoCard
              title="Score Global GSAT"
              badge="V3.0"
              badgeVariant="primary"
              loading={loading}
              skeletonHeight={280}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <ScoreGaugeChart score={stats?.scoreGlobal ?? 0} size={200} />

                {/* KO alert */}
                {stats?.criteresEssentielsKO && stats.criteresEssentielsKO.length > 0 && (
                  <div
                    style={{
                      background: 'var(--danger-light)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px 16px',
                      width: '100%',
                    }}
                  >
                    <p
                      style={{
                        color: 'var(--danger)',
                        fontSize: '12px',
                        fontWeight: 700,
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <AlertCircle size={13} />
                      {stats.criteresEssentielsKO.length} critère(s) essentiel(s) KO
                    </p>
                    <p style={{ color: 'var(--danger)', fontSize: '11px', opacity: 0.8, lineHeight: 1.4 }}>
                      {stats.criteresEssentielsKO.join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            </BentoCard>

            {/* Dimensions grid */}
            <BentoCard
              title="Performance par Dimension"
              badge={stats?.scoreParDimension ? `${Object.keys(stats.scoreParDimension).length} dim.` : undefined}
              badgeVariant="info"
              loading={loading}
              skeletonHeight={280}
            >
              {stats?.scoreParDimension ? (
                <DimensionRadarChart scoreParDimension={stats.scoreParDimension} />
              ) : (
                <EmptyChart message="Aucune donnée de dimension disponible" />
              )}
            </BentoCard>
          </div>

          {/* Row 3: Comparaison ASN (si dispo) */}
          {(loading || stats?.scoresAsn) && (
            <BentoCard
              title="Comparaison des scores ASN"
              badge={
                stats?.scoresAsn
                  ? `${Object.keys(stats.scoresAsn).length} ASN`
                  : undefined
              }
              loading={loading}
              skeletonHeight={200}
            >
              {stats?.scoresAsn ? (
                <AsnBarChart scoresAsn={stats.scoresAsn} height={200} />
              ) : (
                <EmptyChart message="Aucune donnée ASN disponible" />
              )}
            </BentoCard>
          )}

          {/* Row 4: Évaluations récentes */}
          <BentoCard
            title={t('dashboard.evaluationsRecentes')}
            badge={
              evaluationsRecentes.length > 0
                ? String(evaluationsRecentes.length)
                : undefined
            }
            loading={loadingEvals}
            skeletonHeight={120}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate('/evaluation')}>
                Voir tout →
              </Button>
            }
          >
            {evaluationsRecentes.length === 0 ? (
              <EmptyEvaluations onStart={() => navigate('/evaluation')} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {evaluationsRecentes.map(ev => (
                  <EvaluationRecenteCard key={ev.id} evaluation={ev} />
                ))}
              </div>
            )}
          </BentoCard>

        </div>
      )}
    </div>
  );
}
