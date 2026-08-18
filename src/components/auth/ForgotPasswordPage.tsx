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
