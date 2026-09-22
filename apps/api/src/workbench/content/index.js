import { invalidInput } from '../problems.js';
import { imageTypes } from '../files/index.js';
import { validateSchema } from './schema.js';

export function createContent({ files }) {
  function validate(principal, document) {
    if (![1, 2].includes(document?.version))
      throw invalidInput('/version', 'unsupported-content-version');
    validateSchema('Document', document);
    let count = 0,
      mathLength = 0;
    function blocks(items, field) {
      for (const [i, block] of items.entries()) {
        const pointer = `${field}/${i}`;
        count += 1;
        if (count > 2000) throw invalidInput(pointer, 'out-of-range');
        if (block.type === 'math') mathLength += block.latex.length;
        for (const run of block.runs ?? []) if (run.type === 'math') mathLength += run.latex.length;
        if (mathLength > 200000) throw invalidInput(pointer, 'out-of-range');
        if (block.type === 'image') {
          const file = files.read(principal, block.fileId);
          if (!imageTypes.has(file.mediaType))
            throw invalidInput(`${pointer}/fileId`, 'out-of-range');
        }
        if (block.type === 'teacher-note') blocks(block.blocks, `${pointer}/blocks`);
        if (block.type === 'list')
          block.items.forEach((item, j) => blocks(item.blocks, `${pointer}/items/${j}/blocks`));
        if (block.type === 'table') {
          const columns = block.rows[0].length;
          block.rows.forEach((row, j) => {
            if (row.length !== columns) throw invalidInput(`${pointer}/rows/${j}`, 'out-of-range');
            row.forEach((cell, k) => blocks(cell.blocks, `${pointer}/rows/${j}/${k}/blocks`));
          });
        }
      }
    }
    blocks(document.blocks, '/blocks');
    return document;
  }
  return { validate };
}

// The owning import supplies its immutable source/derived records. This helper
// does not create a new public port or infer provenance from client file IDs.
export function validateLocation(
  files,
  principal,
  location,
  { text = '', originals = [], renditions = [], paragraphs = [] } = {}
) {
  validateSchema('Location', location);
  if (location.kind === 'text') {
    if (location.start >= location.end || location.end > [...text].length)
      throw invalidInput('/end', 'out-of-range');
    return location;
  }
  const original = files.read(principal, location.fileId);
  if (!originals.includes(location.fileId)) throw invalidInput('/fileId', 'out-of-range');
  if (location.kind === 'docx') {
    const runCount = paragraphs[location.paragraph - 1];
    if (
      original.mediaType !==
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      runCount === undefined ||
      location.runStart >= location.runEnd ||
      location.runEnd > runCount
    )
      throw invalidInput('/runEnd', 'out-of-range');
    return location;
  }
  const rendition = files.read(principal, location.renditionFileId);
  const record = renditions.find(
    (item) => item.fileId === location.fileId && item.renditionFileId === rendition.id
  );
  const selfImage = rendition.id === original.id && imageTypes.has(original.mediaType);
  if (
    (!selfImage && !record) ||
    (!imageTypes.has(rendition.mediaType) && rendition.mediaType !== 'application/pdf')
  )
    throw invalidInput('/renditionFileId', 'out-of-range');
  const pages = selfImage ? 1 : record.pages;
  if (location.page > pages) throw invalidInput('/page', 'out-of-range');
  const b = location.box;
  if (b && (b.x + b.width > 1 || b.y + b.height > 1)) throw invalidInput('/box', 'out-of-range');
  return location;
}
