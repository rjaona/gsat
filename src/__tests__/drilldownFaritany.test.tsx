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
});
