import { useTranslation } from 'react-i18next'
import { colors, elevation, borderRadius } from '@/design/tokens'
import type { EvaluationStatut } from '@/types'

// ── Step definition ─────────────────────────────────────────────────────────

interface Step {
  statut: EvaluationStatut
  icon: string
}

const STEPS: Step[] = [
  { statut: 'brouillon', icon: 'edit_note' },
  { statut: 'en_cours',  icon: 'pending' },
  { statut: 'soumise',   icon: 'send' },
  { statut: 'validee',   icon: 'verified' },
  { statut: 'cloturee',  icon: 'lock' },
]

const STATUT_ORDER: Record<EvaluationStatut, number> = {
  brouillon: 0,
  en_cours: 1,
  soumise: 2,
  validee: 3,
  cloturee: 4,
}

// ── Component ────────────────────────────────────────────────────────────────

interface WorkflowStatusStepperProps {
  currentStatut: EvaluationStatut
}

export function WorkflowStatusStepper({ currentStatut }: WorkflowStatusStepperProps) {
  const { t } = useTranslation()
  const currentIdx = STATUT_ORDER[currentStatut]

  return (
    <div className="flex items-center w-full gap-0">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isUpcoming = idx > currentIdx

        return (
          <div key={step.statut} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: isCompleted
                    ? colors.secondary
                    : isCurrent
                      ? colors.primary
                      : colors.surfaceContainerHighest,
                  boxShadow: isCurrent ? elevation.md : 'none',
                }}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: isCompleted || isCurrent
                      ? colors.onPrimary
                      : colors.outline,
                    fontVariationSettings: isCompleted
                      ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                      : undefined,
                  }}
                >
                  {isCompleted ? 'check_circle' : step.icon}
                </span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap"
                style={{
                  color: isCompleted
                    ? colors.secondary
                    : isCurrent
                      ? colors.primary
                      : colors.outline,
                }}
              >
                {t(`evaluation.statuts.${step.statut}`)}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-2"
                style={{
                  background: idx < currentIdx
                    ? colors.secondary
                    : colors.surfaceContainerHighest,
                  borderRadius: borderRadius.full,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
