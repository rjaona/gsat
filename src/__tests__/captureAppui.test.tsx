import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaptureAppui, type CaptureAppuiProps } from '@/components/dashboard/pilotage/CaptureAppui';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string, opts?: Record<string, unknown>) => {
      const s = d ?? k;
      return opts ? s.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(opts[key] ?? '')) : s;
    },
  }),
}));

function props(over: Partial<CaptureAppuiProps> = {}): CaptureAppuiProps {
  return {
    appui: null,
    referents: [{ id: 'u-osn', nom: 'Hery Rabe' }],
    essentielsKO: [{ code: 'F401', libelle: 'Assurance des membres' }],
    peutCreerAction: true,
    busy: false,
    error: null,
    onOuvrir: vi.fn(), onMettreAJour: vi.fn(), onClore: vi.fn(),
    onCreerAction: vi.fn().mockResolvedValue(true),
    ...over,
  };
}

describe('CaptureAppui', () => {
  it('sans appui : « Marquer en appui » transmet référent et note', () => {
    const p = props();
    render(<CaptureAppui {...p} />);
    fireEvent.change(screen.getByLabelText('Référent national'), { target: { value: 'u-osn' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Visite prévue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marquer en appui' }));
    expect(p.onOuvrir).toHaveBeenCalledWith({ referentUserId: 'u-osn', note: 'Visite prévue' });
  });

  it('appui ouvert : affiche la date, permet de clore', () => {
    const p = props({ appui: { id: 'ap1', orgId: 'f1', statut: 'ouvert', ouvertAt: '2026-10-04T08:00:00Z', referentUserId: 'u-osn' } });
    render(<CaptureAppui {...p} />);
    expect(screen.getByText('En appui depuis le 2026-10-04')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clore l’appui' }));
    expect(p.onClore).toHaveBeenCalled();
  });

  it('Faritany jamais évalué : message honnête, pas de formulaire', () => {
    render(<CaptureAppui {...props({ peutCreerAction: false })} />);
    expect(screen.getByText('Aucune évaluation : impossible de créer une action d’appui.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer l’action d’appui' })).toBeNull();
  });

  it('détail en chargement : ni « impossible » ni formulaire', () => {
    render(<CaptureAppui {...props({ peutCreerAction: null })} />);
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText(/impossible de créer/)).toBeNull();
  });

  it('formulaire : désactivé tant que les champs requis manquent, puis payload exact', async () => {
    const p = props();
    render(<CaptureAppui {...p} />);
    const bouton = screen.getByRole('button', { name: 'Créer l’action d’appui' });
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Objectif'), { target: { value: 'Former le trésorier' } });
    fireEvent.change(screen.getByLabelText('Domaine d’amélioration'), { target: { value: 'Finances' } });
    fireEvent.change(screen.getByLabelText('Échéance'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Critère essentiel visé'), { target: { value: 'F401' } });
    expect(bouton).not.toBeDisabled();
    fireEvent.click(bouton);
    await waitFor(() => expect(p.onCreerAction).toHaveBeenCalledWith({
      objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01',
      priorite: 'haute', responsable: '', critereCode: 'F401',
    }));
    await waitFor(() => expect(screen.getByLabelText('Objectif')).toHaveValue(''));
  });

  it('affiche l erreur de capture', () => {
    render(<CaptureAppui {...props({ error: 'Un appui est déjà ouvert pour ce Faritany.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Un appui est déjà ouvert pour ce Faritany.');
  });
});
