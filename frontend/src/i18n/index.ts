import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resolveInitialLocale } from './types';
import apiKeyEn from './locales/en/api-key.json';
import archiveEn from './locales/en/archive.json';
import authEn from './locales/en/auth.json';
import commonEn from './locales/en/common.json';
import dashboardEn from './locales/en/dashboard.json';
import billingEn from './locales/en/billing.json';
import myBillingEn from './locales/en/myBilling.json';
import eventEn from './locales/en/event.json';
import networkEn from './locales/en/network.json';
import networkSubmissionEn from './locales/en/networkSubmission.json';
import notificationEn from './locales/en/notification.json';
import profileEn from './locales/en/profile.json';
import roleEn from './locales/en/role.json';
import storyEn from './locales/en/story.json';
import subscriptionEn from './locales/en/subscription.json';
import subscriptionRequestEn from './locales/en/subscriptionRequest.json';
import userEn from './locales/en/user.json';
import validationEn from './locales/en/validation.json';
import apiKeyId from './locales/id/api-key.json';
import archiveId from './locales/id/archive.json';
import authId from './locales/id/auth.json';
import commonId from './locales/id/common.json';
import dashboardId from './locales/id/dashboard.json';
import billingId from './locales/id/billing.json';
import myBillingId from './locales/id/myBilling.json';
import eventId from './locales/id/event.json';
import networkId from './locales/id/network.json';
import networkSubmissionId from './locales/id/networkSubmission.json';
import notificationId from './locales/id/notification.json';
import profileId from './locales/id/profile.json';
import roleId from './locales/id/role.json';
import storyId from './locales/id/story.json';
import subscriptionId from './locales/id/subscription.json';
import subscriptionRequestId from './locales/id/subscriptionRequest.json';
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
      'api-key': apiKeyEn,
      story: storyEn,
      archive: archiveEn,
      event: eventEn,
      profile: profileEn,
      network: networkEn,
      networkSubmission: networkSubmissionEn,
      notification: notificationEn,
      subscription: subscriptionEn,
      subscriptionRequest: subscriptionRequestEn,
      billing: billingEn,
      myBilling: myBillingEn,
      validation: validationEn,
    },
    id: {
      common: commonId,
      auth: authId,
      dashboard: dashboardId,
      user: userId,
      role: roleId,
      'api-key': apiKeyId,
      story: storyId,
      archive: archiveId,
      event: eventId,
      profile: profileId,
      network: networkId,
      networkSubmission: networkSubmissionId,
      notification: notificationId,
      subscription: subscriptionId,
      subscriptionRequest: subscriptionRequestId,
      billing: billingId,
      myBilling: myBillingId,
      validation: validationId,
    },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [
    'common',
    'auth',
    'dashboard',
    'user',
    'role',
    'api-key',
    'story',
    'archive',
    'event',
    'profile',
    'network',
    'networkSubmission',
    'notification',
    'subscription',
    'subscriptionRequest',
    'billing',
    'myBilling',
    'validation',
  ],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
