// Hook and helper accessors that resolve the app's own React at call time.
const R = () => globalThis.__tb.React;
export const tb = () => globalThis.__tb;
export const useState = (...a) => R().useState(...a);
export const useEffect = (...a) => R().useEffect(...a);
export const useLayoutEffect = (...a) => R().useLayoutEffect(...a);
export const useRef = (...a) => R().useRef(...a);
export const useMemo = (...a) => R().useMemo(...a);
export const useCallback = (...a) => R().useCallback(...a);
export const useContext = (...a) => R().useContext(...a);
export const useId = (...a) => R().useId(...a);
export const t = (key, options) => globalThis.__tb.i18n.t(key, options);
export const cx = (...parts) => parts.filter(Boolean).join(' ');

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const on = (e) => setReduced(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
}

/*
 * Overlay copy is written in Chinese and looked up as-is. English lives in
 * ./locales/en.js under the "tbx" namespace; keys the app already translates
 * (workbench, agent, schedule…) resolve from its own dictionaries. Only the
 * current language is consulted, so a missing English line falls back to the
 * Chinese key rather than to another namespace's Chinese.
 */
const NS = ['tbx', 'workbench', 'agent', 'schedule', 'reliability', 'questions', 'resources', 'math'];
export const tx = (key, options) => {
  const i = globalThis.__tb?.i18n;
  if (!i) return key;
  globalThis.__tbx?.installLocales?.(i);
  // a numeric {{n}} picks the plural form unless a count is given
  const count = options && options.count === undefined && typeof options.n === 'number' ? { count: options.n } : null;
  return i.t(key, { ns: NS, lngs: [i.language], nsSeparator: false, ...options, ...count });
};
export const isEnglish = () => (globalThis.__tb?.i18n?.language || '').startsWith('en');
/* re-render on language change */
export const useLocale = () => tb().useTranslation('workbench').i18n.language;

/* dates for a YYYY-MM-DD day, in the interface language */
const dayUTC = (date) => new Date(`${date}T12:00:00Z`);
export const monthDay = (date) => isEnglish()
  ? dayUTC(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  : `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
export const weekdayName = (date) => isEnglish()
  ? dayUTC(date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  : `周${'日一二三四五六'[dayUTC(date).getUTCDay()]}`;
