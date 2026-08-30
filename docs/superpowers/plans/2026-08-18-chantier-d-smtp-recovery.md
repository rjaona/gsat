# Chantier D — SMTP réel + recovery mot de passe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux comptes GSAT (33 `responsable_asn` + admin) de réinitialiser leur mot de passe eux-mêmes via un vrai email de récupération.

**Architecture:** Deux workstreams. (B) Frontend — `authService` gagne 3 fonctions, deux pages publiques `/forgot-password` et `/reset-password` calquées sur `/login`, page reset **flow-agnostic** (implicit `#access_token` ou PKCE `?code=`). (A) Ops — GoTrue de la prod repointé d'inbucket vers Gmail SMTP + URLs publiques + allow-list, livré comme runbook exécuté quand le firewall VPS est rouvert. Frontend d'abord (TDD), ops ensuite, smoke end-to-end en dernier.

**Tech Stack:** React 19 + Vite 6 + TypeScript strict, react-router-dom v7 (`createBrowserRouter`), `@supabase/supabase-js ^2.103`, react-i18next, Vitest + Testing Library. Supabase self-hosted (GoTrue) sur VPS Hostinger.

## Global Constraints

- Spec de référence : `docs/superpowers/specs/2026-08-18-chantier-d-smtp-recovery-design.md`.
- Repo : `/mnt/d/Mes Documents/GSAT/gsat-v2`, origin `github.com/rjaona/gsat`, base master `0bce7f3` (chantiers A/C empilés dessus, ne pas mélanger).
- TypeScript strict : `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`.
- Gates (⚠️ `.bin` cassés sous `/mnt/d`) :
  - Typecheck : `node node_modules/typescript/bin/tsc -b` (JAMAIS `-p tsconfig.json` = no-op).
  - Tests : `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'`.
  - Build : `node node_modules/vite/bin/vite.js build`.
- i18n : fichiers TS `src/i18n/fr.ts` / `en.ts` / `mg.ts` (PAS de `.json`). Toujours renseigner les 3 (mg peut copier fr en fallback pragmatique).
- Pages auth : vivent dans `src/components/auth/` (à côté de `LoginPage.tsx`).
- Politique mot de passe UI : longueur ≥ 8 + confirmation qui matche ; ≥ `GOTRUE_PASSWORD_MIN_LENGTH` serveur (défaut 6) — jamais plus laxiste que le serveur.
- Anti-énumération : la page forgot affiche un message neutre quel que soit le résultat.
- Secret Gmail (App Password) : fourni à l'apply, root-only sur le VPS, **jamais committé ni loggé**.
- Commits fréquents, un par tâche minimum. Terminer les messages de commit par les lignes Co-Authored-By / Claude-Session du projet.
- Créer une branche dédiée avant la Tâche 1 : `git checkout -b feat/chantier-d-recovery` (base master `0bce7f3`).

---

### Task 1: authService — requestPasswordReset, updatePassword, ensureRecoverySession

**Files:**
- Modify: `src/services/authService.ts` (ajout de 3 fonctions après `refreshSession`, avant la section « Helpers de rôle »)
- Modify: `src/vitest.setup.ts` (ajouter `resetPasswordForEmail`, `updateUser`, `exchangeCodeForSession` au mock global `supabase.auth`)
- Test: `src/__tests__/authService.recovery.test.ts` (nouveau)

**Interfaces:**
- Consumes: `supabase` de `@/services/supabase` (client singleton).
- Produces (utilisés par Tasks 2 & 3) :
  - `requestPasswordReset(email: string): Promise<void>` — appelle `resetPasswordForEmail` avec `redirectTo = window.location.origin + '/reset-password'` ; throw si `error`.
  - `updatePassword(newPassword: string): Promise<void>` — appelle `updateUser({ password })` ; throw si `error`.
  - `ensureRecoverySession(): Promise<boolean>` — true si une session existe déjà (flow implicit) OU si un `?code=` présent s'échange avec succès (flow PKCE) ; false sinon.

- [ ] **Step 1: Write the failing test**

Créer `src/__tests__/authService.recovery.test.ts` :

```ts
/**
 * Tests unitaires — authService recovery (Chantier D).
 * requestPasswordReset / updatePassword / ensureRecoverySession.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: h.resetPasswordForEmail,
      updateUser: h.updateUser,
      getSession: h.getSession,
      exchangeCodeForSession: h.exchangeCodeForSession,
    },
  },
}));

// auditService est importé par authService — le neutraliser
vi.mock('@/services/auditService', () => ({ writeAuditEntry: vi.fn() }));

import {
  requestPasswordReset,
  updatePassword,
  ensureRecoverySession,
} from '@/services/authService';

const ORIGIN = 'https://gsat.tily-digital.com';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { location: { origin: ORIGIN, search: '' } });
  h.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  h.updateUser.mockResolvedValue({ data: {}, error: null });
  h.getSession.mockResolvedValue({ data: { session: null }, error: null });
  h.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('requestPasswordReset', () => {
  it('appelle resetPasswordForEmail avec redirectTo = origin + /reset-password', async () => {
    await requestPasswordReset('user@tem.mg');
    expect(h.resetPasswordForEmail).toHaveBeenCalledWith('user@tem.mg', {
      redirectTo: `${ORIGIN}/reset-password`,
    });
  });
  it('throw si supabase renvoie une erreur', async () => {
    h.resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'rate limited' } });
    await expect(requestPasswordReset('user@tem.mg')).rejects.toBeTruthy();
  });
});

describe('updatePassword', () => {
  it('appelle updateUser avec le nouveau mot de passe', async () => {
    await updatePassword('nouveauSecret1');
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'nouveauSecret1' });
  });
  it('throw si supabase renvoie une erreur', async () => {
    h.updateUser.mockResolvedValue({ data: {}, error: { message: 'weak' } });
    await expect(updatePassword('x')).rejects.toBeTruthy();
  });
});

describe('ensureRecoverySession', () => {
  it('retourne true si une session existe déjà (flow implicit)', async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    await expect(ensureRecoverySession()).resolves.toBe(true);
    expect(h.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('échange le code si ?code= présent et pas de session (flow PKCE)', async () => {
    vi.stubGlobal('window', { location: { origin: ORIGIN, search: '?code=abc123' } });
    h.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    await expect(ensureRecoverySession()).resolves.toBe(true);
    expect(h.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
  });
  it('retourne false si ni session ni code exploitable', async () => {
    await expect(ensureRecoverySession()).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/authService.recovery.test.ts`
Expected: FAIL — `requestPasswordReset is not a function` (ou export introuvable).

- [ ] **Step 3: Write minimal implementation**

Dans `src/services/authService.ts`, après la fonction `refreshSession` (ligne ~116) et avant `// ── Helpers de rôle ──` :

```ts
// ── Récupération de mot de passe (Chantier D) ────────────────────────────────

/**
 * Déclenche l'envoi d'un email de réinitialisation.
 * redirectTo pointe sur la page /reset-password de l'origine courante
 * (prod, staging ou local) ; cette URL doit figurer dans URI_ALLOW_LIST de GoTrue.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/**
 * Met à jour le mot de passe de la session courante (session de recovery).
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Établit la session de recovery, quel que soit le flow GoTrue.
 * - Flow implicit : detectSessionInUrl a déjà posé la session → getSession la voit.
 * - Flow PKCE : un ?code= est présent dans l'URL → l'échanger contre une session.
 * Retourne true si une session est disponible pour changer le mot de passe.
 */
export async function ensureRecoverySession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return true;

  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) return true;
  }
  return false;
}
```

Puis dans `src/vitest.setup.ts`, ajouter au bloc `auth: { ... }` du mock global (après `refreshSession`) :

```ts
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
        updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/authService.recovery.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc -b`
Expected: exit 0, aucune erreur.

- [ ] **Step 6: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/services/authService.ts src/vitest.setup.ts src/__tests__/authService.recovery.test.ts
git commit -m "feat(auth): requestPasswordReset/updatePassword/ensureRecoverySession (Chantier D)"
```

---

### Task 2: i18n — clés forgot/reset (fr/en/mg)

**Files:**
- Modify: `src/i18n/fr.ts` (bloc `auth`)
- Modify: `src/i18n/en.ts` (bloc `auth`)
- Modify: `src/i18n/mg.ts` (bloc `auth`)
- Test: `src/__tests__/i18nRecovery.test.ts` (nouveau)

**Interfaces:**
- Produces (utilisés par Tasks 3, 4, 5) : sous `auth`, les clés
  `forgotLink`, `forgot.{title,description,emailLabel,submit,sent,error,back}`,
  `reset.{title,newPassword,confirmPassword,submit,success,mismatch,tooShort,invalidLink,requestNew}`.

- [ ] **Step 1: Write the failing test**

Créer `src/__tests__/i18nRecovery.test.ts` :

```ts
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

describe.each([['fr', fr], ['en', en], ['mg', mg]])('i18n %s recovery', (_lang, dict) => {
  it.each(REQUIRED)('a la clé auth.%s non vide', (key) => {
    const v = get((dict as Record<string, unknown>)['auth'], key);
    expect(typeof v).toBe('string');
    expect((v as string).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/i18nRecovery.test.ts`
Expected: FAIL — clés absentes.

- [ ] **Step 3: Write minimal implementation**

Dans `src/i18n/fr.ts`, remplacer le bloc `auth` existant par :

```ts
  auth: {
    login: 'Connexion',
    logout: 'Déconnexion',
    email: 'Email',
    password: 'Mot de passe',
    forgotLink: 'Mot de passe oublié ?',
    forgot: {
      title: 'Réinitialiser le mot de passe',
      description: 'Saisissez votre email : si un compte existe, vous recevrez un lien de réinitialisation.',
      emailLabel: 'Email',
      submit: 'Envoyer le lien',
      sent: 'Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé.',
      error: 'Une erreur est survenue. Réessayez plus tard.',
      back: 'Retour à la connexion',
    },
    reset: {
      title: 'Choisir un nouveau mot de passe',
      newPassword: 'Nouveau mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      submit: 'Enregistrer',
      success: 'Mot de passe mis à jour. Redirection vers la connexion…',
      mismatch: 'Les deux mots de passe ne correspondent pas.',
      tooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
      invalidLink: 'Ce lien est invalide ou a expiré.',
      requestNew: 'Demander un nouveau lien',
    },
  },
```

Dans `src/i18n/en.ts`, remplacer le bloc `auth` par :

```ts
  auth: {
    login: 'Sign in',
    logout: 'Sign out',
    email: 'Email',
    password: 'Password',
    forgotLink: 'Forgot password?',
    forgot: {
      title: 'Reset your password',
      description: 'Enter your email: if an account exists, you will receive a reset link.',
      emailLabel: 'Email',
      submit: 'Send link',
      sent: 'If an account exists for this email, a reset link has just been sent.',
      error: 'Something went wrong. Please try again later.',
      back: 'Back to sign in',
    },
    reset: {
      title: 'Choose a new password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      submit: 'Save',
      success: 'Password updated. Redirecting to sign in…',
      mismatch: 'The two passwords do not match.',
      tooShort: 'Password must be at least 8 characters.',
      invalidLink: 'This link is invalid or has expired.',
      requestNew: 'Request a new link',
    },
  },
```

Dans `src/i18n/mg.ts`, remplacer le bloc `auth` par (mg pragmatique — libellés malgaches simples, sinon reprendre le fr) :

```ts
  auth: {
    login: 'Hiditra',
    logout: 'Hivoaka',
    email: 'Mailaka',
    password: 'Tenimiafina',
    forgotLink: 'Hadino ny tenimiafina ?',
    forgot: {
      title: 'Avereno ny tenimiafina',
      description: 'Ampidiro ny mailakao : raha misy kaonty, handefasana rohy fanavaozana ianao.',
      emailLabel: 'Mailaka',
      submit: 'Alefaso ny rohy',
      sent: 'Raha misy kaonty amin’ity mailaka ity, dia vao nalefa ny rohy fanavaozana.',
      error: 'Nmisy olana. Andramo indray afaka kelikely.',
      back: 'Hiverina amin’ny fidirana',
    },
    reset: {
      title: 'Misafidiana tenimiafina vaovao',
      newPassword: 'Tenimiafina vaovao',
      confirmPassword: 'Hamafiso ny tenimiafina',
      submit: 'Tehirizo',
      success: 'Voaova ny tenimiafina. Mba miandry kely…',
      mismatch: 'Tsy mitovy ny tenimiafina roa.',
      tooShort: 'Tokony ho 8 litera farafahakeliny ny tenimiafina.',
      invalidLink: 'Tsy mety na efa lany daty ity rohy ity.',
      requestNew: 'Mangataha rohy vaovao',
    },
  },
```

⚠️ Vérifier qu'aucune autre clé du bloc `auth` d'origine n'est perdue (les 3 fichiers n'avaient que login/logout/email/password sous `auth` — vérifier `en.ts` et `mg.ts` avant de remplacer, adapter si un champ diffère).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/i18nRecovery.test.ts`
Expected: PASS (51 assertions : 17 clés × 3 langues).

- [ ] **Step 5: Typecheck**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc -b`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/i18n/fr.ts src/i18n/en.ts src/i18n/mg.ts src/__tests__/i18nRecovery.test.ts
git commit -m "feat(i18n): clés forgot/reset password fr/en/mg (Chantier D)"
```

---

### Task 3: ForgotPasswordPage

**Files:**
- Create: `src/components/auth/ForgotPasswordPage.tsx`
- Test: `src/__tests__/forgotPasswordPage.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `requestPasswordReset` (Task 1), clés `auth.forgot.*` (Task 2).
- Produces: composant exporté `ForgotPasswordPage` (default + named), rendu à la route `/forgot-password` (Task 5).

Comportement : formulaire email → à la soumission, appelle `requestPasswordReset`. En cas de succès **et** en cas d'erreur non critique, on privilégie l'anti-énumération : succès → message neutre `auth.forgot.sent` ; erreur → message générique `auth.forgot.error` (ne révèle pas l'existence du compte). Lien retour vers `/login`.

- [ ] **Step 1: Write the failing test**

Créer `src/__tests__/forgotPasswordPage.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/services/authService', () => ({ requestPasswordReset: h.requestPasswordReset }));

import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage';

beforeEach(() => { vi.clearAllMocks(); cleanup(); });

it('appelle requestPasswordReset et affiche le message neutre au succès', async () => {
  h.requestPasswordReset.mockResolvedValue(undefined);
  render(<ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText('auth.forgot.emailLabel'), { target: { value: 'a@tem.mg' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgot.submit' }));
  await waitFor(() => expect(h.requestPasswordReset).toHaveBeenCalledWith('a@tem.mg'));
  expect(await screen.findByText('auth.forgot.sent')).toBeTruthy();
});

it('affiche un message générique (pas de fuite) en cas d’erreur', async () => {
  h.requestPasswordReset.mockRejectedValue(new Error('rate limited'));
  render(<ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText('auth.forgot.emailLabel'), { target: { value: 'a@tem.mg' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgot.submit' }));
  expect(await screen.findByText('auth.forgot.error')).toBeTruthy();
  expect(screen.queryByText('auth.forgot.sent')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/forgotPasswordPage.test.tsx`
Expected: FAIL — module `ForgotPasswordPage` introuvable.

- [ ] **Step 3: Write minimal implementation**

Créer `src/components/auth/ForgotPasswordPage.tsx` :

```tsx
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { requestPasswordReset } from '@/services/authService';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      await requestPasswordReset(email);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{t('auth.forgot.title')}</h1>
        <p className="text-sm text-gray-600">{t('auth.forgot.description')}</p>

        {status === 'sent' ? (
          <p className="text-sm text-green-700">{t('auth.forgot.sent')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                {t('auth.forgot.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            {status === 'error' && (
              <p className="text-sm text-red-600">{t('auth.forgot.error')}</p>
            )}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded bg-[#4B2E83] px-4 py-2 text-white disabled:opacity-60"
            >
              {t('auth.forgot.submit')}
            </button>
          </form>
        )}

        <Link to="/login" className="block text-sm text-[#4B2E83] underline">
          {t('auth.forgot.back')}
        </Link>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/forgotPasswordPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc -b`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/components/auth/ForgotPasswordPage.tsx src/__tests__/forgotPasswordPage.test.tsx
git commit -m "feat(auth): page /forgot-password anti-énumération (Chantier D)"
```

---

### Task 4: ResetPasswordPage (flow-agnostic)

**Files:**
- Create: `src/components/auth/ResetPasswordPage.tsx`
- Test: `src/__tests__/resetPasswordPage.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `ensureRecoverySession`, `updatePassword` (Task 1), clés `auth.reset.*` (Task 2), `useNavigate` de react-router-dom.
- Produces: composant exporté `ResetPasswordPage` (default + named), rendu à `/reset-password` (Task 5).

Comportement :
- Au montage : `ensureRecoverySession()`. Si `false` → afficher `auth.reset.invalidLink` + lien `auth.reset.requestNew` vers `/forgot-password`, pas de formulaire.
- Si `true` → formulaire nouveau mot de passe + confirmation. Validation : longueur ≥ 8 (`auth.reset.tooShort`) et matche (`auth.reset.mismatch`). Soumission → `updatePassword` → message `auth.reset.success` puis `navigate('/login')` après 1500 ms.

- [ ] **Step 1: Write the failing test**

Créer `src/__tests__/resetPasswordPage.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  ensureRecoverySession: vi.fn(),
  updatePassword: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => h.navigate,
}));
vi.mock('@/services/authService', () => ({
  ensureRecoverySession: h.ensureRecoverySession,
  updatePassword: h.updatePassword,
}));

import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage';

beforeEach(() => { vi.clearAllMocks(); cleanup(); });

it('affiche le lien invalide si aucune session de recovery', async () => {
  h.ensureRecoverySession.mockResolvedValue(false);
  render(<ResetPasswordPage />);
  expect(await screen.findByText('auth.reset.invalidLink')).toBeTruthy();
  expect(screen.queryByLabelText('auth.reset.newPassword')).toBeNull();
});

it('refuse si les mots de passe ne correspondent pas', async () => {
  h.ensureRecoverySession.mockResolvedValue(true);
  render(<ResetPasswordPage />);
  await screen.findByLabelText('auth.reset.newPassword');
  fireEvent.change(screen.getByLabelText('auth.reset.newPassword'), { target: { value: 'longsecret1' } });
  fireEvent.change(screen.getByLabelText('auth.reset.confirmPassword'), { target: { value: 'different1' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.reset.submit' }));
  expect(await screen.findByText('auth.reset.mismatch')).toBeTruthy();
  expect(h.updatePassword).not.toHaveBeenCalled();
});

it('refuse si trop court', async () => {
  h.ensureRecoverySession.mockResolvedValue(true);
  render(<ResetPasswordPage />);
  await screen.findByLabelText('auth.reset.newPassword');
  fireEvent.change(screen.getByLabelText('auth.reset.newPassword'), { target: { value: 'short' } });
  fireEvent.change(screen.getByLabelText('auth.reset.confirmPassword'), { target: { value: 'short' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.reset.submit' }));
  expect(await screen.findByText('auth.reset.tooShort')).toBeTruthy();
  expect(h.updatePassword).not.toHaveBeenCalled();
});

it('met à jour puis redirige vers /login au succès', async () => {
  // Timers réels : la page enchaîne des microtasks async (ensureRecoverySession,
  // updatePassword) + un setTimeout de 1500 ms. Mélanger fake timers et
  // microtasks casse waitFor → on reste en timers réels avec un timeout élargi.
  h.ensureRecoverySession.mockResolvedValue(true);
  h.updatePassword.mockResolvedValue(undefined);
  render(<ResetPasswordPage />);
  await screen.findByLabelText('auth.reset.newPassword');
  fireEvent.change(screen.getByLabelText('auth.reset.newPassword'), { target: { value: 'longsecret1' } });
  fireEvent.change(screen.getByLabelText('auth.reset.confirmPassword'), { target: { value: 'longsecret1' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.reset.submit' }));
  await waitFor(() => expect(h.updatePassword).toHaveBeenCalledWith('longsecret1'));
  expect(await screen.findByText('auth.reset.success')).toBeTruthy();
  await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/login'), { timeout: 2000 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/resetPasswordPage.test.tsx`
Expected: FAIL — module `ResetPasswordPage` introuvable.

- [ ] **Step 3: Write minimal implementation**

Créer `src/components/auth/ResetPasswordPage.tsx` :

```tsx
import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ensureRecoverySession, updatePassword } from '@/services/authService';

const MIN_LEN = 8;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    ensureRecoverySession()
      .then((ok) => { if (active) setReady(ok ? 'ok' : 'invalid'); })
      .catch(() => { if (active) setReady('invalid'); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (pwd.length < MIN_LEN) { setError(t('auth.reset.tooShort')); return; }
    if (pwd !== confirm) { setError(t('auth.reset.mismatch')); return; }
    try {
      await updatePassword(pwd);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch {
      setError(t('auth.reset.invalidLink'));
    }
  }

  if (ready === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-sm text-red-600">{t('auth.reset.invalidLink')}</p>
          <Link to="/forgot-password" className="text-sm text-[#4B2E83] underline">
            {t('auth.reset.requestNew')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">{t('auth.reset.title')}</h1>
        {done ? (
          <p className="text-sm text-green-700">{t('auth.reset.success')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium">
                {t('auth.reset.newPassword')}
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={MIN_LEN}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium">
                {t('auth.reset.confirmPassword')}
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={ready !== 'ok'}
              className="w-full rounded bg-[#4B2E83] px-4 py-2 text-white disabled:opacity-60"
            >
              {t('auth.reset.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
```

Note pour l'implémenteur : `id`/`htmlFor` alignés (`new-password`, `confirm-password`) pour que `getByLabelText` retrouve les champs.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/resetPasswordPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc -b`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/components/auth/ResetPasswordPage.tsx src/__tests__/resetPasswordPage.test.tsx
git commit -m "feat(auth): page /reset-password flow-agnostic (Chantier D)"
```

---

### Task 5: Câblage routes + lien login

**Files:**
- Modify: `src/router.tsx` (ajout des 2 routes publiques + imports lazy)
- Modify: `src/components/auth/LoginPage.tsx` (lien « Mot de passe oublié ? »)
- Test: `src/__tests__/recoveryRoutes.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `ForgotPasswordPage` (Task 3), `ResetPasswordPage` (Task 4), clé `auth.forgotLink` (Task 2).
- Produces: routes `/forgot-password` et `/reset-password` accessibles publiquement.

- [ ] **Step 1: Write the failing test**

Créer `src/__tests__/recoveryRoutes.test.tsx` (vérifie que les 2 routes publiques existent dans la config du router, hors PrivateRoute) :

```tsx
import { describe, it, expect } from 'vitest';
import { router } from '@/router';

function paths(routes: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const r of routes as Array<{ path?: string; children?: unknown[] }>) {
    if (r.path) out.push(r.path);
  }
  return out;
}

it('expose /forgot-password et /reset-password comme routes de premier niveau (publiques)', () => {
  const topLevel = paths(router.routes as unknown[]);
  expect(topLevel).toContain('/forgot-password');
  expect(topLevel).toContain('/reset-password');
});
```

⚠️ Si `router.routes` n'est pas directement introspectable dans cette version, remplacer l'assertion par un test RTL montant `<RouterProvider>` sur une `createMemoryRouter` partageant le même tableau de routes exporté. Extraire le tableau de routes dans une const exportée `routes` de `src/router.tsx` si besoin, et faire porter le test dessus.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/recoveryRoutes.test.tsx`
Expected: FAIL — routes absentes.

- [ ] **Step 3: Write minimal implementation**

Dans `src/router.tsx`, ajouter les imports lazy près des autres `withSuspense` (adapter au style existant — les pages n'ont pas besoin d'être lazy, un import direct suffit) :

```tsx
import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage';
```

Puis dans le tableau passé à `createBrowserRouter`, juste après le bloc `{ path: '/login', element: <LoginPage /> }` :

```tsx
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
```

Dans `src/components/auth/LoginPage.tsx`, ajouter l'import du `Link` et le lien sous le formulaire. En haut :

```tsx
import { useNavigate, Link } from 'react-router-dom';
```

Puis, à l'intérieur du panneau de connexion (après le bouton submit du `<form>`, à l'endroit approprié du markup existant), ajouter :

```tsx
          <Link
            to="/forgot-password"
            style={{ display: 'block', marginTop: 12, fontSize: 14, color: WOSM_PURPLE }}
          >
            {t('auth.forgotLink')}
          </Link>
```

Note : `t` est déjà disponible (`const { t, i18n } = useTranslation()`). Placer le lien dans le bloc du formulaire de droite, pas dans le panneau brand de gauche.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/recoveryRoutes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full gates (tsc + suite + build)**

Run:
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
node node_modules/typescript/bin/tsc -b
node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'
node node_modules/vite/bin/vite.js build
```
Expected: tsc exit 0 ; suite entièrement verte (les nouveaux tests inclus) ; build OK.

- [ ] **Step 6: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/router.tsx src/components/auth/LoginPage.tsx src/__tests__/recoveryRoutes.test.tsx
git commit -m "feat(auth): routes /forgot-password + /reset-password + lien login (Chantier D)"
```

---

### Task 6: Runbook ops — GoTrue → Gmail SMTP (exécuté à l'apply)

**Files:**
- Create: `docs/superpowers/runbooks/2026-08-18-chantier-d-ops-gotrue-smtp.md`

Cette tâche produit le **runbook** exécuté quand le firewall VPS est rouvert ; elle ne modifie pas de code applicatif et n'a pas de test unitaire — la vérification est le smoke réel documenté dedans. Le runbook doit contenir, dans l'ordre, les commandes exactes à adapter après l'inspection live.

- [ ] **Step 1: Écrire le runbook**

Créer `docs/superpowers/runbooks/2026-08-18-chantier-d-ops-gotrue-smtp.md` avec les sections suivantes (contenu complet, pas de placeholder) :

```markdown
# Runbook ops — Chantier D : GoTrue GSAT → Gmail SMTP

## Pré-requis
- Firewall hPanel Hostinger : rouvrir l'egress dev (bloc /24 courant, cf. gotcha `/24`)
  sur 22/80/443. Vérifier : `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 'echo OK'`.
- App Password Gmail de `digitaltily@gmail.com` (16 caractères) en main — secret,
  jamais collé dans un commit ni un log.
- WARP off.

## 0. Backup
    ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      'cp /var/www/gsat/supabase/config.toml /root/config.toml.bak-$(date +%Y%m%d-%H%M%S); \
       docker inspect supabase_auth_gsat > /root/auth_inspect_pre_D.json'

## 1. Inspection live (fige le modèle de gestion + noms de vars)
    ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      'docker inspect supabase_auth_gsat --format "{{range .Config.Env}}{{println .}}{{end}}"' \
      | grep -iE 'SMTP|MAILER|SITE_URL|EXTERNAL_URL|URI_ALLOW|AUTOCONFIRM|PASSWORD_MIN'
- Noter : GOTRUE_SMTP_* actuels, GOTRUE_SITE_URL, API_EXTERNAL_URL/GOTRUE_API_EXTERNAL_URL,
  GOTRUE_URI_ALLOW_LIST, GOTRUE_MAILER_AUTOCONFIRM, GOTRUE_PASSWORD_MIN_LENGTH.
- Déterminer le modèle : env fourni par config.toml (stack CLI) vs env docker direct.
  → conditionne l'étape 3 (persistance) et 4 (restart scope).

## 2. Valeurs cibles
- GOTRUE_SMTP_HOST=smtp.gmail.com
- GOTRUE_SMTP_PORT=587        # STARTTLS d'abord ; si échec TLS aux logs, tester 465
- GOTRUE_SMTP_USER=digitaltily@gmail.com
- GOTRUE_SMTP_PASS=<App Password>          # secret
- GOTRUE_SMTP_ADMIN_EMAIL=digitaltily@gmail.com
- GOTRUE_SMTP_SENDER_NAME=GSAT — TEM Madagascar
- GOTRUE_SITE_URL=https://gsat.tily-digital.com
- (API externe)=https://gsat-api.tily-digital.com
- GOTRUE_URI_ALLOW_LIST inclut EXACTEMENT https://gsat.tily-digital.com/reset-password
- GOTRUE_MAILER_AUTOCONFIRM=true           # conservé
- Vérifier GOTRUE_PASSWORD_MIN_LENGTH ≤ 8 (l'UI impose 8).

## 3. Appliquer (selon modèle de l'étape 1)
- Si config.toml [auth] / [auth.email.smtp] : éditer config.toml (backup fait),
  renseigner host/port/user/pass/admin_email/sender_name, site_url, external_url,
  additional_redirect_urls.
- Persistance : le secret PASS peut être injecté via env/secret plutôt qu'en clair
  dans config.toml selon ce que lit le stack — choisir la voie qui persiste ET
  garde le secret root-only.

## 4. Redémarrer (scope minimal)
- Si possible, ne redémarrer que l'auth : `docker restart supabase_auth_gsat`.
- Si le stack est CLI et n'applique le config.toml qu'au boot complet :
  `supabase stop && supabase start` dans /var/www/gsat (⚠️ brève coupure de tous
  les conteneurs gsat + interaction possible avec le secret JWT custom — prévenir).

## 5. Vérifier le fallback SPA nginx (pas une hypothèse)
    curl -I https://gsat.tily-digital.com/reset-password
- Attendu : 200 servant index.html (pas 404). Sinon ajouter `try_files $uri /index.html;`
  au bloc nginx du frontend et `nginx -t && systemctl reload nginx`.

## 6. Smoke end-to-end
1. Depuis le navigateur : /forgot-password → email d'un compte réel de test
   (ex. une boîte que tu contrôles ; à défaut, admin). ⚠️ Rate-limit GoTrue :
   ~60 s entre deux demandes pour le même email + cap horaire → ne pas confondre
   un 429 avec « email cassé ».
2. Surveiller les logs auth en parallèle :
   `ssh … 'docker logs -f --tail 50 supabase_auth_gsat'` — repérer un envoi OK
   ou une erreur TLS/handshake (→ bascule port 465).
3. Réception de l'email → cliquer le lien → doit atterrir sur /reset-password
   (page « choisir un nouveau mot de passe », pas « lien invalide »).
   - Si « lien invalide » : vérifier flow. Si l'URL contient `?code=`, la page
     tente déjà l'échange ; si elle contient `#access_token`, detectSessionInUrl
     suffit. Si échec persistant PKCE, ajouter `flowType: 'pkce'` dans
     src/services/supabase.ts (auth options) puis re-déployer le frontend.
4. Saisir un nouveau mot de passe (≥ 8) → succès → redirection /login → se
   connecter avec le nouveau mot de passe.
5. Rejouer avec un compte responsable_asn (ex. ant.01@tem.mg) pour confirmer le
   chemin réel des 33.

## 7. Rollback
- Restaurer config.toml depuis /root/config.toml.bak-* + restart auth.
```

- [ ] **Step 2: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add docs/superpowers/runbooks/2026-08-18-chantier-d-ops-gotrue-smtp.md
git commit -m "docs(chantier-d): runbook ops GoTrue → Gmail SMTP + smoke recovery"
```

---

## Après le plan

- Frontend (Tasks 1→5) : ouvrir une PR `feat/chantier-d-recovery` → master, revue whole-branch, merge, déployer le frontend (rsync `dist/` → `/var/www/gsat-frontend`, cf. runbook LOT 4 Indice).
- Ops (Task 6) : exécuter le runbook quand le firewall est rouvert + App Password fourni.
- Smoke end-to-end en prod ; si flow PKCE révélé, ajuster `flowType` (petit patch frontend + redeploy).
- Follow-up hors périmètre : templates d'email brandés FR ; config SMTP réelle partagée avec les autres apps si voulu.
