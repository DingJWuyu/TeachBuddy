import { ConfirmButton } from '../../components/ui/confirm.jsx';
import { Icon2 } from '../../components/icons.jsx';
import { cx } from '../../components/ui/classNames.js';
import { tx, useLocale } from '../../i18n/presentation.js';
import { useTranslation } from 'react-i18next';
import { useEffect, useId, useRef, useState } from 'react';
import { Presence } from './chrome/Presence.jsx';

export function SettingsDisclosure({ title, children, className = '' }) {
  useTranslation("reliability");
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className={`settings-disclosure ${className}`} data-open={open}>
    <button type="button" className="settings-disclosure-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>{title}</span><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div className="settings-disclosure-grid" id={id} inert={!open} aria-hidden={!open}><div className="settings-disclosure-inner"><div className="settings-disclosure-content">{children}</div></div></div>
  </div>;
}

function SettingsDialogBody({ title, children, confirmLabel, onConfirm, onClose, danger, confirmDisabled, closeLabel, className = '' }) {
  const { t } = useTranslation("reliability");
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={dialog} className={`settings-confirm ${className}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
        .filter(element => element.getClientRects().length && !element.closest('[inert]'));
      const edge = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === edge) {
        event.preventDefault();
        (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
      }
    }}
    onClick={event => { if (event.target === event.currentTarget) {
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    } }}>
    <div className="settings-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="settings-dialog-close" onClick={onClose} aria-label={t("关闭")}>×</button></div>
    <div className="settings-confirm-copy">{children}</div>
    <div className="settings-confirm-actions"><button type="button" className="wb-button" onClick={onClose}>{closeLabel || (confirmLabel ? t("取消") : t("关闭"))}</button>
      {confirmLabel && <button type="button" className={`wb-button ${danger ? 'settings-danger-button' : 'settings-primary'}`} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</button>}</div>
  </dialog>;
}
export function SettingsConfirm({ show, ...props }) {
  useTranslation("reliability");
  return <Presence show={show}><SettingsDialogBody {...props} /></Presence>;
}

/*
 * Settings pieces the app routes through the overlay (build/patch_app.py):
 * the content background picker (three patterns and your own picture), one
 * export package row, the mock data-processing agreement, and the danger zone.
 */

const Icon = ({ name, size = 18, stroke = 1.8 }) => {
  return <Icon2 name={name} size={size} strokeWidth={stroke} />;
};

/* ---------- content background ---------- */

const MAX_EDGE = 2400;
const MAX_CHARS = 3 * 1024 * 1024;

// Shrinks a picture to a JPEG data URL the preferences service accepts.
async function encodeBackground(file) {
  const bitmap = await createImageBitmap(file);
  try {
    for (const [edge, quality] of [[MAX_EDGE, 0.86], [1920, 0.8], [1600, 0.74], [1280, 0.7]]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= MAX_CHARS) return url;
    }
    throw new Error('too-large');
  } finally {
    bitmap.close?.();
  }
}

export function BackgroundChoices({ value, image, disabled, onChange, choices }) {
  useLocale();
  const input = useRef(null);
  const selection = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const custom = value === 'custom' && image;
  useEffect(() => () => { selection.current += 1; }, []);

  function select(patch) {
    selection.current += 1;
    setBusy(false);
    onChange(patch);
  }

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      setError(tx('请选择不超过 20 MB 的 JPG、PNG 或 WebP 图片。'));
      return;
    }
    const request = ++selection.current;
    setError('');
    setBusy(true);
    try {
      const backgroundImage = await encodeBackground(file);
      if (request === selection.current) onChange({ background: 'custom', backgroundImage });
    } catch {
      if (request === selection.current) setError(tx('这张图片读不出来，换一张试试。'));
    } finally {
      if (request === selection.current) setBusy(false);
    }
  }

  return (
    <>
      <div className="settings-background-options tbx-bg-options" role="group" aria-label={tx('内容背景')}>
        {choices.map(([id, label]) => (
          <button key={id} type="button" disabled={disabled} aria-label={label} aria-pressed={value === id || (id === 'grid' && value === 'custom' && !image)} onClick={() => select({ background: id })}>
            <span className="settings-background-swatch" data-pattern={id} />
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          className={cx('tbx-bg-custom', image && 'has-image')}
          disabled={disabled || busy}
          aria-pressed={Boolean(custom)}
          aria-label={image ? tx('自定义背景') : tx('上传背景图片')}
          title={custom ? tx('点按更换图片') : undefined}
          onClick={() => (image && !custom ? select({ background: 'custom' }) : input.current?.click())}
        >
          <span className="settings-background-swatch" data-pattern="custom" style={image ? { backgroundImage: `url("${image}")` } : undefined}>
            <span className="tbx-bg-upload">
              {busy ? <span className="tbx-spinner" /> : <Icon name="upload" size={image ? 16 : 20} stroke={1.9} />}
              {!image && !busy && <em>{tx('上传图片')}</em>}
              {custom && !busy && <em>{tx('更换')}</em>}
            </span>
          </span>
          <span>{tx('自定义')}</span>
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choose} />
      </div>
      {error && <p className="tbx-bg-error" role="alert">{error}</p>}
    </>
  );
}

/* ---------- one export package ---------- */

export function ExportItem({ item, date, state, busy, working, onDownload, onDelete }) {
  useLocale();
  const pending = ['queued', 'running'].includes(item.state);
  return (
    <li className={cx('tbx-export', working && 'is-working')}>
      <span className="tbx-export-icon" aria-hidden="true"><Icon name="file" size={18} /></span>
      <span className="tbx-export-copy">
        <strong className="tbx-num">{date}</strong>
        <small className={`is-${item.state}`}>{pending && <span className="tbx-spinner is-small" />}{state}</small>
        {item.problem && <small className="is-failed">{item.problem.detail}</small>}
      </span>
      <span className="tbx-export-actions">
        {item.state === 'ready' && (
          <button type="button" className="tbx-export-btn" disabled={busy} onClick={onDownload}>
            <Icon name="arrowDown" size={15} stroke={2} />{tx('下载')}
          </button>
        )}
        <ConfirmButton label={tx('删除资料包')} disabled={busy || pending} onConfirm={onDelete} quiet />
      </span>
    </li>
  );
}

/* ---------- data-processing agreement (sample) ---------- */

const SECTIONS = [
  {
    id: 'scope',
    title: '适用范围',
    body: [
      '本协议适用于你在 TeachBuddy 中创建、上传和保存的全部内容，包括题目、资料、日程、数学作品和与教学助理的对话。',
      '在本协议中，你是数据的“控制者”，决定这些数据为何以及如何被使用；TeachBuddy 是“处理者”，只按你的指示处理它们。',
    ],
  },
  {
    id: 'purpose',
    title: '处理目的',
    body: [
      '我们只为向你提供 TeachBuddy 的功能而处理数据：保存与同步、搜索、生成预览，以及在你主动提问时由教学助理读取相关内容。',
      '我们不会出售你的数据，不会用它投放广告，也不会在未经你同意的情况下用它训练模型。',
    ],
  },
  {
    id: 'security',
    title: '安全措施',
    list: ['传输与存储全程加密', '按最小权限原则控制内部访问，并留存访问记录', '定期备份，并演练从备份中恢复'],
  },
  {
    id: 'vendors',
    title: '子处理方',
    body: ['我们可能委托云服务与模型服务提供方协助处理数据。每一家都须签署不低于本协议标准的书面协议，变更前我们会提前通知你。'],
  },
  {
    id: 'retention',
    title: '保留与删除',
    body: [
      '你可以随时在“设置”中导出全部数据，或删除账户。删除后，数据会在 30 天内从在线系统中清除，并在下一个备份周期结束后从备份中清除。',
    ],
  },
  {
    id: 'rights',
    title: '你的权利',
    list: ['查阅和导出你的数据', '更正不准确的信息', '删除数据或注销账户', '就数据处理方式提出疑问或投诉'],
  },
];

const HIGHLIGHTS = [
  ['folder', '你的资料归你所有', '我们只按你的指示保存和处理。'],
  ['shield', '不出售，不投放广告', '也不会未经同意用于训练模型。'],
  ['upload', '随时带走', '导出全部数据，或一键删除账户。'],
];

export function AgreementPaper() {
  useLocale();
  const scroller = useRef(null);
  const [active, setActive] = useState(SECTIONS[0].id);
  const lock = useRef(0);
  useEffect(() => {
    const root = scroller.current?.closest('.settings-confirm-copy');
    if (!root) return undefined;
    // The reading line starts near the top; over the last stretch of scrolling it
    // slides down the page, so the final short sections still get their turn.
    const spy = () => {
      if (Date.now() < lock.current) return;
      const box = root.getBoundingClientRect();
      const max = root.scrollHeight - root.clientHeight;
      const p = max > 0 ? root.scrollTop / max : 0;
      const slide = Math.max(0, (p - 0.55) / 0.45);
      const line = box.top + 96 + slide * Math.max(0, root.clientHeight - 120);
      let current = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = root.querySelector(`[data-section="${s.id}"]`);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      if (max > 0 && root.scrollTop >= max - 2) current = SECTIONS[SECTIONS.length - 1].id;
      setActive(current);
    };
    root.addEventListener('scroll', spy, { passive: true });
    return () => root.removeEventListener('scroll', spy);
  }, []);
  const jump = (id) => {
    const root = scroller.current?.closest('.settings-confirm-copy');
    const el = root?.querySelector(`[data-section="${id}"]`);
    // what you click is what is selected, even if it can't scroll to the top
    setActive(id);
    lock.current = Date.now() + 700;
    if (root && el) root.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
  };
  return (
    <div className="tbx-dpa" ref={scroller}>
      <nav className="tbx-dpa-toc" aria-label={tx('目录')}>
        <span className="tbx-dpa-toc-label">{tx('目录')}</span>
        {SECTIONS.map((s, i) => (
          <button key={s.id} type="button" className={cx(active === s.id && 'is-active')} onClick={() => jump(s.id)}>
            <span className="tbx-num">{i + 1}</span>{tx(s.title)}
          </button>
        ))}
      </nav>
      <article className="tbx-dpa-paper">
        <header className="tbx-dpa-head">
          <span className="tbx-dpa-badge">{tx('示例')}</span>
          <h3>{tx('TeachBuddy 数据处理协议')}</h3>
          <p className="tbx-dpa-meta">{tx('版本 0.1 · 生效日期 2026 年 9 月 1 日')}</p>
          <p className="tbx-dpa-lead">{tx('这份协议说明 TeachBuddy 如何代你处理教学数据：处理什么、为什么处理，以及你始终拥有哪些权利。')}</p>
        </header>
        <ul className="tbx-dpa-highlights">
          {HIGHLIGHTS.map(([icon, title, note]) => (
            <li key={title}>
              <span className="tbx-dpa-hl-icon"><Icon name={icon} size={18} /></span>
              <strong>{tx(title)}</strong>
              <small>{tx(note)}</small>
            </li>
          ))}
        </ul>
        {SECTIONS.map((s, i) => (
          <section key={s.id} data-section={s.id} className="tbx-dpa-section">
            <h4><span className="tbx-num">{String(i + 1).padStart(2, '0')}</span>{tx(s.title)}</h4>
            {s.body?.map((p) => <p key={p}>{tx(p)}</p>)}
            {s.list && <ul>{s.list.map((x) => <li key={x}>{tx(x)}</li>)}</ul>}
          </section>
        ))}
        <aside className="tbx-dpa-note" role="note">
          <Icon name="info" size={18} />
          <div>
            <strong>{tx('这是一份模拟协议')}</strong>
            <p>{tx('TeachBuddy 目前还没有正式的数据处理协议。以上内容仅用于展示页面排版，不构成任何承诺，也不具备法律效力。正式协议发布后，会在这里替换并通知你。')}</p>
          </div>
        </aside>
      </article>
    </div>
  );
}

/* ---------- danger zone ---------- */

export function DangerZone({ onDelete }) {
  useLocale();
  return (
    <section className="settings-sheet tbx-danger" aria-labelledby="tbx-danger-title">
      <header className="tbx-danger-head">
        <span className="tbx-danger-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4m0 4h.01" />
          </svg>
        </span>
        <div>
          <h2 id="tbx-danger-title">{tx('危险操作')}</h2>
          <p>{tx('这里的操作无法撤销，请确认后再继续。')}</p>
        </div>
      </header>
      <div className="tbx-danger-row">
        <div className="tbx-danger-copy">
          <h3>{tx('删除账户')}</h3>
          <p>{tx('永久删除账户和全部数据，包括题库、日程、资料与助理对话。')}</p>
        </div>
        <button type="button" className="tbx-danger-btn" onClick={onDelete}>
          <Icon name="trash" size={16} />{tx('删除账户…')}
        </button>
      </div>
    </section>
  );
}
