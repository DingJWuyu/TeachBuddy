import { useRef } from 'react';
import FormulaPreview from './FormulaPreview.jsx';
import { ModuleDisclosure } from '../workbench/ModuleMotion.jsx';

const templates = {
  fraction: { title: '分式', fields: [['top', '分子', 'x+1'], ['bottom', '分母', '2']], latex: v => `\\frac{${v.top}}{${v.bottom}}` },
  root: { title: '根式', fields: [['body', '根号内', 'x+1']], latex: v => `\\sqrt{${v.body}}` },
  power: { title: '上下标', fields: [['base', '主体', 'x'], ['lower', '下标', '1'], ['upper', '上标', '2']], latex: v => `{${v.base}}_{${v.lower}}^{${v.upper}}` },
};
function Symbol({ name }) {
  if (name === 'fraction') return <span className="math-fraction-symbol"><span>a</span><span>b</span></span>;
  return <span className="math-formula-symbol">{name === 'root' ? '√x' : <>x<sup>2</sup><sub>1</sub></>}</span>;
}

export default function FormulaEditor({ source, onChange, view, onView, confirm, retry, savedInvalid }) {
  const input = useRef(null);
  const builder = view.formulaBuilder;
  const matching = builder && templates[builder.kind]?.latex(builder.values) === source.latex;
  const mode = view.formulaMode ?? (source.latex && !matching ? 'source' : 'guided');
  async function choose(kind) {
    if (source.latex.trim() && !await confirm('选择新的公式结构会替换当前公式，是否继续？')) return;
    const values = Object.fromEntries(templates[kind].fields.map(([key, , value]) => [key, value]));
    onView({ formulaBuilder: { kind, values }, formulaMode: 'guided' });
    onChange({ ...source, latex: templates[kind].latex(values) });
  }
  function update(key, value) {
    const values = { ...builder.values, [key]: value };
    onView({ formulaBuilder: { ...builder, values } });
    onChange({ ...source, latex: templates[builder.kind].latex(values) });
  }
  function insert(text) {
    const start = input.current?.selectionStart ?? source.latex.length;
    const end = input.current?.selectionEnd ?? start;
    onChange({ ...source, latex: source.latex.slice(0, start) + text + source.latex.slice(end) });
    requestAnimationFrame(() => {
      input.current?.focus();
      const cursor = start + (text.includes('{}') ? text.indexOf('{}') + 1 : text.length);
      input.current?.setSelectionRange(cursor, cursor);
    });
  }
  return <div className="math-formula math-formula-editor">
    <div className="math-formula-result"><span className="math-section-kicker">公式预览</span>
      <FormulaPreview source={source} retry={retry} onLocate={position => { onView({ formulaMode: 'source' }); requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(position, position + 1); }); }}/>
    </div>
    {savedInvalid && <p role="alert">源码已保存，公式暂时无法显示。请修正后再次保存；当前版本仅可下载制作源。</p>}
    <div className="math-formula-mode" aria-label="公式输入方式">
      <button aria-pressed={mode === 'guided'} onClick={() => onView({ formulaMode: 'guided' })}>常用结构</button>
      <button aria-pressed={mode === 'source'} onClick={() => onView({ formulaMode: 'source' })}>LaTeX 源码</button>
    </div>
    {mode === 'guided' ? <div className="math-guided-formula">
      <div className="math-formula-templates">{Object.entries(templates).map(([kind, template]) => <button key={kind} aria-label={template.title} aria-pressed={!!matching && builder.kind === kind} onClick={() => choose(kind)}><span aria-hidden="true"><Symbol name={kind}/></span><span>{template.title}</span></button>)}</div>
      {matching ? <div className="math-formula-values">{templates[builder.kind].fields.map(([key, label]) => <label key={key}>{label}<input value={builder.values[key]} onChange={e => update(key, e.target.value)}/></label>)}</div>
        : <p className="math-hint">{source.latex ? '当前公式可在 LaTeX 源码中继续编辑，也可以选择新的结构。' : '选择一种结构，填写内容后即可看到公式。'}</p>}
    </div> : <div>
      <label className="math-latex-field">公式源码<textarea ref={input} aria-label="LaTeX" placeholder="例如：x^2 + y^2 = r^2" value={source.latex} onChange={e => onChange({ ...source, latex: e.target.value })}/></label>
      <div className="math-insert">{[['分式', '\\frac{}{}'], ['根式', '\\sqrt{}'], ['上下标', 'x_{}^{}'], ['分段式', '\\begin{cases}x & x>0\\\\ -x & x\\le0\\end{cases}']].map(([name, text]) => <button key={name} onMouseDown={e => e.preventDefault()} onClick={() => insert(text)}>{name}</button>)}</div>
    </div>}
    <ModuleDisclosure title="说明与样式" open={!!view.formulaOptions} onOpenChange={formulaOptions => onView({ formulaOptions })}>
      <div className="math-formula-settings">
        <label>中文说明<textarea aria-label="中文说明" value={source.caption} onChange={e => onChange({ ...source, caption: e.target.value })}/></label>
        <label><input type="checkbox" checked={source.includeCaption} onChange={e => onChange({ ...source, includeCaption: e.target.checked })}/>在下载图片中包含说明</label>
        <label>颜色<input type="color" value={source.color} onChange={e => onChange({ ...source, color: e.target.value })}/></label>
        <label>字号<input type="number" value={source.fontSize} onChange={e => onChange({ ...source, fontSize: Number(e.target.value) })}/></label>
      </div>
    </ModuleDisclosure>
  </div>;
}
