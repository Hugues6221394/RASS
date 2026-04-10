import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import kin from './locales/kin.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      kin: { translation: kin },
    },
    lng: localStorage.getItem('rass_lang') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
