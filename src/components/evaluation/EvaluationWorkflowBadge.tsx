import { useTranslation } from 'react-i18next';
import type { EvaluationStatut } from '@/types';

interface EvaluationWorkflowBadgeProps {
  statut: EvaluationStatut;
  size?: 'sm' | 'md';
}

const STATUT_CLASSES: Record<EvaluationStatut, string> = {
  brouillon: 'bg-surface-container-high text-on-surface-variant',
  en_cours:  'bg-primary/10 text-primary',
  soumise:   'bg-tertiary-container text-on-tertiary-container',
  validee:   'bg-secondary-container text-on-secondary-container',
  cloturee:  'bg-surface-container-highest text-on-surface',
};

const DOT_CLASSES: Record<EvaluationStatut, string> = {
  brouillon: 'bg-outline',
  en_cours:  'bg-primary',
  soumise:   'bg-tertiary',
  validee:   'bg-secondary',
  cloturee:  'bg-outline-variant',
};

export function EvaluationWorkflowBadge({
  statut,
  size = 'md',
}: EvaluationWorkflowBadgeProps) {
  const { t } = useTranslation();

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${sizeClasses} ${STATUT_CLASSES[statut]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${DOT_CLASSES[statut]}`}
        aria-hidden="true"
      />
      {t(`evaluation.statuts.${statut}`)}
    </span>
  );
}
