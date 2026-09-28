import { useTranslation } from 'react-i18next';

import { useRef, useState } from 'react';
import { useModuleDialogFocus } from '../workbench/ModuleMotion.jsx';

export function RecordMoveDialog({ record, classes, onCancel, onConfirm }) {
  const { t } = useTranslation('classes');
  const dialog = useRef(null);
  const [target, setTarget] = useState('');
  useModuleDialogFocus(dialog, onCancel);
  const choices = classes.filter(item => item.id !== record.classId);
  return <div className="wb-dialog-host wb-module-dialog" data-overlay="dialog">
    <div className="wb-dialog-scrim" role="presentation" onClick={onCancel} />
    <form ref={dialog} className="wb-dialog" role="dialog" aria-modal="true" aria-label={t("移动课堂记录")}
      onSubmit={event => { event.preventDefault(); if (target) onConfirm(target); }}>
      <h2>{t("移动课堂记录")}</h2>
      <p>{t("目标班级接收这条已保存的记录。原记录进入原班级的“已删除”，仍可恢复；已有日程继续关联原记录。")}</p>
      {choices.length ? <label className="wb-field"><span className="wb-label">{t("移到哪个班级")}</span>
        <select className="wb-input" aria-label={t("移到哪个班级")} value={target} onChange={event => setTarget(event.target.value)}>
          <option value="">{t("选择班级")}</option>{choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label> : <p className="wb-muted">{t("还没有其他活动班级，请先在班级主页创建。")}</p>}
      <div className="wb-dialog-actions"><button type="button" className="wb-button" onClick={onCancel}>{t("取消")}</button>
        <button type="submit" className="wb-button is-primary" disabled={!target}>{t("移动并打开记录")}</button></div>
    </form>
  </div>;
}
