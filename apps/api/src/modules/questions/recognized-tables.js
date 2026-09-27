import { documentText, images, walkBlocks } from './materials-content.js';
import { extractionId } from './extraction-fragments.js';

const text = blocks => blocks.map(block => block.runs
  ? block.runs.map(run => run.text ?? run.latex).join('')
  : documentText({version: 2, blocks: [block]})).join('\n');
const roles = new Map([['教学内容', 'content'], ['学习内容', 'content'], ['师生活动', 'activity'],
  ['教师活动', 'activity'], ['学生活动', 'activity'], ['设计点评', 'note'], ['教学点评', 'note']]);
const role = value => roles.get(value.replace(/\s|[:：]$/g, ''));
const heading = /^【\s*((?:例题?|练习|思考)\s*[0-9０-９]*)\s*】$/;
const sectionHeading = /^\s*(?:教学环节\s*[:：]|【\s*教学环节\s*】)/;
const activity = /^\s*(?:教学环节|教师|师|学生)\s*[:：]/;
const furniture = new Set(['header', 'footer', 'number', 'header_image', 'footer_image']);

// The shared HTML parser already owns table structure, math and asset IDs.
// Split text boundaries only; never flatten a math run into another parser.
function parts(blocks) {
  const result = [];
  for (const block of blocks) {
    if (!block.runs) { result.push(structuredClone(block)); continue; }
    let runs = [];
    const flush = () => {
      if (runs.some(run => run.type === 'math' || run.text.trim()))
        result.push({...structuredClone(block), runs});
      runs = [];
    };
    for (const run of block.runs) {
      if (run.type !== 'text') { runs.push(structuredClone(run)); continue; }
      // Some OCR HTML uses literal separators before a title or subquestion.
      // Leave unrelated literal text and all LaTeX escapes untouched.
      const value = run.text.replace(/\\n(?=\s*(?:【|[（(][0-9０-９]+[）)]|(?:教师|师|学生)\s*[:：]|$))/g, '\n');
      for (const piece of value.split(/(【[^】\r\n]{1,32}】|\r?\n)/)) {
        if (/^【.*】$/.test(piece)) { flush(); result.push({marker: piece}); }
        else if (/^\r?\n$/.test(piece)) flush();
        else if (piece) runs.push({type: 'text', text: piece});
      }
    }
    flush();
  }
  return result;
}

export function readTeachingTables(page, {section, previous} = {}) {
  const records = [], fragments = [], handled = new Set();
  const occurrences = new Map();
  let context = null, recognized = false, partial = false, first = true;
  const fragment = (blocks, location) => {
    const value = text(blocks);
    if (!value.trim()) return;
    for (let start = 0; start < value.length; start += 20000)
      fragments.push({id: extractionId(page.resultId, 'table-fragment', fragments.length),
        text: value.slice(start, start + 20000), locations: [location], disposition: 'unassigned'});
  };
  for (const [order, raw] of page.blocks.entries()) {
    if (furniture.has(raw.block_label) || ['paragraph_title', 'doc_title'].includes(raw.block_label) && /^\s*第\s*\d+\s*页/.test(raw.text)) continue;
    if (!raw.document.blocks.some(block => block.type === 'table')) {
      context = null;
      first = false;
      continue;
    }
    for (const table of raw.document.blocks.filter(block => block.type === 'table')) {
      const location = {...page.location, box: raw.box};
      const header = row => {
        const roles = row.map(cell => role(text(cell.blocks)));
        return roles.every(Boolean) && roles.filter(r => r === 'content').length === 1 && roles.length > 1 ? roles : null;
      };
      const adjacent = first && previous && previous.revision === page.revision &&
        previous.location.fileId === page.location.fileId && previous.location.renditionFileId === page.location.renditionFileId &&
        previous.location.page + 1 === page.location.page && previous.box && raw.box &&
        Math.abs(previous.box.x - raw.box.x) <= 0.025 &&
        Math.abs(previous.box.x + previous.box.width - raw.box.x - raw.box.width) <= 0.025 &&
        table.rows.every(row => row.length === previous.roles.length);
      // Separate tables on one page need their own header. Only a leading
      // table on the immediately following original page may inherit roles.
      context = adjacent ? {...previous, inherited: true} : null;
      first = false;
      if (!context && !table.rows.some(header)) continue;
      handled.add(table);
      recognized = true;
      const localIssues = page.issues.filter(issue => issue.blockId == null || issue.blockId === (raw.block_id ?? raw.rawIndex));
      const malformed = localIssues.some(issue => issue.code === 'uneven-table');
      for (const [rowIndex, row] of table.rows.entries()) {
        const roles = header(row);
        if (roles) {
          context = {roles, group: extractionId(page.resultId, order, rowIndex), location: page.location,
            box: raw.box, revision: page.revision};
          continue;
        }
        if (row.some(cell => sectionHeading.test(text(cell.blocks)))) {
          row.forEach(cell => fragment(cell.blocks, location)); context = null; continue;
        }
        if (context?.inherited && row.some((cell, index) => context.roles[index] !== 'content' &&
            /^\s*【\s*(?:例题?|练习|思考)/.test(text(cell.blocks)))) {
          context = null;
        }
        if (!context || malformed || row.length !== context.roles.length ||
            localIssues.some(issue => issue.code === 'merged-cells') && row.some(cell => !text(cell.blocks).trim() && !images({blocks: cell.blocks}).length)) {
          row.forEach(cell => fragment(cell.blocks, location)); partial = true; continue;
        }
        const content = row[context.roles.indexOf('content')];
        row.filter(cell => cell !== content).forEach(cell => fragment(cell.blocks, location));
        const values = parts(content.blocks);
        const markers = values.filter(value => value.marker).length;
        let current = null;
        const finish = () => {
          if (!current) return;
          const body = text(current.blocks);
          let hasMath = false;
          walkBlocks(current.blocks, block => { hasMath ||= block.type === 'math' || block.runs?.some(run => run.type === 'math'); });
          if (!body.trim() || /下列/.test(body) && !hasMath && !/[（(][0-9０-９]+[）)]/.test(body) && !images({blocks: current.blocks}).length) {
            fragment([{type: 'paragraph', runs: [{type: 'text', text: current.marker}]}, ...current.blocks], location);
            partial = true; current = null; return;
          }
          const document = {version: 2, blocks: current.blocks};
          // Source content distinguishes unnumbered exercises. Candidate order
          // and display titles alone cannot identify a teacher's edited draft.
          const anchor = extractionId(page.location, raw.box, current.marker, document);
          const occurrence = occurrences.get(anchor) ?? 0;
          occurrences.set(anchor, occurrence + 1);
          const sourceKey = extractionId(anchor, occurrence);
          records.push({id: sourceKey, role: 'question', sourceKey,
            label: current.label, section, group: context.group, continues: '', text: documentText(document), document,
            locations: [location], figureLocations: images(document).length ? [location] : [],
            doubts: [...localIssues.map(issue => issue.detail), ...(context.inherited ? ['沿连续原页的表头识别内容列，请核对列归属。'] : [])],
            issueCodes: [...new Set(localIssues.map(issue => issue.code === 'unparsed-math' ? 'uncertain-formula' : 'uncertain-text')),
              ...(context.inherited ? ['split-boundary'] : [])], order});
          current = null;
        };
        for (const value of values) {
          if (value.marker) {
            finish();
            const match = value.marker.match(heading);
            if (match) current = {label: match[1].replace(/\s/g, ''), marker: value.marker, blocks: []};
            else { fragment([{type: 'paragraph', runs: [{type: 'text', text: value.marker}]}], location); partial = true; }
          } else if (activity.test(text([value]))) {
            finish(); fragment([value], location);
          } else if (current) {
            if (value.type === 'image' && markers > 1) {
              fragment([value], location); partial = true;
            } else current.blocks.push(value);
          } else {
            fragment([value], location);
            partial = true;
          }
        }
        finish();
      }
      if (context) context = {...context, location: page.location, box: raw.box};
    }
  }
  return {records, fragments, handled, recognized, partial, context};
}
