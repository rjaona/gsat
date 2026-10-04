import { describe, it, expect } from 'vitest';
import { fr } from '@/i18n/fr';
import { en } from '@/i18n/en';

const NAT = ['colAppui', 'enAppui', 'kpiZoneAppui', 'kpiAvecKo', 'kpiActionsNationales', 'echeance', 'drillNationales',
  'drillAucuneNationale', 'captureTitre', 'enAppuiDepuis', 'referent', 'aucunReferent', 'note', 'enregistrer', 'clore',
  'marquer', 'actionTitre', 'actionImpossible', 'objectif', 'domaine', 'echeanceLabel', 'priorite', 'responsable',
  'critere', 'aucunCritere', 'creerAction'];
const REG = ['badgeNational', 'chipAppui'];

describe('i18n cockpits Phase 2', () => {
  it('clés présentes et non vides en fr et en', () => {
    for (const lang of [fr, en] as Record<string, any>[]) {
      for (const k of NAT) expect(lang["pages"].pilotageNational[k], `pilotageNational.${k}`).toBeTruthy();
      for (const k of ['critique', 'haute', 'moyenne', 'basse']) expect(lang["pages"].pilotageNational.priorites?.[k]).toBeTruthy();
      for (const k of REG) expect(lang["pages"].pilotageRegional[k], `pilotageRegional.${k}`).toBeTruthy();
    }
  });
  it('placeholders Phase 1 retirés', () => {
    expect((fr as any)["pages"].pilotageNational.drillPhase2).toBeUndefined();
    expect((en as any)["pages"].pilotageNational.drillPhase2).toBeUndefined();
  });
});
