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
