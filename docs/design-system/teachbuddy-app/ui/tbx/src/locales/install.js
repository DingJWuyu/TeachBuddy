import { EN, APP_EN, APP_OVERRIDES, APP_ZH } from './en.js';

let done = false;
// Adds the overlay's English once the app's i18next instance exists.
export function installLocales(i18n) {
  if (done || !i18n?.addResourceBundle) return;
  done = true;
  i18n.addResourceBundle('en', 'tbx', EN, true, true);
  for (const [ns, table] of Object.entries(APP_EN)) i18n.addResourceBundle('en', ns, table, true, false);
  for (const [ns, table] of Object.entries(APP_OVERRIDES)) i18n.addResourceBundle('en', ns, table, true, true);
  for (const [ns, table] of Object.entries(APP_ZH)) i18n.addResourceBundle('zh-CN', ns, table, true, false);
}
