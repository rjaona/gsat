import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();

const readSrc = (path: string) =>
  readFileSync(resolve(ROOT, path), 'utf8');

describe('Channels Realtime globaux supprimés (scaling)', () => {
  it('evaluationService ne contient plus subscribeAllEvaluations', () => {
    const src = readSrc('src/services/evaluationService.ts');
    expect(src).not.toMatch(/channel\(['"]evaluations-all['"]\)/);
    expect(src).not.toMatch(/export function subscribeAllEvaluations/);
  });

  it('campagneService ne contient plus le channel campagnes-realtime', () => {
    const src = readSrc('src/services/campagneService.ts');
    expect(src).not.toMatch(/channel\(['"]campagnes-realtime['"]\)/);
  });

  it('organisationService ne contient plus le channel organisations-realtime', () => {
    const src = readSrc('src/services/organisationService.ts');
    expect(src).not.toMatch(/channel\(['"]organisations-realtime['"]\)/);
  });

  it('EvaluationListPage n importe plus subscribeAllEvaluations', () => {
    const src = readSrc('src/pages/evaluation/EvaluationListPage.tsx');
    expect(src).not.toMatch(/subscribeAllEvaluations/);
  });
});
