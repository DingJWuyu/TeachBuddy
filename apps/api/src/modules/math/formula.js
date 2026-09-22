import { registerAndReadFont } from './font.js';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import { checkFormula, formulaPackages, formulaSvg } from '../../../../../packages/shared/src/math/formula.js';
import { MathSourceError } from '../../../../../packages/shared/src/math/expression.js';

export async function renderFormula(source, options) {
  checkFormula(source.latex);
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  const document = mathjax.document('', {
    InputJax: new TeX({ packages: formulaPackages, maxBuffer: 10000,
      formatError: (_jax, error) => { throw new MathSourceError('invalid-formula', error.message); } }),
    OutputJax: new SVG({ fontCache: 'none' })
  });
  const node = document.convert(source.latex, { display: true });
  const mathSvg = adaptor.outerHTML(adaptor.firstChild(node));
  return formulaSvg(source, mathSvg, await registerAndReadFont(), options.width);
}
