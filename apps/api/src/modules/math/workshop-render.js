import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { renderSource, renderWorkshopFormulaAssets } from './render.js';
import { mathFontStyle } from '@refatos/shared/math/formula';
import { registerAndReadFont } from './font.js';
import { MathSourceError } from '@refatos/shared/math/expression';
import { mathError, workshopContractError } from './contract.js';
import { validateWorkshopReferences, visibleWorkshopFormulas } from '@refatos/shared/math/workshop';
import { savedWorkshopPlaneViewport, captureWorkshopPlaneViewport, fitWorkshopPlaneViewport } from '@refatos/shared/math/workshop-runtime';

export const geogebraDirectory = fileURLToPath(new URL('../../../../web/public/vendor/math/geogebra/', import.meta.url));
const safe = value => JSON.stringify(value).replaceAll('<', '\\u003c');

export async function readSavedWorkshopPlaneViewport(base64) {
  const zip = await JSZip.loadAsync(Buffer.from(base64, 'base64'));
  const xml = await zip.file('geogebra.xml').async('string');
  return savedWorkshopPlaneViewport(new DOMParser().parseFromString(xml, 'application/xml'));
}

// A fresh browser has no account, cookies or external resource access. Only the
// pinned local runtime is served; imported construction JavaScript is disabled.
export async function renderWorkshopGraph(source, options = {}) {
  const width = options.width ?? 1600;
  const height = Math.round(width * 0.625);
  const runtimeDirectory = options.runtimeDirectory ?? geogebraDirectory;
  const view = source.steps.find(step => step.id === source.initialStepId)?.view ?? source.view;
  if (options.background === 'transparent' && view !== 'plane') throw mathError('unsupported-export', '/background', 'opaque-three-dimensional-background');
  let browser;
  let deadline;
  const started = Date.now();
  try {
    const savedPlaneViewport = await readSavedWorkshopPlaneViewport(source.graph.base64);
    await fs.access(path.join(runtimeDirectory, 'loader.js'));
    browser = await chromium.launch({ headless: true, timeout: 10000, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    deadline = setTimeout(() => browser.close().catch(() => {}), Math.max(1, 28000 - (Date.now() - started)));
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}#graph{width:${width}px;height:${height}px}</style><div id="graph"></div><script src="/runtime/loader.js"></script><script>window.graphReady=new Promise((resolve,reject)=>{try{const applet=new GGBApplet({width:${width},height:${height},appName:'classic',ggbBase64:${safe(source.graph.base64)},disableJavaScript:true,useBrowserForJS:false,enableFileFeatures:false,randomize:false,showToolBar:false,showAlgebraInput:false,showMenuBar:false,showLogging:false,appletOnLoad:api=>{window.graphApi=api;api.stopAnimation();api.setErrorDialogsActive(false);resolve(true)}});Promise.resolve(applet.inject('graph')).catch(reject)}catch(error){reject(error)}});</script>`;
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://math-render.invalid') return route.abort();
      if (url.pathname === '/render') return route.fulfill({ body: html, contentType: 'text/html' });
      if (!url.pathname.startsWith('/runtime/')) return route.abort();
      const relative = decodeURIComponent(url.pathname.slice('/runtime/'.length));
      const filename = path.resolve(runtimeDirectory, relative);
      if (!filename.startsWith(`${path.resolve(runtimeDirectory)}${path.sep}`)) return route.abort();
      try {
        const contentType = filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.css') ? 'text/css' : filename.endsWith('.html') ? 'text/html' : undefined;
        await route.fulfill({ body: await fs.readFile(filename), ...(contentType ? { contentType } : {}) });
      } catch { await route.abort(); }
    });
    await page.goto('http://math-render.invalid/render');
    await page.waitForFunction(() => Boolean(window.graphApi), null, { timeout: 20000 });
    await page.evaluate(() => window.graphReady);
    await page.addScriptTag({ content: `window.captureWorkshopPlaneViewport = ${captureWorkshopPlaneViewport}; window.fitWorkshopPlaneViewport = ${fitWorkshopPlaneViewport};` });
    const planeViewport = savedPlaneViewport ?? await page.evaluate(() => window.captureWorkshopPlaneViewport(window.graphApi));
    const objects = await page.evaluate(() => {
      const api = window.graphApi;
      return Array.from(api.getAllObjectNames()).map(name => {
        const xml = new DOMParser().parseFromString(api.getXML(name), 'application/xml');
        const slider = xml.querySelector('slider');
        return { name, type: api.getObjectType(name), numericValue: api.getValue(name), slider: slider ? {
          min: slider.getAttribute('min'), max: slider.getAttribute('max'), step: xml.querySelector('animation')?.getAttribute('step') ?? null,
        } : null };
      });
    });
    try { validateWorkshopReferences(source, objects); }
    catch (error) { throw workshopContractError(error); }
    // Check every step against the restored construction, then leave the saved
    // initial step applied. Each step starts from the same complete GGB bytes.
    const undefinedObjects = await page.evaluate(async source => {
      const api = window.graphApi;
      const reset = () => new Promise(resolve => api.setBase64(source.graph.base64, resolve));
      window.applyWorkshopStep = async step => {
        await reset(); api.stopAnimation();
        if (step) {
          for (const [name, value] of Object.entries(step.values)) api.setValue(name, value);
          for (const name of api.getAllObjectNames()) api.setVisible(name, step.visibleObjects.includes(name));
        }
      };
      for (const step of source.steps) {
        await window.applyWorkshopStep(step);
        const invalid = step.visibleObjects.filter(name => !api.isDefined(name));
        if (invalid.length) return invalid;
      }
      await window.applyWorkshopStep(source.steps.find(step => step.id === source.initialStepId));
      return Array.from(api.getAllObjectNames()).filter(name => api.getVisible(name) && !api.isDefined(name));
    }, source);
    if (undefinedObjects.length) throw new MathSourceError('invalid-geometry', '保存初态或教学步骤包含未定义对象。');
    // The source-built app exposes the classic perspective API. A perspective
    // string is supplied by the shared, verified view implementation below.
    const viewModule = await import('@refatos/shared/math/workshop-runtime');
    const perspective = viewModule.workshopPerspective(view);
    await page.evaluate(perspective => window.graphApi.setPerspective(perspective), perspective);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (view !== 'space') {
      await page.evaluate(saved => window.fitWorkshopPlaneViewport(window.graphApi, saved), planeViewport);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    if (options.format === 'svg') {
      if (view !== 'plane') throw mathError('unsupported-export', '/format', 'three-dimensional-svg');
      const svg = await page.evaluate(() => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SVG export timed out')), 5000);
        window.graphApi.exportSVG(value => { clearTimeout(timer); resolve(value); });
      }));
      if (typeof svg !== 'string' || !/<svg\b/.test(svg)) throw mathError('unsupported-export', '/format', 'vector-export-unavailable');
      const dimensions = svg.match(/<svg\b[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);
      if (!dimensions) throw mathError('unsupported-export', '/format', 'vector-export-unavailable');
      const naturalWidth = Number(dimensions[1]), naturalHeight = Number(dimensions[2]);
      const font = mathFontStyle(await registerAndReadFont());
      const background = options.background === 'white' ? `<rect width="${naturalWidth}" height="${naturalHeight}" fill="white"/>` : '';
      const vector = svg.replace(/<svg\b[^>]*>/, opening => opening.replace(/width="[^"]+"/, `width="${width}"`).replace(/height="[^"]+"/, `height="${Math.round(width * naturalHeight / naturalWidth)}"`).replace(/>$/, ` viewBox="0 0 ${naturalWidth} ${naturalHeight}">${font}${background}`));
      return { bytes: Buffer.from(vector), objects };
    }
    const pngs = await page.evaluate(async ({ background, view }) => {
      const api = window.graphApi;
      const views = view === 'split' ? [1, -1] : [view === 'space' ? -1 : 1];
      const images = [];
      for (const active of views) {
        api.evalCommand(`SetActiveView(${active})`);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        images.push(api.getPNGBase64(1, background !== 'white', 96, false, false));
      }
      return images;
    }, { background: options.background, view });
    const images = await Promise.all(pngs.map(async png => {
      if (typeof png !== 'string' || !png) throw new Error('GGB returned no image');
      const bytes = Buffer.from(png.replace(/^data:image\/png;base64,/, ''), 'base64');
      const metadata = await sharp(bytes, { limitInputPixels: 24000000 }).metadata();
      if (metadata.format !== 'png') throw new Error('GGB returned a non-PNG image');
      return { bytes, ...metadata };
    }));
    let bytes = images[0].bytes;
    if (images.length === 2) {
      const outputWidth = images.reduce((sum, image) => sum + image.width, 0);
      const outputHeight = Math.max(...images.map(image => image.height));
      if (outputWidth * outputHeight > 24000000) throw mathError('unsupported-export', '/width', 'pixel-limit');
      bytes = await sharp({ create: { width: outputWidth, height: outputHeight, channels: 4, background: options.background === 'white' ? '#ffffff' : { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: images[0].bytes, left: 0, top: 0 }, { input: images[1].bytes, left: images[0].width, top: 0 }]).png().toBuffer();
    }
    bytes = await sharp(bytes, { limitInputPixels: 24000000 }).resize({ width }).png().toBuffer();
    return { bytes, objects };
  } catch (error) {
    if (error.problem || error instanceof MathSourceError) throw error;
    throw Object.assign(mathError('render-unavailable', undefined, undefined, 503), { cause: error });
  } finally { clearTimeout(deadline); await browser?.close(); }
}

export async function workshopFormulaAssets(source) {
  return renderWorkshopFormulaAssets(source);
}

export async function renderWorkshop(source, options = {}) {
  const selection = options.selection ?? 'work';
  if (selection === 'formula') {
    const formula = source.formulas.find(item => item.id === options.formulaId);
    if (!formula) throw mathError('unsupported-export', '/formulaId', 'invalid-reference');
    return { bytes: await renderSource({ schemaVersion: 1, kind: 'formula', ...formula }, { format: options.format ?? 'png', width: options.width ?? 1600 }), formulaAssets: [] };
  }
  const formulas = await workshopFormulaAssets(source);
  if (!source.graph) {
    try { validateWorkshopReferences(source, []); }
    catch (error) { throw workshopContractError(error); }
  }
  if (options.format === 'svg' && source.graph && selection === 'work') throw mathError('unsupported-export', '/format', 'workshop-with-graph-svg');
  const graphOptions = { ...options, background: options.background ?? 'white' };
  const graph = source.graph ? await renderWorkshopGraph(source, options.format === 'svg' && selection === 'graph' ? graphOptions : { ...graphOptions, format: 'png' }) : null;
  if (selection === 'graph') {
    if (!graph) throw mathError('unsupported-export', '/selection', 'no-graph');
    return { bytes: graph.bytes, graphBytes: graph.bytes, formulaAssets: formulas };
  }
  const visible = new Set(visibleWorkshopFormulas(source).map(item => item.id));
  const visibleAssets = formulas.filter(item => visible.has(item.id));
  const width = options.width ?? 1600;
  const rows = visibleAssets.map(({ svg }) => {
    const [w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
    return { svg, width: w, height: h };
  });
  const naturalWidth = Math.max(320, ...rows.map(row => row.width), graph ? width : 0);
  const padding = 24;
  let y = padding;
  let content = '';
  for (const row of rows) {
    content += row.svg.replace('<svg ', `<svg x="${padding + (naturalWidth - row.width) / 2}" y="${y}" `);
    y += row.height + 16;
  }
  if (graph) {
    const metadata = await sharp(graph.bytes).metadata();
    const graphHeight = naturalWidth * metadata.height / metadata.width;
    content += `<image x="${padding}" y="${y}" width="${naturalWidth}" height="${graphHeight}" href="data:image/png;base64,${graph.bytes.toString('base64')}"/>`;
    y += graphHeight;
  }
  const naturalHeight = Math.max(48, y + padding);
  const height = Math.max(1, Math.round(width * naturalHeight / (naturalWidth + 2 * padding)));
  if (options.format !== 'svg' && width * height > 24000000) throw mathError('unsupported-export', '/width', 'pixel-limit');
  const background = options.background === 'white' ? `<rect width="100%" height="100%" fill="white"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${naturalWidth + 2 * padding} ${naturalHeight}">${mathFontStyle(await registerAndReadFont())}${background}${content}</svg>`;
  return { bytes: options.format === 'svg' ? Buffer.from(svg) : await raster(svg), graphBytes: graph?.bytes ?? null, formulaAssets: formulas };
}
async function raster(svg) {
  const width = Number(svg.match(/\bwidth="([\d.]+)"/)[1]);
  const height = Number(svg.match(/\bheight="([\d.]+)"/)[1]);
  if (width * height > 24000000) throw mathError('unsupported-export', '/width', 'pixel-limit');
  return sharp(Buffer.from(svg), { limitInputPixels: 24000000 }).png().toBuffer();
}
