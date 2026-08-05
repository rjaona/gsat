import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { IndiceDeploiementPage } from '@/pages/dashboard/IndiceDeploiementPage';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';

const store = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/stores/indiceStore', () => ({ useIndiceStore: () => store.current }));

function baseState(resultats: IndiceCritereNational[], over: Record<string, unknown> = {}) {
  return { resultats, loading: false, error: null, load: vi.fn(), reset: vi.fn(), ...over };
}
afterEach(cleanup);

describe('IndiceDeploiementPage', () => {
  it('affiche une ligne par critère national avec ID et écart', () => {
    store.current = baseState([
      { code: '401', noteNationale: 3, id: 45, ecart: 55, interpretation: 'alerte', nbEnfants: 2, nbFaritanyContributeurs: 5 },
    ]);
    render(<IndiceDeploiementPage />);
    expect(screen.getByText('401')).toBeTruthy();
    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.getByText('pages.indice.interpretation.alerte')).toBeTruthy();
  });

  it('affiche « — » quand l’écart est indéfini (note nationale N/A)', () => {
    store.current = baseState([
      { code: '706', noteNationale: null, id: 60, nbEnfants: 1, nbFaritanyContributeurs: 3 },
    ]);
    render(<IndiceDeploiementPage />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('état vide quand aucun résultat', () => {
    store.current = baseState([]);
    render(<IndiceDeploiementPage />);
    expect(screen.getByText('pages.indice.vide')).toBeTruthy();
  });
});
