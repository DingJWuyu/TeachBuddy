import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: "schedule", ...options });
import { useState } from 'react';
import { CalendarDialog, CalendarIcon } from './CalendarControls.jsx';
import { endOf, repeatLabel } from './calendarModel.js';
import { weekdayLabel } from './model.js';

export const reminderLabel = reminder => {
  const start = reminder.anchor === 'start';
  if (reminder.minutes === 0) return t(start ? "开始时提醒" : "结束时提醒");
  return t(start ? "开始{{value}} {{minutes}} 分钟提醒" : "结束{{value}} {{minutes}} 分钟提醒", { value: reminder.side === 'before' ? t("前") : t("后"), minutes: reminder.minutes });
};

export function ReminderDialog({ value, onSave, onClose }) {
  const { t } = useTranslation("schedule");
  const [timing, setTiming] = useState(`${value?.anchor ?? 'end'}-${value?.side ?? 'before'}`);
  const [anchor, side] = timing.split('-');
  const [minutes, setMinutes] = useState(value?.minutes ?? 10);
  return <CalendarDialog title={t("提醒")} onClose={onClose}>
    <p className="cal-help">{t("提醒会显示在工作台通知中；离线期间到期的提醒，下次打开时显示。")}</p>
    <div className="cal-field-pair cal-reminder-fields"><label className="cal-field">{t("提醒时机")}<span className="cal-select-wrap"><select aria-label={t("提醒时机")} name="reminder-side" value={timing} onChange={e => setTiming(e.target.value)}><option value="start-before">{t("开始前")}</option><option value="start-after">{t("开始后")}</option><option value="end-before">{t("结束前")}</option><option value="end-after">{t("结束后")}</option></select><CalendarIcon name="down" size={16}/></span></label>
      <label className="cal-field">{t("分钟数")}<input type="number" min="0" max="10080" value={minutes} onChange={e => setMinutes(e.target.value)}/></label></div>
    <p className="cal-help">{t(anchor === 'start' ? "填写 0 表示开始时提醒。" : "填写 0 表示结束时提醒。")}</p>
    <footer>{value && <button onClick={() => onSave(null)}>{t("关闭提醒")}</button>}<button onClick={onClose}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" disabled={minutes === '' || !Number.isInteger(Number(minutes)) || minutes < 0 || minutes > 10080} onClick={() => onSave({ side, minutes: Number(minutes), ...(anchor === 'start' ? { anchor } : {}) })}>{t("完成")}</button></footer>
  </CalendarDialog>;
}

export function ConflictPreview({ content, labels, onAdopt }) {
  const { t } = useTranslation("schedule");
  const end = endOf(content);
  return <details className="cal-conflict-preview"><summary>{t("查看服务器内容")}</summary>
    <dl>
      <dt>{t("标题")}</dt><dd>{content.title || t("无标题")}</dd>
      <dt>{t("时间")}</dt><dd>{content.time ? t("{{date}} {{detail}} 至 {{date2}} {{suffix}}（{{timeZone}}）", { date: content.time.date, detail: content.calendar.allDay ? t("全天") : content.time.startTime, date2: end.date, suffix: content.calendar.allDay ? '' : end.time, timeZone: content.time.timeZone }) : t("未排期")}</dd>
      <dt>{t("重复")}</dt><dd>{repeatLabel(content.repeat, content.time?.date)}</dd>
      <dt>{t("事项")}</dt><dd>{content.items.length ? <ul>{content.items.map(item => <li key={item.id}>{item.text}</li>)}</ul> : t("无")}</dd>
      <dt>{t("备注")}</dt><dd>{content.calendar.notes || t("无")}</dd>
      <dt>{t("标签")}</dt><dd>{labels.filter(label => content.calendar.tags.includes(label.id)).map(label => label.name).join('、') || t("无")}</dd>
      <dt>{t("提醒")}</dt><dd>{content.reminder ? reminderLabel(content.reminder) : t("无")}</dd>
    </dl><button onClick={onAdopt}>{t("采用服务器内容")}</button>
  </details>;
}
