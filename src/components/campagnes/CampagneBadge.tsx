import { useTranslation } from 'react-i18next';
import type { CampagneStatut } from '@/types';

interface CampagneBadgeProps {
  statut: CampagneStatut;
  className?: string;
}

const STATUT_STYLES: Record<CampagneStatut, { bg: string; color: string }> = {
  planifiee: { bg: 'var(--primary-light)',  color: 'var(--primary)' },
  ouverte:   { bg: 'var(--success-light)',  color: 'var(--success)' },
  fermee:    { bg: 'var(--surface-container-high)', color: 'var(--text-secondary)' },
  archivee:  { bg: 'var(--warning-light)',  color: 'var(--warning)' },
};

export default function CampagneBadge({ statut, className = '' }: CampagneBadgeProps) {
  const { t } = useTranslation();
  const s = STATUT_STYLES[statut];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{ background: s.bg, color: s.color }}
    >
      {t(`campagne.statut.${statut}`)}
    </span>
  );
}
