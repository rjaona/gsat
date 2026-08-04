/**
 * Tests RTL — DimensionSection (P3 parties 1 & 3).
 * Garde les deux comportements les plus facilement réversibles :
 *  - un N/A (ligne présente, note null) COMPTE dans l'avancement de la dimension ;
 *  - en mode socle, un critère d'extension va dans la section repliée, pas la liste.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DimensionSection } from '@/components/evaluation/DimensionSection';
import type { DimensionDef, Score } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'fr' } }),
}));
// Stub CritereItem : on ne teste ici que le placement, pas le rendu du critère.
vi.mock('@/components/evaluation/CritereItem', () => ({
  CritereItem: ({ critere }: { critere: { code: string } }) => (
    <div data-testid={`crit-${critere.code}`}>{critere.code}</div>
  ),
}));

function crit(code: string, socle: boolean) {
  return {
    code, libelle: { fr: code, en: code }, essentiel: false, actif: true,
    ordre: Number(code.slice(1)), sourceCodes: [], socle, indicateurErp: [],
  };
}

const dimension: DimensionDef = {
  code: 'D01', nom: { fr: 'Dim 1', en: 'Dim 1' }, ordre: 1,
  criteres: [crit('F101', true), crit('F102', true), crit('F103', true), crit('F104', false), crit('F105', false)],
};

// F101 est N/A : ligne présente, note null.
const scores: Record<string, Score> = {
  F101: { critereCode: 'F101', note: null, updatedBy: 'u', updatedAt: '2026-09-01' },
};

function renderSocle() {
  return render(
    <DimensionSection
      dimension={dimension}
      scores={scores}
      criteresKO={[]}
      scoreDim={50}
      onScoreChange={vi.fn()}
      onUploadPreuve={vi.fn()}
      uploadProgress={{}}
      defaultOpen
      mode="socle"
    />
  );
}

afterEach(cleanup);

describe('DimensionSection — mode socle', () => {
  it('un N/A compte dans l’avancement (1/3, pas 0/3)', () => {
    renderSocle();
    // principales = 3 socle ; F101 est N/A mais présent ⇒ compté.
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('les critères d’extension ne sont PAS dans la liste principale', () => {
    renderSocle();
    expect(screen.getByTestId('crit-F101')).toBeTruthy();
    expect(screen.queryByTestId('crit-F104')).toBeNull();
    expect(screen.queryByTestId('crit-F105')).toBeNull();
  });

  it('la section repliée « Pour aller plus loin » révèle les extensions', () => {
    renderSocle();
    fireEvent.click(screen.getByText('evaluation.sectionExtension'));
    expect(screen.getByTestId('crit-F104')).toBeTruthy();
    expect(screen.getByTestId('crit-F105')).toBeTruthy();
  });

  it('en mode complet, les extensions sont dans la liste principale', () => {
    render(
      <DimensionSection
        dimension={dimension}
        scores={scores}
        criteresKO={[]}
        scoreDim={50}
        onScoreChange={vi.fn()}
        onUploadPreuve={vi.fn()}
        uploadProgress={{}}
        defaultOpen
        mode="complet"
      />
    );
    expect(screen.getByTestId('crit-F104')).toBeTruthy();
    expect(screen.queryByText('evaluation.sectionExtension')).toBeNull();
  });
});
