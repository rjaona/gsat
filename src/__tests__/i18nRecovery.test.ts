/**
 * Tests i18n — clés recovery (Chantier D).
 * fr + en doivent être COMPLETS (langues de premier plan).
 * mg est partiel par design (DeepPartial + fallback fr, cf. en-tête mg.ts) :
 * on n'exige pas la complétude, mais toute clé présente doit être non vide.
 */
import { describe, it, expect } from 'vitest';
import { fr } from '@/i18n/fr';
import { en } from '@/i18n/en';
import { mg } from '@/i18n/mg';

const REQUIRED = [
  'forgotLink',
  'forgot.title', 'forgot.description', 'forgot.emailLabel', 'forgot.submit',
  'forgot.sent', 'forgot.error', 'forgot.back',
  'reset.title', 'reset.newPassword', 'reset.confirmPassword', 'reset.submit',
  'reset.success', 'reset.mismatch', 'reset.tooShort', 'reset.invalidLink', 'reset.requestNew',
];

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

describe.each([['fr', fr], ['en', en]])('i18n %s recovery — complet', (_lang, dict) => {
  it.each(REQUIRED)('a la clé auth.%s non vide', (key) => {
    const v = get((dict as Record<string, unknown>)['auth'], key);
    expect(typeof v).toBe('string');
    expect((v as string).length).toBeGreaterThan(0);
  });
});

describe('i18n mg recovery — partiel, clés présentes non vides', () => {
  it.each(REQUIRED)('si auth.%s existe, il est non vide', (key) => {
    const v = get((mg as Record<string, unknown>)['auth'], key);
    if (v === undefined) return; // fallback fr assumé
    expect(typeof v).toBe('string');
    expect((v as string).length).toBeGreaterThan(0);
  });
});
