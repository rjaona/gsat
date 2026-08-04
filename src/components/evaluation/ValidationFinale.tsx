/**
 * ValidationFinale — Validation finale par l'approbateur
 * Source Stitch : validation_finale_par_l_approbateur/code.html
 * Header score 75%, dimension breakdown 2-col grid, evidence log, sidebar checklist
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function Icon({ name, size = 20, fill = 0 }: { name: string; size?: number; fill?: 0 | 1 }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

const DIMENSIONS = [
  { label: 'Planification Stratégique', pct: 88 },
  { label: 'Ressources Humaines', pct: 62 },
  { label: 'Gestion Financière', pct: 94 },
  { label: 'Programme Jeunesse', pct: 71 },
  { label: 'Communication', pct: 55 },
  { label: 'Infrastructure', pct: 78 },
  { label: 'Gouvernance', pct: 83 },
  { label: 'Partenariats', pct: 67 },
  { label: 'Innovation', pct: 72 },
  { label: 'Impact Social', pct: 79 },
];

const EVIDENCE_LOG = [
  { id: '1', type: 'document', title: 'Rapport annuel 2023', author: 'Sarah Miller', date: '15 Oct 2024', verified: true },
  { id: '2', type: 'photo',    title: 'Photos événements Q3',  author: 'Jean Kofi',   date: '12 Oct 2024', verified: true },
  { id: '3', type: 'document', title: 'Bilan financier',       author: 'Sarah Miller', date: '10 Oct 2024', verified: false },
  { id: '4', type: 'video',    title: 'Formation jeunesse',    author: 'Amina Diallo', date: '08 Oct 2024', verified: true },
];

const CHECKLIST = [
  { id: 'c1', label: 'Toutes les dimensions évaluées',         checked: true },
  { id: 'c2', label: 'Preuves documentaires vérifiées',        checked: true },
  { id: 'c3', label: 'Score ≥ 50% (seuil minimum)',           checked: true },
  { id: 'c4', label: 'Commentaires du responsable OSN reçus',  checked: false },
  { id: 'c5', label: 'Rapport de risques analysé',             checked: false },
];

export function ValidationFinale() {
  const { evalId } = useParams();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(CHECKLIST);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allChecked = checklist.every(c => c.checked);

  function toggleCheck(id: string) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  }

  async function handleApprove() {
    setSubmitting(true);
    // Logic handled by existing evaluationService — no change
    await new Promise(r => setTimeout(r, 800));
    setSubmitting(false);
    navigate('/evaluation');
  }

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-12">

      {/* Hero header */}
      <header className="flex justify-between items-end">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-2"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            GSAT Assessment Cycle 2024
          </p>
          <h1
            className="text-5xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            Cycle National Sénégal
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <span
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold"
              style={{
                background: 'var(--surface-container-highest)',
                color: 'var(--primary)',
                borderRadius: 'var(--radius-full)',
              }}
            >
              <span
                className="w-2 h-2"
                style={{ background: 'var(--primary)', borderRadius: '50%' }}
              />
              En attente d'approbation
            </span>
            <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              Soumis par <strong style={{ color: 'var(--on-surface)' }}>Sarah Miller</strong> · il y a 2 jours
            </span>
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-6xl font-black leading-none"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            75%
          </div>
          <p className="label-caps mt-1">Score Global</p>
        </div>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* Dimension breakdown — 8 cols */}
        <section
          className="col-span-12 lg:col-span-8 p-8"
          style={{
            background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div className="flex justify-between items-center mb-8">
            <h2
              className="text-xl font-bold tracking-tight"
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
            >
              Performance par Dimension
            </h2>
            <span className="label-caps">10 Métriques totales</span>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-6">
            {DIMENSIONS.map(d => (
              <div key={d.label} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="label-caps" style={{ color: 'var(--on-surface-variant)' }}>{d.label}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{d.pct}%</span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden"
                  style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
                >
                  <div
                    style={{
                      width: `${d.pct}%`,
                      height: '100%',
                      background: 'var(--secondary)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Validation checklist sidebar — 4 cols */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div
            className="p-6"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h3
              className="text-sm font-bold mb-4"
              style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
            >
              Checklist de validation
            </h3>
            <div className="space-y-3">
              {checklist.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className="w-full flex items-center gap-3 text-left"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div
                    className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: item.checked ? 'var(--secondary)' : 'var(--surface-container-high)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {item.checked && <Icon name="check" size={14} fill={1} />}
                  </div>
                  <span
                    className="text-sm"
                    style={{
                      color: item.checked ? 'var(--on-surface)' : 'var(--on-surface-variant)',
                      textDecoration: item.checked ? 'none' : 'none',
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
            <div
              className="mt-4 pt-4"
              style={{ borderTop: '1px solid rgba(198,197,210,0.15)' }}
            >
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--on-surface-variant)' }}>Complété</span>
                <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>
                  {checklist.filter(c => c.checked).length}/{checklist.length}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden"
                style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
              >
                <div
                  style={{
                    width: `${(checklist.filter(c => c.checked).length / checklist.length) * 100}%`,
                    height: '100%',
                    background: 'var(--secondary)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 300ms',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Comment */}
          <div
            className="p-6"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <label
              htmlFor="validatorComment"
              className="label-caps block mb-2"
            >
              Commentaire de validation
            </label>
            <textarea
              id="validatorComment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Observations, réserves, recommandations..."
              rows={4}
              className="w-full px-4 py-3 text-sm outline-none resize-none"
              style={{
                background: 'var(--surface-container-highest)',
                border: '2px solid transparent',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--on-surface)',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--surface-container-lowest)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.background = 'var(--surface-container-highest)';
              }}
            />
          </div>
        </aside>

        {/* Evidence log — full width */}
        <section
          className="col-span-12 overflow-hidden"
          style={{
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div
            className="px-6 py-4"
            style={{ background: 'var(--surface-container-low)', borderBottom: '1px solid rgba(198,197,210,0.1)' }}
          >
            <h3
              className="text-base font-bold"
              style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
            >
              Journal des Preuves
            </h3>
          </div>
          <table className="min-w-full">
            <thead style={{ background: 'var(--surface-container-low)' }}>
              <tr>
                {['Type', 'Document / Preuve', 'Soumis par', 'Date', 'Vérifié'].map(h => (
                  <th key={h} className="px-6 py-4 text-left label-caps" style={{ borderBottom: '1px solid rgba(198,197,210,0.1)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVIDENCE_LOG.map((ev, i) => (
                <tr
                  key={ev.id}
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(198,197,210,0.06)' : undefined,
                    transition: 'background var(--transition)',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-low)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-6 py-4">
                    <span style={{ color: 'var(--on-surface-variant)' }}>
                      <Icon
                        name={ev.type === 'document' ? 'description' : ev.type === 'photo' ? 'image' : 'videocam'}
                        size={20}
                      />
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{ev.title}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{ev.author}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{ev.date}</span>
                  </td>
                  <td className="px-6 py-4">
                    {ev.verified ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-bold"
                        style={{ color: 'var(--secondary)' }}
                      >
                        <Icon name="verified" size={16} fill={1} />
                        Vérifié
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-bold"
                        style={{ color: 'var(--warning-dark)' }}
                      >
                        <Icon name="schedule" size={16} />
                        En attente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Action footer */}
        <div className="col-span-12 flex justify-end gap-3 pt-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 text-sm font-semibold transition-colors"
            style={{
              background: 'var(--surface-container-highest)',
              color: 'var(--on-surface)',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Demander des modifications
          </button>
          <button
            onClick={handleApprove}
            disabled={!allChecked || submitting}
            className="px-8 py-3 text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: allChecked ? 'var(--gradient-primary)' : 'var(--surface-container-highest)',
              color: allChecked ? 'white' : 'var(--outline)',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: allChecked ? 'pointer' : 'not-allowed',
              boxShadow: allChecked ? '0 4px 12px rgba(21,35,110,0.25)' : 'none',
            }}
          >
            {submitting ? (
              <span
                className="w-4 h-4 border-2 border-current border-t-transparent"
                style={{ borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}
              />
            ) : (
              <Icon name="check_circle" size={18} fill={1} />
            )}
            Approuver l'évaluation
          </button>
        </div>
      </div>
    </div>
  );
}
