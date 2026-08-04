import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';
import type { OrgAvecScore } from '@/services/cartoService';

// ── Fix icônes Leaflet (assets cassés par Vite) ───────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'];
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Palette Stitch GSAT (hex résolus depuis wosm.css — requis pour SVG Leaflet) ──
// CSS vars ne fonctionnent pas dans les strings SVG passées à L.divIcon
const SCORE_COLORS = {
  excellent:  '#3b6934',  // --score-excellent
  moyen:      '#F59E0B',  // --score-moyen
  faible:     '#F97316',  // --score-faible
  critique:   '#ba1a1a',  // --score-critique
  sansDonnee: '#767682',  // --text-muted
} as const;

function couleurScore(score: number | undefined): string {
  if (score === undefined) return SCORE_COLORS.sansDonnee;
  if (score >= 75) return SCORE_COLORS.excellent;
  if (score >= 50) return SCORE_COLORS.moyen;
  if (score >= 25) return SCORE_COLORS.faible;
  return SCORE_COLORS.critique;
}

function creerIconeColoriee(couleur: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
        <path
          d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z"
          fill="${couleur}"
          stroke="white"
          stroke-width="1.5"
        />
        <circle cx="12" cy="12" r="5" fill="white" opacity="0.85"/>
      </svg>
    `,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

// Cache module-level : 5 couleurs possibles, créées une seule fois
const ICONES_CACHE: Record<string, L.DivIcon> = {};
function iconeColoriee(couleur: string): L.DivIcon {
  if (!ICONES_CACHE[couleur]) {
    ICONES_CACHE[couleur] = creerIconeColoriee(couleur);
  }
  return ICONES_CACHE[couleur]!;
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface WorldMapProps {
  orgs: OrgAvecScore[];
}

export function WorldMap({ orgs }: WorldMapProps) {
  const { t } = useTranslation();

  const orgsAvecCoords = orgs.filter(
    item => item.org.coordonnees?.lat != null && item.org.coordonnees?.lng != null
  );

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={10}
      className="h-full w-full"
      worldCopyJump
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {orgsAvecCoords.map(({ org, stats }) => {
        const score = stats?.scoreGlobal;
        const couleur = couleurScore(score);
        const icone = iconeColoriee(couleur);

        return (
          <Marker
            key={org.id}
            position={[org.coordonnees!.lat, org.coordonnees!.lng]}
            icon={icone}
          >
            <Popup>
              <div style={{ minWidth: '180px', fontFamily: 'var(--font-body)' }}>
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: '13px',
                    color: 'var(--text)',
                    marginBottom: '2px',
                  }}
                >
                  {org.nom}
                </p>
                {org.code && (
                  <p
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {org.code}
                  </p>
                )}
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {t('cartographie.popup.score')} :&nbsp;
                  {score != null ? (
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '15px',
                        color: couleur,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {score}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {t('cartographie.popup.sansDonnee')}
                    </span>
                  )}
                </p>
                <Link
                  to={`/campagnes?orgId=${org.id}`}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                >
                  {t('cartographie.popup.voirEvaluation')} →
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
