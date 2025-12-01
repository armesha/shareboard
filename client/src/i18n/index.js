import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enWorkspace from './locales/en/workspace.json';
import enSharing from './locales/en/sharing.json';
import enToolbar from './locales/en/toolbar.json';
import enEditor from './locales/en/editor.json';
import enMessages from './locales/en/messages.json';
import enValidation from './locales/en/validation.json';

import csCommon from './locales/cs/common.json';
import csLanding from './locales/cs/landing.json';
import csWorkspace from './locales/cs/workspace.json';
import csSharing from './locales/cs/sharing.json';
import csToolbar from './locales/cs/toolbar.json';
import csEditor from './locales/cs/editor.json';
import csMessages from './locales/cs/messages.json';
import csValidation from './locales/cs/validation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        landing: enLanding,
        workspace: enWorkspace,
        sharing: enSharing,
        toolbar: enToolbar,
        editor: enEditor,
        messages: enMessages,
        validation: enValidation
      },
      cs: {
        common: csCommon,
        landing: csLanding,
        workspace: csWorkspace,
        sharing: csSharing,
        toolbar: csToolbar,
        editor: csEditor,
        messages: csMessages,
        validation: csValidation
      }
    },
    lng: 'cs',
    fallbackLng: 'cs',
    defaultNS: 'common',
    ns: ['common', 'landing', 'workspace', 'sharing', 'toolbar', 'editor', 'messages', 'validation'],
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'shareboardLanguage'
    }
  });

export default i18n;
