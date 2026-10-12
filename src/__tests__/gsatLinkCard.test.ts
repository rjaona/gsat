// @vitest-environment node
/**
 * E19 vague 2 (Tily Wiki) — Edge Function gsat-link-card : gestionnaire pur.
 * Environnement node : Request, Response et crypto.subtle natifs (jsdom ne
 * fournit pas crypto.subtle de façon fiable).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  EVALUATION_SELECT,
  handleLinkCard,
  KEY_HEADER,
  LINK_CARD_KEY_MIN,
  PROVINCE_LABELS,
  toCardRow,
  type LinkCardEvaluation,
} from '../../supabase/edge-functions/gsat-link-card/handler.ts';
import { PROVINCES } from '@/utils/perimetreProvinces';

const KEY = 'recette-e19-gsat-link-card-key-0001';
const OSN_ID = '5a1f0c3e-7b2d-4e6a-8c9b-1d2e3f4a5b6c';
const OTHER_OSN_ID = '9e8d7c6b-5a49-4382-b1a0-f9e8d7c6b5a4';
const ASN_ID = 'c1c1c1c1-0000-4000-8000-000000000001';
const ID = '0b9d4c2e-5f1a-4c3b-9e8d-7a6b5c4d3e2f';
const BASE = 'http://localhost:8000/gsat-link-card';
const SUBTITLE = 'Auto-évaluation · Cycle 1 Faritany 2026 · 1 mars 2026 – 30 juin 2026 · Antananarivo';

const ROW: LinkCardEvaluation = {
  statut: 'en_cours',
  type: 'auto',
  campagne: {
    nom: 'Cycle 1 Faritany 2026',
    date_ouverture: '2026-03-01T00:00:00+00:00',
    date_fermeture: '2026-06-30T00:00:00+00:00',
  },
  organisation: { id: ASN_ID, parent_id: OSN_ID, nom: 'Faritany Analamanga', code: 'ANT-01' },
};

interface Card {
  title?: unknown;
  subtitle?: unknown;
  state?: unknown;
  stateLabel?: unknown;
  meta?: unknown;
  error?: unknown;
  code?: unknown;
}

interface Call {
  path?: string | null | undefined;
  key?: string | null | undefined;
  serverKey?: string | undefined;
  roots?: string | undefined;
  row?: LinkCardEvaluation | null | undefined;
  load?: ((id: string) => Promise<LinkCardEvaluation | null>) | undefined;
  method?: string | undefined;
  url?: string | undefined;
}

async function call(o: Call = {}) {
  const loadEvaluation = vi.fn(o.load ?? (async (_id: string) => ('row' in o ? (o.row ?? null) : ROW)));
  const logError = vi.fn();
  const path = 'path' in o ? o.path : `/evaluation/${ID}`;
  const url = o.url ?? (path === null || path === undefined ? BASE : `${BASE}?path=${encodeURIComponent(path)}`);
  const headers = new Headers();
  const key = 'key' in o ? o.key : KEY;
  if (key !== null && key !== undefined) headers.set(KEY_HEADER, key);
  const res = await handleLinkCard(new Request(url, { method: o.method ?? 'GET', headers }), {
    key: 'serverKey' in o ? o.serverKey : KEY,
    rootOrgIds: 'roots' in o ? o.roots : OSN_ID,
    loadEvaluation,
    logError,
  });
  const text = await res.text();
  let body: Card = {};
  try {
    body = JSON.parse(text) as Card;
  } catch {
    body = {};
  }
  return { res, status: res.status, body, text, loadEvaluation, logError };
}

describe('gsat-link-card (E19 vague 2)', () => {
  it('la clé de recette est assez longue', () => {
    expect(LINK_CARD_KEY_MIN).toBe(32);
    expect(KEY.length).toBeGreaterThanOrEqual(LINK_CARD_KEY_MIN);
  });

  describe('clé partagée', () => {
    it.each([
      ['absent', undefined],
      ['vide', '   '],
      ['de 31 caractères', 'k'.repeat(31)],
    ])('503 si le secret est %s, sans lecture', async (_label, serverKey) => {
      const r = await call({ serverKey, key: serverKey ?? KEY });
      expect(r.status).toBe(503);
      expect(r.res.headers.get('cache-control')).toBe('no-store');
      expect(r.body).toEqual({ error: expect.any(String) });
      expect(r.loadEvaluation).not.toHaveBeenCalled();
    });

    it.each([
      ['absente', null],
      ['vide', ''],
      ['fausse', 'x'.repeat(KEY.length)],
      ['préfixe', KEY.slice(0, -1)],
      ['plus longue', `${KEY}x`],
    ])('401 si la clé est %s, sans lecture', async (_label, key) => {
      const r = await call({ key });
      expect(r.status).toBe(401);
      expect(r.res.headers.get('cache-control')).toBe('no-store');
      expect(r.body).toEqual({ error: expect.any(String) });
      expect(r.text).not.toContain(KEY);
      expect(r.loadEvaluation).not.toHaveBeenCalled();
    });

    it('la clé est contrôlée avant la méthode et le chemin', async () => {
      expect((await call({ path: '/pas-un-chemin', key: 'mauvaise' })).status).toBe(401);
      expect((await call({ method: 'POST', key: null })).status).toBe(401);
    });

    it('la clé dans la requête ne vaut rien', async () => {
      const r = await call({ key: null, url: `${BASE}?path=${encodeURIComponent(`/evaluation/${ID}`)}&key=${KEY}` });
      expect(r.status).toBe(401);
    });
  });

  it.each(['POST', 'PUT', 'DELETE', 'HEAD'])('405 pour %s (clé valide), sans lecture', async (method) => {
    const r = await call({ method });
    expect(r.status).toBe(405);
    expect(r.res.headers.get('allow')).toBe('GET');
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect(r.loadEvaluation).not.toHaveBeenCalled();
  });

  describe('périmètre OSN TEM', () => {
    it.each([
      ['absente', undefined],
      ['vide', ' , '],
      ['sans UUID valide', 'TEM, pas-un-uuid'],
    ])('503 si GSAT_LINK_CARD_ROOT_ORG_IDS est %s, sans lecture', async (_label, roots) => {
      const r = await call({ roots });
      expect(r.status).toBe(503);
      expect(r.res.headers.get('cache-control')).toBe('no-store');
      expect(r.loadEvaluation).not.toHaveBeenCalled();
    });

    it('carte pour un ASN enfant de l\'OSN TEM', async () => {
      expect((await call()).status).toBe(200);
    });

    it('carte pour une évaluation de l\'OSN TEM lui-même, casse et espaces tolérés', async () => {
      const row = { ...ROW, organisation: { ...ROW.organisation!, id: OSN_ID.toUpperCase(), parent_id: null } };
      expect((await call({ row, roots: `${OTHER_OSN_ID}, ${OSN_ID}` })).status).toBe(200);
    });

    it.each([
      ['ASN d\'un autre OSN', { id: ASN_ID, parent_id: OTHER_OSN_ID }],
      ['autre OSN racine', { id: OTHER_OSN_ID, parent_id: null }],
      ['petit-enfant de l\'OSN', { id: ASN_ID, parent_id: ASN_ID }],
      ['organisation sans id ni parent', { id: null, parent_id: null }],
    ])('404 indiscernable d\'une évaluation inconnue : %s', async (_label, ids) => {
      const out = await call({ row: { ...ROW, organisation: { ...ROW.organisation!, ...ids } } });
      const unknown = await call({ row: null });
      expect(out.status).toBe(404);
      expect(out.body).toEqual(unknown.body);
      expect(out.res.headers.get('cache-control')).toBe(unknown.res.headers.get('cache-control'));
    });

    it('404 sans organisation (hors périmètre par défaut)', async () => {
      expect((await call({ row: { ...ROW, organisation: null } })).status).toBe(404);
    });

    it('la réponse ne contient ni id ni parent_id', async () => {
      const r = await call();
      expect(r.text).not.toContain(ASN_ID);
      expect(r.text).not.toContain(OSN_ID);
    });
  });

  describe('chemin', () => {
    it.each([
      ['absent', null],
      ['liste', '/evaluation'],
      ['liste avec barre', '/evaluation/'],
      ['nouvelle évaluation', '/evaluation/new'],
      ['page de validation', `/evaluation/validate/${ID}`],
      ['sous-chemin', `/evaluation/${ID}/edit`],
      ['barre finale', `/evaluation/${ID}/`],
      ['pas un UUID', '/evaluation/123'],
      ['UUID sans tirets', `/evaluation/${ID.replace(/-/g, '')}`],
      ['UUID trop long', `/evaluation/${ID}0`],
      ['UUID entre accolades', `/evaluation/{${ID}}`],
      ['sans barre initiale', `evaluation/${ID}`],
      ['espace initiale', ` /evaluation/${ID}`],
      ['pluriel', `/evaluations/${ID}`],
      ['autre ressource', `/campaigns/${ID}`],
    ])('400 link_card_bad_path : %s', async (_label, path) => {
      const r = await call({ path });
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: expect.any(String), code: 'link_card_bad_path' });
      expect(r.loadEvaluation).not.toHaveBeenCalled();
    });

    it('400 si path est répété', async () => {
      const p = encodeURIComponent(`/evaluation/${ID}`);
      const r = await call({ url: `${BASE}?path=${p}&path=${p}` });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('link_card_bad_path');
      expect(r.loadEvaluation).not.toHaveBeenCalled();
    });

    it('UUID en capitales : accepté, lu en minuscules', async () => {
      const r = await call({ path: `/evaluation/${ID.toUpperCase()}` });
      expect(r.status).toBe(200);
      expect(r.loadEvaluation).toHaveBeenCalledWith(ID);
    });

    it('le chemin de la requête est ignoré (Kong peut garder ou retirer /functions/v1)', async () => {
      const r = await call({ url: `http://kong:8000/functions/v1/gsat-link-card?path=${encodeURIComponent(`/evaluation/${ID}`)}` });
      expect(r.status).toBe(200);
    });
  });

  it('404 link_card_not_found si l’évaluation n’existe pas', async () => {
    const r = await call({ row: null });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'Évaluation introuvable.', code: 'link_card_not_found' });
    expect(r.loadEvaluation).toHaveBeenCalledWith(ID);
  });

  it.each([['brouillon'], ['supprimee'], [''], ['EN_COURS'], [null], [42]])(
    '404 pour le statut %j : indiscernable d’une évaluation inconnue',
    async (statut) => {
      const r = await call({ row: { ...ROW, statut } });
      expect(r.status).toBe(404);
      expect(r.body).toEqual({ error: 'Évaluation introuvable.', code: 'link_card_not_found' });
      expect(r.text).not.toContain('Analamanga');
      expect(r.text).not.toContain('Cycle 1');
    },
  );

  it('200 : carte de l’évaluation, cache privé 5 min', async () => {
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.res.headers.get('cache-control')).toBe('private, max-age=300');
    expect(r.res.headers.get('content-type')).toContain('application/json');
    expect(r.body).toEqual({
      title: 'Faritany Analamanga',
      subtitle: SUBTITLE,
      state: 'en_cours',
      stateLabel: 'En cours',
      meta: {},
    });
  });

  it.each([
    ['en_cours', 'En cours'],
    ['soumise', 'Soumise'],
    ['validee', 'Validée'],
    ['cloturee', 'Clôturée'],
  ])('200 : statut %s renvoyé brut, libellé %s', async (statut, label) => {
    const r = await call({ row: { ...ROW, statut } });
    expect(r.body.state).toBe(statut);
    expect(r.body.stateLabel).toBe(label);
  });

  it('200 n’expose JAMAIS de score, de nom ni de donnée de revue', async () => {
    const raw = {
      statut: 'validee',
      type: 'accompagnee',
      score_global: 87.5,
      score_par_dimension: { D01: 75.5 },
      submitted_by: 'uid-rakoto',
      validee_par: 'uid-rabe',
      revue_par: 'uid-solo',
      revue_motif: 'Motif confidentiel',
      pv_comite_path: 'pv/ant-01.pdf',
      reviewer_name: 'RAKOTO Jean',
      reviewer_title: 'Commissaire',
      reviewer_recommendation: 'Reco secrète',
      commentaire: 'Commentaire interne',
      created_by: 'uid-createur',
      campagne: {
        nom: 'Cycle 1 Faritany 2026',
        date_ouverture: '2026-03-01T00:00:00+00:00',
        date_fermeture: '2026-06-30T00:00:00+00:00',
        description: 'Desc interne',
        statut: 'ouverte',
        evaluateur_name: 'RABE Lova',
        reviewer_name: 'SOLO Hery',
        perimetre: ['org-x'],
      },
      organisation: { ...ROW.organisation, lat: -18.9 },
    };
    const r = await call({ load: async () => toCardRow(raw) });
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['meta', 'state', 'stateLabel', 'subtitle', 'title']);
    expect(r.body.meta).toEqual({});
    for (const secret of ['87', '75.5', 'uid-', 'Motif', 'pv/', 'RAKOTO', 'Commissaire', 'Reco', 'Commentaire', 'Desc interne', 'ouverte', 'RABE', 'SOLO', 'org-x', '-18.9']) {
      expect(r.text).not.toContain(secret);
    }
    expect(r.body.subtitle).toBe('Évaluation accompagnée · Cycle 1 Faritany 2026 · 1 mars 2026 – 30 juin 2026 · Antananarivo');
  });

  it.each([
    ['type inconnu : omis', { ...ROW, type: 'autre' }, 'Faritany Analamanga', 'Cycle 1 Faritany 2026 · 1 mars 2026 – 30 juin 2026 · Antananarivo'],
    ['province inconnue (TEM) : omise', { ...ROW, organisation: { id: ASN_ID, parent_id: OSN_ID, nom: 'Faritany Analamanga', code: 'TEM' } }, 'Faritany Analamanga', 'Auto-évaluation · Cycle 1 Faritany 2026 · 1 mars 2026 – 30 juin 2026'],
    ['code absent : province omise', { ...ROW, organisation: { id: ASN_ID, parent_id: OSN_ID, nom: 'Faritany Analamanga', code: null } }, 'Faritany Analamanga', 'Auto-évaluation · Cycle 1 Faritany 2026 · 1 mars 2026 – 30 juin 2026'],
    ['même jour : une seule date', { ...ROW, campagne: { nom: 'Cycle 1 Faritany 2026', date_ouverture: '2026-03-01T06:00:00+00:00', date_fermeture: '2026-03-01T15:00:00+00:00' } }, 'Faritany Analamanga', 'Auto-évaluation · Cycle 1 Faritany 2026 · 1 mars 2026 · Antananarivo'],
    ['dates invalides : omises', { ...ROW, campagne: { nom: 'Cycle 1 Faritany 2026', date_ouverture: 'demain', date_fermeture: 42 } }, 'Faritany Analamanga', 'Auto-évaluation · Cycle 1 Faritany 2026 · Antananarivo'],
    ['fuseau Antananarivo', { ...ROW, campagne: { nom: 'Cycle 1 Faritany 2026', date_ouverture: '2026-05-03T21:30:00Z', date_fermeture: null } }, 'Faritany Analamanga', 'Auto-évaluation · Cycle 1 Faritany 2026 · 4 mai 2026 · Antananarivo'],
    ['date seule', { ...ROW, campagne: { nom: 'Cycle 1 Faritany 2026', date_ouverture: '2026-06-01', date_fermeture: '' } }, 'Faritany Analamanga', 'Auto-évaluation · Cycle 1 Faritany 2026 · 1 juin 2026 · Antananarivo'],
  ])('200 : %s', async (_label, row, title, subtitle) => {
    const r = await call({ row: row as LinkCardEvaluation });
    expect(r.status).toBe(200);
    expect(r.body.title).toBe(title);
    expect(r.body.subtitle).toBe(subtitle);
  });

  it('200 : textes nettoyés et bornés à 200 caractères ; rien pour le sous-titre → null', async () => {
    const long = await call({ row: { statut: 'soumise', type: null, campagne: null, organisation: { id: ASN_ID, parent_id: OSN_ID, nom: 'x'.repeat(500), code: null } } });
    expect(long.body.title).toBe('x'.repeat(200));
    expect(long.body.subtitle).toBeNull();
    expect(long.body.state).toBe('soumise');
    const dirty = await call({ row: { ...ROW, organisation: { id: ASN_ID, parent_id: OSN_ID, nom: 'Faritany\u0000 Analamanga\n', code: 'ANT-01' } } });
    expect(dirty.body.title).toBe('Faritany Analamanga');
  });

  it('500 si la lecture échoue, sans le détail dans la réponse', async () => {
    const r = await call({ load: async () => { throw new Error('boom db'); } });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: 'Erreur interne.' });
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    expect(r.text).not.toContain('boom');
    expect(r.logError).toHaveBeenCalledWith('boom db');
  });

  describe('lecture', () => {
    it('la requête ne sélectionne que la liste blanche', () => {
      expect(EVALUATION_SELECT).toBe(
        'statut, type, campagne:campagnes(nom, date_ouverture, date_fermeture), organisation:organisations(id, parent_id, nom, code)',
      );
      for (const forbidden of ['*', 'score', '_by', '_par', '_name', 'reviewer', 'revue', 'pv_', 'commentaire', 'description', 'perimetre']) {
        expect(EVALUATION_SELECT).not.toContain(forbidden);
      }
    });

    it('toCardRow : ne garde que les clés de la liste blanche', () => {
      const row = toCardRow({ statut: 'soumise', type: 'auto', score_global: 1, campagne: { nom: 'C', date_ouverture: null, date_fermeture: null, statut: 'ouverte' }, organisation: { id: ASN_ID, parent_id: OSN_ID, nom: 'O', code: 'ANT-01', lat: 1 } });
      expect(row).toEqual({
        statut: 'soumise',
        type: 'auto',
        campagne: { nom: 'C', date_ouverture: null, date_fermeture: null },
        organisation: { id: ASN_ID, parent_id: OSN_ID, nom: 'O', code: 'ANT-01' },
      });
    });

    it('toCardRow : relation renvoyée en tableau → premier élément ; absente → null', () => {
      expect(toCardRow({ statut: 'soumise', type: 'auto', campagne: [{ nom: 'C', date_ouverture: null, date_fermeture: null }], organisation: [] })).toEqual({
        statut: 'soumise',
        type: 'auto',
        campagne: { nom: 'C', date_ouverture: null, date_fermeture: null },
        organisation: null,
      });
    });

    it.each([[null], [[]], ['x'], [42]])('toCardRow(%j) → null', (raw) => {
      expect(toCardRow(raw)).toBeNull();
    });
  });

  it('table des provinces identique à celle de GSAT', () => {
    expect([...PROVINCE_LABELS.entries()]).toEqual(PROVINCES.map((p) => [p.prefixe, p.nom]));
  });
});
