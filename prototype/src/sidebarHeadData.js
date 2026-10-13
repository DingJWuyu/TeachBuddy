/*
 * Sample data for the sidebar head block.
 *
 * The language list and the semester list are fixtures. Nothing here talks to a
 * service: the prototype shows the interface, not the storage behind it.
 *
 * PROTOTYPE: fixture values only.
 */

/* Order and labels follow the reference selector. English carries no secondary
 * label because its own name is already the English one. */
export const LANGUAGES = [
  { code: 'en', flag: 'us', native: 'English', english: null },
  { code: 'pt', flag: 'br', native: 'Português', english: 'Portuguese' },
  { code: 'es', flag: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', flag: 'fr', native: 'Français', english: 'French' },
  { code: 'ja', flag: 'jp', native: '日本語', english: 'Japanese' },
  { code: 'ko', flag: 'kr', native: '한국어', english: 'Korean' },
  { code: 'de', flag: 'de', native: 'Deutsch', english: 'German' },
  { code: 'nl', flag: 'nl', native: 'Nederlands', english: 'Dutch' },
  { code: 'it', flag: 'it', native: 'Italiano', english: 'Italian' },
  { code: 'zh-CN', flag: 'cn', native: '简体中文', english: 'Chinese (Simplified)' },
  { code: 'zh-TW', flag: 'tw', native: '繁體中文', english: 'Chinese (Traditional)' },
  { code: 'uk', flag: 'ua', native: 'Українська', english: 'Ukrainian' },
  { code: 'uz', flag: 'uz', native: 'Oʻzbekcha', english: 'Uzbek' },
  { code: 'km', flag: 'kh', native: 'ភាសាខ្មែរ', english: 'Khmer' },
  { code: 'bn', flag: 'bd', native: 'বাংলা', english: 'Bengali' },
  { code: 'ur', flag: 'pk', native: 'اردو', english: 'Urdu' },
  { code: 'tr', flag: 'tr', native: 'Türkçe', english: 'Turkish' },
  { code: 'th', flag: 'th', native: 'ไทย', english: 'Thai' },
  { code: 'vi', flag: 'vn', native: 'Tiếng Việt', english: 'Vietnamese' },
  { code: 'pl', flag: 'pl', native: 'Polski', english: 'Polish' }
];

export const SEMESTERS = [
  { id: '2026-spring', name: '2026春季学期', start: '2026-03-01', end: '2026-07-10' },
  { id: '2026-autumn', name: '2026秋季学期', start: '2026-09-01', end: '2027-01-15' }
];

export const ACTIVE_SEMESTER_ID = '2026-autumn';

/* Both dates always carry their year. The reference drops the start year when it
 * matches the current year; the product owner asked for the full date here, so
 * that reference behaviour is deliberately not copied. Dates join on an en dash. */
export function formatSemesterRange(semester) {
  const [startYear, startMonth, startDay] = semester.start.split('-').map(Number);
  const [endYear, endMonth, endDay] = semester.end.split('-').map(Number);
  return `${startYear}年${startMonth}月${startDay}日 – ${endYear}年${endMonth}月${endDay}日`;
}

/* Categories a teacher can pull from another semester. Counts are fixtures; the
 * last one stays at zero so the disabled row state stays visible. */
export const COPYABLE_ITEMS = [
  { id: 'classes', label: '班级', unit: '个班级', icon: 'classes', count: 2 },
  { id: 'students', label: '学生', unit: '名学生', icon: 'students', count: 48 },
  { id: 'units', label: '单元', unit: '个单元', icon: 'planner', count: 6 },
  { id: 'lessons', label: '课程', unit: '节课程', icon: 'book', count: 24 },
  { id: 'standards', label: '课程标准', unit: '套标准', icon: 'standards', count: 3 },
  { id: 'topics', label: '课堂主题', unit: '个主题', icon: 'classwork', count: 0 }
];

/* Explains what copying leaves behind. The reference shows this once a source is
 * chosen; the reference wording uses an em dash where this uses a plain one. */
export function copyNotice(sourceName) {
  return `学生的提交、考勤记录和成绩仍保留在 ${sourceName} 中。单元和课程为共享而非复制 - `
    + '同一单元会出现在两个学期中，而排课按学期各自独立。';
}

/* Fixture id for a semester the teacher creates in this session. */
export function nextSemesterId(existing) {
  return `semester-${existing.length + 1}-${Date.now().toString(36)}`;
}
