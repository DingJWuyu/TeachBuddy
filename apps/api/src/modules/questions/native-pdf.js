import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DOMParser } from '@xmldom/xmldom';
import { nativeText, questionStart, answerHeading } from './extraction.js';
import { documentText, textDocument } from './materials-content.js';
import { extractionId } from './extraction-fragments.js';
const execute = promisify(execFile);

// Xpdf orders columns geometrically. Its HTML keeps individual lines, unlike
// pdftotext reading mode, which joins paragraphs and loses question boundaries.
// The generated HTML is parsed locally as data, never rendered in the browser.
export function createPdfReader(files) {
  return async function readPdf(principal, unit, signal) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'questions-pdf-'));
    try {
      const chunks = [];
      for await (const chunk of await files.open(principal, unit.preview.renditionFileId)) chunks.push(chunk);
      await fs.writeFile(path.join(directory, 'source.pdf'), Buffer.concat(chunks));
      const output = path.join(directory, 'output');
      await fs.mkdir(output);
      const executable = await fs.realpath(process.env.QUESTIONS_XPDF_PDFTOHTML || '/usr/local/bin/xpdf-pdftohtml');
      await execute('/usr/bin/bwrap', [
        '--die-with-parent', '--unshare-all', '--cap-drop', 'ALL', '--clearenv',
        '--ro-bind', '/usr', '/usr', '--symlink', 'usr/lib', '/lib',
        '--symlink', 'usr/lib64', '/lib64', '--proc', '/proc', '--dev', '/dev',
        '--tmpfs', '/tmp', '--ro-bind', directory, '/input', '--bind', output, '/output',
        '--ro-bind', executable, '/questions-pdftohtml',
        '/usr/bin/prlimit', '--as=1073741824', '--cpu=20', '--fsize=16777216', '--',
        '/questions-pdftohtml', '-nofonts', '-r', '72', '-f', String(unit.page),
        '-l', String(unit.page), '/input/source.pdf', '/output/page',
      ], { timeout: 25000, maxBuffer: 8 * 1024 * 1024, signal });
      const html = path.join(output, 'page', `page${unit.page}.html`);
      if ((await fs.stat(html)).size > 8 * 1024 * 1024) throw new Error('PDF text output exceeds limit');
      const page = new DOMParser().parseFromString(await fs.readFile(html, 'utf8'), 'text/html');
      const stdout = Array.from(page.getElementsByTagName('div'))
        .filter(node => node.getAttribute('class')?.split(/\s+/).includes('txt'))
        .map(node => node.textContent).join('\n');
      if (!stdout.trim()) return null;
      const lines = stdout.split('\n');
      // A page header may itself identify an answer page. Classify it before
      // removing page furniture, and only before any numbered question.
      const firstAnswer = lines.findIndex(line => answerHeading.test(line.replace(/^\s*第\s*\d+\s*页\s*[·:：-]?\s*/, '')));
      const firstQuestion = lines.findIndex(line => questionStart.test(line));
      const answerPage = firstAnswer >= 0 && (firstQuestion < 0 || firstAnswer < firstQuestion);
      const text = stdout.replace(/^\s*第\s*\d+\s*页[^\n]*$/gm, '').replaceAll('\f', '').trim();
      // Parse numbered answers using the same boundaries as question text, then
      // let the existing cross-page merger match only unambiguous labels.
      // Keep mid-page headings so nativeText can associate answers with the
      // preceding questions, including questions left / answers right layouts.
      let content = answerPage ? text.split('\n').filter(line => !answerHeading.test(line)).join('\n').trim() : text;
      const continuation = !answerPage && content.match(/^(?:续第\s*([0-9０-９]+)\s*题|第\s*([0-9０-９]+)\s*题[（(]续[）)])[ \t]*[:：]?[ \t]*(?:\r?\n|$)/);
      if (continuation) content = (continuation[1] ?? continuation[2]) + '. ' + content.slice(continuation[0].length);
      // Text offsets identify only the first explicit continuation. Public
      // locations still point to the unchanged PDF page, including selected pages.
      const parsed = nativeText(content);
      const records = [];
      function record(draft, role, document) {
        const text = documentText(document);
        records.push({
          id: extractionId(unit.file.id, unit.page, records.length), role,
          label: draft.title, section: unit.file.id, group: '', continues: role === 'continuation' ? draft.title : '',
          text, document, locations: [unit.location],
          doubts: /[⎧⎩⎨�]/.test(text) ? ['原稿数学排版需校对'] : [],
        });
      }
      for (const draft of parsed.drafts) {
        if (answerPage) {
          const blocks = [...draft.body.blocks, ...draft.solution.blocks];
          record(draft, 'answer', {version: 2, blocks});
        } else {
          const continued = continuation && draft.parts[0].locations[0]?.start === 0;
          record(draft, continued ? 'continuation' : 'question', draft.body);
          if (draft.answerStatus === 'present') record(draft, 'answer', draft.solution);
        }
      }
      // Unnumbered text remains editable without inventing question boundaries.
      if (!records.length && text) {
        record({title: `第 ${unit.page} 页`}, answerPage ? 'other' : 'question', textDocument(text));
        records[0].doubts.push('未识别题号，请核对拆题范围');
        parsed.fragments = [];
      }
      return {drafts: [], fragments: parsed.fragments.map(fragment => ({...fragment, locations: [unit.location]})), records};
    } finally {
      await fs.rm(directory, {recursive: true, force: true});
    }
  };
}
