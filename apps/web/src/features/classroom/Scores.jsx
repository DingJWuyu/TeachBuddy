import React, { Fragment } from 'react';
import { useEffect, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { Icon, Avatar, Menu, Empty, Spinner } from './ui.jsx';
import { TrendChart, Histogram, RateBars, Stat } from './charts.jsx';
import { longDate, fmt, pct } from './util.js';

/*
 * Scores, organised the way a teacher looks: the whole picture over time,
 * then one exam, then the evidence (students, questions, tags). Filters for
 * exams and tags work together. Missing never counts as zero.
 */

export function ClassScores({ ctx, cls }) {
  const [examIds, setExamIds] = useState([]);
  const [tagIds, setTagIds] = useState([]);
  const [stats, setStats] = useState(null);
  const [focus, setFocus] = useState(null);
  const [bin, setBin] = useState(null);
  const exams = ctx.data.exams;
  const tags = ctx.data.tags;

  useEffect(() => {
    let live = true;
    setStats(null);
    ctx.api.get(`/classes/${cls.id}/statistics`, { examId: examIds, tagId: tagIds })
      .then((s) => live && setStats(s))
      .catch((err) => live && setStats({ error: err }));
    return () => { live = false; };
  }, [cls.id, cls.version, examIds.join(), tagIds.join(), exams.length]);

  const importButton = <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('import', { classId: cls.id })}><Icon name="upload" size={15} stroke={2} />{tx('导入成绩')}</button>;

  if (!exams.length) {
    return (
      <Empty icon="file" title={tx('还没有考试')} text={tx('先建一场考试：名称、日期、每道计分题的满分。之后把成绩表导进来，就能看到全班的样子。')}>
        <button type="button" className="cr-btn is-primary" onClick={() => ctx.open('exam')}><Icon name="plus" size={15} stroke={2.2} />{tx('新建考试')}</button>
      </Empty>
    );
  }
  if (!stats) return <div className="cr-loading is-inline"><Spinner /></div>;
  if (stats.error) return <Empty compact icon="info" title={tx('成绩暂时无法读取')} text={stats.error.message} />;

  const ok = stats.points.filter((p) => p.state === 'ok');
  const none = stats.points.filter((p) => p.state !== 'ok');
  const current = ok.find((p) => p.exam.id === focus) || ok.at(-1);
  const toggle = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const filters = (
    <div className="cr-toolbar">
      <Menu
        label={tx('考试')}
        trigger={({ open, toggle: t }) => (
          <button type="button" className={cx('cr-btn is-small', (open || examIds.length) && 'is-on')} onClick={t} aria-expanded={open}>
            <Icon name="file" size={14} stroke={2} />{examIds.length ? tx('{{n}} 场考试', { n: examIds.length }) : tx('全部考试')}
          </button>
        )}
        items={[
          { label: tx('全部考试'), check: !examIds.length, onClick: () => setExamIds([]) },
          '-',
          ...[...exams].sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ label: `${e.name} · ${longDate(e.date)}`, check: examIds.includes(e.id), keep: true, onClick: () => toggle(examIds, setExamIds, e.id) })),
        ]}
      />
      {tags.length > 0 && (
        <Menu
          label={tx('题目标签')}
          trigger={({ open, toggle: t }) => (
            <button type="button" className={cx('cr-btn is-small', (open || tagIds.length) && 'is-on')} onClick={t} aria-expanded={open}>
              <Icon name="tag" size={14} stroke={2} />{tagIds.length === 1 ? tags.find((x) => x.id === tagIds[0])?.name : tagIds.length ? tx('{{n}} 个标签', { n: tagIds.length, count: tagIds.length }) : tx('全部标签')}
            </button>
          )}
          items={[
            { label: tx('全部标签'), check: !tagIds.length, onClick: () => setTagIds([]) },
            '-',
            ...tags.map((t) => ({ label: t.name, check: tagIds.includes(t.id), keep: true, onClick: () => toggle(tagIds, setTagIds, t.id) })),
          ]}
        />
      )}
      <span className="cr-grow" />
      {importButton}
    </div>
  );

  if (!ok.length) {
    return (
      <div className="cr-scores">
        {filters}
        <Empty icon="graph" title={examIds.length ? tx('所选考试里，这个班还没有成绩') : tx('这个班还没有成绩')} text={tx('把一场考试的成绩表（Excel）导进来：选工作表、对应姓名和分数列，校对后确认。')}>{importButton}</Empty>
      </div>
    );
  }

  const full = current.exam.fullScore;
  const binStudents = bin != null ? current.distribution[bin].studentIds.map((id) => current.students.find((s) => s.studentId === id)).filter(Boolean) : [];
  const lowest = [...current.questions].filter((q) => q.rate != null).sort((a, b) => a.rate - b.rate)[0];
  return (
    <div className="cr-scores">
      {filters}
      <div className="cr-panel">
        <div className="cr-panel-head">
          <h3>{tx('全班的变化')}</h3>
          <span className="cr-muted">{tx('点一场考试，下面换成那一场。各场满分和难度不同，曲线只作参考。')}</span>
        </div>
        <TrendChart
          label={tx('全班的变化')}
          points={ok.map((p) => ({ key: p.exam.id, title: p.exam.name, name: p.exam.name, date: p.exam.date, values: { mean: p.mean == null ? null : p.mean / p.exam.fullScore, median: p.median == null ? null : p.median / p.exam.fullScore }, band: p.min != null ? [p.min / p.exam.fullScore, p.max / p.exam.fullScore] : null }))}
          selected={current.exam.id}
          onSelect={(id) => { setFocus(id); setBin(null); }}
          series={[{ key: 'mean', label: tx('平均得分率'), tone: 'green' }, { key: 'median', label: tx('中位数'), tone: 'grey', dashed: true }]}
          bandLabel={tx('最高到最低')}
        />
        {none.length > 0 && <p className="cr-footnote">{tx('还没有这个班成绩的考试：{{list}}', { list: none.map((p) => p.exam.name).join('、') })}</p>}
      </div>

      <div className="cr-focus" key={current.exam.id}>
        <div className="cr-focus-head">
          <div>
            <h3>{current.exam.name}</h3>
            <span className="cr-muted">{[longDate(current.exam.date), current.exam.subject, tx('满分 {{n}}', { n: fmt(full) })].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" className="cr-btn is-small" onClick={() => ctx.go({ view: 'exams', examId: current.exam.id })}>{tx('试卷与同场比较')}<Icon name="chevron" size={13} stroke={2.2} /></button>
        </div>
        <div className="cr-stats">
          <Stat label={tx('平均分')} value={fmt(current.mean)} sub={pct(current.mean == null ? null : current.mean / full)} tone="green" />
          <Stat label={tx('中位数')} value={fmt(current.median)} sub={pct(current.median == null ? null : current.median / full)} />
          <Stat label={tx('最高 / 最低')} value={`${fmt(current.max)} / ${fmt(current.min)}`} />
          <Stat label={tx('参加')} value={tx('{{n}} 人', { n: current.present })} sub={[current.absent && tx('缺考 {{n}}', { n: current.absent }), current.unrecorded && tx('未记录 {{n}}', { n: current.unrecorded }), current.missingTotal && tx('无总分 {{n}}', { n: current.missingTotal })].filter(Boolean).join(' · ') || tx('全部到齐')} />
        </div>

        <div className="cr-split">
          <div className="cr-panel">
            <div className="cr-panel-head"><h3>{tx('得分率分布')}</h3><span className="cr-muted">{tx('点一档看是谁')}</span></div>
            <Histogram label={tx('得分率分布')} bins={current.distribution} selected={bin} onSelect={setBin} />
            <p className="cr-axis-note">{tx('得分率（%）· 缺考和没有总分的不计入')}</p>
            {bin != null && (
              <div className="cr-bin-students">
                <strong>{tx('{{from}}–{{to}}% · {{n}} 人', { from: bin * 10, to: bin === 9 ? 100 : bin * 10 + 9, n: binStudents.length })}</strong>
                <div>
                  {binStudents.map((s) => (
                    <button key={s.studentId} type="button" className="cr-chip-student" onClick={() => ctx.go({ view: 'class', tab: 'scores', studentId: s.studentId })}>
                      <Avatar name={s.name} id={s.studentId} size="sm" /><span>{s.name}</span><b>{fmt(s.total)}</b>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="cr-panel">
            <div className="cr-panel-head"><h3>{tx('排名')}</h3><span className="cr-muted">{tx('同分并列')}</span></div>
            <ol className="cr-ranking">
              {current.students.map((s, i) => (
                <li key={s.studentId} style={{ '--i': Math.min(i, 20) }}>
                  <button type="button" onClick={() => ctx.go({ studentId: s.studentId })}>
                    <span className={cx('cr-rank', s.rank && s.rank <= 3 && `is-top is-${s.rank}`)}>{s.rank ?? '-'}</span>
                    <Avatar name={s.name} id={s.studentId} size="sm" />
                    <span className="cr-ranking-name">{s.name}</span>
                    {s.status === 'present'
                      ? <span className="cr-ranking-score"><b>{fmt(s.total)}</b><small>{pct(s.rate)}</small></span>
                      : <em>{s.status === 'absent' ? tx('缺考') : tx('未记录')}</em>}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="cr-split">
          <div className="cr-panel">
            <div className="cr-panel-head">
              <h3>{tx('各题得分率')}</h3>
              {lowest && <span className="cr-muted">{tx('最低：{{q}} {{r}}', { q: lowest.label, r: pct(lowest.rate) })}</span>}
            </div>
            <RateBars rows={current.questions.map((q) => ({ id: q.id, label: q.group ? `${q.group} ${q.label}` : q.label, rate: q.rate, state: 'missing-scores', meta: q.missing ? tx('已知 {{k}} · 缺 {{m}}', { k: q.known, m: q.missing }) : null }))} />
          </div>
          <div className="cr-panel">
            <div className="cr-panel-head"><h3>{tx('标签')}</h3><span className="cr-muted">{tx('多个标签按题目合并，同一题只算一次')}</span></div>
            {current.tags.length ? (
              <RateBars rows={current.tags.map((t) => ({ id: t.id, label: t.name, rate: t.rate, state: t.state, meta: t.state === 'ok' ? tx('{{n}} 道题', { n: t.questionIds.length }) : null }))} />
            ) : <p className="cr-muted cr-pad">{tx('这场考试的题目还没有标签。给题目贴上标签，就能看到这一类题的得分。')}</p>}
            <p className="cr-footnote">{tx('得分率描述的是这场考试的证据，不等于知识掌握度；没考到的标签不记零。')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
