/*
 * The brand mark is a solid circle so it can stand alone as the page mark on the
 * auth screens, where the workbench only ever renders it next to the wordmark.
 */
export default function BrandMark({ mark = 'T', wordmark = 'TeachBuddy' }) {
  return (
    <span className="tb-brand">
      <span className="tb-brand-mark" aria-hidden="true">{mark}</span>
      {wordmark ? <span className="tb-brand-wordmark">{wordmark}</span> : null}
    </span>
  );
}
