import { Cast } from './auth/Cast.jsx';
import { EntryLayout, SUBTITLES } from './auth/EntryLayout.jsx';
import { BrandMark } from './shell/BrandMark.jsx';
import { Topbar } from './shell/Topbar.jsx';
import { Sidebar } from './shell/Sidebar.jsx';
import { AuxPanel } from './shell/AuxPanel.jsx';
import { buildGlyphs } from './shell/glyphs.jsx';
import { AgentWorkspace, Home } from './agent/AgentWorkspace.jsx';
import { FocusToggle, TaskBoard } from './schedule/TaskBoard.jsx';
import { agentScript } from './agent/script.js';
import { EntryEditor } from './schedule/EntryEditor.jsx';
import { tx } from './react.js';
import { HelpCenter } from './help/HelpCenter.jsx';
import { ResourceLibrary } from './resources/ResourceLibrary.jsx';
import { MathHome } from './math/MathHome.jsx';
import { QuestionFinder, QuestionWelcome } from './questions/QuestionFinder.jsx';
import { ClassroomPage } from './classroom/ClassroomPage.jsx';
import { BackgroundChoices, ExportItem, AgreementPaper, DangerZone } from './settings/Settings.jsx';
import { installLocales } from './locales/install.js';
import { confirmDialog, ConfirmButton, ConfirmMenuItem, ConfirmDialog, AppConfirmDialog } from './kit/confirm.jsx';
import { Rail, RailSection } from './kit/rail.jsx';

// One reply for each kind of feedback: what was heard, and what happens next.
const FEEDBACK_REPLIES = {
  建议: { title: '好主意，收到了。', note: '每一条建议，我们都会认真读完。' },
  错误报告: { title: '谢谢你帮我们找到它。', note: '我们会尽快修好这个问题。' },
  问题: { title: '你的问题，我们收到了。', note: '我们会尽快给你答复。' },
  赞扬: { title: '这句话，我们会记很久。', note: '谢谢你，这对我们意义重大。' },
};

let glyphs = null;
// Components the app bundle routes through (see build/patch_app.py).
// Copy the app reads by key is translated on the way out.
const translated = (table, map) => new Proxy(table, { get: (o, k) => (o[k] == null ? undefined : map(o[k])) });
globalThis.__tbx = {
  authSubtitles: translated(SUBTITLES, (v) => tx(v)),
  feedbackReplies: translated(FEEDBACK_REPLIES, (v) => ({ title: tx(v.title), note: tx(v.note) })),
  installLocales,
  ...(globalThis.__tbx || {}),
  AuthCharacters: Cast,
  AuthEntryLayout: EntryLayout,
  BrandMark,
  Topbar,
  Sidebar,
  AuxiliaryPanel: AuxPanel,
  AgentWorkspace,
  Home,
  FocusToggle,
  TaskBoard,
  agentScript,
  CalendarEditor: EntryEditor,
  SupportHelp: HelpCenter,
  Library: ResourceLibrary,
  WorkspaceHome: MathHome,
  QuestionFinder,
  QuestionWelcome,
  ClassroomPage,
  BackgroundChoices,
  ExportItem,
  AgreementPaper,
  DangerZone,
  // shared kit, also used by patches inside the app bundle
  confirmDialog,
  ConfirmButton,
  ConfirmMenuItem,
  ConfirmDialog: AppConfirmDialog,
  KitConfirmDialog: ConfirmDialog,
  Rail,
  RailSection,
};
// Glyphs are React elements, so they are built on first use, once React is up.
Object.defineProperty(globalThis.__tbx, 'glyphs', {
  configurable: true,
  get() { return glyphs || (glyphs = buildGlyphs()); },
});
