import { invalidInput, materialsError } from '../../workbench/problems.js';
import { imageTypes } from '../../workbench/files/index.js';
import { validateSchema } from '../../workbench/content/schema.js';

// Locations belong to an import and its persisted immutable source records.
function validateLocation(
  files,
  principal,
  location,
  { text = '', originals = [], renditions = [], paragraphs = [], nativeWordSource } = {}
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
    const wordType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    let hasWordSource = original.mediaType === wordType;
    if (original.mediaType === 'application/msword' && nativeWordSource?.format === 'libreoffice-docx-v1') {
      const converted = files.read(principal, nativeWordSource.fileId);
      hasWordSource = converted.mediaType === wordType &&
        original.sha256 === nativeWordSource.originalSha256 && converted.sha256 === nativeWordSource.sha256;
    }
    const runCount = paragraphs[location.paragraph - 1];
    if (
      !hasWordSource ||
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

export function createLocationValidator({ store, files }) {
  return (principal, material, parts) => {
    const originals = [...(material.input.fileIds ?? []), ...material.supplementFileIds];
    const task = store.get('tasks', principal, material.jobId);
    for (const part of parts) for (const location of part.locations) {
      try {
        validateLocation(files, principal, location, {
          text: material.input.text,
          originals,
          renditions: task.renditions ?? [],
          paragraphs: task.paragraphs?.[location.fileId] ?? [],
          nativeWordSource: task.nativeWordSources?.[location.fileId],
        });
      } catch (error) {
        if (error.status === 404) throw error;
        throw materialsError('invalid-location', 422, '/parts', error.message);
      }
    }
  };
}
