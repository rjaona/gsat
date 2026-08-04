import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { fr } from './fr'
import { en } from './en'
import { mg } from './mg'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      // Malagasy : partiel, fallback automatique sur le francais (cf. mg.ts)
      mg: { translation: mg },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'mg'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
