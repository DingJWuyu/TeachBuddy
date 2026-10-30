import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import JSZip from 'jszip';
import { geogebraDirectory, readSavedWorkshopPlaneViewport } from './workshop-render.js';
import { workshopPresentationCss } from '@teachbuddy/shared/math/workshop-presentation';
import { mathFontStyle } from '@teachbuddy/shared/math/formula';
import { registerAndReadFont } from './font.js';
import { mathDependencyLicenses } from './licenses.js';
import { mathError } from './contract.js';

const safe = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const runtimes = new Map();
async function presentationRuntime(hasGraph) {
  if (!runtimes.has(hasGraph)) runtimes.set(hasGraph, build({ stdin: { contents: `export {mountWorkshopPresentation} from '@teachbuddy/shared/math/workshop-presentation'; ${hasGraph ? "export {applyWorkshopView} from '@teachbuddy/shared/math/workshop-runtime';" : 'export const applyWorkshopView = () => {};'} `, resolveDir: fileURLToPath(new URL('.', import.meta.url)) },
    bundle: true, write: false, format: 'iife', globalName: 'WorkshopClassroom', platform: 'browser', target: 'es2022', minify: true, legalComments: 'inline' })
    .then(result => result.outputFiles[0].text).catch(error => { runtimes.delete(hasGraph); throw error; }));
  return runtimes.get(hasGraph);
}
export async function workshopPresentation(source, { title, formulaAssets, runtimeDirectory = geogebraDirectory }) {
  try {
    const zip = new JSZip();
    const planeViewport = source.graph ? await readSavedWorkshopPlaneViewport(source.graph.base64) : null;
    const css = `${workshopPresentationCss}${mathFontStyle(await registerAndReadFont()).replace(/^<style>|<\/style>$/g, '')}`;
    // The GGB runtime needs 'unsafe-eval'; construction-file scripts stay disabled and this wrapper never carries external HTML.
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"><title>${String(title).replace(/[<>&"]/g, '')}</title><style>${css}</style><main id="classroom"></main>${source.graph ? '<script src="runtime/loader.js"></script>' : ''}<script>${await presentationRuntime(Boolean(source.graph))}\nWorkshopClassroom.mountWorkshopPresentation(document.getElementById('classroom'),${safe(source)},{title:${safe(title)},formulas:${safe(formulaAssets)},planeViewport:${safe(planeViewport)},applyView:WorkshopClassroom.applyWorkshopView});</script></html>`;
    zip.file('index.html', html);
    zip.file('workshop.json', JSON.stringify(source, null, 2));
    zip.file('打开说明.txt', '解压整个 ZIP 文件，保留文件夹内全部文件，再打开 index.html。课堂修改仅影响当前展示，重新打开回到保存初态。\n');
    zip.file('LICENSES/math-dependencies.json', JSON.stringify(await mathDependencyLicenses(), null, 2));
    if (source.graph) {
      const copy = async (directory, prefix) => {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          if (entry.isSymbolicLink()) throw new Error('Runtime must not contain symbolic links');
          const filename = path.join(directory, entry.name); const name = `${prefix}/${entry.name}`;
          if (entry.isDirectory()) await copy(filename, name);
          else if (entry.isFile()) zip.file(name, await fs.readFile(filename));
        }
      };
      await copy(runtimeDirectory, 'runtime');
    }
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    if (bytes.length > 100 * 1024 * 1024) throw mathError('unsupported-export', '/format', 'byte-limit');
    return bytes;
  } catch (error) {
    if (error.problem) throw error;
    throw mathError('render-unavailable', undefined, undefined, 503);
  }
}
