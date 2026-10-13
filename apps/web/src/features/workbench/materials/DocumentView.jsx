import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { canRenderMath, supportedDocument } from '@refatos/shared';
import { MathFormula } from '../MathText.jsx';
import { workbenchBlob } from '../apiClient.js';
import './materials.css';

export function Formula({ latex, display = false }) {
  const { t } = useTranslation("workbench");
  return canRenderMath(latex) ? (
    <MathFormula latex={latex} display={display} />
  ) : (
    <span className="wb-formula-failed" data-formula-failed="1"> {t("公式预览失败：")}{latex}
    </span>
  );
}
export function ControlledImage({ fileId, alt, widthMm, onOpenFile }) {
  const { t } = useTranslation("workbench");
  const [source, setSource] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true,
      url;
    const controller = new AbortController();
    setSource(null);
    setFailed(false);
    setLoaded(false);
    if (!/^[0-9a-f-]{36}$/i.test(fileId ?? '')) {
      setFailed(true);
      return () => {};
    }
    workbenchBlob(`/api/workbench/files/${fileId}/content`, {
      signal: controller.signal
    })
      .then((blob) => {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
          throw new Error('Image unavailable');
        if (active) {
          url = URL.createObjectURL(blob);
          setSource(url);
        }
      })
      .catch((error) => {
        if (active && error.name !== 'AbortError') setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);
  if (failed) return <span role="status" data-image-state="failed">{t("图片暂时无法读取：")}{alt}</span>;
  if (!source) return <span role="status" data-image-state="loading">{t("正在读取图片")}</span>;
  const image = <img src={source} alt={alt} data-image-state={loaded ? 'ready' : 'loading'}
    onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
    style={{ width: `${widthMm}mm`, maxWidth: '100%' }} />;
  return onOpenFile ? (
    <button
      type="button"
      className="material-image"
      onClick={() => onOpenFile(fileId)}
      aria-label={t("打开图片：{{alt}}", { alt: alt })}
    >
      {image}
    </button>
  ) : (
    image
  );
}
function Runs({ runs }) {
  useTranslation("workbench");
  return runs.map((run, i) =>
    run.type === 'math' ? <Formula key={i} latex={run.latex} /> : <span key={i}>{run.text}</span>
  );
}
export function Blocks({ blocks, onOpenFile }) {
  const { t } = useTranslation("workbench");
  return blocks.map((block, i) => {
    switch (block.type) {
      case 'paragraph':
        return (
          <p className="wb-paragraph" key={i}>
            <Runs runs={block.runs} />
          </p>
        );
      case 'math':
        return (
          <div className="wb-math-block" key={i}>
            <Formula latex={block.latex} display />
          </div>
        );
      case 'image':
        return (
          <figure key={i}>
            <ControlledImage {...block} onOpenFile={onOpenFile} />
          </figure>
        );
      case 'heading': {
        const Tag = `h${block.level + 1}`;
        return (
          <Tag key={i}>
            <Runs runs={block.runs} />
          </Tag>
        );
      }
      case 'list':
        return (
          <ol className="material-list" key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <span>{item.label}</span>
                <div>
                  <Blocks blocks={item.blocks} onOpenFile={onOpenFile} />
                </div>
              </li>
            ))}
          </ol>
        );
      case 'table':
        return (
          <div className="material-table-scroll" key={i}>
            <table>
              <tbody>
                {block.rows.map((row, j) => (
                  <tr key={j}>
                    {row.map((cell, k) => (
                      <td key={k}>
                        <Blocks blocks={cell.blocks} onOpenFile={onOpenFile} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'teacher-note':
        return (
          <aside className="material-note" key={i}>
            <span>{t("教师注记")}</span>
            <Blocks blocks={block.blocks} onOpenFile={onOpenFile} />
          </aside>
        );
      default:
        return <pre key={i}>{JSON.stringify(block, null, 2)}</pre>;
    }
  });
}
export function DocumentView({ value, document, onOpenFile, className = '' }) {
  const { t } = useTranslation("workbench");
  const source = value ?? document;
  if (!supportedDocument(source))
    return (
      <div className="material-unknown">
        <p className="wb-field-error" data-region="unsupported-version" role="status"> {t("文档版本")} {String(source?.version)} {t("暂不支持，原数据只读保留。")} </p>
        <pre>{JSON.stringify(source, null, 2)}</pre>
      </div>
    );
  return (
    <div className={`wb-document material-document ${className}`}>
      <Blocks blocks={source.blocks} onOpenFile={onOpenFile} />
    </div>
  );
}
