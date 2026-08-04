import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EvaluationForm } from './EvaluationForm';

/**
 * Page wrapper pour la route /evaluation/:evalId.
 * Extrait le paramètre d'URL et le transmet à EvaluationForm.
 */
export function EvaluationPage() {
  const { t } = useTranslation();
  const { evalId } = useParams<{ evalId: string }>();

  if (!evalId) {
    return (
      <div className="p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('evaluation.titre')} — identifiant manquant
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <EvaluationForm evalId={evalId} />
    </div>
  );
}
