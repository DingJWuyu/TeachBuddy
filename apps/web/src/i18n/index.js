import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { EN, APP_EN, APP_OVERRIDES, APP_ZH } from './presentationResources.js';

// Bundled, explicitly authored dictionaries. No network or browser-language
// detection: anonymous pages start in Chinese; the account owns its locale.
const dictionaries = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' });
const resources = {};
for (const [file, dictionary] of Object.entries(dictionaries)) {
  const [, language, namespace] = file.match(/\/locales\/([^/]+)\/([^/]+)\.json$/);
  (resources[language] ??= {})[namespace] = dictionary;
}

resources.en.tbx = EN;
for (const [language, namespaces, overwrite] of [['en', APP_EN, false], ['en', APP_OVERRIDES, true], ['zh-CN', APP_ZH, false]]) {
  for (const [namespace, table] of Object.entries(namespaces)) {
    const current = resources[language][namespace] || {};
    resources[language][namespace] = overwrite ? { ...current, ...table } : { ...table, ...current };
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  supportedLngs: ['zh-CN', 'en'],
  load: 'currentOnly',
  defaultNS: 'workbench',
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function documentLanguage(language) {
  document.documentElement.lang = language;
  document.documentElement.dir = 'ltr';
}
i18n.on('languageChanged', documentLanguage);
documentLanguage(i18n.language);

export default i18n;
