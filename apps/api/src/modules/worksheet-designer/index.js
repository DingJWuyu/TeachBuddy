import express from 'express';
import { buildManifest } from '@refatos/shared';
import { Packer, Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableCell, TableRow, WidthType } from 'docx';
import PDFDocument from 'pdfkit';
import { ensureEnum, ensureObject, ensurePositiveInteger, ensureStringArray, ensureTrimmedString, optionalTrimmedString } from '../../core/validation.js';

const manifest = buildManifest({
  id: 'worksheet-designer'
});

function buildQuestions(item) {
  if (Array.isArray(item.questionItems) && item.questionItems.length) return item.questionItems;
  return Array.from({ length: Number(item.questionCount || 0) }, (_, index) => ({
    number: index + 1,
    type: index % 3 === 2 ? 'diagram-structured' : 'structured',
    prompt: `Question ${index + 1} on ${item.topic}`,
    marks: Math.max(1, Math.round(Number(item.marks || 0) / Math.max(1, Number(item.questionCount || 1)))),
    lines: index % 3 === 2 ? 3 : 5,
    diagramSpace: index % 3 === 2
  }));
}

function buildExportSpec(item) {
  const questions = buildQuestions(item);
  return {
    worksheetId: item.id,
    exportVersion: '0.3.0',
    supportedTargets: ['docx', 'pdf', 'print-html'],
    school: 'ST. MARY’S INTERNATIONAL SCHOOL',
    document: {
      title: item.title,
      className: item.className,
      topic: item.topic,
      format: item.format,
      marks: item.marks,
      duration: item.duration,
      instructions: item.instructions,
      questionCount: questions.length
    },
    layout: {
      answerStyle: 'O-Level dotted lines',
      diagramSpace: true,
      pageHeader: true,
      margins: 'normal'
    },
    placeholders: questions.map((question) => ({
      key: `Q${question.number}`,
      type: question.type,
      marks: question.marks,
      prompt: question.prompt,
      diagramSpace: Boolean(question.diagramSpace),
      lines: Number(question.lines || 0)
    }))
  };
}

function repeatLines(lines = 4) {
  return Array.from({ length: Number(lines) }, () => '<div class="answer-line"></div>').join('');
}

function buildPrintableHtml(item) {
  const questions = buildQuestions(item).map((question) => `
    <section class="question-block">
      <div class="question-head">
        <strong>Question ${question.number}</strong>
        <span>${question.marks} marks</span>
      </div>
      <p class="prompt-line">${question.prompt}</p>
      <div class="answer-lines">${repeatLines(question.lines || 4)}</div>
      ${question.diagramSpace ? '<div class="diagram-box">Diagram / graph space</div>' : ''}
    </section>
  `).join('');

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${item.title}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
        .header { text-align: center; margin-bottom: 24px; }
        .meta { display: flex; justify-content: space-between; gap: 12px; margin: 18px 0; }
        .meta-box { border: 1px solid #777; padding: 8px 12px; flex: 1; }
        .question-block { border: 1px solid #bbb; padding: 14px; margin-bottom: 18px; page-break-inside: avoid; }
        .question-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .answer-line { border-bottom: 1px dotted #777; height: 24px; }
        .diagram-box { margin-top: 14px; height: 110px; border: 1px dashed #999; display: flex; align-items: center; justify-content: center; color: #666; }
        .instructions { margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ST. MARY’S INTERNATIONAL SCHOOL</h1>
        <h2>${item.title}</h2>
        <p>${item.className} • ${item.topic} • ${item.format}</p>
      </div>
      <div class="meta">
        <div class="meta-box"><strong>Total Marks:</strong> ${item.marks}</div>
        <div class="meta-box"><strong>Duration:</strong> ${item.duration}</div>
        <div class="meta-box"><strong>Questions:</strong> ${buildQuestions(item).length}</div>
      </div>
      <p class="instructions"><strong>Instructions:</strong> ${item.instructions}</p>
      ${questions}
    </body>
  </html>`;
}

function dottedLineParagraph() {
  return new Paragraph({ text: '............................................................................................................................' });
}

function sanitizeQuestionItems(value, fallbackQuestionCount, fallbackMarks) {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  return value.map((question, index) => {
    const body = ensureObject(question, `Question ${index + 1} must be an object.`);
    return {
      number: ensurePositiveInteger(body.number ?? index + 1, `Question ${index + 1} number`, { min: 1, max: 99 }),
      type: ensureTrimmedString(body.type ?? 'structured', `Question ${index + 1} type`, { maxLength: 60 }),
      prompt: ensureTrimmedString(body.prompt, `Question ${index + 1} prompt`, { maxLength: 1000 }),
      marks: ensurePositiveInteger(body.marks ?? Math.max(1, Math.round(fallbackMarks / fallbackQuestionCount)), `Question ${index + 1} marks`, { min: 1, max: 100 }),
      lines: ensurePositiveInteger(body.lines ?? 4, `Question ${index + 1} lines`, { min: 0, max: 20 }),
      diagramSpace: Boolean(body.diagramSpace)
    };
  });
}

function sanitizeWorksheetPayload(payload) {
  const body = ensureObject(payload);
  const questionCount = ensurePositiveInteger(body.questionCount ?? 5, 'Question count', { min: 1, max: 20 });
  const marks = ensurePositiveInteger(body.marks ?? 15, 'Total marks', { min: 1, max: 200 });

  return {
    title: ensureTrimmedString(body.title, 'Title', { maxLength: 160 }),
    className: ensureTrimmedString(body.className, 'Class', { maxLength: 80 }),
    format: ensureEnum(body.format ?? 'O-Level structured', ['O-Level structured', 'Mixed worksheet', 'MCQ + structured', 'Practical investigation'], 'Format'),
    topic: ensureTrimmedString(body.topic, 'Topic', { maxLength: 160 }),
    marks,
    duration: ensureTrimmedString(body.duration, 'Duration', { maxLength: 40 }),
    instructions: optionalTrimmedString(body.instructions, { label: 'Instructions', maxLength: 1200 }),
    questionCount,
    questionItems: sanitizeQuestionItems(body.questionItems, questionCount, marks),
    generatedFromLessonId: optionalTrimmedString(body.generatedFromLessonId, { label: 'Generated from lesson ID', maxLength: 120 }) || null,
    resourceIds: ensureStringArray(body.resourceIds, 'Resource IDs')
  };
}

async function createDocxBuffer(item) {
  const questions = buildQuestions(item);
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'ST. MARY’S INTERNATIONAL SCHOOL', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: item.title, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `${item.className} | ${item.topic} | ${item.format}`, alignment: AlignmentType.CENTER }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph(`Total Marks: ${item.marks}`)] }),
              new TableCell({ children: [new Paragraph(`Duration: ${item.duration}`)] }),
              new TableCell({ children: [new Paragraph(`Questions: ${questions.length}`)] })
            ]})
          ]
        }),
        new Paragraph({ children: [new TextRun({ text: `Instructions: ${item.instructions}`, bold: true })] }),
        ...questions.flatMap((question) => {
          const children = [
            new Paragraph({ children: [new TextRun({ text: `Question ${question.number}`, bold: true }), new TextRun({ text: ` (${question.marks} marks)` })] }),
            new Paragraph(question.prompt)
          ];
          for (let i = 0; i < Number(question.lines || 4); i += 1) children.push(dottedLineParagraph());
          if (question.diagramSpace) {
            children.push(new Paragraph('Diagram / graph space:'));
            children.push(new Paragraph(''));
            children.push(new Paragraph('______________________________________________'));
            children.push(new Paragraph('______________________________________________'));
          }
          return children;
        })
      ]
    }]
  });
  return Packer.toBuffer(doc);
}

function writePdf(res, item) {
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${item.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'worksheet'}.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).text('ST. MARY’S INTERNATIONAL SCHOOL', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(15).text(item.title, { align: 'center' });
  doc.fontSize(11).text(`${item.className} | ${item.topic} | ${item.format}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).text(`Total Marks: ${item.marks}     Duration: ${item.duration}     Questions: ${buildQuestions(item).length}`);
  doc.moveDown(0.5);
  doc.text(`Instructions: ${item.instructions}`);
  doc.moveDown();
  for (const question of buildQuestions(item)) {
    doc.fontSize(12).text(`Question ${question.number} (${question.marks} marks)`, { underline: false });
    doc.fontSize(11).text(question.prompt);
    for (let i = 0; i < Number(question.lines || 4); i += 1) {
      doc.moveDown(0.8);
      const y = doc.y;
      doc.moveTo(40, y).lineTo(550, y).dash(1, { space: 2 }).stroke();
      doc.undash();
    }
    if (question.diagramSpace) {
      doc.moveDown(0.6);
      const startY = doc.y;
      doc.rect(40, startY, 510, 90).dash(3, { space: 3 }).stroke();
      doc.undash();
      doc.text('Diagram / graph space', 220, startY + 35);
      doc.y = startY + 100;
    }
    doc.moveDown();
  }
  doc.end();
}

export const moduleDefinition = {
  manifest,
  register({ app, eventBus, dataStore }) {
    const router = express.Router();

    router.get('/', (req, res) => {
      res.json({ items: dataStore.list('worksheetDrafts') });
    });

    router.post('/', express.json(), (req, res) => {
      const item = dataStore.create('worksheetDrafts', sanitizeWorksheetPayload(req.body));
      eventBus.emitEvent('worksheet.draft.created', { moduleId: manifest.id, item });
      res.status(201).json(item);
    });

    router.put('/:id', express.json(), (req, res) => {
      const item = dataStore.update('worksheetDrafts', req.params.id, sanitizeWorksheetPayload(req.body));
      if (!item) return res.status(404).json({ message: 'Worksheet draft not found.' });
      eventBus.emitEvent('worksheet.draft.updated', { moduleId: manifest.id, item });
      return res.json(item);
    });

    router.get('/:id/export/spec', (req, res) => {
      const item = dataStore.get('worksheetDrafts', req.params.id);
      if (!item) return res.status(404).json({ message: 'Worksheet draft not found.' });
      return res.json(buildExportSpec(item));
    });

    router.get('/:id/export/preview', (req, res) => {
      const item = dataStore.get('worksheetDrafts', req.params.id);
      if (!item) return res.status(404).send('Worksheet draft not found.');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(buildPrintableHtml(item));
    });

    router.get('/:id/export/docx', async (req, res, next) => {
      try {
        const item = dataStore.get('worksheetDrafts', req.params.id);
        if (!item) return res.status(404).json({ message: 'Worksheet draft not found.' });
        const buffer = await createDocxBuffer(item);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${item.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'worksheet'}.docx"`);
        return res.send(buffer);
      } catch (error) {
        return next(error);
      }
    });

    router.get('/:id/export/pdf', (req, res, next) => {
      try {
        const item = dataStore.get('worksheetDrafts', req.params.id);
        if (!item) return res.status(404).json({ message: 'Worksheet draft not found.' });
        return writePdf(res, item);
      } catch (error) {
        return next(error);
      }
    });

    router.delete('/:id', (req, res) => {
      const item = dataStore.remove('worksheetDrafts', req.params.id);
      if (!item) return res.status(404).json({ message: 'Worksheet draft not found.' });
      eventBus.emitEvent('worksheet.draft.deleted', { moduleId: manifest.id, item });
      return res.json({ success: true, item });
    });

    app.use(manifest.routesBasePath, router);
  }
};
