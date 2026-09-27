import { Fragment } from "react";
import { DocumentView } from "../workbench/materials/index.js";
import { LessonDocumentEditor } from "./LessonDocumentEditor.jsx";

export function LessonSectionContent({ section, editing = false, label, readOnly, onChange, renderReference }) {
  const boundary = position => {
    const references = section.references.filter(r => (r.afterBlock ?? section.content.blocks.length) === position);
    return references.length ? <div className="wb-references" data-region="section-references">{references.map(renderReference)}</div> : null;
  };
  if (editing && !readOnly) return <LessonDocumentEditor value={section.content} label={label} onChange={onChange} renderBoundary={boundary} />;
  return <>{boundary(0)}{section.content.blocks.map((block, index) => <Fragment key={index}>
    <DocumentView value={{ version: section.content.version, blocks: [block] }} />{boundary(index + 1)}
  </Fragment>)}</>;
}
