import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrilldownFaritany } from '@/components/dashboard/pilotage/DrilldownFaritany';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, d?: string, opts?: Record<string, unknown>) => {
      let s = d ?? _k;
      if (opts) for (const [key, val] of Object.entries(opts)) s = s.split(`{{${key}}}`).join(String(val));
      return s;
    },
  }),
}));

describe('DrilldownFaritany', () => {
  it('rend null si aucune donnée', () => {
    const { container } = render(<DrilldownFaritany data={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
  it('affiche le pourquoi : codes KO et résumé chiffré de la souffrance', () => {
    render(<DrilldownFaritany onClose={() => {}} data={{
      nom: 'Analamanga',
      essentielsKO: [{ code: 'F401', libelle: 'Assurance des membres' }],
      actionsRetard: 4,
      actionsBloque: 1,
    }} />);
    expect(screen.getByText('Analamanga')).toBeInTheDocument();
    expect(screen.getByText('F401 — Assurance des membres')).toBeInTheDocument();
    expect(screen.getByText('4 en retard · 1 bloquées')).toBeInTheDocument();
  });
  it('liste les actions en souffrance et les actions nationales avec échéance', () => {
    render(<DrilldownFaritany onClose={() => {}} data={{
      nom: 'Analamanga', essentielsKO: [], actionsRetard: 1, actionsBloque: 0,
      actionsSouffrance: [{ id: 'a1', titre: 'Recenser les unités', statut: 'a_faire', dateEcheance: '2026-09-01T00:00:00Z', origine: 'regionale' }],
      actionsNationales: [{ id: 'a2', titre: 'Former le trésorier', statut: 'en_cours', dateEcheance: '2026-12-01T00:00:00Z', origine: 'nationale' }],
    }}><p>zone capture</p></DrilldownFaritany>);
    expect(screen.getByText('Recenser les unités')).toBeInTheDocument();
    expect(screen.getByText('Échéance 2026-09-01')).toBeInTheDocument();
    expect(screen.getByText('Former le trésorier')).toBeInTheDocument();
    expect(screen.getByText('zone capture')).toBeInTheDocument();
    expect(screen.queryByText(/Phase 2/)).toBeNull();
  });
});
