import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'classes', ...options });
import { useRef } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { ModulePresence } from '../workbench/ModuleMotion.jsx';

export const RECORD_FIELDS = [
  { key: 'position', get label() { return t("教到哪里"); }, get action() { return t("补充教学进度"); }, icon: 'prep', get placeholder() { return t("例如：单调性定义与例1"); }, get aria() { return t("教学位置"); } },
  { key: 'unfinished', get label() { return t("还没讲的内容"); }, get action() { return t("记下未讲内容"); }, icon: 'history', get placeholder() { return t("例如：例2和课后练习"); }, get aria() { return t("未讲内容"); } },
  { key: 'commonIssues', get label() { return t("学生普遍遇到的问题"); }, get action() { return t("记录共性问题"); }, icon: 'question', get placeholder() { return t("例如：容易忽略定义中的“任意”"); }, get aria() { return t("共性问题"); } },
  { key: 'nextNote', get label() { return t("下次准备怎么教"); }, get action() { return t("记下下次教学想法"); }, icon: 'calendar', get placeholder() { return t("例如：先用一个反例复习定义"); }, get aria() { return t("下次备注"); } }
];

/** A field is revealed deliberately or by existing content; hiding never discards text. */
export function RecordFields({ input, onChange, fields, onFieldsChange, onPick }) {
  const { t } = useTranslation('classes');
  const root = useRef(null);
  const visible = key => fields.includes(key) || Boolean(input[key]);
  const available = RECORD_FIELDS.filter(field => !visible(field.key));
  function reveal(key) {
    onFieldsChange([...fields, key]);
    requestAnimationFrame(() => root.current?.querySelector(`[data-field="${key}"] textarea`)?.focus());
  }
  return <div ref={root} className="c-record-fields">
    <div className="c-add-tools">
      {available.length > 0 && <Popover label={t("添加补充")} icon={null} align="start" buttonClassName="wb-button c-text-action">
        {({ close }) => available.map(field => <MenuItem key={field.key} icon={field.icon}
          onClick={() => { close(); reveal(field.key); }}>{field.action}</MenuItem>)}
      </Popover>}
      <button type="button" className="wb-button c-text-action" name="pick-sources" onClick={onPick}>
        <Icon name="folder" size={16} />{t("关联资料")}
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
          aria-label={t("收起{{fieldLabel}}", { fieldLabel: field.label })} title={t("收起{{fieldLabel}}", { fieldLabel: field.label })}
          onClick={() => {
            onFieldsChange(fields.filter(key => key !== field.key));
            requestAnimationFrame(() => root.current?.querySelector(".c-add-tools .wb-popover-trigger, .c-add-tools button")?.focus());
          }}><Icon name="close" size={14} /></button>}
      </div>
    </ModulePresence>)}
  </div>;
}
