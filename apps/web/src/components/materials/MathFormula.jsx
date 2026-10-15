import { useTranslation } from 'react-i18next';
/**
 * Read-side rendering of math documents.
 *
 * Rendering never destroys the source: a formula that fails to preview shows its
 * LaTeX with an explicit warning while the stored source stays untouched.
 */

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function renderLatex(latex, displayMode) {
  try {
    return {
      html: katex.renderToString(latex, {
        displayMode,
        throwOnError: true,
        strict: 'ignore',
        trust: false,
        output: 'html'
      })
    };
  } catch (error) {
    return { failed: true };
  }
}

export function MathFormula({ latex, display = false }) {
  const { t } = useTranslation("workbench");
  const result = useMemo(() => renderLatex(latex ?? '', display), [latex, display]);
  if (result.failed) {
    return (
      <span className="wb-formula-failed" data-formula-failed="1"> {t("公式预览失败：")}{latex}
      </span>
    );
  }
  return (
    <span
      className={display ? 'wb-formula is-display' : 'wb-formula'}
      data-formula-source={latex}
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}
