/**
 * pageIntentClassifier.js — Classify page intent and service type for portal leads
 *
 * Maps sourcePage to page_intent and service_type for CRM tracking
 */

export function classifyPageIntent(sourcePage = 'portal') {
  const pageMappings = {
    'osek_patur': {
      intent: 'open_osek_patur',
      service_type: 'business_registration'
    },
    'osek_murshe': {
      intent: 'open_osek_murshe',
      service_type: 'business_registration'
    },
    'hevra_bam': {
      intent: 'open_hevra',
      service_type: 'business_registration'
    },
    'sgirat_tikim': {
      intent: 'close_account',
      service_type: 'account_closure'
    },
    'accountant': {
      intent: 'accounting_services',
      service_type: 'accounting'
    },
    'consultation': {
      intent: 'general_consultation',
      service_type: 'consultation'
    },
    'portal': {
      intent: 'portal_lead',
      service_type: 'general'
    }
  };

  return pageMappings[sourcePage] || {
    intent: 'unknown_page',
    service_type: 'general'
  };
}
