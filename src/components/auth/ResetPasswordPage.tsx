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
