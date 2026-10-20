import { h, Fragment } from '../shim.js';
import { useEffect, useMemo, useRef, useState, cx, tx } from '../react.js';
import { api } from './api.js';
import { Icon, Menu, Dialog, Field, Empty, Spinner } from './ui.jsx';
import { longDate, fmt, pct, sum, today, hueOf, classMark } from './util.js';
import { isEnglish } from '../react.js';

/*
 * Exams: one paper, one date, any number of classes. Questions are the
 * smallest scored parts; a group title only organises them. Tags are the
 * teacher's own words, reused across papers.
 */

const imported = (imports) => {
  const map = new Map();
  for (const i of imports) if (i.state === 'confirmed') map.set(`${i.examId}:${i.classId}`, i);
  return map;
};

export function ExamList({ ctx }) {
  const [imports, setImports] = useState([]);
  useEffect(() => { api.get('/imports').then((r) => setImports(r.items)).catch(() => {}); }, [ctx.data.exams.length]);
  const done = imported(imports);
  const exams = ctx.data.exams;
  return (
    <div className="cr-page">
      <header className="cr-head">
        <div className="cr-head-title is-plain">
          <div>
            <h2>{tx('考试')}</h2>
            <span>{tx('{{n}} 场 · 一份试卷可以给多个班用', { n: exams.length })}</span>
          </div>
        </div>
        <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('exam')}><Icon name="plus" size={15} stroke={2.2} />{tx('新建考试')}</button>
      </header>
      <div className="cr-page-scroll">
        {!exams.length ? (
          <Empty icon="file" title={tx('还没有考试')} text={tx('一场考试就是同一次、同一份试卷：名称、日期、每道计分题的满分。建好后把各班的成绩表导进来。')}>
            <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('exam')}><Icon name="plus" size={15} stroke={2.2} />{tx('新建考试')}</button>
          </Empty>
        ) : (
          <div className="cr-exams">
            {exams.map((e, i) => (
              <button key={e.id} type="button" className="cr-exam-card" style={{ '--i': i }} onClick={() => ctx.go({ examId: e.id })}>
                <span className="cr-datebox">
                  <small>{isEnglish() ? new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : tx('{{m}} 月', { m: Number(e.date.slice(5, 7)) })}</small>
                  <strong>{Number(e.date.slice(8, 10))}</strong>
                </span>
                <span className="cr-exam-card-text">
                  <strong>{e.name}</strong>
                  <small>{[e.subject, tx('满分 {{n}}', { n: fmt(e.fullScore) }), tx('{{n}} 道计分题', { n: e.questions.length }), e.source.files.length ? tx('有原卷') : null].filter(Boolean).join(' · ')}</small>
                  <span className="cr-class-chips">
                    {ctx.data.classes.map((c) => (
                      <span key={c.id} className={cx('cr-class-chip', done.has(`${e.id}:${c.id}`) ? 'is-done' : 'is-todo')}>
                        {done.has(`${e.id}:${c.id}`) ? <Icon name="check" size={11} stroke={2.6} /> : <i />}{c.name}
                      </span>
                    ))}
                  </span>
                </span>
                <Icon name="chevron" size={15} stroke={2} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- create / edit an exam ---------- */
function TagPicker({ ctx, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open]);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const add = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try {
      const tag = await api.post('/tags', { name: n });
      await ctx.reload();
      onChange([...value, tag.id]);
    } catch (err) {
      if (err.problem?.tagId) onChange([...new Set([...value, err.problem.tagId])]);
      else ctx.toast(err.message, 'error');
    }
    setName('');
  };
  return (
    <span className="cr-menuwrap" ref={ref}>
      <button type="button" className={cx('cr-tagcell', open && 'is-on')} onClick={() => setOpen(!open)} aria-expanded={open}>
        {value.length ? value.map((id) => <span key={id} className="cr-tagmini">{ctx.data.tags.find((t) => t.id === id)?.name}</span>) : <span className="cr-muted">{tx('添加标签')}</span>}
      </button>
      {open && (
        <div className="cr-menu is-end cr-tagmenu" role="menu" aria-label={tx('标签')}>
          {ctx.data.tags.map((t) => (
            <button key={t.id} type="button" role="menuitemcheckbox" aria-checked={value.includes(t.id)} onClick={() => toggle(t.id)}>
              <span>{t.name}</span>{value.includes(t.id) && <Icon name="check" size={14} stroke={2.4} />}
            </button>
          ))}
          {ctx.data.tags.length > 0 && <div className="cr-menu-sep" />}
          <form className="cr-tagmenu-new" onSubmit={add}>
            <input value={name} maxLength={40} placeholder={tx('新标签')} aria-label={tx('新标签')} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="cr-icon-btn is-small is-filled" aria-label={tx('添加')} disabled={!name.trim()}><Icon name="plus" size={12} stroke={2.6} /></button>
          </form>
        </div>
      )}
    </span>
  );
}

export function ExamForm({ ctx, initial, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    date: initial?.date ?? today(),
    subject: initial?.subject ?? tx('数学'),
    fullScore: initial ? String(initial.fullScore) : '',
    questions: initial?.questions.map((q) => ({ ...q, fullScore: String(q.fullScore) })) ?? [],
  });
  const [bulk, setBulk] = useState({ count: '10', score: '10' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const total = sum(form.questions.map((q) => Number(q.fullScore) || 0));
  const patchQ = (i, patch) => setForm({ ...form, questions: form.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const addMany = () => {
    const n = Math.min(100, Math.max(1, Number(bulk.count) || 0));
    const start = form.questions.length;
    setForm({ ...form, questions: [...form.questions, ...Array.from({ length: n }, (_, i) => ({ label: String(start + i + 1), group: '', fullScore: bulk.score, tagIds: [] }))] });
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = {
        name: form.name, date: form.date, subject: form.subject,
        fullScore: form.fullScore ? Number(form.fullScore) : total,
        questions: form.questions.map((q) => ({ ...(q.id ? { id: q.id } : {}), label: q.label, group: q.group || '', fullScore: Number(q.fullScore), tagIds: q.tagIds })),
      };
      const saved = initial ? await api.put(`/exams/${initial.id}`, { baseVersion: initial.version, ...body }) : await api.post('/exams', body);
      await ctx.reload();
      ctx.toast(initial ? tx('已保存') : tx('考试已创建'));
      ctx.go({ view: 'exams', examId: saved.id });
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const covered = form.fullScore && total && Number(form.fullScore) !== total;
  return (
    <Dialog
      wide
      title={initial ? tx('编辑考试') : tx('新建考试')}
      subtitle={tx('计分题是最小的计分单位，可以是小问。大题标题写在“分组”里，不会再算一次分。')}
      onClose={onClose}
      footer={(
        <>
          <span className="cr-muted">{tx('{{n}} 道题，合计 {{s}} 分', { n: form.questions.length, s: fmt(total) })}</span>
          <span className="cr-grow" />
          <button type="button" className="cr-btn" onClick={onClose}>{tx('取消')}</button>
          <button type="button" className="cr-btn is-primary" disabled={busy || !form.name.trim() || !form.questions.length} onClick={save}>{initial ? tx('保存') : tx('创建考试')}</button>
        </>
      )}
    >
      <div className="cr-form">
        <div className="cr-form-row is-exam">
          <Field label={tx('考试名称')}><input value={form.name} maxLength={80} placeholder={tx('例如：期中考试')} onChange={set('name')} /></Field>
          <Field label={tx('日期')}><input type="date" value={form.date} onChange={set('date')} /></Field>
          <Field label={tx('学科')}><input value={form.subject} maxLength={40} onChange={set('subject')} /></Field>
          <Field label={tx('总满分')} hint={tx('选填')}><input inputMode="decimal" value={form.fullScore} placeholder={total ? fmt(total) : '100'} title={tx('留空就用计分题合计')} onChange={set('fullScore')} /></Field>
        </div>
        {covered && <p className="cr-note"><Icon name="info" size={14} stroke={2} />{tx('计分题合计 {{s}}，和总满分 {{f}} 不同。只有逐题完整覆盖整卷时，才会检查总分和逐题之和是否一致。', { s: fmt(total), f: form.fullScore })}</p>}
        <div className="cr-qtable">
          {form.questions.length > 0 && <div className="cr-qtable-head"><span>{tx('分组')}</span><span>{tx('题号')}</span><span>{tx('满分')}</span><span>{tx('标签')}</span><span /></div>}
          {form.questions.map((q, i) => (
            <div key={q.id || i} className="cr-qrow">
              <input aria-label={tx('分组')} value={q.group} placeholder={tx('如：一、选择题')} onChange={(e) => patchQ(i, { group: e.target.value })} />
              <input aria-label={tx('题号')} value={q.label} onChange={(e) => patchQ(i, { label: e.target.value })} />
              <input aria-label={tx('满分')} inputMode="decimal" value={q.fullScore} onChange={(e) => patchQ(i, { fullScore: e.target.value })} />
              <TagPicker ctx={ctx} value={q.tagIds} onChange={(tagIds) => patchQ(i, { tagIds })} />
              <button type="button" className="cr-icon-btn is-small" aria-label={tx('移除这道题')} onClick={() => setForm({ ...form, questions: form.questions.filter((_, j) => j !== i) })}><Icon name="close" size={12} stroke={2.4} /></button>
            </div>
          ))}
          <div className="cr-qadd">
            <span>{tx('添加')}</span>
            <input aria-label={tx('题数')} inputMode="numeric" value={bulk.count} onChange={(e) => setBulk({ ...bulk, count: e.target.value })} />
            <span>{tx('道题，每题')}</span>
            <input aria-label={tx('每题满分')} inputMode="decimal" value={bulk.score} onChange={(e) => setBulk({ ...bulk, score: e.target.value })} />
            <span>{tx('分')}</span>
            <button type="button" className="cr-btn is-small" onClick={addMany}><Icon name="plus" size={13} stroke={2.4} />{tx('添加')}</button>
          </div>
        </div>
        {error && <p className="cr-error">{error}</p>}
      </div>
    </Dialog>
  );
}

/* ---------- one exam ---------- */
export function ExamDetail({ ctx, exam }) {
  const [comparison, setComparison] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api.get(`/exams/${exam.id}/comparison`).then((c) => live && setComparison(c)).catch(() => live && setComparison(false));
    return () => { live = false; };
  }, [exam.id, exam.version]);
  const tagName = useMemo(() => new Map(ctx.data.tags.map((t) => [t.id, t.name])), [ctx.data.tags]);
  const groups = [];
  for (const q of exam.questions) {
    if (!groups.length || groups.at(-1).group !== q.group) groups.push({ group: q.group, items: [] });
    groups.at(-1).items.push(q);
  }
  const total = sum(exam.questions.map((q) => q.fullScore));
  const upload = async (files) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const stored = [];
      for (const f of files) stored.push(await api.upload(f));
      await api.put(`/exams/${exam.id}`, { baseVersion: exam.version, source: { files: [...exam.source.files, ...stored.map((s) => ({ fileId: s.id }))] } });
      await ctx.reload();
      ctx.toast(tx('原卷已上传'));
    } catch (err) { ctx.toast(err.message, 'error'); } finally { setBusy(false); }
  };
  const removeFile = async (fileId) => {
    try {
      await api.put(`/exams/${exam.id}`, { baseVersion: exam.version, source: { files: exam.source.files.filter((f) => f.fileId !== fileId) } });
      await ctx.reload();
    } catch (err) { ctx.toast(err.message, 'error'); }
  };
  const classes = comparison?.classes ?? [];
  const shown = classes.filter((c) => c.state === 'ok');
  return (
    <div className="cr-page">
      <header className="cr-head">
        <button type="button" className="cr-back" onClick={() => ctx.go({ examId: null })}><Icon name="arrowLeft" size={16} stroke={2.2} /><span>{tx('考试')}</span></button>
        <span className="cr-grow" />
        <button type="button" className="cr-btn" onClick={() => ctx.open('exam', { initial: exam })}><Icon name="pencil" size={14} stroke={2} />{tx('编辑')}</button>
        <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('import', { examId: exam.id })}><Icon name="upload" size={14} stroke={2} />{tx('导入成绩')}</button>
        <Menu label={tx('考试操作')} items={[{ label: tx('归档考试'), icon: 'trash', danger: true, onClick: () => ctx.open('confirm', {
          title: tx('归档“{{name}}”？', { name: exam.name }),
          message: tx('归档后这场考试退出统计；恢复后，原来的成绩会重新参与。'),
          confirmLabel: tx('归档'),
          onConfirm: async () => { await api.remove('exams', exam); ctx.go({ examId: null }); await ctx.reload(); ctx.toast(tx('已归档')); },
        }) }]} />
      </header>
      <div className="cr-page-scroll">
        <section className="cr-exam-hero">
          <span className="cr-datebox is-big">
            <small>{isEnglish() ? new Date(`${exam.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) : tx('{{m}} 月', { m: Number(exam.date.slice(5, 7)) })}</small>
            <strong>{Number(exam.date.slice(8, 10))}</strong>
          </span>
          <div>
            <h2>{exam.name}</h2>
            <p>{[longDate(exam.date), exam.subject, tx('满分 {{n}}', { n: fmt(exam.fullScore) }), tx('{{n}} 道计分题', { n: exam.questions.length })].filter(Boolean).join(' · ')}</p>
          </div>
        </section>

        <div className="cr-panel">
          <div className="cr-panel-head">
            <h3>{tx('同场比较')}</h3>
            <span className="cr-muted">{tx('同一份试卷、同一套口径；没有成绩的班级不记零。')}</span>
          </div>
          {comparison === null ? <div className="cr-loading is-inline"><Spinner /></div> : (
            <>
              <ul className="cr-compare">
                {classes.map((c, i) => (
                  <li key={c.classId} style={{ '--i': i }} className={cx(c.state !== 'ok' && 'is-none')}>
                    <span className={cx('cr-place-dot', `is-${hueOf(c.classId)}`)}>{classMark(c.name)}</span>
                    <strong>{c.name}</strong>
                    {c.state === 'ok' ? (
                      <>
                        <span className="cr-rate-track is-big"><span className="cr-rate-fill" style={{ '--w': c.mean / exam.fullScore }} /></span>
                        <span className="cr-compare-num"><b>{fmt(c.mean)}</b><small>{tx('平均 · {{r}}', { r: pct(c.mean / exam.fullScore) })}</small></span>
                        <span className="cr-compare-num"><b>{fmt(c.median)}</b><small>{tx('中位数')}</small></span>
                        <span className="cr-compare-num"><b>{c.present}</b><small>{c.absent ? tx('缺考 {{n}}', { n: c.absent }) : tx('参加')}</small></span>
                      </>
                    ) : (
                      <>
                        <span className="cr-none">{tx('无结果')}</span>
                        <button type="button" className="cr-btn is-small" onClick={() => ctx.open('import', { examId: exam.id, classId: c.classId })}><Icon name="upload" size={13} stroke={2} />{tx('导入这个班')}</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {shown.length > 0 && (
                <div className="cr-qcompare" style={{ '--n': shown.length }}>
                  <div className="cr-qcompare-row is-head">
                    <span>{tx('题目')}</span>
                    {shown.map((c) => <span key={c.classId}>{c.name}</span>)}
                  </div>
                  {exam.questions.map((q) => (
                    <div key={q.id} className="cr-qcompare-row">
                      <span><b>{q.group ? `${q.group} ${q.label}` : q.label}</b><small>{fmt(q.fullScore)} {tx('分')}</small></span>
                      {shown.map((c) => {
                        const r = c.questions.find((x) => x.id === q.id)?.rate;
                        return (
                          <span key={c.classId} className="cr-qcompare-cell">
                            <span className="cr-rate-track"><span className={cx('cr-rate-fill', r != null && r < 0.6 && 'is-low')} style={{ '--w': r ?? 0 }} /></span>
                            <small>{pct(r)}</small>
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="cr-split">
          <div className="cr-panel">
            <div className="cr-panel-head">
              <h3>{tx('计分题')}</h3>
              <span className={cx('cr-muted', total !== exam.fullScore && 'is-warn')}>{total === exam.fullScore ? tx('合计 {{s}}，覆盖整卷', { s: fmt(total) }) : tx('合计 {{s}} / 满分 {{f}}', { s: fmt(total), f: fmt(exam.fullScore) })}</span>
            </div>
            <div className="cr-qlist">
              {groups.map((g, gi) => (
                <div key={gi} className="cr-qgroup">
                  {g.group && <h4>{g.group}</h4>}
                  {g.items.map((q) => (
                    <div key={q.id} className="cr-qitem">
                      <strong>{q.label}</strong>
                      <span className="cr-qitem-tags">{q.tagIds.map((id) => <span key={id} className="cr-tagmini">{tagName.get(id)}</span>)}</span>
                      <small>{tx('{{n}} 分', { n: fmt(q.fullScore) })}</small>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="cr-panel">
            <div className="cr-panel-head">
              <h3>{tx('原卷')}</h3>
              <label className={cx('cr-btn is-small', busy && 'is-disabled')}>
                <Icon name="upload" size={13} stroke={2} />{tx('上传')}
                <input type="file" hidden multiple accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(e) => { upload([...e.target.files]); e.target.value = ''; }} />
              </label>
            </div>
            {exam.source.files.length ? (
              <ul className="cr-files">
                {exam.source.files.map((f) => (
                  <li key={f.fileId}>
                    {f.mediaType?.startsWith('image/') ? <img src={api.fileUrl(f.fileId)} alt="" /> : <span className="cr-file-icon"><Icon name="file" size={18} stroke={1.8} /><em>{(f.name.split('.').pop() || '').toUpperCase()}</em></span>}
                    <a href={api.fileUrl(f.fileId)} target="_blank" rel="noreferrer">{f.name}</a>
                    <button type="button" className="cr-icon-btn is-small" aria-label={tx('移除')} onClick={() => removeFile(f.fileId)}><Icon name="close" size={12} stroke={2.4} /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="cr-muted cr-pad">{tx('Word、PDF 或图片都可以。没有原卷，成绩也能照常保存；只是看题时少了证据。')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- tags ---------- */
export function TagManager({ ctx }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const usage = new Map();
  for (const e of ctx.data.exams) for (const q of e.questions) for (const id of q.tagIds) usage.set(id, (usage.get(id) || 0) + 1);
  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api.post('/tags', { name }); setName(''); await ctx.reload(); } catch (err) { ctx.toast(err.message, 'error'); }
  };
  const rename = async (tag) => {
    try { await api.put(`/tags/${tag.id}`, { baseVersion: tag.version, name: draft }); setEditing(null); await ctx.reload(); } catch (err) { ctx.toast(err.message, 'error'); }
  };
  const merge = (tag, target) => ctx.open('confirm', {
    title: tx('把“{{a}}”合并到“{{b}}”？', { a: tag.name, b: target.name }),
    message: tx('所有题目上的“{{a}}”会换成“{{b}}”，之后只剩“{{b}}”。', { a: tag.name, b: target.name }),
    confirmLabel: tx('合并'),
    onConfirm: async () => { await api.post(`/tags/${tag.id}/merge`, { baseVersion: tag.version, targetId: target.id, targetVersion: target.version }); await ctx.reload(); ctx.toast(tx('已合并')); },
  });
  return (
    <div className="cr-page">
      <header className="cr-head">
        <div className="cr-head-title is-plain">
          <div>
            <h2>{tx('题目标签')}</h2>
            <span>{tx('用你自己的话给题目分类，长期复用；可以改名，也可以合并。')}</span>
          </div>
        </div>
      </header>
      <div className="cr-page-scroll">
        <form className="cr-tagnew" onSubmit={create}>
          <Icon name="tag" size={15} stroke={2} />
          <input value={name} maxLength={40} placeholder={tx('新标签，例如：二次函数、几何证明')} aria-label={tx('新标签')} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="cr-btn is-primary is-small" disabled={!name.trim()}>{tx('添加')}</button>
        </form>
        {!ctx.data.tags.length ? <Empty compact icon="tag" title={tx('还没有标签')} text={tx('标签贴在试卷的题目上，一次标注，全班共用。')} /> : (
          <ul className="cr-tags">
            {ctx.data.tags.map((t, i) => (
              <li key={t.id} style={{ '--i': i }}>
                <span className="cr-tag-icon"><Icon name="tag" size={14} stroke={2} /></span>
                {editing === t.id ? (
                  <form className="cr-tag-edit" onSubmit={(e) => { e.preventDefault(); rename(t); }}>
                    <input autoFocus value={draft} maxLength={40} aria-label={tx('标签名称')} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
                    <button type="submit" className="cr-btn is-primary is-small">{tx('保存')}</button>
                  </form>
                ) : (
                  <>
                    <strong>{t.name}</strong>
                    <small>{usage.get(t.id) ? tx('{{n}} 道题', { n: usage.get(t.id) }) : tx('还没用过')}</small>
                    <span className="cr-grow" />
                    <Menu label={tx('标签操作')} items={[
                      { label: tx('改名'), icon: 'pencil', onClick: () => { setEditing(t.id); setDraft(t.name); } },
                      ...(ctx.data.tags.length > 1 ? ['-', ...ctx.data.tags.filter((x) => x.id !== t.id).map((x) => ({ label: tx('合并到“{{b}}”', { b: x.name }), onClick: () => merge(t, x) }))] : []),
                    ]} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
