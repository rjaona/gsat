/**
 * AuditLog — Journal d'audit système
 * Source Stitch : journal_d_audit_syst_me/code.html
 * Filtres avancés, table zero-line, stat cards
 */
import { useState } from 'react';

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

type ActionType = 'create' | 'update' | 'delete' | 'login' | 'export' | 'approve';

interface LogEntry {
  id: string;
  user: string;
  role: string;
  action: ActionType;
  resource: string;
  osn: string;
  ip: string;
  timestamp: string;
  status: 'success' | 'failure' | 'warning';
}

const ACTION_CONFIG: Record<ActionType, { label: string; color: string; bg: string; icon: string }> = {
  create:  { label: 'Création',      color: 'var(--secondary)',   bg: 'var(--secondary-container)', icon: 'add_circle' },
  update:  { label: 'Modification',  color: 'var(--primary)',     bg: 'var(--primary-fixed)',        icon: 'edit' },
  delete:  { label: 'Suppression',   color: 'var(--error)',       bg: 'var(--error-container)',       icon: 'delete' },
  login:   { label: 'Connexion',     color: 'var(--surface-tint)', bg: '#eef0ff',                    icon: 'login' },
  export:  { label: 'Export',        color: 'var(--warning-dark)', bg: 'var(--warning-light)',        icon: 'file_download' },
  approve: { label: 'Approbation',   color: 'var(--secondary)',   bg: 'var(--secondary-container)',  icon: 'verified' },
};

const SAMPLE_LOGS: LogEntry[] = [
  { id: '1', user: 'Alice Dupont', role: 'Admin Global', action: 'approve', resource: 'Évaluation Sénégal 2024', osn: 'Sénégal', ip: '192.168.1.12', timestamp: '2024-10-25 10:42:15', status: 'success' },
  { id: '2', user: 'Bob Martin', role: 'Responsable OSN', action: 'update', resource: 'Plan d\'action Q3', osn: 'France', ip: '10.0.0.24', timestamp: '2024-10-25 09:30:00', status: 'success' },
  { id: '3', user: 'Carla Santos', role: 'Évaluateur', action: 'create', resource: 'Soumission évaluation', osn: 'Brésil', ip: '172.16.4.8', timestamp: '2024-10-24 16:15:22', status: 'success' },
  { id: '4', user: 'David Kim', role: 'Lecteur', action: 'export', resource: 'Rapport global CSV', osn: 'Corée', ip: '10.1.2.3', timestamp: '2024-10-24 14:00:05', status: 'warning' },
  { id: '5', user: 'Système', role: 'Automatique', action: 'delete', resource: 'Session expirée #4892', osn: 'Global', ip: 'internal', timestamp: '2024-10-24 00:00:01', status: 'success' },
  { id: '6', user: 'Unknown', role: 'N/A', action: 'login', resource: 'Tentative de connexion', osn: 'N/A', ip: '185.99.2.14', timestamp: '2024-10-23 22:41:19', status: 'failure' },
];

const STATUS_CFG = {
  success: { label: 'Succès',    color: 'var(--secondary)', bg: 'var(--secondary-container)' },
  failure: { label: 'Échec',     color: 'var(--error)',     bg: 'var(--error-container)' },
  warning: { label: 'Attention', color: 'var(--warning-dark)', bg: 'var(--warning-light)' },
};

export function AuditLog() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionType | 'all'>('all');

  const filtered = SAMPLE_LOGS.filter(l => {
    const matchSearch = !search || l.user.toLowerCase().includes(search.toLowerCase()) || l.resource.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2
            className="text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
          >
            Journal d'Audit
          </h2>
          <p className="mt-2" style={{ color: 'var(--on-surface-variant)', maxWidth: 560 }}>
            Historique complet des actions institutionnelles, modifications système et transitions documentaires.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-5 py-2.5 flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{
              background: 'var(--surface-container-highest)',
              color: 'var(--on-surface)',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-variant)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-highest)'}
          >
            <Icon name="file_download" size={18} />
            Export CSV
          </button>
          <button
            className="px-5 py-2.5 flex items-center gap-2 text-sm font-bold transition-all"
            style={{
              background: 'var(--primary)',
              color: 'white',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(21,35,110,0.2)',
            }}
          >
            <Icon name="filter_alt" size={18} />
            Filtres avancés
          </button>
        </div>
      </div>

      {/* Stats bento */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Logs', value: '12,842', sub: '+12% ce mois', color: 'var(--primary)', icon: 'history' },
          { label: 'Téléversements', value: '843', sub: 'Documents traités', color: 'var(--secondary)', icon: 'upload' },
          { label: 'Utilisateurs actifs', value: '56', sub: "Contributeurs aujourd'hui", color: 'var(--surface-tint)', icon: 'group' },
          { label: 'Délai moyen', value: '4.2h', sub: 'Traitement / action', color: 'var(--warning-dark)', icon: 'schedule' },
        ].map(s => (
          <div
            key={s.label}
            className="p-6"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--shadow-card)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(198,197,210,0.1)',
            }}
          >
            <p className="label-caps mb-1">{s.label}</p>
            <p
              className="text-3xl font-extrabold"
              style={{ color: s.color, fontFamily: 'var(--font-headline)' }}
            >
              {s.value}
            </p>
            <p className="text-[10px] font-semibold mt-2 flex items-center gap-1" style={{ color: 'var(--outline)' }}>
              <Icon name={s.icon} size={12} />
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--surface-container-lowest)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid rgba(198,197,210,0.05)',
        }}
      >
        {/* Filter bar */}
        <div
          className="p-6 flex flex-wrap gap-4 items-end"
          style={{ background: 'var(--surface-container-low)', borderBottom: '1px solid rgba(198,197,210,0.1)' }}
        >
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <label className="label-caps block mb-1 px-1">Recherche</label>
            <div className="relative">
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
                placeholder="Utilisateur, ressource..."
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
          </div>
          {/* Action filter */}
          <div className="min-w-[160px]">
            <label className="label-caps block mb-1 px-1">Type d'action</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value as typeof actionFilter)}
              className="w-full px-4 py-2.5 text-sm outline-none"
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
            >
              <option value="all">Toutes</option>
              {(Object.keys(ACTION_CONFIG) as ActionType[]).map(a => (
                <option key={a} value={a}>{ACTION_CONFIG[a].label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table — zero-line design */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead style={{ background: 'var(--surface-container-low)' }}>
              <tr>
                {['Utilisateur', 'Action', 'Ressource', 'OSN', 'Adresse IP', 'Date/Heure', 'Statut'].map(h => (
                  <th key={h} className="px-6 py-4 text-left label-caps" style={{ borderBottom: '1px solid rgba(198,197,210,0.1)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const aCfg = ACTION_CONFIG[log.action];
                const sCfg = STATUS_CFG[log.status];
                return (
                  <tr
                    key={log.id}
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
                        <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{log.user}</p>
                        <p className="text-xs" style={{ color: 'var(--outline)' }}>{log.role}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold"
                        style={{ background: aCfg.bg, color: aCfg.color, borderRadius: 'var(--radius-full)' }}
                      >
                        <Icon name={aCfg.icon} size={12} />
                        {aCfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm" style={{ color: 'var(--on-surface)' }}>{log.resource}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{log.osn}</span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono" style={{ color: 'var(--outline)' }}>{log.ip}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{log.timestamp}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold"
                        style={{ background: sCfg.bg, color: sCfg.color, borderRadius: 'var(--radius-full)' }}
                      >
                        {sCfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Icon name="history_edu" size={40} />
                    <p className="mt-2 text-sm" style={{ color: 'var(--on-surface-variant)' }}>Aucun log correspondant</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
