import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mountGeoGebra } from './controller.js';
import './geogebra.css';

/** initialBase64 is used only when this instance mounts; switch works with React key. */
export default function GeoGebraEditor({ initialBase64 = '', appName = 'graphing', onReady, onChange, onError, className = '' }) {
  const { t, i18n } = useTranslation('math');
  const language = i18n.resolvedLanguage || i18n.language || 'zh-CN';
  const languageRef = useRef(language);
  languageRef.current = language;
  const controllerRef = useRef(null);
  const host = useRef(null);
  const callbacks = useRef({ onReady, onChange, onError });
  callbacks.current = { onReady, onChange, onError };
  const initial = useRef(initialBase64);
  const recovering = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    const lifetime = new AbortController();
    let editor;
    setStatus('loading'); setError('');
    mountGeoGebra(host.current, {
      base64: initial.current, appName, language: languageRef.current, signal: lifetime.signal,
      onChange: snapshot => callbacks.current.onChange?.(snapshot),
      onError: failure => {
        if (lifetime.signal.aborted) return;
        if (failure.recoveryBase64) {
          initial.current = failure.recoveryBase64;
          controllerRef.current = null;
          callbacks.current.onReady?.(null);
          if (failure.name === 'AbortError') {
            recovering.current = true;
            setStatus('loading'); setError(''); setAttempt(value => value + 1);
            return;
          }
          setStatus('error'); setError(failure.message);
        }
        callbacks.current.onError?.(failure);
      },
    }).then(controller => {
      if (lifetime.signal.aborted) { controller.destroy(); return; }
      editor = controller; controllerRef.current = controller;
      controller.setLanguage(languageRef.current);
      setStatus('ready'); callbacks.current.onReady?.(controller);
      if (recovering.current) {
        recovering.current = false;
        callbacks.current.onChange?.({ ...controller.read(), origin: 'restore' });
      }
    }).catch(failure => {
      if (lifetime.signal.aborted) return;
      setStatus('error'); setError(failure.message); callbacks.current.onError?.(failure);
    });
    return () => { controllerRef.current = null; callbacks.current.onReady?.(null); lifetime.abort(); editor?.destroy(); };
  }, [appName, attempt]);
  useEffect(() => {
    try { controllerRef.current?.setLanguage(language); }
    catch (failure) { callbacks.current.onError?.(failure); }
  }, [language]);
  return <section className={`math-geogebra ${className}`} aria-label={t('GeoGebra 数学画布')} aria-busy={status === 'loading'}>
    <div ref={host} className="math-geogebra-host" />
    {status === 'ready' && <a className="math-geogebra-credit" href="https://www.geogebra.org" target="_blank" rel="noreferrer">Made with GeoGebra®</a>}
    {status === 'loading' && <div className="math-geogebra-status" role="status">{t('正在加载 GeoGebra 画布…')}</div>}
    {status === 'error' && <div className="math-geogebra-status" role="alert">
      <p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{t('重试加载')}</button>
    </div>}
  </section>;
}
