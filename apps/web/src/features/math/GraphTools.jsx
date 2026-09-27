import { constructionKinds } from '../../../../../packages/shared/src/math/geometry.js';
import AnalysisTools from './AnalysisTools.jsx';
import ConstructionTools from './ConstructionTools.jsx';
import SurfaceProperties from './SurfaceTools.jsx';
import { Icon } from '../workbench/icons.jsx';
import { ModuleDisclosure } from '../workbench/ModuleMotion.jsx';
import { ObjectProperties, ToolPanel } from './WorkspaceControls.jsx';
import DynamicTools from './DynamicTools.jsx';

const coordinateLabel = value => value.trim() && Number.isFinite(Number(value)) ? Number(Number(value).toPrecision(8)).toString() : value;

export default function GraphTools({ active, source, selection, onSelect, objects, onChange, onReplace, onRemove, Fields, expanded, onExpanded, onTool, edits, onEdits, confirm }) {
  const [kind, indexText] = selection.split(':');
  const index = Number(indexText);
  const edge = kind === 'edge' ? source.edges?.[index] : null;
  const object = kind === 'object' ? objects[index] : null;
  const surface = kind === 'face' ? source.faces?.[index] : kind === 'section' ? source.sections?.[index] : null;
  const titles = { objects: '图形与标注', parameters: '设置滑杆', steps: '编排步骤', canvas: '画布设置', analysis: '函数分析', construct: '关联构造' };
  const updateEdge = next => onChange({ ...source, edges: source.edges.map((e, i) => i === index ? next : e) });
  return <>
    <div className="math-tool-heading">{active !== 'objects' && <button className="math-icon-button" aria-label="返回图形编辑" onClick={() => onTool('objects')}><Icon name="back"/></button>}<h2>{titles[active]}</h2></div>
    <ToolPanel name="objects" active={active}>
      <div className="math-object-list" aria-label="图形列表">
        {objects.map((o, i) => <button key={`object-${i}`} aria-pressed={selection === `object:${i}`} onClick={() => onSelect(`object:${i}`)}><span className="math-object-dot" style={{ background: o.style?.stroke }}/><span><strong>{o.id}</strong><small>{o.construction ? `${constructionKinds[o.construction.kind]?.label} · ${o.construction.refs.join('、')}` : o.expression ? `y = ${o.expression}` : o.text || (o.at ? `(${coordinateLabel(o.at.x)}, ${coordinateLabel(o.at.y)})` : '')}</small></span></button>)}
        {source.edges?.map((e, i) => <button key={`edge-${i}`} aria-pressed={selection === `edge:${i}`} onClick={() => onSelect(`edge:${i}`)}><span className="math-object-edge"/><span>{e.from} → {e.to}</span></button>)}
        {['face', 'section'].flatMap(kind => (source[kind === 'face' ? 'faces' : 'sections'] ?? []).map((s, i) => <button key={`${kind}-${i}`} aria-pressed={selection === `${kind}:${i}`} onClick={() => onSelect(`${kind}:${i}`)}><span className="math-object-dot" style={{ background: s.style.fill }}/><span>{kind === 'face' ? '面' : '截面'} {s.id}</span></button>))}
      </div>
      {!objects.length && <p className="math-library-empty">从画布上方添加图形，或选择一个示例开始。</p>}
      {object && <><div className="math-selection-title">正在编辑 · {object.id}</div><ObjectProperties elements={objects} value={object} onChange={onReplace} Fields={Fields} expanded={expanded} onExpanded={onExpanded}/></>}
      {edge && <><div className="math-selection-title">正在编辑 · 棱 {edge.from} → {edge.to}</div>
        <div className="math-fields">{[['from', '起点'], ['to', '终点']].map(([key, title]) => <label key={key}>{title}<select aria-label={`棱${title}`} value={edge[key]} onChange={e => updateEdge({ ...edge, [key]: e.target.value })}>{objects.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}</select></label>)}</div>
        <ObjectProperties value={{ style: edge.style }} onChange={next => updateEdge({ ...edge, style: next.style })} Fields={Fields} expanded={{ ...expanded, style: expanded.style ?? true }} onExpanded={onExpanded}/>
      </>}
      {surface && <><div className="math-selection-title">正在编辑 · {kind === 'face' ? '面' : '截面'} {surface.id}</div>
        <SurfaceProperties value={surface} kind={kind} source={source} Fields={Fields} onChange={next => onChange({ ...source, [kind === 'face' ? 'faces' : 'sections']: source[kind === 'face' ? 'faces' : 'sections'].map((s, i) => i === index ? next : s) })}/>
        <ObjectProperties value={{ style: surface.style }} Fields={Fields} expanded={expanded} onExpanded={onExpanded} onChange={next => onChange({ ...source, [kind === 'face' ? 'faces' : 'sections']: source[kind === 'face' ? 'faces' : 'sections'].map((s, i) => i === index ? { ...s, style: next.style } : s) })}/>
      </>}
      {(edge || object || surface) && <button className="math-remove-object" onClick={onRemove}><Icon name="trash"/>移除{edge ? '棱' : surface ? kind === 'face' ? '面' : '截面' : '对象'}</button>}
    </ToolPanel>
    {source.scene && <><ToolPanel name="analysis" active={active}><AnalysisTools source={source} onChange={onChange} onSelect={onSelect}/></ToolPanel><ToolPanel name="construct" active={active}><ConstructionTools source={source} onChange={onChange} onSelect={onSelect}/></ToolPanel></>}
    {source.kind === 'dynamic' && <DynamicTools active={active} expanded={expanded} onExpanded={onExpanded} source={source} onChange={onChange} Fields={Fields} edits={edits} onEdits={onEdits} confirm={confirm}/>}
    <ToolPanel name="canvas" active={active}>
      {source.kind === 'space' && <><h3 className="math-section-heading">观察角度</h3><Fields value={{ azimuth: source.azimuth, elevation: source.elevation }} onChange={angles => onChange({ ...source, ...angles })}/></>}
      <h3 className="math-section-heading">坐标范围</h3>
      <Fields value={Object.fromEntries(Object.entries({ tickLabels: false, ...(source.scene?.viewport ?? source.viewport) }).filter(([key]) => !['width', 'height'].includes(key)))} onChange={next => {
        const viewport = { ...(source.scene?.viewport ?? source.viewport), ...next };
        onChange(source.scene ? { ...source, scene: { ...source.scene, viewport } } : { ...source, viewport });
      }}/>
      <ModuleDisclosure title="画布尺寸" open={!!expanded.dimensions} onOpenChange={open => onExpanded('dimensions', open)}>
        <Fields value={{ width: (source.scene?.viewport ?? source.viewport).width, height: (source.scene?.viewport ?? source.viewport).height }} onChange={next => {
          const viewport = { ...(source.scene?.viewport ?? source.viewport), ...next };
          onChange(source.scene ? { ...source, scene: { ...source.scene, viewport } } : { ...source, viewport });
        }}/>
      </ModuleDisclosure>
    </ToolPanel>
  </>;
}
