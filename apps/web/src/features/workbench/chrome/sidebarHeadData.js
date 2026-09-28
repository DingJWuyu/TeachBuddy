import i18n from "../../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "workbench", ...options });
export const LANGUAGES = [
  { code: 'zh-CN', flag: 'cn', native: '简体中文', english: 'Chinese (Simplified)' },
  { code: 'en', flag: 'us', native: 'English', english: null }
];


/* Both dates always carry their year. The reference drops the start year when it
 * matches the current year; the product owner asked for the full date here, so
 * that reference behaviour is deliberately not copied. Dates join on an en dash. */
export function formatSemesterRange(semester) {
  const format = value => new Intl.DateTimeFormat(i18n.resolvedLanguage, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  return `${format(semester.start)} - ${format(semester.end)}`;
}

/* Categories a teacher can pull from another semester. Counts are fixtures; the
 * last one stays at zero so the disabled row state stays visible. */
export const COPYABLE_ITEMS = [];

/* Explains what copying leaves behind. The reference shows this once a source is
 * chosen; the reference wording uses an em dash where this uses a plain one. */
export function copyNotice(sourceName) {
  return t("学生的提交、考勤记录和成绩仍保留在 {{sourceName}} 中。单元和课程为共享而非复制 - ", { sourceName: sourceName })
    + t("同一单元会出现在两个学期中，而排课按学期各自独立。");
}

/* Fixture id for a semester the teacher creates in this session. */
export function nextSemesterId(existing) {
  return `semester-${existing.length + 1}-${Date.now().toString(36)}`;
}
