/**
 * GSAT Digital v2 — Design System Tokens
 *
 * Source de vérité : Stitch Design System (lumen_scout_heritage)
 * Validé sur la V1 : /app/src/theme/wosm.css
 *
 * Usage :
 * - Styles dynamiques (inline, logique JS, canvas jsPDF)
 * - Le bloc @theme de src/index.css expose les mêmes valeurs comme classes Tailwind
 * - En CSS statique, préférer les var() définis dans :root (src/index.css)
 */

// ─── WOSM Brand Palette ──────────────────────────────────────────────────────

export const wosmBrand = {
  /** WOSM Purple — official fleur-de-lis */
  purple:              '#4B2E83',
  purpleLight:         '#6B4FA3',
  purpleDark:          '#351F63',
  purpleContainer:     '#EDE7F6',
  onPurpleContainer:   '#3A2272',
  purpleMuted:         '#D1C4E9',
  purpleGlow:          'rgba(75, 46, 131, 0.18)',

  /** WOSM Yellow — Pantone 116C */
  yellow:              '#FDB714',
  yellowLight:         '#FEEAB0',
  yellowDark:          '#C98E00',
  yellowContainer:     '#FFF8E1',
  onYellowContainer:   '#7A5800',

  /** WOSM White */
  white:               '#FFFFFF',
} as const

// ─── Color Palette — MD3 (exact Stitch values) ───────────────────────────────

const baseColors = {
  // Primary — Deep Indigo (WOSM Scout Blue)
  primary:                  '#15236e',
  primaryContainer:         '#2e3b85',
  onPrimary:                '#ffffff',
  onPrimaryContainer:       '#9ca9fb',
  primaryFixed:             '#dee0ff',
  primaryFixedDim:          '#bbc3ff',
  onPrimaryFixed:           '#000f5c',
  onPrimaryFixedVariant:    '#33408a',
  inversePrimary:           '#bbc3ff',

  // Secondary — Forest Green
  secondary:                '#3b6934',
  secondaryContainer:       '#b9eeab',
  onSecondary:              '#ffffff',
  onSecondaryContainer:     '#3f6d38',
  secondaryFixed:           '#bcf0ae',
  secondaryFixedDim:        '#a1d494',
  onSecondaryFixed:         '#002201',
  onSecondaryFixedVariant:  '#23501e',

  // Tertiary — Charcoal
  tertiary:                 '#2a2c30',
  tertiaryContainer:        '#404246',
  onTertiary:               '#ffffff',
  onTertiaryContainer:      '#adaeb3',
  tertiaryFixed:            '#e2e2e7',
  tertiaryFixedDim:         '#c6c6cb',
  onTertiaryFixed:          '#1a1c1f',
  onTertiaryFixedVariant:   '#45474b',

  // Error — Red
  error:                    '#ba1a1a',
  errorContainer:           '#ffdad6',
  onError:                  '#ffffff',
  onErrorContainer:         '#93000a',

  // Surface & Background
  background:               '#f8f9ff',
  onBackground:             '#171c22',
  surface:                  '#f8f9ff',
  surfaceDim:               '#d6dae3',
  surfaceBright:            '#f8f9ff',
  surfaceContainerLowest:   '#ffffff',
  surfaceContainerLow:      '#f0f4fd',
  surfaceContainer:         '#eaeef7',
  surfaceContainerHigh:     '#e4e8f1',
  surfaceContainerHighest:  '#dee3eb',
  surfaceVariant:           '#dee3eb',
  surfaceTint:              '#4c58a4',
  onSurface:                '#171c22',
  onSurfaceVariant:         '#454651',
  inverseSurface:           '#2c3137',
  inverseOnSurface:         '#edf1fa',

  // Neutrals
  outline:                  '#767682',
  outlineVariant:           '#c6c5d2',
} as const

/** Palette complète — MD3 + alias sémantiques pour les composants UI */
export const colors = {
  ...baseColors,

  // WOSM brand tokens
  wosmPurple:       wosmBrand.purple,
  wosmPurpleLight:  wosmBrand.purpleLight,
  wosmPurpleDark:   wosmBrand.purpleDark,
  wosmPurpleContainer: wosmBrand.purpleContainer,
  wosmYellow:       wosmBrand.yellow,
  wosmYellowLight:  wosmBrand.yellowLight,
  wosmYellowContainer: wosmBrand.yellowContainer,

  // Alias sémantiques utilisés par les composants UI
  border:           baseColors.outlineVariant,
  text:             baseColors.onSurface,
  textMuted:        baseColors.outline,
  textSecondary:    baseColors.onSurfaceVariant,
  textInverse:      baseColors.onPrimary,
  surfaceHighest:   baseColors.surfaceContainerHighest,
  surfaceHigh:      baseColors.surfaceContainerHigh,
  surfaceLow:       baseColors.surfaceContainerLow,
  primaryHover:     baseColors.primaryContainer,
  primaryMuted:     baseColors.primaryFixedDim,
  success:          baseColors.secondary,
  successLight:     baseColors.secondaryContainer,
  warning:          '#F59E0B',
  warningLight:     '#FEF3C7',
  errorLight:       baseColors.errorContainer,
  errorText:        baseColors.onErrorContainer,
} as const

export type ColorToken = keyof typeof colors

// ─── Semantic Aliases ─────────────────────────────────────────────────────────

export const semantic = {
  bg:              colors.background,
  text:            colors.onSurface,
  textSecondary:   colors.onSurfaceVariant,
  textMuted:       colors.outline,
  textInverse:     colors.onPrimary,
  border:          colors.outlineVariant,
  borderSubtle:    colors.surfaceContainerLow,
  success:         colors.secondary,
  successLight:    colors.secondaryContainer,
  successHover:    '#2d5228',
  danger:          colors.error,
  dangerLight:     colors.errorContainer,
  warning:         '#F59E0B',
  warningLight:    '#FEF3C7',
  warningDark:     '#78350f',
  info:            '#3B82F6',
  infoLight:       '#DBEAFE',
  infoDark:        '#1e40af',
  primaryHover:    colors.primaryContainer,
  primaryLight:    colors.primaryFixed,
  primaryMuted:    colors.primaryFixedDim,
} as const

// ─── Score Colors — GSAT notation (0–3) ──────────────────────────────────────

/** Couleur du texte/icône par score GSAT */
export const scoreColors: Record<0 | 1 | 2 | 3, string> = {
  3: colors.secondary,      // Conforme — vert
  2: '#b07d00',             // Majoritaire — ambre foncé
  1: '#e97c00',             // Partiel — orange
  0: colors.error,          // Non-conforme — rouge
}

/** Couleur de fond par score GSAT */
export const scoreBgColors: Record<0 | 1 | 2 | 3, string> = {
  3: colors.secondaryContainer,
  2: '#FEF3C7',
  1: '#fff3e0',
  0: colors.errorContainer,
}

/** Score semantics nommés (pour usage dans les helpers de style) */
export const scoreSemantics = {
  excellent:      colors.secondary,   // score 3
  moyen:          '#F59E0B',          // score 2
  faible:         '#F97316',          // score 1
  critique:       colors.error,       // score 0
  faibleLight:    'rgba(249, 115, 22, 0.12)',
} as const

/** Seuils de score en pourcentage (0–100) pour la notation GSAT */
export const scoreThresholds = {
  excellent:  75,  // >= 75% → vert
  correct:    50,  // >= 50% → bleu primary
  warning:    25,  // >= 25% → orange
  // < 25% → rouge
} as const

/** Retourne la couleur texte selon un score en % */
export function scoreTextColor(score: number): string {
  if (score >= scoreThresholds.excellent) return colors.secondary
  if (score >= scoreThresholds.correct)   return colors.primary
  if (score >= scoreThresholds.warning)   return '#e97c00'
  return colors.error
}

/** Retourne la couleur fond selon un score en % */
export function scoreBgColor(score: number): string {
  if (score >= scoreThresholds.excellent) return colors.secondaryContainer
  if (score >= scoreThresholds.correct)   return colors.primaryFixed
  if (score >= scoreThresholds.warning)   return '#fff3e0'
  return colors.errorContainer
}

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    headline: "'Manrope', system-ui, -apple-system, sans-serif",
    body:     "'Inter', system-ui, -apple-system, sans-serif",
    label:    "'Inter', system-ui, -apple-system, sans-serif",
  },
  fontSize: {
    display:  '3.75rem',    // 60px — hero metrics (ex: "78.4%")
    h1:       '1.875rem',   // 30px — titres de page
    h2:       '1.5rem',     // 24px — en-têtes de section
    h3:       '1.125rem',   // 18px — en-têtes de carte
    body:     '0.875rem',   // 14px — corps de texte
    caption:  '0.75rem',    // 12px — descriptions
    label:    '0.6875rem',  // 11px — labels majuscules
    micro:    '0.625rem',   // 10px — badges, timestamps
  },
  fontWeight: {
    regular:   '400',
    medium:    '500',
    semibold:  '600',
    bold:      '700',
    extrabold: '800',
  },
  lineHeight: {
    tight:   '1.2',
    normal:  '1.5',
    relaxed: '1.75',
  },
  letterSpacing: {
    tighter:  '-0.05em',
    tight:    '-0.025em',
    wide:     '0.05em',
    widest:   '0.1em',
    label:    '0.08em',   // pour les labels uppercase
  },
} as const

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const spacing = {
  0:    '0',
  0.5:  '0.125rem',
  1:    '0.25rem',
  2:    '0.5rem',
  3:    '0.75rem',
  4:    '1rem',
  5:    '1.25rem',
  6:    '1.5rem',
  8:    '2rem',
  10:   '2.5rem',
  12:   '3rem',
  16:   '4rem',
  20:   '5rem',
  24:   '6rem',
} as const

// ─── Border Radius — Stitch spec (px, pas rem) ────────────────────────────────

export const borderRadius = {
  sm:   '2px',   // micro-interactions
  md:   '4px',   // léger arrondi
  lg:   '8px',   // inputs, boutons
  xl:   '12px',  // cartes, modals standard
  '2xl':'16px',  // cartes larges
  full: '12px',  // NOTE: Stitch = 12px, pas 9999px (pas des pills)
} as const

// ─── Elevation / Shadows — Stitch model ──────────────────────────────────────
// Y:8 Blur:24 Spread:-4 @ 6% on-surface (#171c22)

export const elevation = {
  none:    'none',
  xs:      '0 1px 2px rgba(23, 28, 34, 0.04)',
  sm:      '0 2px 4px rgba(23, 28, 34, 0.06)',
  md:      '0 4px 12px -2px rgba(23, 28, 34, 0.08)',
  lg:      '0 8px 24px -4px rgba(23, 28, 34, 0.09)',
  xl:      '0 8px 24px -4px rgba(23, 28, 34, 0.06), 0 1px 2px rgba(23, 28, 34, 0.04)',
  card:    '0 8px 24px -4px rgba(23, 28, 34, 0.06)',
  modal:   '0 20px 60px -10px rgba(23, 28, 34, 0.15)',
  tooltip: '0 4px 12px rgba(23, 28, 34, 0.08)',
} as const

// ─── Glassmorphism ────────────────────────────────────────────────────────────

export const glass = {
  bg:         'rgba(255, 255, 255, 0.85)',
  blur:       'blur(20px)',
  border:     'rgba(198, 197, 210, 0.3)',
  bgDark:     'rgba(21, 35, 110, 0.85)',
  borderDark: 'rgba(187, 195, 255, 0.15)',
} as const

// ─── Transitions ─────────────────────────────────────────────────────────────

export const transitions = {
  fast:         '100ms cubic-bezier(0.4, 0, 0.2, 1)',
  base:         '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow:         '250ms cubic-bezier(0.16, 1, 0.3, 1)',
  durationFast: '150ms',
  durationBase: '200ms',
  durationSlow: '300ms',
  easing:       'cubic-bezier(0.4, 0, 0.2, 1)',
  easingOut:    'cubic-bezier(0, 0, 0.2, 1)',
  easingSpring: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

// ─── Gradients ────────────────────────────────────────────────────────────────

export const gradients = {
  primary:    'linear-gradient(135deg, #15236e 0%, #2e3b85 100%)',
  hero:       'linear-gradient(to right, #15236e, #2e3b85)',
  wosmPurple: 'linear-gradient(135deg, #4B2E83 0%, #6B4FA3 100%)',
  wosmHero:   'linear-gradient(135deg, #351F63 0%, #4B2E83 60%, #6B4FA3 100%)',
  wosmCta:    'linear-gradient(135deg, #4B2E83 0%, #351F63 100%)',
  wosmAccent: 'linear-gradient(135deg, #4B2E83 0%, #FDB714 100%)',
} as const

// ─── Layout Constants ─────────────────────────────────────────────────────────

export const layout = {
  sidebarWidth:       '256px',   // var(--sidebar-width)
  sidebarCollapsed:   '60px',
  topNavHeight:       '64px',    // h-16
  contentPadding:     '2rem',    // p-8
  gridCols:           12,
  maxContentWidth:    '1400px',
} as const

// ─── Breakpoints ─────────────────────────────────────────────────────────────

export const breakpoints = {
  sm:   '640px',
  md:   '768px',
  lg:   '1024px',
  xl:   '1280px',
  '2xl':'1536px',
} as const

// ─── GSAT Domain Constants ────────────────────────────────────────────────────

/** Régions OMMS */
export const ommsRegions = [
  { code: 'AFRICA',        label: { fr: 'Afrique',        en: 'Africa' } },
  { code: 'ASIA_PACIFIC',  label: { fr: 'Asie-Pacifique', en: 'Asia-Pacific' } },
  { code: 'ARAB',          label: { fr: 'Arabe',          en: 'Arab' } },
  { code: 'INTERAMERICA',  label: { fr: 'Interamérique',  en: 'Interamerica' } },
  { code: 'EUROPE',        label: { fr: 'Europe',         en: 'Europe' } },
  { code: 'EURASIA',       label: { fr: 'Eurasie',        en: 'Eurasia' } },
] as const

export type OmmsRegionCode = (typeof ommsRegions)[number]['code']

/** Dimensions GSAT V3.0 */
export const gsatDimensions = [
  { code: 'D01', label: { fr: 'Obligations institutionnelles OSN-OMMS',        en: 'OSN–WOSM Institutional Obligations' },     criteriaCount: 8,  range: [101, 108]   as [number, number] },
  { code: 'D02', label: { fr: 'Cadre de la gouvernance',                        en: 'Governance Framework' },                   criteriaCount: 17, range: [201, 217]   as [number, number] },
  { code: 'D03', label: { fr: 'Cadre stratégique',                              en: 'Strategic Framework' },                    criteriaCount: 15, range: [301, 315]   as [number, number] },
  { code: 'D04', label: { fr: 'Gestion de l\'intégrité',                        en: 'Integrity Management' },                   criteriaCount: 8,  range: [401, 408]   as [number, number] },
  { code: 'D05', label: { fr: 'Communication, plaidoyer et image publique',     en: 'Communication, Advocacy & Public Image' }, criteriaCount: 8,  range: [501, 508]   as [number, number] },
  { code: 'D06', label: { fr: 'Adultes dans le Scoutisme',                      en: 'Adults in Scouting' },                     criteriaCount: 13, range: [601, 613]   as [number, number] },
  { code: 'D07', label: { fr: 'Stabilité financière & mobilisation des ressources', en: 'Financial Stability & Resource Mobilisation' }, criteriaCount: 12, range: [701, 712] as [number, number] },
  { code: 'D08', label: { fr: 'Programme des jeunes',                           en: 'Youth Programme' },                        criteriaCount: 10, range: [801, 810]   as [number, number] },
  { code: 'D09', label: { fr: 'Croissance',                                     en: 'Growth' },                                 criteriaCount: 5,  range: [901, 905]   as [number, number] },
  { code: 'D10', label: { fr: 'Amélioration continue',                          en: 'Continuous Improvement' },                 criteriaCount: 9,  range: [1001, 1009] as [number, number] },
] as const

export type DimensionCode = (typeof gsatDimensions)[number]['code']

// ─── WOSM Brand ──────────────────────────────────────────────────────────────

/** WOSM_YELLOW = Pantone 116C — accents, badges, CTAs */
export const WOSM_YELLOW = '#FDB714' as const

/** WOSM_PURPLE = violet officiel fleur-de-lis — navigation active, hero panels, accents */
export const WOSM_PURPLE = '#4B2E83' as const

// ─── Alias exports — noms courts attendus par les composants UI ───────────────

/** Alias de borderRadius */
export const radius = borderRadius

/** Alias de elevation */
export const shadow = elevation

/** Alias de transitions */
export const transition = transitions

/** Alias plat de typography.fontFamily */
export const font = {
  headline: typography.fontFamily.headline,
  body:     typography.fontFamily.body,
  label:    typography.fontFamily.label,
} as const
