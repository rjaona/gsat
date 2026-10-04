import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionPriorite, AppuiFaritany } from '@/types';
import type { ActionAppuiForm } from '@/services/appuiService';

export interface CaptureAppuiProps {
  appui: AppuiFaritany | null;
  referents: { id: string; nom: string }[];
  essentielsKO: { code: string; libelle: string }[];
  /** null = détail en cours de chargement. */
  peutCreerAction: boolean | null;
  busy: boolean;
  error: string | null;
  onOuvrir: (input: { referentUserId: string | null; note: string | null }) => void;
  onMettreAJour: (input: { referentUserId: string | null; note: string | null }) => void;
  onClore: () => void;
  onCreerAction: (form: ActionAppuiForm) => Promise<boolean>;
}

const PRIORITES: ActionPriorite[] = ['critique', 'haute', 'moyenne', 'basse'];
const VIDE = { objectif: '', domaine: '', echeance: '', priorite: 'haute' as ActionPriorite, responsable: '', critere: '' };
const champ = 'w-full rounded-lg border border-[#c6c5d4] px-3 py-2 text-sm';
const etiquette = 'block text-xs font-semibold text-[#454651] mb-1';

export function CaptureAppui(p: CaptureAppuiProps) {
  const { t } = useTranslation();
  const [referent, setReferent] = useState(p.appui?.referentUserId ?? '');
  const [note, setNote] = useState(p.appui?.note ?? '');
  const [f, setF] = useState(VIDE);

  // Resynchronise quand on change de Faritany / d'appui.
  useEffect(() => {
    setReferent(p.appui?.referentUserId ?? '');
    setNote(p.appui?.note ?? '');
  }, [p.appui?.id, p.appui?.referentUserId, p.appui?.note]);

  const etat = { referentUserId: referent || null, note: note.trim() || null };
  const formValide = f.objectif.trim() !== '' && f.domaine.trim() !== '' && f.echeance !== '';

  async function soumettre() {
    const ok = await p.onCreerAction({
      objectif: f.objectif.trim(),
      domaineAmelioration: f.domaine.trim(),
      dateEcheance: f.echeance,
      priorite: f.priorite,
      responsable: f.responsable.trim(),
      ...(f.critere ? { critereCode: f.critere } : {}),
    });
    if (ok) setF(VIDE);
  }

  return (
    <div className="space-y-6 border-t border-[#eceef4] pt-5">
      {p.error && <div role="alert" className="p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm">{p.error}</div>}

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-[#15236e]">{t('pages.pilotageNational.captureTitre', 'Appui national')}</h4>
        {p.appui && (
          <p className="text-sm font-semibold text-[#15236e]">
            {t('pages.pilotageNational.enAppuiDepuis', 'En appui depuis le {{date}}', { date: p.appui.ouvertAt.slice(0, 10) })}
          </p>
        )}
        <div>
          <label htmlFor="appui-referent" className={etiquette}>{t('pages.pilotageNational.referent', 'Référent national')}</label>
          <select id="appui-referent" className={champ} value={referent} onChange={e => setReferent(e.target.value)}>
            <option value="">{t('pages.pilotageNational.aucunReferent', '— Aucun —')}</option>
            {p.referents.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="appui-note" className={etiquette}>{t('pages.pilotageNational.note', 'Note')}</label>
          <textarea id="appui-note" rows={2} className={champ} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        {p.appui ? (
          <div className="flex gap-2">
            <button type="button" disabled={p.busy} onClick={() => p.onMettreAJour(etat)} className="px-3 py-2 rounded-lg bg-[#15236e] text-white text-sm font-semibold disabled:opacity-50">
              {t('pages.pilotageNational.enregistrer', 'Enregistrer')}
            </button>
            <button type="button" disabled={p.busy} onClick={p.onClore} className="px-3 py-2 rounded-lg border border-[#c6c5d4] text-sm font-semibold disabled:opacity-50">
              {t('pages.pilotageNational.clore', 'Clore l’appui')}
            </button>
          </div>
        ) : (
          <button type="button" disabled={p.busy} onClick={() => p.onOuvrir(etat)} className="px-3 py-2 rounded-lg bg-[#15236e] text-white text-sm font-semibold disabled:opacity-50">
            {t('pages.pilotageNational.marquer', 'Marquer en appui')}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-[#15236e]">{t('pages.pilotageNational.actionTitre', 'Créer une action d’appui')}</h4>
        {p.peutCreerAction === null ? (
          <p className="text-sm text-[#767682]">{t('common.chargement', 'Chargement…')}</p>
        ) : !p.peutCreerAction ? (
          <p className="text-sm text-[#767682]">{t('pages.pilotageNational.actionImpossible', 'Aucune évaluation validée : impossible de créer une action d’appui.')}</p>
        ) : (
          <>
            <div>
              <label htmlFor="aa-objectif" className={etiquette}>{t('pages.pilotageNational.objectif', 'Objectif')}</label>
              <input id="aa-objectif" className={champ} value={f.objectif} onChange={e => setF({ ...f, objectif: e.target.value })} />
            </div>
            <div>
              <label htmlFor="aa-domaine" className={etiquette}>{t('pages.pilotageNational.domaine', 'Domaine d’amélioration')}</label>
              <input id="aa-domaine" className={champ} value={f.domaine} onChange={e => setF({ ...f, domaine: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="aa-echeance" className={etiquette}>{t('pages.pilotageNational.echeanceLabel', 'Échéance')}</label>
                <input id="aa-echeance" type="date" className={champ} value={f.echeance} onChange={e => setF({ ...f, echeance: e.target.value })} />
              </div>
              <div>
                <label htmlFor="aa-priorite" className={etiquette}>{t('pages.pilotageNational.priorite', 'Priorité')}</label>
                <select id="aa-priorite" className={champ} value={f.priorite} onChange={e => setF({ ...f, priorite: e.target.value as ActionPriorite })}>
                  {PRIORITES.map(pr => <option key={pr} value={pr}>{t(`pages.pilotageNational.priorites.${pr}`, pr)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="aa-responsable" className={etiquette}>{t('pages.pilotageNational.responsable', 'Responsable')}</label>
              <input id="aa-responsable" className={champ} value={f.responsable} onChange={e => setF({ ...f, responsable: e.target.value })} />
            </div>
            <div>
              <label htmlFor="aa-critere" className={etiquette}>{t('pages.pilotageNational.critere', 'Critère essentiel visé')}</label>
              <select id="aa-critere" className={champ} value={f.critere} onChange={e => setF({ ...f, critere: e.target.value })}>
                <option value="">{t('pages.pilotageNational.aucunCritere', '— Aucun —')}</option>
                {p.essentielsKO.map(k => <option key={k.code} value={k.code}>{k.code} — {k.libelle}</option>)}
              </select>
            </div>
            <button type="button" disabled={!formValide || p.busy} onClick={() => void soumettre()} className="px-3 py-2 rounded-lg bg-[#15236e] text-white text-sm font-semibold disabled:opacity-50">
              {t('pages.pilotageNational.creerAction', 'Créer l’action d’appui')}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
