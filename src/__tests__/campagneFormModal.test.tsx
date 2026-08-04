/**
 * Tests RTL — CampagneFormModal (le composant QUI EST P2).
 * Encode le « fait quand » P2 : choisir far_v1_0 → mode socle → cocher la
 * province ANT → soumettre ⇒ creerCampagne({mode:'socle', perimetre: 9 ids}).
 * Garde aussi le bug de défaut (ne jamais défaut sur un référentiel inactif).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { Organisation } from '@/types';
import CampagneFormModal from '@/components/campagnes/CampagneFormModal';

const { creerCampagne, modifierCampagne, listReferentiels, listOrganisations } = vi.hoisted(() => ({
  creerCampagne: vi.fn(),
  modifierCampagne: vi.fn(),
  listReferentiels: vi.fn(),
  listOrganisations: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) => (o?.count !== undefined ? `${k}:${o.count}` : k),
  }),
}));
vi.mock('@/hooks/useCampagne', () => ({
  useCampagneActions: () => ({ creerCampagne, modifierCampagne, loading: false, error: null }),
}));
vi.mock('@/services/referentielService', () => ({ listReferentiels }));
vi.mock('@/services/organisationService', () => ({ listOrganisations }));
vi.mock('@/components/ui', () => ({
  // Passe-plat : préserve type/form pour que la soumission fonctionne ; `loading`
  // n'est pas un attribut DOM → on le retire.
  Button: ({ children, loading: _l, ...p }: React.ComponentProps<'button'> & { loading?: boolean }) =>
    <button {...p}>{children}</button>,
}));

function asn(prefixe: string, n: number): Organisation[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefixe}-${i + 1}`,
    type: 'ASN' as const,
    nom: `${prefixe} Faritany ${i + 1}`,
    code: `${prefixe}-${String(i + 1).padStart(2, '0')}`,
    actif: true,
    poids: 1,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listReferentiels.mockResolvedValue([
    { version: 'v3_0', nom: 'GSAT v3.0', niveau: 'OSN', actif: true },
    { version: 'far_v1_0', nom: 'GSAT-Faritany', niveau: 'ASN', actif: true },
  ]);
  listOrganisations.mockResolvedValue([...asn('ANT', 9), ...asn('TOA', 2)]);
  creerCampagne.mockResolvedValue('new-id');
});
afterEach(cleanup);

describe('CampagneFormModal — fait quand P2', () => {
  it('far_v1_0 + socle + province ANT ⇒ creerCampagne({mode:socle, 9 périmètres})', async () => {
    const { container } = render(<CampagneFormModal onClose={vi.fn()} />);
    await screen.findByRole('option', { name: /GSAT-Faritany/ });
    await screen.findByText('Antananarivo'); // ASN chargées

    fireEvent.change(container.querySelector('#campagne-nom')!, { target: { value: 'Cycle Socle ANT' } });
    fireEvent.change(container.querySelector('#campagne-date-ouverture')!, { target: { value: '2026-09-01' } });
    fireEvent.change(container.querySelector('#campagne-date-fermeture')!, { target: { value: '2026-10-01' } });
    fireEvent.change(container.querySelector('#campagne-referentiel')!, { target: { value: 'far_v1_0' } });

    // Le mode n'apparaît que pour un référentiel ASN.
    fireEvent.click(await screen.findByText('campagne.form.modeSocle'));

    // Case « select-all » de la province Antananarivo.
    const antCheckbox = screen.getByText('Antananarivo').querySelector('input[type=checkbox]')!;
    fireEvent.click(antCheckbox);

    fireEvent.submit(container.querySelector('#campagne-form')!);

    await waitFor(() => expect(creerCampagne).toHaveBeenCalledTimes(1));
    const payload = creerCampagne.mock.calls[0]![0];
    expect(payload.referentielVersion).toBe('far_v1_0');
    expect(payload.mode).toBe('socle');
    expect(payload.perimetre).toHaveLength(9);
    expect(payload.perimetre.every((id: string) => id.startsWith('ANT-'))).toBe(true);
  });

  it('référentiel OSN (national) ⇒ pas de sélecteur de mode, mode forcé complet', async () => {
    const { container } = render(<CampagneFormModal onClose={vi.fn()} />);
    await screen.findByRole('option', { name: /GSAT v3.0/ });

    // Défaut = v3_0 (OSN), donc pas de mode.
    expect(screen.queryByText('campagne.form.mode')).toBeNull();

    fireEvent.change(container.querySelector('#campagne-nom')!, { target: { value: 'Cycle national' } });
    fireEvent.change(container.querySelector('#campagne-date-ouverture')!, { target: { value: '2026-09-01' } });
    fireEvent.change(container.querySelector('#campagne-date-fermeture')!, { target: { value: '2026-10-01' } });
    fireEvent.submit(container.querySelector('#campagne-form')!);

    await waitFor(() => expect(creerCampagne).toHaveBeenCalledTimes(1));
    expect(creerCampagne.mock.calls[0]![0].mode).toBe('complet');
  });

  it('rechargement : une campagne socle réaffiche le mode socle actif', async () => {
    render(
      <CampagneFormModal
        onClose={vi.fn()}
        campagne={{
          id: 'c1', organisateurId: 'u', referentielVersion: 'far_v1_0', nom: 'X',
          dateOuverture: '2026-09-01T00:00:00.000Z', dateFermeture: '2026-10-01T00:00:00.000Z',
          statut: 'planifiee', mode: 'socle', perimetre: [], createdBy: 'u', createdAt: '2026-09-01T00:00:00.000Z',
        }}
      />
    );
    const socleBtn = await screen.findByText('campagne.form.modeSocle');
    expect(socleBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('ne prend JAMAIS un référentiel inactif comme défaut (bug garde-fou)', async () => {
    // Ordre alphabétique : far_v1_0 (inactif) avant v3_0 (actif).
    listReferentiels.mockResolvedValue([
      { version: 'far_v1_0', nom: 'GSAT-Faritany', niveau: 'ASN', actif: false },
      { version: 'v3_0', nom: 'GSAT v3.0', niveau: 'OSN', actif: true },
    ]);
    const { container } = render(<CampagneFormModal onClose={vi.fn()} />);
    await screen.findByRole('option', { name: /GSAT v3.0/ });
    // Défaut = v3_0 (le seul actif), pas far_v1_0 malgré l'ordre alphabétique.
    expect((container.querySelector('#campagne-referentiel') as HTMLSelectElement).value).toBe('v3_0');
  });
});
