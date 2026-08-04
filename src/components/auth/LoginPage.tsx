import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { login } from '@/services/authService';

// WOSM brand constants
const WOSM_YELLOW = '#FDB714';
const WOSM_PURPLE = '#4B2E83';
const WOSM_PURPLE_LIGHT = '#6B4FA3';
const WOSM_PURPLE_DARK = '#351F63';

/* Motif geometrique losanges — opacite 10% */
const DIAMOND_PATTERN = `
  <svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
    <path d='M24 4 L44 24 L24 44 L4 24 Z' fill='none' stroke='white' stroke-width='0.8' opacity='0.08'/>
  </svg>
`;
const PATTERN_URI = `data:image/svg+xml,${encodeURIComponent(DIAMOND_PATTERN)}`;

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* -- Panneau gauche -- Brand WOSM Purple -------------------------------- */}
      <div
        className="hidden lg:flex"
        style={{
          width: '55%',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${WOSM_PURPLE_DARK} 0%, ${WOSM_PURPLE} 50%, ${WOSM_PURPLE_LIGHT} 100%)`,
        }}
        aria-hidden="true"
      >
        {/* Motif losanges */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: `url("${PATTERN_URI}")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Blob decoratif — jaune WOSM */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '360px',
            height: '360px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(253, 183, 20, 0.12) 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '-80px',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            pointerEvents: 'none',
          }}
        />

        {/* Contenu centre */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            padding: '48px',
          }}
        >
          {/* Shield GSAT */}
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '20px',
              background: WOSM_YELLOW,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '28px',
              boxShadow: `0 8px 32px rgba(0,0,0,0.25), 0 0 0 4px rgba(253, 183, 20, 0.25)`,
            }}
          >
            <svg viewBox="0 0 32 32" width="46" height="46" fill="none">
              <path
                d="M16 2L5 7v8c0 7 4.7 13.5 11 15.5C22.3 28.5 27 22 27 15V7L16 2z"
                fill={WOSM_PURPLE}
              />
              <text
                x="16" y="19"
                textAnchor="middle"
                fontSize="6"
                fontWeight="bold"
                fill={WOSM_YELLOW}
                fontFamily="system-ui, sans-serif"
                letterSpacing="-0.5"
              >
                GSAT
              </text>
            </svg>
          </div>

          {/* Titre */}
          <h1
            style={{
              color: '#ffffff',
              fontSize: '36px',
              fontWeight: 800,
              fontFamily: 'var(--font-headline)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              textAlign: 'center',
              marginBottom: '8px',
            }}
          >
            GSAT Digital
          </h1>
          <p
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '15px',
              lineHeight: 1.5,
              textAlign: 'center',
              marginBottom: '44px',
            }}
          >
            Outil d&rsquo;evaluation qualite officiel WOSM
          </p>

          {/* Feature pills */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
              maxWidth: '320px',
            }}
          >
            {[
              { text: '10 dimensions WOSM V3.0', icon: 'verified' },
              { text: "Plan d'action integre", icon: 'moving' },
              { text: 'Cartographie mondiale', icon: 'public' },
            ].map(feature => (
              <div
                key={feature.text}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderRadius: 'var(--radius-xl)',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ color: WOSM_YELLOW, fontSize: '18px', flexShrink: 0 }}
                >
                  {feature.icon}
                </span>
                <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', textAlign: 'center', paddingBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: WOSM_YELLOW }} />
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em' }}>
              &copy; 2025 WOSM &middot; OMMS
            </p>
          </div>
        </div>
      </div>

      {/* -- Panneau droit -- Formulaire ---------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          position: 'relative',
          background: 'var(--bg)',
        }}
        className="lg:w-[45%]"
      >
        {/* Switch langue */}
        <div style={{ position: 'absolute', top: '20px', right: '24px', zIndex: 10 }}>
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--surface-container)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background 150ms ease, color 150ms ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = '#EDE7F6';
              el.style.color = WOSM_PURPLE;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'var(--surface-container)';
              el.style.color = 'var(--text-secondary)';
            }}
            aria-label={i18n.language === 'fr' ? 'Switch to English' : 'Passer en Francais'}
          >
            {i18n.language === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>

        {/* Centrage vertical */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            padding: '32px',
            maxWidth: '440px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Logo mobile only */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${WOSM_PURPLE} 0%, ${WOSM_PURPLE_LIGHT} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 14px rgba(75, 46, 131, 0.35)`,
              }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
                <path
                  d="M16 2L5 7v8c0 7 4.7 13.5 11 15.5C22.3 28.5 27 22 27 15V7L16 2z"
                  fill={WOSM_YELLOW}
                />
                <text
                  x="16" y="19"
                  textAnchor="middle"
                  fontSize="6"
                  fontWeight="bold"
                  fill={WOSM_PURPLE}
                  fontFamily="system-ui, sans-serif"
                >
                  GSAT
                </text>
              </svg>
            </div>
          </div>

          {/* Titre */}
          <div style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: '26px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text)',
                marginBottom: '6px',
                lineHeight: 1.1,
              }}
            >
              Connexion
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Accedez a votre espace d&rsquo;evaluation
            </p>
          </div>

          {/* Formulaire */}
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            noValidate
          >
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="label-caps"
                style={{ display: 'block', marginBottom: '6px' }}
              >
                {t('auth.email')}
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="vous@organisation.com"
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius-lg)',
                  padding: '11px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  lineHeight: 1.5,
                  transition: 'border-color 200ms ease, box-shadow 200ms ease',
                  background: 'var(--surface-container-highest)',
                  border: `2px solid ${emailFocused ? WOSM_PURPLE : 'transparent'}`,
                  boxShadow: emailFocused ? `0 0 0 3px rgba(75, 46, 131, 0.1)` : 'none',
                  color: 'var(--text)',
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </div>

            {/* Mot de passe */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label
                  htmlFor="login-password"
                  className="label-caps"
                >
                  {t('auth.password')}
                </label>
                <a
                  href="#"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: WOSM_PURPLE,
                    textDecoration: 'none',
                    transition: 'opacity 150ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  Mot de passe oublie ?
                </a>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
                  width: '100%',
                  borderRadius: 'var(--radius-lg)',
                  padding: '11px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  lineHeight: 1.5,
                  transition: 'border-color 200ms ease, box-shadow 200ms ease',
                  background: 'var(--surface-container-highest)',
                  border: `2px solid ${passwordFocused ? WOSM_PURPLE : 'transparent'}`,
                  boxShadow: passwordFocused ? `0 0 0 3px rgba(75, 46, 131, 0.1)` : 'none',
                  color: 'var(--text)',
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </div>

            {/* Erreur */}
            {error && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  fontSize: '13px',
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit — WOSM purple gradient */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px 16px',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: 'var(--font-headline)',
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1,
                background: `linear-gradient(135deg, ${WOSM_PURPLE} 0%, ${WOSM_PURPLE_DARK} 100%)`,
                boxShadow: loading ? 'none' : `0 4px 14px rgba(75, 46, 131, 0.4)`,
                transition: 'opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.opacity = '0.92';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.opacity = loading ? '0.65' : '1';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
              onMouseDown={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
              }}
              onMouseUp={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span
                    className="animate-spin"
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                    }}
                  />
                  {t('common.chargement')}
                </span>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>

          {/* Footer form */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: WOSM_YELLOW }} />
            <p style={{ fontSize: '11px', color: 'var(--outline-variant)', fontWeight: 600, letterSpacing: '0.03em' }}>
              WOSM — GSAT V3.0
            </p>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: WOSM_YELLOW }} />
          </div>
        </div>
      </div>
    </div>
  );
}
