import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resolveInitialLocale } from './types';
import authEn from './locales/en/auth.json';
import commonEn from './locales/en/common.json';
import dashboardEn from './locales/en/dashboard.json';
import profileEn from './locales/en/profile.json';
import roleEn from './locales/en/role.json';
import userEn from './locales/en/user.json';
import validationEn from './locales/en/validation.json';
import authId from './locales/id/auth.json';
import commonId from './locales/id/common.json';
import dashboardId from './locales/id/dashboard.json';
import profileId from './locales/id/profile.json';
import roleId from './locales/id/role.json';
import userId from './locales/id/user.json';
import validationId from './locales/id/validation.json';

const initialLocale = resolveInitialLocale();

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLocale;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: commonEn,
      auth: authEn,
      dashboard: dashboardEn,
      user: userEn,
      role: roleEn,
      profile: profileEn,
      validation: validationEn,
    },
    id: {
      common: commonId,
      auth: authId,
      dashboard: dashboardId,
      user: userId,
      role: roleId,
      profile: profileId,
      validation: validationId,
    },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'auth', 'dashboard', 'user', 'role', 'profile', 'validation'],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
