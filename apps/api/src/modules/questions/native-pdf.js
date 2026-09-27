import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { nativeText } from './extraction.js';
import { documentText, textDocument } from './materials-content.js';
import { extractionId } from './extraction-fragments.js';
const execute = promisify(execFile);

// Poppler reads the existing text layer locally. No credentials, model downloads
// or network requests are involved; image-only pages remain explicitly incomplete.
export function createPdfReader(files) {
  return async function readPdf(principal, unit, signal) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'questions-pdf-'));
    try {
      const chunks = [];
      for await (const chunk of await files.open(principal, unit.preview.renditionFileId)) chunks.push(chunk);
      await fs.writeFile(path.join(directory, 'source.pdf'), Buffer.concat(chunks));
      const { stdout } = await execute('/usr/bin/bwrap', [
        '--die-with-parent', '--unshare-all', '--cap-drop', 'ALL', '--clearenv',
        '--ro-bind', '/usr', '/usr', '--symlink', 'usr/lib', '/lib',
        '--symlink', 'usr/lib64', '/lib64', '--proc', '/proc', '--dev', '/dev',
        '--tmpfs', '/tmp', '--ro-bind', directory, '/input',
        '/usr/bin/prlimit', '--as=1073741824', '--cpu=20', '--fsize=16777216', '--',
        '/usr/bin/pdftotext', '-layout', '-enc', 'UTF-8', '-f', String(unit.page),
        '-l', String(unit.page), '/input/source.pdf', '-',
      ], { timeout: 25000, maxBuffer: 8 * 1024 * 1024, signal });
      if (!stdout.trim()) return null;
      const answerPage = /(?:参考答案|答案解析|原有答案|参考解答)/.test(stdout.split('\n').slice(0, 3).join('\n'));
      const text = stdout.replace(/^\s*第\s*\d+\s*页[^\n]*$/gm, '').replaceAll('\f', '').trim();
      // Parse numbered answers using the same boundaries as question text, then
      // let the existing cross-page merger match only unambiguous labels.
      let content = text.replace(/^\s*(?:【.*(?:答案|解析).*】|参考答案[:：]?|答案解析[:：]?|参考解答[:：]?)\s*$/gm, '').trim();
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
