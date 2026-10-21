import { useId } from 'react';
/*
 * The mark: a teacher made of an open book and a spark.
 * The book is held open like two arms; the head is a four-point spark -
 * the moment an idea lands, and the assistant that helps it along.
 * Black tile, white book, system-blue spark.
 */
const SPARK = 'M32 9.2C32.9 16.3 34.2 17.6 41.3 18.5C34.2 19.4 32.9 20.7 32 27.8C31.1 20.7 29.8 19.4 22.7 18.5C29.8 17.6 31.1 16.3 32 9.2Z';
const PAGE_L = 'M11.5 33.2C18.6 29.9 25.6 30 30.6 34.3V52.6C25.6 48.8 18.6 48.6 11.5 51.6Z';
const PAGE_R = 'M52.5 33.2C45.4 29.9 38.4 30 33.4 34.3V52.6C38.4 48.8 45.4 48.6 52.5 51.6Z';

export function Mark({ size = 28, className = '' }) {
  const id = `tbx-mark-hi-${useId()}`;
  return (
    <svg className={`tbx-mark ${className}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect className="tbx-mark-tile" width="64" height="64" rx="14.5" />
      <rect width="64" height="64" rx="14.5" fill={`url(#${id})`} />
      <path className="tbx-mark-page" d={PAGE_L} />
      <path className="tbx-mark-page" d={PAGE_R} />
      <path className="tbx-mark-spark" d={SPARK} />
    </svg>
  );
}

export function BrandMark({ wordmark = 'TeachBuddy' }) {
  return (
    <span className="ae-brand-lockup tbx-lockup">
      <Mark size={48} />
      {wordmark ? <span className="ae-brand-wordmark tbx-wordmark">{wordmark}</span> : null}
    </span>
  );
}
