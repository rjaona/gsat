/**
 * SystemConfig — Configuration du système GSAT
 * Source Stitch : configuration_du_syst_me_gsat/code.html
 * Sidebar anchor links, 2-col grid, section cards
 * Persistance Supabase : table system_config
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

// ── Toggle switch ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 transition-colors"
      style={{
        width: 44,
        height: 24,
        background: checked ? 'var(--primary)' : 'var(--surface-container-highest)',
        borderRadius: 'var(--radius-full)',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <span
        className="absolute top-0.5 transition-transform"
        style={{
          left: 2,
          width: 20,
          height: 20,
          background: 'white',
          borderRadius: '50%',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: 'var(--shadow-sm)',
        }}
      />
    </button>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function ConfigSection({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 flex items-center justify-center"
          style={{
            background: 'var(--surface-container)',
            color: 'var(--primary)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <Icon name={icon} size={20} />
        </div>
        <h3
          className="text-xl font-bold"
          style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-headline)' }}
        >
          {title}
        </h3>
      </div>
      <div
        className="p-8"
        style={{
          background: 'var(--surface-container-lowest)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid rgba(198,197,210,0.1)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

interface SystemConfigData {
  siteName: string;
  primaryLang: string;
  timezone: string;
  emailAlerts: boolean;
  criticalOnly: boolean;
  digestFreq: string;
  mfa: boolean;
  sessionTimeout: string;
  auditLog: boolean;
  ipWhitelist: boolean;
}

const DEFAULT_CONFIG: SystemConfigData = {
  siteName: 'GSAT Enterprise Global',
  primaryLang: 'fr',
  timezone: 'UTC+3',
  emailAlerts: true,
  criticalOnly: false,
  digestFreq: 'weekly',
  mfa: true,
  sessionTimeout: '120',
  auditLog: true,
  ipWhitelist: false,
};

const COL_SYSTEM_CONFIG = 'system_config';

// ── Main ───────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'general',       icon: 'tune',                  label: 'Général' },
  { id: 'notifications', icon: 'notifications_active',   label: 'Notifications' },
  { id: 'security',      icon: 'security',               label: 'Sécurité' },
  { id: 'branding',      icon: 'palette',                label: 'Marque' },
  { id: 'integration',   icon: 'webhook',                label: 'Intégrations' },
];

export function SystemConfig() {
  const { t } = useTranslation();
  const { orgId } = useAuthStore();
  const [activeSection, setActiveSection] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionTimeoutError, setSessionTimeoutError] = useState<string | null>(null);

  // General
  const [siteName, setSiteName] = useState(DEFAULT_CONFIG.siteName);
  const [primaryLang, setPrimaryLang] = useState(DEFAULT_CONFIG.primaryLang);
  const [timezone, setTimezone] = useState(DEFAULT_CONFIG.timezone);

  // Notifications
  const [emailAlerts, setEmailAlerts] = useState(DEFAULT_CONFIG.emailAlerts);
  const [criticalOnly, setCriticalOnly] = useState(DEFAULT_CONFIG.criticalOnly);
  const [digestFreq, setDigestFreq] = useState(DEFAULT_CONFIG.digestFreq);

  // Security
  const [mfa, setMfa] = useState(DEFAULT_CONFIG.mfa);
  const [sessionTimeout, setSessionTimeout] = useState(DEFAULT_CONFIG.sessionTimeout);
  const [auditLog, setAuditLog] = useState(DEFAULT_CONFIG.auditLog);
  const [ipWhitelist, setIpWhitelist] = useState(DEFAULT_CONFIG.ipWhitelist);

  const mainRef = useRef<HTMLDivElement>(null);

  // ── Load config from Supabase ──
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    async function loadConfig() {
      try {
        const { data, error } = await supabase
          .from(COL_SYSTEM_CONFIG)
          .select('*')
          .eq('org_id', orgId!)
          .maybeSingle();
        if (error) throw error;
        if (cancelled || !data) return;
        const cfg = data as Record<string, unknown>;
        setSiteName((cfg['site_name']         ?? DEFAULT_CONFIG.siteName)      as string);
        setPrimaryLang((cfg['primary_lang']   ?? DEFAULT_CONFIG.primaryLang)   as string);
        setTimezone((cfg['timezone']          ?? DEFAULT_CONFIG.timezone)       as string);
        setEmailAlerts((cfg['email_alerts']   ?? DEFAULT_CONFIG.emailAlerts)   as boolean);
        setCriticalOnly((cfg['critical_only'] ?? DEFAULT_CONFIG.criticalOnly)  as boolean);
        setDigestFreq((cfg['digest_freq']     ?? DEFAULT_CONFIG.digestFreq)    as string);
        setMfa((cfg['mfa']                   ?? DEFAULT_CONFIG.mfa)            as boolean);
        setSessionTimeout((cfg['session_timeout'] ?? DEFAULT_CONFIG.sessionTimeout) as string);
        setAuditLog((cfg['audit_log']         ?? DEFAULT_CONFIG.auditLog)      as boolean);
        setIpWhitelist((cfg['ip_whitelist']   ?? DEFAULT_CONFIG.ipWhitelist)   as boolean);
      } catch (err) {
        console.error('[SystemConfig] loadConfig failed:', err);
        if (!cancelled) setLoadError(t('common.error'));
      }
    }

    void loadConfig();
    return () => { cancelled = true; };
  }, [orgId, t]);

  // ── Save config to Supabase ──
  const handleSave = useCallback(async () => {
    if (!orgId) return;

    const parsedTimeout = parseInt(sessionTimeout, 10);
    if (isNaN(parsedTimeout) || parsedTimeout < 5 || parsedTimeout > 1440) {
      setSessionTimeoutError(
        t('settings.sessionTimeoutError', 'La durée de session doit être comprise entre 5 et 1440 minutes.')
      );
      return;
    }
    setSessionTimeoutError(null);

    setSaving(true);
    setSaveSuccess(false);
    try {
      const configData: SystemConfigData = {
        siteName,
        primaryLang,
        timezone,
        emailAlerts,
        criticalOnly,
        digestFreq,
        mfa,
        sessionTimeout,
        auditLog,
        ipWhitelist,
      };
      const { error: upsertError } = await supabase
        .from(COL_SYSTEM_CONFIG)
        .upsert({
          org_id:          orgId,
          site_name:       configData.siteName,
          primary_lang:    configData.primaryLang,
          timezone:        configData.timezone,
          email_alerts:    configData.emailAlerts,
          critical_only:   configData.criticalOnly,
          digest_freq:     configData.digestFreq,
          mfa:             configData.mfa,
          session_timeout: configData.sessionTimeout,
          audit_log:       configData.auditLog,
          ip_whitelist:    configData.ipWhitelist,
        }, { onConflict: 'org_id' });
      if (upsertError) throw upsertError;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('[SystemConfig] save failed:', err);
      alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  }, [orgId, siteName, primaryLang, timezone, emailAlerts, criticalOnly, digestFreq, mfa, sessionTimeout, auditLog, ipWhitelist, t]);

  function scrollTo(id: string) {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto w-full">

      {/* Header */}
      <div className="mb-10">
        <h2
          className="text-3xl font-extrabold tracking-tight mb-2"
          style={{ color: 'var(--primary)', fontFamily: 'var(--font-headline)' }}
        >
          {t('settings.title', 'Parametres Systeme')}
        </h2>
        <p style={{ color: 'var(--on-surface-variant)' }}>
          {t('settings.subtitle', 'Configurez les parametres globaux et les protocoles de securite institutionnels.')}
        </p>
      </div>

      {loadError && (
        <div
          className="mb-6 p-4 text-sm font-medium"
          style={{
            background: 'var(--error-container)',
            color: 'var(--on-error-container)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── Sidebar anchor nav ── */}
        <nav className="lg:col-span-3 space-y-6" aria-label="Sections de configuration">
          <div>
            <p className="label-caps mb-4 px-2" style={{ color: 'var(--outline)' }}>Configuration</p>
            <ul className="space-y-1">
              {NAV_SECTIONS.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollTo(s.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-all"
                    style={{
                      background: activeSection === s.id ? 'var(--surface-container-low)' : 'transparent',
                      color: activeSection === s.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                      fontWeight: activeSection === s.id ? 700 : 400,
                      borderRadius: 'var(--radius-xl)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => {
                      if (activeSection !== s.id) {
                        (e.currentTarget as HTMLElement).style.background = 'var(--surface-container)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (activeSection !== s.id) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon name={s.icon} size={20} />
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Save shortcut */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'var(--gradient-primary)',
              color: 'white',
              borderRadius: 'var(--radius-xl)',
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(21,35,110,0.25)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Icon name={saving ? 'hourglass_empty' : 'save'} size={16} />
            {saving
              ? t('common.saving', 'Sauvegarde...')
              : t('settings.saveAll', 'Sauvegarder tout')}
          </button>

          {saveSuccess && (
            <p
              className="text-xs font-semibold text-center"
              style={{ color: 'var(--secondary)' }}
            >
              {t('settings.saved', 'Parametres sauvegardes')}
            </p>
          )}
        </nav>

        {/* ── Settings forms ── */}
        <div ref={mainRef} className="lg:col-span-9 space-y-12">

          {/* General */}
          <ConfigSection id="general" icon="public" title={t('settings.general', 'Parametres Generaux')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label
                  htmlFor="siteName"
                  className="label-caps block px-1"
                >
                  {t('settings.siteName', 'Nom du site institutionnel')}
                </label>
                <input
                  id="siteName"
                  type="text"
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  className="w-full px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: 'var(--surface-container-highest)',
                    border: '2px solid transparent',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--on-surface)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--surface-container-lowest)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'var(--surface-container-highest)';
                  }}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="primaryLang"
                  className="label-caps block px-1"
                >
                  {t('settings.language', 'Langue principale')}
                </label>
                <select
                  id="primaryLang"
                  value={primaryLang}
                  onChange={e => setPrimaryLang(e.target.value)}
                  className="w-full px-4 py-3 text-sm outline-none appearance-none"
                  style={{
                    background: 'var(--surface-container-highest)',
                    border: '2px solid transparent',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--on-surface)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--surface-container-lowest)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'var(--surface-container-highest)';
                  }}
                >
                  <option value="fr">Francais</option>
                  <option value="en">English</option>
                  <option value="es">Espanol</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="timezone"
                  className="label-caps block px-1"
                >
                  {t('settings.timezone', 'Fuseau horaire')}
                </label>
                <select
                  id="timezone"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 text-sm outline-none appearance-none"
                  style={{
                    background: 'var(--surface-container-highest)',
                    border: '2px solid transparent',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--on-surface)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--surface-container-lowest)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'var(--surface-container-highest)';
                  }}
                >
                  {['UTC', 'UTC+1', 'UTC+2', 'UTC+3', 'UTC+5:30', 'UTC-5'].map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          </ConfigSection>

          {/* Notifications */}
          <ConfigSection id="notifications" icon="notifications_active" title="Notifications">
            <div className="space-y-6">
              {[
                { label: t('settings.emailAlerts', 'Alertes par email'), sub: t('settings.emailAlertsSub', 'Recevoir des notifications par email pour chaque evenement'), checked: emailAlerts, onChange: setEmailAlerts, id: 'emailAlerts' },
                { label: t('settings.criticalOnly', 'Alertes critiques uniquement'), sub: t('settings.criticalOnlySub', 'Filtrer les notifications pour ne recevoir que les alertes critiques'), checked: criticalOnly, onChange: setCriticalOnly, id: 'criticalOnly' },
              ].map(row => (
                <div key={row.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{row.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>{row.sub}</p>
                  </div>
                  <Toggle checked={row.checked} onChange={row.onChange} id={row.id} />
                </div>
              ))}
              <div className="space-y-2 pt-4" style={{ borderTop: '1px solid rgba(198,197,210,0.15)' }}>
                <label htmlFor="digestFreq" className="label-caps block px-1">
                  {t('settings.digestFreq', 'Frequence du digest')}
                </label>
                <select
                  id="digestFreq"
                  value={digestFreq}
                  onChange={e => setDigestFreq(e.target.value)}
                  className="w-full md:w-1/2 px-4 py-3 text-sm outline-none appearance-none"
                  style={{
                    background: 'var(--surface-container-highest)',
                    border: '2px solid transparent',
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--on-surface)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'var(--surface-container-lowest)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'var(--surface-container-highest)';
                  }}
                >
                  <option value="realtime">{t('settings.realtime', 'Temps reel')}</option>
                  <option value="daily">{t('settings.daily', 'Quotidien')}</option>
                  <option value="weekly">{t('settings.weekly', 'Hebdomadaire')}</option>
                </select>
              </div>
            </div>
          </ConfigSection>

          {/* Security */}
          <ConfigSection id="security" icon="security" title={t('settings.security', 'Securite')}>
            <div className="space-y-6">
              {[
                { label: t('settings.mfa', 'Authentification multi-facteurs (MFA)'), sub: t('settings.mfaSub', 'Obligatoire pour tous les utilisateurs admin_global'), checked: mfa, onChange: setMfa, id: 'mfa' },
                { label: t('settings.auditLog', "Journal d'audit complet"), sub: t('settings.auditLogSub', 'Enregistrer toutes les actions utilisateurs dans le journal'), checked: auditLog, onChange: setAuditLog, id: 'auditLog' },
                { label: t('settings.ipWhitelist', 'Liste blanche IP'), sub: t('settings.ipWhitelistSub', "Limiter l'acces aux adresses IP autorisees uniquement"), checked: ipWhitelist, onChange: setIpWhitelist, id: 'ipWhitelist' },
              ].map(row => (
                <div key={row.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{row.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>{row.sub}</p>
                  </div>
                  <Toggle checked={row.checked} onChange={row.onChange} id={row.id} />
                </div>
              ))}
              <div className="pt-4 space-y-2" style={{ borderTop: '1px solid rgba(198,197,210,0.15)' }}>
                <label htmlFor="sessionTimeout" className="label-caps block px-1">
                  {t('settings.sessionTimeout', 'Expiration de session (minutes)')}
                </label>
                <input
                  id="sessionTimeout"
                  type="number"
                  min={5}
                  max={1440}
                  value={sessionTimeout}
                  onChange={e => {
                    setSessionTimeout(e.target.value);
                    setSessionTimeoutError(null);
                  }}
                  className="w-full md:w-1/3 px-4 py-3 text-sm outline-none"
                  style={{
                    background: 'var(--surface-container-highest)',
                    border: `2px solid ${sessionTimeoutError ? 'var(--error)' : 'transparent'}`,
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--on-surface)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = sessionTimeoutError ? 'var(--error)' : 'var(--primary)';
                    e.currentTarget.style.background = 'var(--surface-container-lowest)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = sessionTimeoutError ? 'var(--error)' : 'transparent';
                    e.currentTarget.style.background = 'var(--surface-container-highest)';
                  }}
                />
                {sessionTimeoutError && (
                  <p className="text-xs mt-1" style={{ color: 'var(--error)' }}>
                    {sessionTimeoutError}
                  </p>
                )}
              </div>
            </div>
          </ConfigSection>

          {/* Branding */}
          <ConfigSection id="branding" icon="palette" title={t('settings.branding', 'Identite Visuelle')}>
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              {t('settings.brandingPlaceholder', 'Personnalisation du logo, des couleurs et de la charte graphique institutionnelle. Cette section sera disponible dans une prochaine version.')}
            </p>
          </ConfigSection>

          {/* Integration */}
          <ConfigSection id="integration" icon="webhook" title={t('settings.integrations', 'Integrations')}>
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              {t('settings.integrationsPlaceholder', 'Connexions API, webhooks et services tiers (SSO, Slack, etc.). Cette section sera disponible dans une prochaine version.')}
            </p>
          </ConfigSection>

          {/* Save footer */}
          <div className="flex items-center justify-end gap-4 pt-4">
            {saveSuccess && (
              <span
                className="text-sm font-semibold flex items-center gap-1"
                style={{ color: 'var(--secondary)' }}
              >
                <Icon name="check_circle" size={16} />
                {t('settings.saved', 'Parametres sauvegardes')}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 text-sm font-bold flex items-center gap-2 transition-all"
              style={{
                background: 'var(--gradient-primary)',
                color: 'white',
                borderRadius: 'var(--radius-xl)',
                border: 'none',
                cursor: saving ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(21,35,110,0.25)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              <Icon name={saving ? 'hourglass_empty' : 'save'} size={18} />
              {saving
                ? t('common.saving', 'Sauvegarde...')
                : t('settings.save', 'Enregistrer les modifications')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
