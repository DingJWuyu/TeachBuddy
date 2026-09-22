/*
 * The brand mark is a solid circle so it can stand alone as the page mark on
 * the account screens, where the workbench only renders it next to the
 * wordmark.
 */
export default function BrandMark({ mark = 'T', wordmark = 'TeachBuddy' }) {
  return (
    <span className="ae-brand-lockup">
      <span className="ae-brand-mark" aria-hidden="true">{mark}</span>
      {wordmark ? <span className="ae-brand-wordmark">{wordmark}</span> : null}
    </span>
  );
}
