import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { Icon, Avatar, Seg, Menu, Dialog, Field, Empty, Search, Spinner } from './ui.jsx';
import { TrendChart, RateBars } from './charts.jsx';
import { useClassroomSubmission } from './useSubmission.js';
import { Journal } from './Records.jsx';
import { longDate, age, fmt, pct } from './util.js';

/* ---------- add / edit ---------- */
export function StudentForm({ ctx, classId, initial, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    studentNo: initial?.studentNo ?? '',
    birthday: initial?.birthday ?? '',
    interests: initial?.interests ?? '',
    personality: initial?.personality ?? '',
    classId: initial?.classId ?? classId,
  });
  const { busy, error, submit } = useClassroomSubmission({ api: ctx.api, collection: 'students', initial, reload: ctx.reload });
  const [more, setMore] = useState(Boolean(initial));
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const save = (again) => {
    if (!form.name.trim()) return;
    const body = { name: form.name, studentNo: form.studentNo, birthday: form.birthday || null, interests: form.interests, personality: form.personality, classId: form.classId };
    return submit(body, () => {
      ctx.toast(initial ? tx('已保存') : tx('已添加 {{name}}', { name: form.name.trim() }));
      if (again) setForm({ ...form, name: '', studentNo: '', birthday: '', interests: '', personality: '' });
      else onClose();
    });
  };
  const moving = initial && form.classId !== initial.classId;
  return (
    <Dialog
      busy={busy}
      title={initial ? tx('学生资料') : tx('添加学生')}
      subtitle={initial ? null : tx('只有姓名是必填的。性格、兴趣想到再写，不必一次填完。')}
      onClose={onClose}
      footer={(
        <>
          {!initial && <button type="button" className="cr-btn is-quiet" disabled={busy || !form.name.trim()} onClick={() => save(true)}>{tx('保存并继续添加')}</button>}
          <span className="cr-grow" />
          <button type="button" className="cr-btn" disabled={busy} onClick={onClose}>{tx('取消')}</button>
          <button type="button" className="cr-btn is-primary" disabled={busy || !form.name.trim()} onClick={() => save(false)}>{initial ? tx('保存') : tx('添加')}</button>
        </>
      )}
    >
      <form className="cr-form" onSubmit={(e) => { e.preventDefault(); save(!initial); }}>
        <div className="cr-form-row">
          <Field label={tx('姓名')}><input disabled={busy} value={form.name} maxLength={40} onChange={set('name')} /></Field>
          <Field label={tx('学号')} hint={tx('选填')}><input disabled={busy} value={form.studentNo} maxLength={32} inputMode="numeric" onChange={set('studentNo')} /></Field>
        </div>
        {!more && <button type="button" className="cr-link" disabled={busy} onClick={() => setMore(true)}><Icon name="plus" size={13} stroke={2.4} />{tx('生日、兴趣与性格')}</button>}
        {more && (
          <>
            <Field label={tx('生日')} hint={tx('选填')}><input disabled={busy} type="date" value={form.birthday || ''} onChange={set('birthday')} /></Field>
            <Field label={tx('兴趣')} hint={tx('选填')}><input disabled={busy} value={form.interests} maxLength={400} placeholder={tx('例如：篮球、科幻小说、画画')} onChange={set('interests')} /></Field>
            <Field label={tx('性格')} hint={tx('选填，用你自己的话写')}><textarea disabled={busy} rows={3} value={form.personality} maxLength={1000} placeholder={tx('例如：安静，但讲到感兴趣的题会抢着回答')} onChange={set('personality')} /></Field>
          </>
        )}
        {initial && (
          <Field label={tx('所在班级')}>
            <select disabled={busy} value={form.classId} onChange={set('classId')}>
              {ctx.data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {moving && <p className="cr-note"><Icon name="info" size={14} stroke={2} />{tx('换班后，记录跟着学生走；以前的成绩仍属于当时的班级，座位会空出来。')}</p>}
        {error && <p className="cr-error">{error}</p>}
      </form>
    </Dialog>
  );
}

/* ---------- roster ---------- */
export function Roster({ ctx, cls, students }) {
  const [q, setQ] = useState('');
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    ctx.api.get(`/classes/${cls.id}/statistics`).then((s) => {
      const last = [...s.points].reverse().find((p) => p.state === 'ok');
      if (live) setLatest(last ? { exam: last.exam, byStudent: new Map(last.students.map((x) => [x.studentId, x])) } : false);
    }).catch(error => live && setError(error));
    return () => { live = false; };
  }, [cls.id, cls.version]);
  const seat = new Map(cls.seating.seats.map((s) => [s.studentId, s]));
  const shown = students.filter((s) => !q || s.name.includes(q.trim()) || (s.studentNo || '').includes(q.trim()));
  return (
    <div className="cr-roster">
      <div className="cr-toolbar">
        <Search value={q} onChange={setQ} placeholder={tx('搜索姓名或学号')} />
        {latest && <span className="cr-muted cr-toolbar-note">{tx('分数来自最近一场：{{name}}', { name: latest.exam.name })}</span>}
        <span className="cr-grow" />
        <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('student', { classId: cls.id })}><Icon name="plus" size={15} stroke={2.2} />{tx('添加学生')}</button>
      </div>
      {error ? <Empty compact icon="info" title={tx('成绩暂时无法读取')} text={error.message} /> : !students.length ? (
        <Empty icon="students" title={tx('班里还没有学生')} text={tx('先把名单加进来。之后的座位、记录和成绩都围绕他们。')}>
          <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('student', { classId: cls.id })}><Icon name="plus" size={15} stroke={2.2} />{tx('添加学生')}</button>
        </Empty>
      ) : !shown.length ? (
        <Empty compact icon="search" title={tx('没有找到这位学生')} text={tx('换个名字或学号试试。')} />
      ) : (
        <div className="cr-cards">
          {shown.map((s, i) => {
            const r = latest && latest.byStudent.get(s.id);
            const where = seat.get(s.id);
            return (
              <button key={s.id} type="button" className="cr-card" style={{ '--i': Math.min(i, 16) }} onClick={() => ctx.go({ studentId: s.id })}>
                <Avatar name={s.name} id={s.id} size="lg" />
                <span className="cr-card-text">
                  <strong>{s.name}</strong>
                  <small>{[s.studentNo, where ? tx('第 {{r}} 排第 {{c}} 座', { r: where.row + 1, c: where.col + 1 }) : tx('未排座')].filter(Boolean).join(' · ')}</small>
                  {s.interests && <span className="cr-card-note">{s.interests}</span>}
                </span>
                {r && (
                  <span className={cx('cr-score-pill', r.status !== 'present' && 'is-muted')}>
                    {r.status === 'present' && r.rate != null ? pct(r.rate) : r.status === 'absent' ? tx('缺考') : tx('未记录')}
                    {r.rank && <small>{tx('第 {{n}}', { n: r.rank })}</small>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- one student ---------- */
export function StudentDetail({ ctx, student, cls }) {
  const [tab, setTab] = useState('records');
  const years = age(student.birthday);
  const archive = () => ctx.open('confirm', {
    title: tx('归档 {{name}}？', { name: student.name }),
    message: tx('学生会移到“已归档”，座位空出来；记录和历史成绩都保留。恢复后不会自动坐回原来的座位。'),
    confirmLabel: tx('归档'),
    onConfirm: async () => { await ctx.api.remove('students', student); ctx.go({ studentId: null }); await ctx.reload(); ctx.toast(tx('已归档')); },
  });
  return (
    <div className="cr-student">
      <header className="cr-student-head">
        <button type="button" className="cr-back" onClick={() => ctx.go({ studentId: null })}>
          <Icon name="arrowLeft" size={16} stroke={2.2} /><span>{cls.name}</span>
        </button>
        <span className="cr-grow" />
        <button type="button" className="cr-btn" onClick={() => ctx.open('student', { initial: student })}><Icon name="pencil" size={14} stroke={2} />{tx('编辑资料')}</button>
        <Menu label={tx('学生操作')} items={[{ label: tx('归档学生'), icon: 'trash', danger: true, onClick: archive }]} />
      </header>
      <div className="cr-student-scroll">
        <section className="cr-profile">
          <Avatar name={student.name} id={student.id} size="xl" />
          <div className="cr-profile-text">
            <h2>{student.name}</h2>
            <p>{[student.studentNo && tx('学号 {{n}}', { n: student.studentNo }), student.birthday && (years != null ? tx('{{date}} · {{n}} 岁', { date: longDate(student.birthday), n: years }) : longDate(student.birthday))].filter(Boolean).join(' · ') || tx('还没有填学号和生日')}</p>
          </div>
        </section>
        <div className="cr-traits">
          <button type="button" className={cx('cr-trait', !student.interests && 'is-empty')} onClick={() => ctx.open('student', { initial: student })}>
            <span className="cr-trait-label"><Icon name="sparkles" size={14} stroke={2} />{tx('兴趣')}</span>
            <p>{student.interests || tx('还没写。想到了就记一笔。')}</p>
          </button>
          <button type="button" className={cx('cr-trait', !student.personality && 'is-empty')} onClick={() => ctx.open('student', { initial: student })}>
            <span className="cr-trait-label"><Icon name="info" size={14} stroke={2} />{tx('性格')}</span>
            <p>{student.personality || tx('用你自己的话描述，不必面面俱到。')}</p>
          </button>
        </div>
        <Seg className="cr-subtabs" label={tx('学生视图')} value={tab} onChange={setTab} options={[['records', tx('记录'), 'pencil'], ['scores', tx('成绩'), 'graph']]} />
        <div className="cr-view" key={tab}>
          {tab === 'records' && <Journal ctx={ctx} subject={{ kind: 'student', id: student.id }} placeholder={tx('记下关于{{name}}的一件事：说过的话、一次交流、一个约定……', { name: student.name })} />}
          {tab === 'scores' && <StudentScores ctx={ctx} student={student} />}
        </div>
      </div>
    </div>
  );
}

function StudentScores({ ctx, student }) {
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    let live = true;
    ctx.api.get(`/students/${student.id}/statistics`).then((s) => live && setStats(s)).catch((err) => live && setStats({ error: err }));
    return () => { live = false; };
  }, [student.id]);
  const tagName = useMemo(() => new Map(ctx.data.tags.map((t) => [t.id, t.name])), [ctx.data.tags]);
  if (!stats) return <div className="cr-loading is-inline"><Spinner /></div>;
  if (stats.error) return <Empty compact icon="info" title={tx('成绩暂时无法读取')} text={stats.error.message} />;
  if (!stats.points.length) return <Empty compact icon="graph" title={tx('还没有考试成绩')} text={tx('导入一场考试的成绩表后，这里会按时间列出每一场。')} />;
  const pts = stats.points.map((p) => ({ key: p.exam.id, title: p.exam.name, name: p.exam.name, date: p.exam.date, values: { me: p.rate, cls: p.classMean != null ? p.classMean / p.exam.fullScore : null }, note: p.status === 'absent' ? tx('缺考') : p.status === 'unrecorded' ? tx('未记录') : null }));
  const current = stats.points.find((p) => p.exam.id === open) || stats.points.at(-1);
  return (
    <div className="cr-scores-student">
      <div className="cr-panel">
        <div className="cr-panel-head">
          <h3>{tx('历次得分率')}</h3>
          <span className="cr-muted">{tx('各场满分和难度不同，曲线只是参考，不代表能力的升降。')}</span>
        </div>
        <TrendChart
          label={tx('历次得分率')}
          points={pts}
          selected={current.exam.id}
          onSelect={setOpen}
          series={[{ key: 'me', label: student.name, tone: 'blue' }, { key: 'cls', label: tx('班级平均'), tone: 'grey', dashed: true }]}
        />
      </div>
      <div className="cr-exam-rows">
        {[...stats.points].reverse().map((p) => (
          <button key={p.exam.id} type="button" className={cx('cr-exam-row', current.exam.id === p.exam.id && 'is-on')} onClick={() => setOpen(p.exam.id)}>
            <span className="cr-exam-row-title"><strong>{p.exam.name}</strong><small>{[longDate(p.exam.date), p.exam.subject, p.className].filter(Boolean).join(' · ')}</small></span>
            <span className="cr-exam-row-score">
              {p.status === 'present' ? <><b>{fmt(p.total)}</b><small>/ {fmt(p.exam.fullScore)}</small></> : <em>{p.status === 'absent' ? tx('缺考') : tx('未记录')}</em>}
            </span>
            <span className="cr-exam-row-rank">{p.rank ? tx('第 {{rank}} / {{n}}', { rank: p.rank, n: p.rankCount }) : '-'}</span>
            <span className="cr-exam-row-mean">{tx('班均 {{v}}', { v: fmt(p.classMean) })}</span>
          </button>
        ))}
      </div>
      {current.status === 'present' && (
        <div className="cr-panel" key={current.exam.id}>
          <div className="cr-panel-head">
            <h3>{tx('{{name}} · 各题', { name: current.exam.name })}</h3>
            <span className="cr-legend-inline"><i className="is-fill" />{tx('{{name}}的得分率', { name: student.name })}<i className="is-mark" />{tx('班级得分率')}</span>
          </div>
          <RateBars compareKey="classRate" rows={current.questions.map((q) => ({ id: q.id, label: q.label, rate: q.score == null ? null : q.score / q.fullScore, classRate: q.classRate, meta: q.score == null ? tx('缺分') : `${fmt(q.score)} / ${fmt(q.fullScore)}`, state: 'missing-scores' }))} />
          {current.tags.length > 0 && (
            <div className="cr-tagline">
              {current.tags.map((t) => <span key={t.id} className="cr-tagstat"><Icon name="tag" size={12} stroke={2.2} />{tagName.get(t.id) || t.name}<b>{t.rate == null ? tx('缺分') : pct(t.rate)}</b></span>)}
            </div>
          )}
          <p className="cr-footnote">{tx('题目得分率描述的是这场考试的证据，不等于知识掌握度。')}</p>
        </div>
      )}
    </div>
  );
}
