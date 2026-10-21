import { useTranslation } from 'react-i18next';
import i18n from './index.js';

/*
 * Presentation copy is written in Chinese and looked up as-is. English lives in
 * ./presentationResources.js under the "tbx" namespace; keys the app already translates
 * (workbench, agent, schedule…) resolve from its own dictionaries. Only the
 * current language is consulted, so a missing English line falls back to the
 * Chinese key rather than to another namespace's Chinese.
 */
const NS = ['tbx', 'workbench', 'agent', 'schedule', 'reliability', 'questions', 'resources', 'math'];
export const tx = (key, options) => {
  const i = i18n;
  if (!i) return key;
  // a numeric {{n}} picks the plural form unless a count is given
  const count = options && options.count === undefined && typeof options.n === 'number' ? { count: options.n } : null;
  return i.t(key, { ns: NS, lngs: [i.language], nsSeparator: false, ...options, ...count });
};
export const isEnglish = () => (i18n?.language || '').startsWith('en');
/* re-render on language change */
export const useLocale = () => useTranslation('workbench').i18n.language;

/* dates for a YYYY-MM-DD day, in the interface language */
const dayUTC = (date) => new Date(`${date}T12:00:00Z`);
export const monthDay = (date) => isEnglish()
  ? dayUTC(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  : `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
export const weekdayName = (date) => isEnglish()
  ? dayUTC(date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  : `周${'日一二三四五六'[dayUTC(date).getUTCDay()]}`;
