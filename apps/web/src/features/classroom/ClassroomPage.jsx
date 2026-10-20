import { useScene } from '../../platform/device/useScene.js';
import React, { Fragment } from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { tx, useLocale } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { Icon, Seg, Menu, Dialog, Confirm, Field, Empty, useToast } from './ui.jsx';
import { Seating } from './Seating.jsx';
import { Roster, StudentDetail, StudentForm } from './Students.jsx';
import { ClassScores } from './Scores.jsx';
import { Journal } from './Records.jsx';
import { ExamList, ExamDetail, ExamForm, TagManager } from './Exams.jsx';
import { ImportDialog } from './Import.jsx';
import { Archive } from './Archive.jsx';
import { hueOf, classMark } from './util.js';
import { Rail, RailSection, RailItem, RailAction, RailHint } from '../../components/ui/rail.jsx';

/*
 * 班级 - remembering every student and what the class is going through.
 * Same structure as the other modules: a navigation card (classes, exams,
 * tags, archive) and one surface. A class opens on four views - seats,
 * students, scores, notes - and a student opens in place, like a resource.
 */

const initialScene = { view: 'class', tab: 'seats' };

function useData(api) {
  const [data, setData] = useState({ classes: [], students: [], exams: [], tags: [], loaded: false, error: null });
  const load = useCallback(async () => {
    try {
      await api.recover();
      const c = await api.get('/classes');
      const [s, e, t] = await Promise.all([api.get('/students'), api.get('/exams'), api.get('/tags')]);
      setData({ classes: c.items, students: s.items, exams: e.items, tags: t.items.filter((x) => !x.mergedIntoId), loaded: true, error: null });
    } catch (error) {
      setData((d) => ({ ...d, loaded: true, error }));
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  return [data, load];
}

function ClassForm({ api, initial, onClose, onSaved }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [term, setTerm] = useState(initial?.term ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = initial
        ? await api.put(`/classes/${initial.id}`, { baseVersion: initial.version, name, term })
        : await api.post('/classes', { name, term });
      onSaved(saved);
      onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Dialog
      title={initial ? tx('班级信息') : tx('新建班级')}
      subtitle={initial ? null : tx('建好后，把学生加进来，再排一排座位。')}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="cr-btn" onClick={onClose}>{tx('取消')}</button>
          <button type="button" className="cr-btn is-primary" disabled={busy || !name.trim()} onClick={save}>{initial ? tx('保存') : tx('创建班级')}</button>
        </>
      )}
    >
      <form className="cr-form" onSubmit={save}>
        <Field label={tx('班级名称')}><input value={name} maxLength={60} placeholder={tx('例如：初三（2）班')} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={tx('学期')} hint={tx('选填')}><input value={term} maxLength={60} placeholder={tx('例如：2026 秋季学期')} onChange={(e) => setTerm(e.target.value)} /></Field>
        {error && <p className="cr-error">{error}</p>}
      </form>
    </Dialog>
  );
}

export function ClassroomWorkspace({ api, shell }) {
  useLocale();
  const [data, reload] = useData(api);
  const [scene, patchScene] = useScene(shell.accountKey, 'classroom', initialScene);
  const [dialog, setDialog] = useState(() => scene.importDialog ? { name: 'import', props: scene.importDialog } : null);
  const [toastNode, toast] = useToast();
  const go = patchScene;
  const open = (name, props = {}) => { if (name === 'import') patchScene({ importDialog: props }); setDialog({ name, props }); };
  const close = () => { patchScene({ importDialog: null }); setDialog(null); };

  const classes = data.classes;
  const current = classes.find((c) => c.id === scene.classId) || (scene.view === 'class' ? classes[0] : null);
  useEffect(() => {
    if (data.loaded && scene.view === 'class' && current && current.id !== scene.classId) go({ classId: current.id });
  }, [data.loaded, current?.id]);

  const roster = (classId) => data.students.filter((s) => s.classId === classId);
  const ctx = { api, accountKey: shell.accountKey, data, reload, toast, go, open, close, scene };
  const student = scene.studentId && data.students.find((s) => s.id === scene.studentId);
  const exam = scene.examId && data.exams.find((e) => e.id === scene.examId);

  let main;
  if (!data.loaded) main = <div className="cr-loading"><span className="tbx-spinner" /></div>;
  else if (data.error) main = <Empty icon="info" title={tx('班级暂时无法读取')} text={data.error.message}><button type="button" className="cr-btn" onClick={reload}>{tx('重新加载')}</button></Empty>;
  else if (scene.view === 'exams') main = exam ? <ExamDetail key={exam.id} ctx={ctx} exam={exam} /> : <ExamList ctx={ctx} />;
  else if (scene.view === 'tags') main = <TagManager ctx={ctx} />;
  else if (scene.view === 'archive') main = <Archive ctx={ctx} />;
  else if (!current) {
    main = (
      <Empty
        art={<ClassArt />}
        title={tx('把你教的班级放在这里')}
        text={tx('记住班里的每个人：他们的座位、说过的话、每次考试的样子。课后整理、回顾和思考，都从这里开始。')}
      >
        <button type="button" className="cr-btn is-primary is-big" onClick={() => open('class')}><Icon name="plus" size={16} stroke={2.2} />{tx('新建班级')}</button>
      </Empty>
    );
  } else if (student && student.classId === current.id) {
    main = <StudentDetail key={student.id} ctx={ctx} student={student} cls={current} />;
  } else {
    const kids = roster(current.id);
    const tab = scene.tab || 'seats';
    main = (
      <div className="cr-class" key={current.id}>
        <header className="cr-head">
          <div className="cr-head-title">
            <span className={cx('cr-class-badge', `is-${hueOf(current.id)}`)}>{classMark(current.name)}</span>
            <div>
              <h2>{current.name}</h2>
              <span>{[current.term, tx('{{n}} 名学生', { n: kids.length, count: kids.length })].filter(Boolean).join(' · ')}</span>
            </div>
          </div>
          <Seg
            className="cr-tabs"
            label={tx('班级视图')}
            value={tab}
            onChange={(t) => go({ tab: t })}
            options={[['seats', tx('座位'), 'grid'], ['students', tx('学生'), 'students'], ['scores', tx('成绩'), 'graph'], ['records', tx('记录'), 'pencil']]}
          />
          <Menu
            label={tx('班级操作')}
            items={[
              { label: tx('班级信息'), icon: 'pencil', onClick: () => open('class', { initial: current }) },
              { label: tx('导入成绩'), icon: 'upload', onClick: () => open('import', { classId: current.id }) },
              '-',
              { label: tx('归档班级'), icon: 'trash', danger: true, onClick: () => open('confirm', {
                title: tx('归档“{{name}}”？', { name: current.name }),
                message: tx('班级会移到“已归档”，学生、记录和成绩都原样保留，随时可以恢复。'),
                confirmLabel: tx('归档'),
                onConfirm: async () => { await api.remove('classes', current); go({ classId: null }); await reload(); toast(tx('已归档')); },
              }) },
            ]}
          />
        </header>
        <div className="cr-view" key={tab} data-tab={tab}>
          {tab === 'seats' && <Seating ctx={ctx} cls={current} students={kids} />}
          {tab === 'students' && <Roster ctx={ctx} cls={current} students={kids} />}
          {tab === 'scores' && <ClassScores ctx={ctx} cls={current} students={kids} />}
          {tab === 'records' && <Journal ctx={ctx} subject={{ kind: 'class', id: current.id }} placeholder={tx('今天讲到哪里了？有什么共同的问题、讲解的效果，或下一节课想做的事……')} />}
        </div>
      </div>
    );
  }

  const place = scene.view === 'class' ? `class:${current?.id}` : scene.view;
  return (
    <section className="tbx-cr tbx-split">
      <div className="cr-main">{main}</div>

      {/* ---------- rail: classes, exams and tags, the assistant ---------- */}
      <Rail
        label={tx('班级导航')}
        footer={<RailItem icon="trash" label={tx('已归档')} current={place === 'archive'} onClick={() => go({ view: 'archive' })} />}
      >
        <RailSection
          title={tx('我的班级')}
          count={classes.length || ''}
          actions={<RailAction primary icon="plus" label={tx('新建班级')} onClick={() => open('class')} />}
        >
          {classes.length === 0 && <p className="tbx-rail-empty">{tx('还没有班级')}</p>}
          {classes.map((c) => (
            <RailItem
              key={c.id}
              mark={<span className={cx('cr-place-dot', `is-${hueOf(c.id)}`)}>{classMark(c.name)}</span>}
              label={c.name}
              count={roster(c.id).length}
              current={place === `class:${c.id}`}
              onClick={() => go({ view: 'class', classId: c.id, studentId: null })}
            />
          ))}
        </RailSection>
        <RailSection title={tx('考试与标签')}>
          <RailItem icon="file" label={tx('考试')} count={data.exams.length} current={place === 'exams'} onClick={() => go({ view: 'exams', examId: null })} />
          <RailItem icon="tag" label={tx('题目标签')} count={data.tags.length} current={place === 'tags'} onClick={() => go({ view: 'tags' })} />
        </RailSection>
        <RailHint tone="green" onClick={() => shell.openPanel?.('ai')}>{tx('想知道谁最近进步了、哪类题失分多？问问助理。')}</RailHint>
      </Rail>

      {dialog?.name === 'class' && <ClassForm api={api} {...dialog.props} onClose={close} onSaved={async (c) => { await reload(); go({ view: 'class', classId: c.id, studentId: null }); toast(dialog.props.initial ? tx('已保存') : tx('班级已创建')); }} />}
      {dialog?.name === 'student' && <StudentForm ctx={ctx} {...dialog.props} onClose={close} />}
      {dialog?.name === 'exam' && <ExamForm ctx={ctx} {...dialog.props} onClose={close} />}
      {dialog?.name === 'import' && <ImportDialog ctx={ctx} {...dialog.props} onClose={close} />}
      {dialog?.name === 'confirm' && <Confirm {...dialog.props} onClose={close} />}
      {toastNode}
    </section>
  );
}

function ClassArt() {
  return (
    <div className="cr-art" aria-hidden="true">
      <span className="cr-art-board" />
      {Array.from({ length: 9 }, (_, i) => <span key={i} className={cx('cr-art-desk', `is-${['blue', 'green', 'orange', 'purple', 'pink', 'teal', 'indigo', 'yellow', 'blue'][i]}`)} style={{ '--i': i }} />)}
    </div>
  );
}
