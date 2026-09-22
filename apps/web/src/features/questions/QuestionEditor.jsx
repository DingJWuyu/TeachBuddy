/**
 * Question editor.
 *
 * Local validation marks the field before the request is sent, the save status
 * comes straight from the save lifecycle, and a conflict offers the server
 * version for comparison instead of overwriting anything.
 */

import { useRef, useState } from 'react';
import { DocumentEditor } from '../workbench/DocumentEditor.jsx';
import { SaveActions, SaveStatus } from '../workbench/SaveStatus.jsx';
import { useSaveShortcut } from '../workbench/useSaveShortcut.js';
import { validateQuestionInput } from './model.js';
import { QuestionTitle, QuestionBody, SolutionDetails } from './QuestionReader.jsx';

export function QuestionServerVersion({ server }) {
  return (
    <>
      <QuestionTitle question={server} />
      <QuestionBody document={server.body} />
      <SolutionDetails document={server.solution} />
    </>
  );
}

export function QuestionEditor({ savable, saveLabel = '保存', footer = null }) {
  const [localProblem, setLocalProblem] = useState(null);
  const titleRef = useRef(null);
  const bodyRef = useRef(null);

  function handleSave(options = {}) {
    if (!options.retry) {
      const problem = validateQuestionInput(savable.input);
      if (problem) {
        setLocalProblem(problem);
        if (problem.field === '/note') document.getElementById('wb-question-note')?.focus();
        else if (problem.field === '/title') titleRef.current?.focus();
        else bodyRef.current?.focus();
        return;
      }
    }
    setLocalProblem(null);
    savable.save(options);
  }

  useSaveShortcut(() => handleSave(), savable.status !== 'identity' && savable.status !== 'deleted');

  const input = savable.input || { title: '', body: { version: 1, blocks: [] }, solution: { version: 1, blocks: [] }, note: '', starred: false };
  const problem = localProblem || (savable.problem && savable.status !== 'unconfirmed' ? savable.problem : null);

  return (
    <div className="wb-editor" data-region="question-editor">
      <div className="wb-field">
        <label className="wb-label" htmlFor="wb-question-title">标题（可留空）</label>
        <input
          id="wb-question-title"
          ref={titleRef}
          className="wb-input"
          aria-label="标题"
          maxLength={200}
          value={input.title}
          onChange={(event) => savable.setInput((current) => ({ ...current, title: event.target.value }))}
        />
      </div>

      <div
        className={`wb-field${problem?.field === '/body' ? ' is-invalid' : ''}`}
        tabIndex={-1}
        ref={bodyRef}
        data-field="body"
      >
        <span className="wb-label">题面</span>
        {problem?.field === '/body' && <span className="wb-field-error">{problem.message}</span>}
        <DocumentEditor
          label="题面"
          document={input.body}
          onChange={(body) => savable.setInput((current) => ({ ...current, body }))}
        />
      </div>

      <div className="wb-field">
        <span className="wb-label">答案与解析</span>
        <DocumentEditor
          label="答案"
          document={input.solution}
          onChange={(solution) => savable.setInput((current) => ({ ...current, solution }))}
        />
      </div>

      <div className="wb-field">
        <label className="wb-label" htmlFor="wb-question-note">教学笔记</label>
        <textarea
          id="wb-question-note"
          className="wb-input"
          aria-label="教学笔记"
          rows={3}
          maxLength={20000}
          value={input.note}
          onChange={(event) => savable.setInput((current) => ({ ...current, note: event.target.value }))}
        />
      </div>

      <label className="wb-check">
        <input
          type="checkbox"
          checked={Boolean(input.starred)}
          onChange={(event) => savable.setInput((current) => ({ ...current, starred: event.target.checked }))}
        />
        标记为常用
      </label>

      <footer className="wb-editor-foot">
        <SaveStatus savable={savable} />
        <SaveActions savable={savable} onSave={handleSave} saveLabel={saveLabel} />
      </footer>
      {footer}
    </div>
  );
}
