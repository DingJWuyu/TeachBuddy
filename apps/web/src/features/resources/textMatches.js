// Preserve offsets into the displayed source while applying the library's
// whitespace and Chinese line-break rules. Never infer positions on page images.
function normalized(value) {
  const pieces = [];
  for (const { segment, index } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)) {
    // Some PDFs map rendered Han glyphs to their Kangxi radical code points
    // in PDF.js while Poppler extracts the ordinary character. Normalize only
    // those compatibility radicals; offsets still point to the real glyph.
    const text = segment.replace(/[\u2F00-\u2FD5]/gu, char => char.normalize("NFKC")).normalize("NFC");
    if (/^\s+$/u.test(text)) {
      if (pieces.at(-1)?.text === " ") pieces.at(-1).end = index + segment.length;
      else pieces.push({ text: " ", start: index, end: index + segment.length });
    } else pieces.push({ text, start: index, end: index + segment.length });
  }
  const kept = pieces.filter((piece, index) => piece.text !== " " ||
    (index > 0 && index < pieces.length - 1 &&
      !(/\p{Script=Han}$/u.test(pieces[index - 1].text) && /^\p{Script=Han}/u.test(pieces[index + 1].text))));
  const offsets = [];
  for (const piece of kept) for (let i = 0; i < piece.text.length; i++) offsets.push(piece);
  return { text: kept.map(piece => piece.text).join(""), offsets };
}
export function textMatches(value, query) {
  const source = normalized(value), needle = normalized(query).text;
  if (!needle) return [];
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  return [...source.text.matchAll(pattern)].map(match => ({
    from: source.offsets[match.index].start,
    to: source.offsets[match.index + match[0].length - 1].end,
  }));
}
