/**
 * CyclesEvaluationPage — Gestion des cycles d'évaluation
 * Source Stitch : gestion_des_cycles_d_valuation/code.html
 * Tableau de cycles, filtres, création modal, statut badges
 */
import { useState } from 'react';
import { Modal, Button, Badge, FormField, Input, Select, PageHeader } from '@/components/ui';

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

type CycleStatus = 'open' | 'closed' | 'draft' | 'archived';

interface EvalCycle {
  id: string;
  name: string;
  year: number;
  region: string;
  status: CycleStatus;
  osn_count: number;
  submissions: number;
  deadline: string;
  created_by: string;
}

const STATUS_BADGE: Record<CycleStatus, { variant: 'success' | 'warning' | 'default' | 'info'; label: string }> = {
  open:     { variant: 'success', label: 'Ouvert' },
  closed:   { variant: 'default', label: 'Clôturé' },
  draft:    { variant: 'warning', label: 'Brouillon' },
  archived: { variant: 'info',    label: 'Archivé' },
};

const SAMPLE_CYCLES: EvalCycle[] = [
  { id: '1', name: 'Cycle National 2024', year: 2024, region: 'Europe', status: 'open', osn_count: 46, submissions: 38, deadline: '30 Nov 2024', created_by: 'Jean Dupont' },
  { id: '2', name: 'Cycle Afrique T3', year: 2024, region: 'Afrique', status: 'open', osn_count: 41, submissions: 22, deadline: '15 Dec 2024', created_by: 'Kofi Mensah' },
  { id: '3', name: 'Cycle Annuel 2023', year: 2023, region: 'Global', status: 'closed', osn_count: 168, submissions: 155, deadline: '31 Jan 2024', created_by: 'Jean Dupont' },
  { id: '4', name: 'Pilot Asie-Pacifique', year: 2024, region: 'Asie-Pacifique', status: 'draft', osn_count: 0, submissions: 0, deadline: 'TBD', created_by: 'Sarah Lee' },
];

export function CyclesEvaluationPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CycleStatus | 'all'>('all');

  // Form state
  const [cycleName, setCycleName] = useState('');
  const [cycleYear, setCycleYear] = useState('2024');
  const [cycleRegion, setCycleRegion] = useState('Global');
  const [cycleDeadline, setCycleDeadline] = useState('');

  const filtered = SAMPLE_CYCLES.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function handleCreate() {
    // Delegate to campagneService — no change to services
    setShowCreate(false);
    setCycleName('');
  }

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      <PageHeader
        label="Gestion des cycles"
        title="Cycles d'Évaluation"
        subtitle="Planifiez et gérez les cycles d'évaluation GSAT par région et par année."
        actions={
          <Button
            onClick={() => setShowCreate(true)}
            icon={<Icon name="add_circle" size={16} />}
          >
            Nouveau cycle
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--outline)' }}
          >
            <Icon name="search" size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un cycle..."
            className="w-full pl-9 pr-4 py-2.5 text-sm outline-none"
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
        <div className="flex gap-2">
          {(['all', 'open', 'closed', 'draft', 'archived'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 text-xs font-bold transition-all"
              style={{
                background: statusFilter === s ? 'var(--primary)' : 'var(--surface-container-high)',
                color: statusFilter === s ? 'white' : 'var(--on-surface-variant)',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {s === 'all' ? 'Tous' : STATUS_BADGE[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Cycles table */}
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--surface-container-lowest)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <table className="min-w-full">
          <thead style={{ background: 'var(--surface-container-low)' }}>
            <tr>
              {['Cycle', 'Région', 'Statut', 'OSN ciblées', 'Soumissions', 'Délai', 'Actions'].map(h => (
                <th
                  key={h}
                  className="px-6 py-4 text-left label-caps"
                  style={{ borderBottom: '1px solid rgba(198,197,210,0.1)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((cycle, i) => {
              const sb = STATUS_BADGE[cycle.status];
              const completion = cycle.osn_count > 0
                ? Math.round((cycle.submissions / cycle.osn_count) * 100)
                : 0;
              return (
                <tr
                  key={cycle.id}
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(198,197,210,0.06)' : undefined,
                    transition: 'background var(--transition)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-low)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{cycle.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--outline)' }}>Par {cycle.created_by} · {cycle.year}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{cycle.region}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                      {cycle.osn_count > 0 ? cycle.osn_count : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {cycle.osn_count > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                            {cycle.submissions}/{cycle.osn_count}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--outline)' }}>{completion}%</span>
                        </div>
                        <div
                          className="h-1 w-24 overflow-hidden"
                          style={{ background: 'var(--surface-container-highest)', borderRadius: 'var(--radius-full)' }}
                        >
                          <div
                            style={{
                              width: `${completion}%`,
                              height: '100%',
                              background: completion >= 80 ? 'var(--secondary)' : completion >= 50 ? 'var(--warning)' : 'var(--error)',
                              borderRadius: 'var(--radius-full)',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--outline)' }}>—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{cycle.deadline}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs font-semibold transition-colors"
                        style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Gérer
                      </button>
                      <button
                        className="text-xs font-semibold transition-colors"
                        style={{ color: 'var(--outline)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Icon name="more_vert" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <Icon name="event_repeat" size={40} />
                  <p className="mt-2 text-sm" style={{ color: 'var(--on-surface-variant)' }}>
                    Aucun cycle trouvé
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal
          title="Créer un nouveau cycle"
          subtitle="Configurez les paramètres du cycle d'évaluation"
          onClose={() => setShowCreate(false)}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!cycleName}>Créer le cycle</Button>
            </>
          }
        >
          <div className="space-y-5">
            <FormField label="Nom du cycle" htmlFor="cycleName" required>
              <Input
                id="cycleName"
                placeholder="Ex: Cycle National 2025"
                value={cycleName}
                onChange={e => setCycleName(e.target.value)}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Année" htmlFor="cycleYear">
                <Select
                  id="cycleYear"
                  value={cycleYear}
                  onChange={e => setCycleYear(e.target.value)}
                >
                  {['2024', '2025', '2026'].map(y => <option key={y}>{y}</option>)}
                </Select>
              </FormField>
              <FormField label="Région" htmlFor="cycleRegion">
                <Select
                  id="cycleRegion"
                  value={cycleRegion}
                  onChange={e => setCycleRegion(e.target.value)}
                >
                  {['Global', 'Europe', 'Afrique', 'Asie-Pacifique', 'Amériques', 'Arabe'].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField label="Date limite de soumission" htmlFor="cycleDeadline">
              <Input
                id="cycleDeadline"
                type="date"
                value={cycleDeadline}
                onChange={e => setCycleDeadline(e.target.value)}
              />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
