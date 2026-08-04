import type { fr } from './fr';

/**
 * Malagasy — langue de travail des Faritany.
 *
 * Fichier volontairement PARTIEL. i18next retombe sur `fr` pour toute cle
 * absente : mieux vaut une cle en francais qu'une traduction automatique qui
 * fait mal comprendre un critere — et un critere mal compris est un critere
 * mal note, qui pollue toute la consolidation nationale.
 *
 * Les libelles des 76 criteres NE SONT PAS ici : ils vivent en base
 * (criteres.libelle_mg) et viendront de la fiche de validation remplie par le
 * comite TEM, traduite par des scouts et non par un traducteur.
 *
 * A completer au fil de l'eau. Le typage `DeepPartial<typeof fr>` garantit
 * qu'une cle mal orthographiee est rejetee a la compilation.
 */
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const mg: DeepPartial<typeof fr> = {
  common: {
    chargement: 'Miandry kely...',
    enregistrer: 'Tehirizo',
    annuler: 'Ajanony',
    fermer: 'Akatona',
    validate: 'Ekeo',
    back: 'Hiverina',
    next: 'Manaraka',
    previous: 'Teo aloha',
    score: 'Isa',
    progress: 'Fandrosoana',
    status: 'Toetra',
    date: 'Daty',
    actions: 'Asa',
  },
  pages: {
    dashboardFaritany: {
      title: 'Tabilaon’ny Faritany',
      scoreGlobal: 'Isa ankapobeny',
      alertes: 'Fampitandremana',
      alertesCritiques: 'Fampitandremana lehibe',
      moyenneNationale: 'Salan’isan’ny Faritany',
      planAction: 'Drafitr’asa',
    },
  },
  campagne: {
    badgeSocle: 'Fototra',
    form: {
      mode: 'Karazana fanombanana',
      modeSocle: 'Fototra',
      modeComplet: 'Feno',
      perimetre: 'Faritany voakasika',
      perimetreTout: 'Rehetra',
      perimetreRien: 'Tsy misy',
      referentielInactif: 'volavola',
    },
  },
  evaluation: {
    extension: 'Fanampiny',
    sectionExtension: 'Fanampiny — tsy tafiditra amin’ny isa',
    erpDonnees: 'Angona ERPTEM tamin’ny {{date}} : {{valeur}}',
    notes: {
      na: 'Tsy mihatra',
      naAide: "Tsy mihatra amin'ity vondrona ity — tsy tafiditra amin'ny isa ny fepetra.",
      effacer: 'Fafao',
      essentielSansReponse: 'Fepetra fototra tsy mbola novaliana',
      0: 'Tsy mifanaraka',
      1: 'Mifanaraka amin’ny ampahany',
      2: 'Mifanaraka',
      3: 'Mifanaraka tanteraka',
    },
  },
};
