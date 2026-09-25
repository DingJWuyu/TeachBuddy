import { useRef } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { ModulePresence } from '../workbench/ModuleMotion.jsx';

export const RECORD_FIELDS = [
  { key: 'position', label: '教到哪里', action: '补充教学进度', icon: 'prep', placeholder: '例如：单调性定义与例1', aria: '教学位置' },
  { key: 'unfinished', label: '还没讲的内容', action: '记下未讲内容', icon: 'history', placeholder: '例如：例2和课后练习', aria: '未讲内容' },
  { key: 'commonIssues', label: '学生普遍遇到的问题', action: '记录共性问题', icon: 'question', placeholder: '例如：容易忽略定义中的“任意”', aria: '共性问题' },
  { key: 'nextNote', label: '下次准备怎么教', action: '记下下次教学想法', icon: 'calendar', placeholder: '例如：先用一个反例复习定义', aria: '下次备注' }
];

/** A field is revealed deliberately or by existing content; hiding never discards text. */
export function RecordFields({ input, onChange, fields, onFieldsChange, onPick }) {
  const root = useRef(null);
  const visible = key => fields.includes(key) || Boolean(input[key]);
  const available = RECORD_FIELDS.filter(field => !visible(field.key));
  function reveal(key) {
    onFieldsChange([...fields, key]);
    requestAnimationFrame(() => root.current?.querySelector(`[data-field="${key}"] textarea`)?.focus());
  }
  return <div ref={root} className="c-record-fields">
    <div className="c-add-tools">
      {available.length > 0 && <Popover label="添加补充" icon={null} align="start" buttonClassName="wb-button c-text-action">
        {({ close }) => available.map(field => <MenuItem key={field.key} icon={field.icon}
          onClick={() => { close(); reveal(field.key); }}>{field.action}</MenuItem>)}
      </Popover>}
      <button type="button" className="wb-button c-text-action" name="pick-sources" onClick={onPick}>
        <Icon name="folder" size={16} />关联资料
      </button>
    </div>
    {RECORD_FIELDS.map(field => <ModulePresence key={field.key} present={visible(field.key)} mode="collapse">
      <div className="c-optional-field" data-field={field.key}>
        <label className="wb-field">
          <span className="c-field-title"><Icon name={field.icon} size={15} />{field.label}</span>
          <textarea className="wb-input c-textarea" rows={2} aria-label={field.aria}
            placeholder={field.placeholder} value={input[field.key]}
            onChange={event => {
              if (!fields.includes(field.key)) onFieldsChange([...fields, field.key]);
              onChange({ [field.key]: event.target.value });
            }} />
        </label>
        {!input[field.key] && <button type="button" className="wb-icon-button c-field-close"
          aria-label={`收起${field.label}`} title={`收起${field.label}`}
          onClick={() => {
            onFieldsChange(fields.filter(key => key !== field.key));
            requestAnimationFrame(() => root.current?.querySelector('[aria-label="添加补充"]')?.focus());
          }}><Icon name="close" size={14} /></button>}
      </div>
    </ModulePresence>)}
  </div>;
}
