/**
 * WorkflowStepper — Horizontal progress bar with 5 workflow steps.
 *
 * Reusable for campaign workflow and evaluation workflow.
 * Shows completed steps with check, active step with animated ring,
 * and future steps dimmed.
 */
import { useTranslation } from 'react-i18next';
import type { WorkflowStep, WorkflowStepDef } from '@/types/workflow';

// ── Step definitions ─────────────────────────────────────────────────────────

const STEP_ICONS: Record<WorkflowStep, string> = {
  initiation:   'play_circle',
  evaluation:   'assignment',
  review:       'rate_review',
  approbation:  'verified_user',
  finalisation: 'check_circle',
};

const STEP_ORDER: WorkflowStep[] = [
  'initiation',
  'evaluation',
  'review',
  'approbation',
  'finalisation',
];

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

// ── Props ────────────────────────────────────────────────────────────────────

export interface WorkflowStepperProps {
  currentStep: WorkflowStep;
  steps?: WorkflowStepDef[] | undefined;
  onStepClick?: ((step: WorkflowStep) => void) | undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowStepper({ currentStep, steps, onStepClick }: WorkflowStepperProps) {
  const { t } = useTranslation();

  const activeIndex = STEP_ORDER.indexOf(currentStep);

  const resolvedSteps = steps ?? STEP_ORDER.map(s => ({
    step: s,
    label: t(`workflow.steps.${s}`),
    icon: STEP_ICONS[s],
  }));

  return (
    <section
      className="p-8"
      style={{
        background: 'var(--surface-container-lowest)',
        boxShadow: 'var(--shadow-card)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <div className="flex justify-between items-center mb-10">
        <h3
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          {t('workflow.progressionFlux')}
        </h3>
        <span
          className="px-3 py-1 text-[10px] font-bold uppercase"
          style={{
            background: 'var(--secondary-container)',
            color: 'var(--on-secondary-container)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {t('workflow.etapeActive')} : {t(`workflow.steps.${currentStep}`)}
        </span>
      </div>

      {/* Steps bar */}
      <div className="relative flex justify-between">
        {/* Background track */}
        <div
          className="absolute top-5 left-0 w-full h-0.5"
          style={{ background: 'var(--surface-container-highest)', zIndex: 0 }}
        />
        {/* Progress fill */}
        <div
          className="absolute top-5 left-0 h-0.5 transition-all duration-500"
          style={{
            width: `${(activeIndex / (resolvedSteps.length - 1)) * 100}%`,
            background: 'var(--secondary)',
            zIndex: 0,
          }}
        />

        {resolvedSteps.map((stepDef, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          const future = i > activeIndex;

          return (
            <button
              key={stepDef.step}
              onClick={() => onStepClick?.(stepDef.step)}
              className="relative z-10 flex flex-col items-center"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: onStepClick ? 'pointer' : 'default',
                opacity: future ? 0.5 : 1,
              }}
              title={stepDef.label}
              type="button"
            >
              <div
                className="w-10 h-10 flex items-center justify-center transition-all"
                style={{
                  background: done || current
                    ? 'var(--secondary)'
                    : 'var(--surface-container-highest)',
                  color: done || current ? 'white' : 'var(--outline)',
                  borderRadius: '50%',
                  boxShadow: current
                    ? '0 0 0 4px rgba(59,105,52,0.2)'
                    : 'none',
                  animation: current ? 'workflow-pulse 2s ease-in-out infinite' : 'none',
                }}
              >
                {done ? (
                  <MIcon name="check" size={18} fill={1} />
                ) : (
                  <MIcon name={stepDef.icon} size={18} />
                )}
              </div>
              <span
                className="mt-3 text-[11px] font-bold uppercase tracking-tight"
                style={{
                  color: done || current
                    ? 'var(--on-surface)'
                    : 'var(--outline)',
                }}
              >
                {stepDef.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes workflow-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(59,105,52,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(59,105,52,0.08); }
        }
      `}</style>
    </section>
  );
}
