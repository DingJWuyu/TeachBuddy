import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import { parseFragment } from "parse5";
import { createContent } from "../content/index.js";
import { hasUnparsedMath, recoverTextFormat } from './text-format.js';

const markdown = unified().use(remarkParse).use(remarkMath);
const documentOf = (blocks) => ({ version: 2, blocks });
const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const children = (node) => node.childNodes ?? [];

function failure(code, detail, blockId = null) {
  return Object.assign(new Error(detail), { code, blockId, fatal: true });
}

function textOf(blocks) {
  return blocks
    .map((block) => {
      if (block.runs)
        return block.runs.map((run) => run.text ?? run.latex).join("");
      if (block.type === "math") return block.latex;
      if (block.type === "list")
        return block.items
          .map((item) => `${item.label} ${textOf(item.blocks)}`.trim())
          .join("\n");
      if (block.type === "table")
        return block.rows
          .map((row) => row.map((cell) => textOf(cell.blocks)).join("\t"))
          .join("\n");
      return "";
    })
    .join("\n");
}

function fileIds(blocks) {
  return blocks.flatMap((block) => {
    if (block.type === "image") return [block.fileId];
    if (block.type === "list")
      return block.items.flatMap((item) => fileIds(item.blocks));
    if (block.type === "table")
      return block.rows.flatMap((row) =>
        row.flatMap((cell) => fileIds(cell.blocks)),
      );
    return [];
  });
}

// One Paddle page, with only bytes already collected by the engine adapter.
// No filesystem paths, remote URLs, model calls, or question-specific repairs.
export async function normalizeRecognition({ result, storeAsset }) {
  const rawBlocks = result?.raw?.parsing_res_list;
  const width = result?.width ?? result?.raw?.width;
  const height = result?.height ?? result?.raw?.height;
  if (
    !Array.isArray(rawBlocks) ||
    !Array.isArray(result.assets) ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    typeof storeAsset !== "function"
  )
    throw failure("invalid-output", "识别页缺少有效的块、尺寸或附件。");

  const assets = new Map();
  const saved = new Map();
  const savedFiles = new Map();
  const used = new Set();
  const issues = [];
  let blockId = null;
  function issue(code, detail) {
    if (
      !issues.some(
        (i) => i.code === code && i.blockId === blockId && i.detail === detail,
      )
    )
      issues.push({ code, blockId, detail });
  }
  for (const asset of result.assets) {
    if (
      typeof asset?.name !== "string" ||
      !asset.name ||
      !(asset.bytes instanceof Uint8Array) ||
      !asset.bytes.length ||
      assets.has(asset.name)
    )
      throw failure("invalid-output", "识别附件缺失、重复命名或字节无效。");
    assets.set(asset.name, asset);
  }
  function boxOf(bbox) {
    if (
      !Array.isArray(bbox) ||
      bbox.length !== 4 ||
      !bbox.every(Number.isFinite) ||
      bbox[0] < 0 ||
      bbox[1] < 0 ||
      bbox[2] > width ||
      bbox[3] > height ||
      bbox[2] <= bbox[0] ||
      bbox[3] <= bbox[1]
    ) {
      issue("invalid-location", "识别块的位置无效，请对照原页核查。");
      return null;
    }
    return {
      x: bbox[0] / width,
      y: bbox[1] / height,
      width: (bbox[2] - bbox[0]) / width,
      height: (bbox[3] - bbox[1]) / height,
    };
  }
  function assetBounds(name) {
    const match = name.match(
      /_box_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)\.[^.]+$/,
    );
    return match ? match.slice(1).map(Number) : null;
  }
  async function image(name, alt = "") {
    const asset = assets.get(name);
    if (!asset)
      throw failure(
        "missing-asset",
        `识别结果引用的图片附件不可读取：${name}`,
        blockId,
      );
    if (!saved.has(name)) {
      const file = await storeAsset(name, Buffer.from(asset.bytes));
      if (
        !file?.id ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.mediaType)
      )
        throw failure(
          "missing-asset",
          "识别图片未保存为有效受管附件。",
          blockId,
        );
      saved.set(name, file);
      savedFiles.set(file.id, file);
    }
    used.add(name);
    const bounds = assetBounds(name);
    const fraction = bounds ? (bounds[2] - bounds[0]) / width : 0.6;
    return {
      type: "image",
      fileId: saved.get(name).id,
      alt,
      widthMm: Math.max(5, Math.min(170, fraction * 170)),
    };
  }

  function leafBlocks(blocks) {
    return blocks.flatMap((block) => {
      if (["paragraph", "math", "image"].includes(block.type)) return [block];
      issue(
        "structure-flattened",
        "原稿含 Document v2 不能嵌套的结构，已保留内容，请核对排版。",
      );
      if (block.type === "heading")
        return [{ type: "paragraph", runs: block.runs }];
      if (block.type === "list")
        return block.items.flatMap((item) => [
          ...(item.label
            ? [
                {
                  type: "paragraph",
                  runs: [{ type: "text", text: item.label }],
                },
              ]
            : []),
          ...leafBlocks(item.blocks),
        ]);
      return block.rows.flatMap((row) =>
        row.flatMap((cell) => leafBlocks(cell.blocks)),
      );
    });
  }

  async function table(node, recover = true) {
    const rows = children(node).flatMap((child) =>
      child.tagName === "tr"
        ? [child]
        : ["thead", "tbody", "tfoot"].includes(child.tagName)
          ? children(child).filter((row) => row.tagName === "tr")
          : [],
    );
    const grid = [];
    for (const [rowIndex, row] of rows.entries()) {
      grid[rowIndex] ??= [];
      let column = 0;
      for (const cell of children(row).filter((c) =>
        ["td", "th"].includes(c.tagName),
      )) {
        while (grid[rowIndex][column] !== undefined) column++;
        const span = (name) => {
          const value = attr(cell, name);
          if (value === undefined) return 1;
          const n = Number(value);
          if (!Number.isInteger(n) || n < 1)
            throw failure(
              "invalid-output",
              "表格包含无法保留的合并单元格范围。",
              blockId,
            );
          return n;
        };
        const rowSpan = span("rowspan"),
          colSpan = span("colspan");
        if (rowIndex + rowSpan > 100 || column + colSpan > 20)
          throw failure(
            "invalid-output",
            "识别表格超过 Document v2 的行列限制。",
            blockId,
          );
        if (rowSpan > 1 || colSpan > 1)
          issue(
            "merged-cells",
            "原表有合并单元格；内容保留在起始格，覆盖区域留空，请核对原稿。",
          );
        for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
          grid[r] ??= [];
          for (let c = column; c < column + colSpan; c++) {
            if (grid[r][c] !== undefined)
              throw failure(
                "invalid-output",
                "表格合并单元格互相重叠。",
                blockId,
              );
            grid[r][c] = { blocks: [] };
          }
        }
        grid[rowIndex][column].blocks = leafBlocks(
          await htmlChildren(children(cell), recover),
        );
        column += colSpan;
      }
    }
    const columns = Math.max(0, ...grid.map((row) => row.length));
    if (!columns)
      throw failure("invalid-output", "识别表格没有可读取的单元格。", blockId);
    if (grid.some((row) => row.length !== columns))
      issue(
        "uneven-table",
        "表格行的列数不一致，缺少的位置已保留为空格，请核对原稿。",
      );
    const normalized = grid.map((row) =>
      Array.from({ length: columns }, (_, i) => row[i] ?? { blocks: [] }),
    );
    const captions = children(node).filter(
      (child) => child.tagName === "caption",
    );
    const captionBlocks = [];
    for (const caption of captions)
      captionBlocks.push(...(await htmlChildren(children(caption), recover)));
    return [...captionBlocks, { type: "table", rows: normalized }];
  }

  async function htmlChildren(nodes, recover = true) {
    const output = [];
    let buffer = "";
    const flush = async () => {
      if (buffer.trim()) output.push(...(await parseMarkdown(buffer, recover)));
      buffer = "";
    };
    for (const [index, node] of nodes.entries()) {
      if (node.nodeName === "#text") {
        if (recover && node.value.trim() === '\\n' &&
            nodes[index - 1]?.tagName === 'img' && nodes[index + 1]?.tagName === 'img') {
          issue('text-lines-recovered',
            '已按相邻图片结构恢复换行分隔，原始标记保留在识别原稿中，请对照原页核对。');
          continue;
        }
        buffer += node.value;
        continue;
      }
      if (node.nodeName === "#comment") continue;
      if (node.tagName === "br") {
        buffer += "\n";
        continue;
      }
      await flush();
      if (node.tagName === "img") {
        output.push(await image(attr(node, "src"), attr(node, "alt") ?? ""));
      } else if (node.tagName === "table") {
        output.push(...(await table(node, recover)));
      } else if (["code", "pre"].includes(node.tagName)) {
        const literal = node => node.nodeName === '#text' ? node.value
          : node.tagName === 'br' ? '\n' : children(node).map(literal).join('');
        const text = literal(node);
        const runs = [];
        for (let i = 0; i < text.length; i += 20000)
          runs.push({type: 'text', text: text.slice(i, i + 20000)});
        if (runs.length) output.push({type: 'paragraph', runs});
      } else {
        if (
          ["script", "style", "iframe", "object", "svg"].includes(node.tagName)
        )
          issue(
            "unsupported-html",
            "识别结果含不支持的 HTML 元素，按纯文字保留，请核对原稿。",
          );
        output.push(...(await htmlChildren(children(node), recover &&
          !['a', 'script', 'style', 'iframe', 'object', 'svg'].includes(node.tagName))));
      }
    }
    await flush();
    return output;
  }
  async function parseHtml(value, recover = true) {
    const fragment = parseFragment(value, {
      onParseError() {
        issue(
          "html-recovered",
          "识别 HTML 存在格式错误，已按 HTML 规则解析，请核对表格与图片。",
        );
      },
    });
    return htmlChildren(children(fragment), recover);
  }

  async function parseMarkdown(source, recover = true) {
    const tree = markdown.parse(source);
    let protectedUntil = 0;
    const definitions = new Map();
    for (const node of tree.children)
      if (node.type === "definition") definitions.set(node.identifier, node);
    const sourceOf = (node) =>
      source.slice(node.position.start.offset, node.position.end.offset);
    const latexOf = (node) => {
      if (node.type === "math") return node.value;
      const raw = sourceOf(node),
        fence = raw.match(/^\$+/)[0];
      return raw.slice(fence.length, -fence.length);
    };
    async function inline(nodes, type = "paragraph", level) {
      const output = [];
      const paragraphEnd = nodes.at(-1)?.position.end.offset ?? 0;
      let runs = [];
      const appendText = text => {
        for (let i = 0; i < text.length; i += 20000)
          runs.push({type: 'text', text: text.slice(i, i + 20000)});
      };
      const flush = () => {
        if (runs.length)
          output.push({ type, ...(level ? { level } : {}), runs });
        runs = [];
      };
      const visit = async (node, allowRecovery = recover) => {
        const start = node.position.start.offset, end = node.position.end.offset;
        if (end <= protectedUntil) return;
        if (start < protectedUntil && !node.children) {
          // A Markdown token can span the HTML closing tag. Keep its remaining
          // source, since its decoded value also includes the consumed prefix.
          appendText(source.slice(protectedUntil, end));
          issue('text-format-uncertain',
            'HTML 与 Markdown 的边界交叠，剩余文字已原样保留，请对照原稿核对。');
          return;
        }
        if (node.type === "inlineMath")
          runs.push({ type: "math", latex: latexOf(node) });
        else if (node.type === "image" || node.type === "imageReference") {
          flush();
          const url = node.url ?? definitions.get(node.identifier)?.url;
          output.push(await image(url, node.alt ?? ""));
        } else if (node.type === "html") {
          flush();
          if (/^<(code|pre|a)(?=[\s/>])/i.test(node.value)) {
            // HTML scopes follow original-source offsets, not Markdown sibling
            // lists. The closing tag can be in another emphasis or paragraph.
            const element = children(parseFragment(source.slice(start),
              {sourceCodeLocationInfo: true}))[0];
            const closing = element?.sourceCodeLocation?.endTag;
            protectedUntil = closing ? start + closing.endOffset : paragraphEnd;
            if (!closing) issue('text-format-uncertain',
              '行内 HTML 字面区域未完整闭合，已保留本段内容，请对照原稿核对。');
            output.push(...await parseHtml(source.slice(start, protectedUntil), false));
          } else output.push(...(await parseHtml(node.value, allowRecovery)));
        } else if (node.children) {
          const original = sourceOf(node);
          // A malformed subscript may become Markdown emphasis spanning other
          // words. Preserve its delimiters instead of accepting a valid prefix.
          if (start >= protectedUntil && ['emphasis', 'strong'].includes(node.type) &&
              (original.startsWith('_{') ||
               (original.endsWith('_') && source[node.position.end.offset] === '{'))) {
            appendText(original);
            if (allowRecovery) issue('unparsed-math',
              '文字中的下标与 Markdown 标记边界不明确，已保留原文，请核对公式。');
            return;
          }
          for (const child of node.children)
            await visit(child, allowRecovery && !['link', 'linkReference'].includes(node.type));
        } else {
          const original = sourceOf(node);
          const unparsedMath = node.type === 'text' && hasUnparsedMath(original);
          // Markdown decodes escapes in text nodes, including LaTeX braces
          // and row separators. Keep uncertain math as literal source.
          let text =
            node.type === "break"
              ? "\n"
              : node.type === "text" && unparsedMath
                ? original
                : (node.value ?? original);
          if (node.type === 'text' && /\\\\/.test(original)) text = original;
          if (allowRecovery && node.type === 'text' && original === node.value) {
            const restored = recoverTextFormat(original,
              source[node.position.start.offset - 1] ?? '', source[node.position.end.offset] ?? '');
            if (restored.mathRecovered) issue('math-recovered',
              '已按完整下标标注恢复数学格式，原文字保留在识别原稿中，请对照原页核对。');
            if (restored.linesRecovered) issue('text-lines-recovered',
              '已将识别文字的换行标记恢复为段落，请对照原页核对。');
            if (restored.uncertainLines) issue('text-format-uncertain',
              '文字中的反斜杠可能属于路径或字面说明，已保留原文，请核对换行。');
            for (const part of restored.parts) {
              if (part.type === 'break') flush();
              else if (part.type === 'math') runs.push(part);
              else {
                if (hasUnparsedMath(part.text)) issue('unparsed-math',
                  '文字中含未加数学定界符的 LaTeX，已保留原文字，请核对公式。');
                appendText(part.text);
              }
            }
            return;
          }
          if (unparsedMath && allowRecovery)
            issue(
              "unparsed-math",
              "文字中含未加数学定界符的 LaTeX，已保留原文字，请核对公式。",
            );
          appendText(text);
        }
      };
      for (const node of nodes) await visit(node);
      flush();
      return output;
    }
    async function blocks(nodes) {
      const output = [];
      for (const node of nodes) {
        if (node.position.end.offset <= protectedUntil) continue;
        if (node.position.start.offset < protectedUntil && !node.children) {
          output.push(...await inline([node]));
          continue;
        }
        if (node.type === "paragraph" || node.type === "heading") {
          if (node.depth > 3)
            issue("heading-level", "标题层级超过三级，保留为三级标题。");
          output.push(
            ...(await inline(
              node.children,
              node.type,
              node.type === "heading" ? Math.min(3, node.depth) : undefined,
            )),
          );
        } else if (node.type === "math")
          output.push({ type: "math", latex: latexOf(node) });
        else if (node.type === "html")
          output.push(...(await parseHtml(node.value, recover)));
        else if (node.type === "list") {
          const items = [];
          for (const [i, item] of node.children.entries()) {
            if (item.position.end.offset <= protectedUntil) continue;
            const label = item.position.start.offset < protectedUntil ? ''
              : node.ordered ? `${(node.start ?? 1) + i}.` : '';
            const content = leafBlocks(await blocks(item.children));
            items.push({
              label,
              blocks: content.length
                ? content
                : [{ type: "paragraph", runs: [] }],
            });
          }
          output.push({ type: "list", role: "plain", items });
        } else if (node.type === "blockquote")
          output.push(...(await blocks(node.children)));
        else if (node.type !== "definition") {
          const text = node.type === "code" ? node.value : sourceOf(node);
          issue(
            "structure-as-text",
            "部分 Markdown 结构按纯文字保留，请核对原稿。",
          );
          output.push({ type: "paragraph", runs: [{ type: "text", text }] });
        }
      }
      return output;
    }
    return blocks(tree.children);
  }

  const blocks = [];
  const pageBlocks = [];
  for (const [rawIndex, raw] of rawBlocks.entries()) {
    if (!raw || typeof raw !== "object")
      throw failure("invalid-output", "识别块不是有效对象。", rawIndex);
    blockId = raw.block_id ?? rawIndex;
    if (typeof raw.block_content !== "string")
      throw failure("invalid-output", "识别块缺少原始内容。", blockId);
    const box = boxOf(raw.block_bbox);
    let content;
    if (raw.block_label === "image" && !raw.block_content.trim()) {
      const matches = [...assets.keys()].filter((name) => {
        const bounds = assetBounds(name);
        return (
          bounds && bounds.every((value, i) => value === raw.block_bbox?.[i])
        );
      });
      if (matches.length !== 1)
        throw failure(
          "missing-asset",
          "原稿图块没有唯一对应的实际裁图附件。",
          blockId,
        );
      content = [await image(matches[0])];
    } else content = await parseMarkdown(raw.block_content);
    if (["paragraph_title", "doc_title"].includes(raw.block_label))
      content = content.map((block) =>
        block.type === "paragraph" && block.runs.length
          ? {
              ...block,
              type: "heading",
              level: raw.block_label === "doc_title" ? 1 : 2,
            }
          : block,
      );
    const assetFileIds = [...new Set(fileIds(content))];
    blocks.push({
      ...raw,
      rawIndex,
      box,
      document: documentOf(content),
      text: textOf(content),
      assetFileIds,
    });
    pageBlocks.push(...content);
  }
  blockId = null;
  for (const name of assets.keys()) {
    if (used.has(name)) continue;
    issue(
      "unassigned-image",
      "存在未关联到文字块的实际图片，已在页末保留，请对照原页核查位置。",
    );
    pageBlocks.push(await image(name));
  }
  const text = textOf(pageBlocks);
  if (rawBlocks.length && !text.trim() && !savedFiles.size)
    throw failure("invalid-output", "识别块未产生可读取的文档内容。");
  const document = documentOf(pageBlocks);
  try {
    createContent({ files: { read: (_, id) => savedFiles.get(id) } }).validate(
      null,
      document,
    );
  } catch {
    throw failure(
      "invalid-output",
      "识别内容无法完整表达为 Document v2，请核对原稿和原始识别结果。",
    );
  }
  return {
    document,
    text,
    blocks,
    issues,
    assetFileIds: [...savedFiles.keys()],
  };
}
