import { readLocal, writeLocal, removeLocal } from '../../platform/device/storage.js';
import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { Icon, Avatar, Dialog, Field, Seg, Spinner } from './ui.jsx';
import { xlsx, download } from './util.js';

/*
 * Bringing in a score sheet: choose the file, say which columns are which,
 * check every row against the class list, then confirm. Nothing is guessed
 * silently: unmatched names, duplicates and impossible scores must be dealt
 * with, and the original sheet stays beside the result.
 */

const STEPS = ['选择成绩表', '对应表格的列', '逐行校对'];
const letter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const clean = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

function ColSelect({ value, onChange, label, optional, columns }) {
  return (
    <Field label={label} hint={optional ? tx('选填') : null}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">{optional ? tx('没有这一列') : tx('选择一列')}</option>
        {columns.map(([n, text]) => <option key={n} value={n}>{text}</option>)}
      </select>
    </Field>
  );
}

function guess(sheet, exam) {
  const rows = sheet.rows;
  let header = rows.findIndex((r) => r?.some((c) => /姓名|学号|name/i.test(c?.text ?? '')));
  if (header < 0) header = 0;
  const head = (rows[header] || []).map((c) => clean(c?.text));
  const find = (re) => { const i = head.findIndex((t) => re.test(t)); return i >= 0 ? i + 1 : null; };
  // "第 3 题", "3", "Q3", "选择题3" all name the same question
  const core = (t) => clean(t).toLowerCase().replace(/^(第|q|question)/, '').replace(/(小题|题)$/, '');
  const questionCols = {};
  const used = new Set();
  for (const q of exam.questions) {
    const keys = [core(q.label), core(`${q.group}${q.label}`), clean(`${q.group}${q.label}`)].filter(Boolean);
    const i = head.findIndex((t, at) => !used.has(at) && t && (keys.includes(core(t)) || keys.includes(t)));
    if (i >= 0) { questionCols[q.id] = i + 1; used.add(i); }
  }
  // no 缺考 header? look for a column whose cells say so (often 备注)
  let absentCol = find(/缺考|absent/);
  if (!absentCol) {
    const width = Math.max(0, ...rows.map((r) => r?.length || 0));
    for (let c = 0; c < width && !absentCol; c++) {
      if (rows.slice(header + 1).some((r) => /^(缺考|缺|absent)$/i.test(clean(r?.[c]?.text)))) absentCol = c + 1;
    }
  }
  return {
    sheet: 0,
    headerRow: header + 1,
    firstRow: header + 2,
    lastRow: rows.length,
    nameCol: find(/姓名|^name$/),
    numberCol: find(/学号|考号|^id$|number/),
    totalCol: find(/总分|合计|total/),
    absentCol,
    questionCols,
  };
}

export function ImportDialog({ ctx, examId: givenExam, classId: givenClass, onClose }) {
  const [savedDraft] = useState(() => readLocal(ctx.accountKey, 'draft:classroom-import'));
  const [step, setStep] = useState(0);
  const [examId, setExamId] = useState(givenExam || savedDraft?.examId || ctx.data.exams[0]?.id || '');
  const [classId, setClassId] = useState(givenClass || savedDraft?.classId || ctx.data.classes[0]?.id || '');
  const [draft, setDraft] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drop, setDrop] = useState(false);
  const [filter, setFilter] = useState('issues');
  const [done, setDone] = useState(null);
  const exam = ctx.data.exams.find((e) => e.id === examId);
  const cls = ctx.data.classes.find((c) => c.id === classId);
  const roster = ctx.data.students.filter((s) => s.classId === classId);
  useEffect(() => {
    if (!savedDraft?.id || (givenExam && givenExam !== savedDraft.examId) || (givenClass && givenClass !== savedDraft.classId)) return;
    let live = true;
    setBusy(true);
    ctx.api.get(`/imports/${savedDraft.id}`).then(d => {
      if (!live) return;
      setDraft(d); setExamId(d.examId); setClassId(d.classId);
      setMapping(d.mapping || guess(d.workbook.sheets[0], ctx.data.exams.find(e => e.id === d.examId)));
      if (d.state === 'confirmed') {
        setDone({ present: d.rows.filter(r => !r.ignored && r.status === 'present').length, absent: d.rows.filter(r => !r.ignored && r.status === 'absent').length, unrecorded: d.unrecorded.length }); setStep(3);
      } else setStep(d.mapping ? 2 : 1);
    }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (draft?.id && step < 3) writeLocal(ctx.accountKey, 'draft:classroom-import', { id: draft.id, examId, classId });
    if (step === 3) removeLocal(ctx.accountKey, 'draft:classroom-import');
  }, [draft?.id, examId, classId, step]);


  const template = () => {
    const head = [tx('学号'), tx('姓名'), tx('缺考'), ...exam.questions.map((q) => q.label), tx('总分')];
    const rows = [...roster].sort((a, b) => (a.studentNo || '~').localeCompare(b.studentNo || '~')).map((s) => [s.studentNo || '', s.name]);
    download(xlsx([head, ...rows], tx('成绩')), `${cls.name}-${exam.name}.xlsx`);
  };

  const choose = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const stored = await ctx.api.upload(file);
      const created = await ctx.api.post('/imports', { examId, classId, fileId: stored.id });
      setDraft(created);
      setMapping(guess(created.workbook.sheets[0], exam));
      setStep(1);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const build = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await ctx.api.put(`/imports/${draft.id}`, { baseVersion: draft.version, mapping, rows: null });
      setDraft(next);
      setFilter(next.summary.errors || next.summary.warnings ? 'issues' : 'all');
      setStep(2);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const queue = useRef(Promise.resolve());
  const edit = (row, change) => {
    const patch = change.scores ? { ...change, scores: { ...row.scores, ...change.scores } } : change;
    const body = { sourceRow: row.sourceRow, studentId: row.studentId, status: row.status, total: row.total, scores: row.scores, ignored: row.ignored, ...patch };
    setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.sourceRow === row.sourceRow ? { ...r, ...patch } : r)) }));
    queue.current = queue.current.then(async () => {
      try {
        const latest = await ctx.api.get(`/imports/${draft.id}`);
        const next = await ctx.api.put(`/imports/${draft.id}`, { baseVersion: latest.version, mapping: null, rows: latest.rows.map(r => r.sourceRow === body.sourceRow ? body : r) });
        setDraft(next);
      } catch (err) { setError(err.message); }
    });
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await queue.current;
      await ctx.api.recover();
      const latest = await ctx.api.get(`/imports/${draft.id}`);
      if (latest.state !== 'confirmed') {
        const reviewed = await ctx.api.put(`/imports/${draft.id}`, { baseVersion: latest.version, rows: latest.rows });
        await ctx.api.post(`/imports/${draft.id}/confirmation`, { baseVersion: reviewed.version });
      }
      await ctx.reload();
      setDone({ present: latest.rows.filter((r) => !r.ignored && r.studentId && r.status === 'present').length, absent: latest.rows.filter((r) => !r.ignored && r.studentId && r.status === 'absent').length, unrecorded: latest.unrecorded.length });
      setStep(3);
    } catch (err) {
      setError(err.problem?.errors ? tx('还有 {{n}} 处需要处理', { n: err.problem.errors.length }) : err.message);
      const latest = await ctx.api.get(`/imports/${draft.id}`).catch(() => null);
      if (latest) setDraft(latest);
    } finally { setBusy(false); }
  };

  const sheet = draft && mapping && draft.workbook.sheets[mapping.sheet];
  const width = sheet ? Math.max(0, ...sheet.rows.map((r) => r?.length || 0)) : 0;
  const header = sheet && (sheet.rows[(mapping.headerRow || 1) - 1] || []);
  const columns = Array.from({ length: width }, (_, i) => [i + 1, `${letter(i + 1)}${header?.[i]?.text ? ` · ${header[i].text}` : ''}`]);
  const mappedCols = new Map();
  if (mapping) {
    if (mapping.nameCol) mappedCols.set(mapping.nameCol, tx('姓名'));
    if (mapping.numberCol) mappedCols.set(mapping.numberCol, tx('学号'));
    if (mapping.totalCol) mappedCols.set(mapping.totalCol, tx('总分'));
    if (mapping.absentCol) mappedCols.set(mapping.absentCol, tx('缺考'));
    for (const q of exam?.questions || []) if (mapping.questionCols[q.id]) mappedCols.set(mapping.questionCols[q.id], q.label);
  }

  const rows = draft?.rows || [];
  const errorsOf = (r) => (r.issues || []).filter((i) => i.level === 'error');
  const shownRows = rows.filter((r) => filter === 'all' || (filter === 'issues' && (r.issues || []).length) || (filter === 'ignored' && r.ignored));
  const unrecorded = (draft?.unrecorded || []).map((id) => roster.find((s) => s.id === id)).filter(Boolean);

  let body, footer;
  if (step === 0) {
    body = (
      <div className="cr-import-start">
        <div className="cr-form-row">
          <Field label={tx('考试')}>
            <select value={examId} onChange={(e) => setExamId(e.target.value)} disabled={Boolean(givenExam)}>
              {ctx.data.exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
          <Field label={tx('哪个班')}>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={Boolean(givenClass)}>
              {ctx.data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        {!exam ? <p className="cr-note"><Icon name="info" size={14} stroke={2} />{tx('先新建一场考试，写好每道计分题的满分。')}</p> : (
          <>
            <label
              className={cx('cr-drop', drop && 'is-over', busy && 'is-busy')}
              onDragOver={(e) => { e.preventDefault(); setDrop(true); }}
              onDragLeave={() => setDrop(false)}
              onDrop={(e) => { e.preventDefault(); setDrop(false); choose(e.dataTransfer.files[0]); }}
            >
              <span className="cr-drop-icon">{busy ? <Spinner /> : <Icon name="upload" size={22} stroke={2} />}</span>
              <strong>{busy ? tx('正在读取表格…') : tx('把成绩表拖到这里，或点一下选择')}</strong>
              <small>{tx('Excel（.xlsx），最大 10 MB。有逐题得分就一起导入；只有总分也可以。')}</small>
              <input type="file" hidden accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" disabled={busy || !classId} onChange={(e) => { choose(e.target.files[0]); e.target.value = ''; }} />
            </label>
            {roster.length > 0 && (
              <button type="button" className="cr-link" onClick={template}>
                <Icon name="arrowDown" size={13} stroke={2.2} />{tx('没有现成的表？下载一份带{{cls}}名单的模板', { cls: cls?.name })}
              </button>
            )}
          </>
        )}
      </div>
    );
    footer = <><span className="cr-grow" /><button type="button" className="cr-btn" disabled={busy} onClick={onClose}>{tx('取消')}</button></>;
  } else if (step === 1) {
    body = (
      <div className="cr-import-map">
        <div className="cr-import-file"><Icon name="file" size={16} stroke={2} /><strong>{draft.fileName}</strong><small>{tx('{{n}} 个工作表', { n: draft.workbook.sheets.length })}</small></div>
        {draft.workbook.sheets.length > 1 && (
          <Seg label={tx('工作表')} value={String(mapping.sheet)} onChange={(v) => setMapping(guess(draft.workbook.sheets[Number(v)], exam) && { ...guess(draft.workbook.sheets[Number(v)], exam), sheet: Number(v) })} options={draft.workbook.sheets.map((s, i) => [String(i), s.name])} />
        )}
        <div className="cr-form-row is-3">
          <Field label={tx('表头在第几行')}><input inputMode="numeric" value={mapping.headerRow ?? ''} onChange={(e) => setMapping({ ...mapping, headerRow: Number(e.target.value) || null })} /></Field>
          <Field label={tx('从第几行开始')}><input inputMode="numeric" value={mapping.firstRow} onChange={(e) => setMapping({ ...mapping, firstRow: Math.max(1, Number(e.target.value) || 1) })} /></Field>
          <Field label={tx('到第几行')}><input inputMode="numeric" value={mapping.lastRow ?? ''} onChange={(e) => setMapping({ ...mapping, lastRow: Number(e.target.value) || null })} /></Field>
        </div>
        <div className="cr-form-row is-4">
          <ColSelect columns={columns} label={tx('姓名')} optional value={mapping.nameCol} onChange={(v) => setMapping({ ...mapping, nameCol: v })} />
          <ColSelect columns={columns} label={tx('学号')} optional value={mapping.numberCol} onChange={(v) => setMapping({ ...mapping, numberCol: v })} />
          <ColSelect columns={columns} label={tx('总分')} optional value={mapping.totalCol} onChange={(v) => setMapping({ ...mapping, totalCol: v })} />
          <ColSelect columns={columns} label={tx('缺考')} optional value={mapping.absentCol} onChange={(v) => setMapping({ ...mapping, absentCol: v })} />
        </div>
        <details className="cr-import-questions" open={Object.keys(mapping.questionCols).length > 0 && Object.keys(mapping.questionCols).length < exam.questions.length}>
          <summary>{tx('逐题得分：已对应 {{a}} / {{b}} 题', { a: Object.keys(mapping.questionCols).length, b: exam.questions.length })}</summary>
          <div className="cr-form-row is-6">
            {exam.questions.map((q) => (
              <ColSelect key={q.id} columns={columns} optional label={q.group ? `${q.group} ${q.label}` : q.label} value={mapping.questionCols[q.id]} onChange={(v) => { const qc = { ...mapping.questionCols }; if (v) qc[q.id] = v; else delete qc[q.id]; setMapping({ ...mapping, questionCols: qc }); }} />
            ))}
          </div>
        </details>
        <div className="cr-sheet-preview">
          <table>
            <thead>
              <tr><th />{columns.map(([n]) => <th key={n} className={cx(mappedCols.has(n) && 'is-mapped')}>{mappedCols.get(n) || letter(n)}</th>)}</tr>
            </thead>
            <tbody>
              {sheet.rows.slice(0, 12).map((r, i) => (
                <tr key={i} className={cx(i + 1 === mapping.headerRow && 'is-header', i + 1 >= mapping.firstRow && (!mapping.lastRow || i + 1 <= mapping.lastRow) && 'is-data')}>
                  <th>{i + 1}</th>
                  {columns.map(([n]) => <td key={n} className={cx(mappedCols.has(n) && 'is-mapped', r?.[n - 1]?.kind === 'error' && 'is-error')}>{r?.[n - 1]?.text ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cr-muted">{tx('空白是缺失，0 就是 0；公式只用表里已有的结果。')}</p>
      </div>
    );
    footer = (
      <>
        <button type="button" className="cr-btn" disabled={busy} onClick={() => setStep(0)}>{tx('换一个文件')}</button>
        <span className="cr-grow" />
        <button type="button" className="cr-btn is-primary" disabled={busy || (!mapping.nameCol && !mapping.numberCol)} onClick={build}>{busy ? <Spinner small /> : null}{tx('生成校对表')}</button>
      </>
    );
  } else if (step === 2) {
    const s = draft.summary || {};
    body = (
      <div className="cr-review">
        <div className="cr-review-summary">
          <span className="cr-pill">{tx('{{n}} 行', { n: s.rows })}</span>
          <span className={cx('cr-pill', s.errors ? 'is-error' : 'is-ok')}>{s.errors ? tx('{{n}} 处需要处理', { n: s.errors }) : tx('没有需要处理的问题')}</span>
          {s.warnings > 0 && <span className="cr-pill is-warn">{tx('{{n}} 个提醒', { n: s.warnings })}</span>}
          {s.ignored > 0 && <span className="cr-pill">{tx('忽略 {{n}} 行', { n: s.ignored })}</span>}
          <span className="cr-grow" />
          <Seg label={tx('显示')} value={filter} onChange={setFilter} options={[['issues', tx('需要看的')], ['all', tx('全部')], ['ignored', tx('已忽略')]]} />
        </div>
        {draft.issues?.some(issue => issue.sourceRow == null) && (
          <ul className="cr-issues">
            {draft.issues.filter(issue => issue.sourceRow == null).map((issue, index) => (
              <li key={index} className={`is-${issue.level}`}><Icon name="info" size={12} stroke={2.2} />{issue.template ? tx(issue.template, issue.params) : tx(issue.message)}</li>
            ))}
          </ul>
        )}
        <div className="cr-review-table">
          <div className="cr-review-row is-head">
            <span>{tx('行')}</span><span>{tx('表中')}</span><span>{tx('对应学生')}</span><span>{tx('状态')}</span><span>{tx('总分')}</span><span />
          </div>
          {!shownRows.length && <p className="cr-muted cr-pad">{filter === 'issues' ? tx('每一行都对上了。') : tx('没有这样的行。')}</p>}
          {shownRows.map((r) => {
            const errs = errorsOf(r);
            return (
              <div key={r.sourceRow} className={cx('cr-review-row', r.ignored && 'is-ignored', errs.length && 'has-error')}>
                <span className="cr-review-num">{r.sourceRow}</span>
                <span className="cr-review-src"><b>{r.source.name || '-'}</b><small>{r.source.studentNo}</small></span>
                <span>
                  <select aria-label={tx('对应学生')} value={r.studentId || ''} disabled={r.ignored} onChange={(e) => edit(r, { studentId: e.target.value || null })}>
                    <option value="">{tx('选择学生')}</option>
                    {roster.map((st) => <option key={st.id} value={st.id}>{st.name}{st.studentNo ? ` · ${st.studentNo}` : ''}</option>)}
                  </select>
                </span>
                <span>
                  <button type="button" className={cx('cr-status', r.status === 'absent' && 'is-absent')} disabled={r.ignored} onClick={() => edit(r, { status: r.status === 'absent' ? 'present' : 'absent' })}>
                    {r.status === 'absent' ? tx('缺考') : tx('参加')}
                  </button>
                </span>
                <span>
                  <input aria-label={tx('总分')} inputMode="decimal" defaultValue={r.total ?? ''} key={`${r.sourceRow}:${r.total}:${r.status}`} disabled={r.ignored || r.status === 'absent'} onBlur={(e) => { const v = e.target.value.trim(); if (String(r.total ?? '') !== v) edit(r, { total: v === '' ? null : Number(v) }); }} />
                </span>
                <span>
                  <button type="button" className="cr-btn is-small is-quiet" onClick={() => edit(r, { ignored: !r.ignored })}>{r.ignored ? tx('恢复') : tx('忽略')}</button>
                </span>
                {(r.issues || []).length > 0 && (
                  <ul className="cr-issues">
                    {r.issues.map((i, k) => (
                      <li key={k} className={`is-${i.level}`}>
                        <Icon name="info" size={12} stroke={2.2} />{i.template ? tx(i.template, i.params) : tx(i.message)}
                        {i.code === 'out-of-range' && i.field && i.field !== 'total' && (
                          <input className="cr-fix" aria-label={tx('改成')} inputMode="decimal" defaultValue={r.scores?.[i.field] ?? ''} placeholder={tx('改成')} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} onBlur={(e) => { const v = e.target.value.trim(); if (String(r.scores?.[i.field] ?? '') !== v) edit(r, { scores: { [i.field]: v === '' ? null : Number(v) } }); }} />
                        )}
                        {i.code === 'name-number-conflict' && r.suggestedStudentId && (
                          <button type="button" className="cr-link" onClick={() => edit(r, { studentId: r.suggestedStudentId })}>{tx('就是 {{name}}', { name: roster.find((st) => st.id === r.suggestedStudentId)?.name })}</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {unrecorded.length > 0 && (
          <div className="cr-unrecorded">
            <strong>{tx('表里没有的学生 · {{n}} 人', { n: unrecorded.length })}</strong>
            <p className="cr-muted">{tx('他们会记为“未记录”，不计分，也不算缺考。')}</p>
            <div>{unrecorded.map((st) => <span key={st.id} className="cr-chip-student is-static"><Avatar name={st.name} id={st.id} size="sm" /><span>{st.name}</span></span>)}</div>
          </div>
        )}
      </div>
    );
    footer = (
      <>
        <button type="button" className="cr-btn" disabled={busy} onClick={() => setStep(1)}>{tx('重新对应列')}</button>
        <span className="cr-grow" />
        <button type="button" className="cr-btn is-primary" disabled={busy || (draft.summary?.errors ?? 0) > 0} onClick={confirm}>{busy ? <Spinner small /> : <Icon name="check" size={14} stroke={2.4} />}{tx('确认入库')}</button>
      </>
    );
  } else {
    body = (
      <div className="cr-import-done">
        <span className="cr-done-mark"><Icon name="check" size={30} stroke={2.6} /></span>
        <h3>{tx('成绩已保存')}</h3>
        <p>{tx('{{cls}} · {{exam}}：{{a}} 人参加，{{b}} 人缺考，{{c}} 人未记录。', { cls: cls.name, exam: exam.name, a: done.present, b: done.absent, c: done.unrecorded })}</p>
        <p className="cr-muted">{tx('原表和校对结果都留着，可以到班级或学生的成绩中查看。')}</p>
      </div>
    );
    footer = (
      <>
        <span className="cr-grow" />
        <button type="button" className="cr-btn" onClick={onClose}>{tx('完成')}</button>
        <button type="button" className="cr-btn is-primary" onClick={() => { ctx.go({ view: 'class', classId, tab: 'scores', studentId: null }); onClose(); }}>{tx('看看成绩')}</button>
      </>
    );
  }

  return (
    <Dialog busy={busy} wide className="cr-import" title={tx('导入成绩')} subtitle={exam && cls ? `${exam.name} · ${cls.name}` : null} onClose={onClose} footer={<>{error && <span className="cr-error is-inline">{error}</span>}{footer}</>}>
      {step < 3 && (
        <ol className="cr-steps">
          {STEPS.map((label, i) => <li key={label} className={cx(i === step && 'is-current', i < step && 'is-done')}><span>{i < step ? <Icon name="check" size={11} stroke={3} /> : i + 1}</span>{tx(label)}</li>)}
        </ol>
      )}
      <fieldset className="cr-step" key={step} disabled={busy}>{body}</fieldset>
    </Dialog>
  );
}
