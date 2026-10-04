import { useTranslation } from 'react-i18next';
import type { Bucket2x2 } from '@/utils/pilotage';

const CASES: { cle: keyof Bucket2x2; labelKey: string; defaut: string; urgent?: boolean }[] = [
  { cle: 'appuiUrgent', labelKey: 'pages.pilotageNational.cases.appuiUrgent', defaut: 'Appui urgent', urgent: true },
  { cle: 'conformite',  labelKey: 'pages.pilotageNational.cases.conformite',  defaut: 'Conformité à traiter' },
  { cle: 'execution',   labelKey: 'pages.pilotageNational.cases.execution',   defaut: 'Exécution en souffrance' },
  { cle: 'sain',        labelKey: 'pages.pilotageNational.cases.sain',        defaut: 'Sous contrôle' },
];

export function Grille2x2({ buckets, onSelectCase }: { buckets: Bucket2x2; onSelectCase?: (cle: keyof Bucket2x2) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      {CASES.map(c => (
        <button
          key={c.cle}
          type="button"
          data-testid={`case-${c.cle}`}
          onClick={() => onSelectCase?.(c.cle)}
          className={[
            'text-left rounded-xl p-4 transition-all border',
            c.urgent ? 'bg-[#ffdad6] border-[#ba1a1a]/30' : 'bg-[#f8f9ff] border-transparent',
            'hover:shadow-sm',
          ].join(' ')}
        >
          <p className="text-3xl font-extrabold tabular-nums text-[#15236e]">{buckets[c.cle]}</p>
          <p className={`text-xs font-semibold mt-1 ${c.urgent ? 'text-[#ba1a1a]' : 'text-[#454651]'}`}>
            {t(c.labelKey, c.defaut)}
          </p>
        </button>
      ))}
    </div>
  );
}
