import fs from 'node:fs';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { contractError, problems } from '../workbench/problems.js';
const agent = JSON.parse(fs.readFileSync(new URL('../contracts/agent.openapi.json', import.meta.url)));
// Contracts declare accepted representations. Reference handling is independent
// of business names and shares definitions instead of expanding repeated unions.
const contractRoot = new URL('../contracts/', import.meta.url);
const documents = new Map([['agent.openapi.json', agent]]);
const definitions = new Map();
function resolve(value, file = 'agent.openapi.json') {
  if (Array.isArray(value)) return value.map(v => resolve(v, file));
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) {
    const [relative, pointer] = value.$ref.split('#');
    const url = new URL(relative || file, contractRoot);
    const target = url.href.slice(contractRoot.href.length);
    const id = `urn:teachbuddy:schema:${encodeURIComponent(target + '#' + pointer)}`;
    if (!definitions.has(id)) {
      if (!documents.has(target)) documents.set(target, YAML.parse(fs.readFileSync(url, 'utf8')));
      const child = pointer.slice(1).split('/').reduce((v, key) => v[key], documents.get(target));
      definitions.set(id, null);
      definitions.set(id, resolve(child, target));
    }
    return { $ref: id };
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolve(child, file)]));
}
function providerSchema(value) {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (!value || typeof value !== 'object') return value;
  if (definitions.has(value.$ref)) return providerSchema(definitions.get(value.$ref));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, providerSchema(child)]));
}
const ajv = new Ajv({ strict: false, allErrors: false, inlineRefs: false });
addFormats(ajv);
const schemas = Object.fromEntries(Object.entries(agent.components.schemas).map(([name, value]) => [name, resolve(value)]));
const tools = agent['x-agent-tools'].map(tool => ({ ...tool, parameters: resolve(tool.parameters), response: resolve(tool.response) }));
for (const [id, definition] of definitions) ajv.addSchema(definition, id);
const validators = new Map();
export function valid(name, value) {
  if (!validators.has(name)) validators.set(name, ajv.compile(schemas[name]));
  return validators.get(name)(value);
}
export function validate(name, value) {
  if (!valid(name, value)) throw contractError(problems.invalidInput('/body', 'invalid-type'));
  return value;
}
export const toolDefinitions = tools.map(tool => ({ ...tool,
  parameters: providerSchema(tool.parameters), response: ajv.compile(tool.response) }));
export function agentProblem(code, extra = {}) {
  const status = ['draft-conflict', 'reference-conflict', 'turn-active', 'pending-operation', 'cursor-ahead'].includes(code) ? 409
    : code === 'model-not-allowed' ? 422 : code === 'tool-failed' ? 500 : 503;
  return { type: `/problems/agent/${code}`, status, title: ({ 'tool-failed': '读取未能完成', 'operation-unconfirmed': '写入结果待确认', 'draft-conflict': '草稿已在其他设备修改', 'reference-conflict': '引用内容已变更', 'model-unavailable': 'AI 暂不可用', 'turn-active': '对话正在生成，请等待完成或先停止', 'pending-operation': '请先确认待核实的写入结果' })[code] ?? '暂时无法完成操作', ...extra };
}
export function agentError(code, extra) { const problem = agentProblem(code, extra); return Object.assign(new Error(problem.title), { status: problem.status, problem }); }
