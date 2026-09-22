import fs from 'node:fs';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { contractError, problems } from '../workbench/problems.js';
const agent = JSON.parse(fs.readFileSync(new URL('../../../../docs/contracts/agent.openapi.json', import.meta.url)));
const business = YAML.parse(fs.readFileSync(new URL('../../../../docs/contracts/workbench/first-flow.openapi.yaml', import.meta.url), 'utf8'));
function resolve(value, source = agent) {
  if (Array.isArray(value)) return value.map(v => resolve(v, source));
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) {
    const [file, pointer] = value.$ref.split('#');
    const target = file ? business : source;
    return resolve(pointer.slice(1).split('/').reduce((v, key) => v[key], target), target);
  }
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, resolve(v, source)]));
}
const ajv = new Ajv({ strict: false, allErrors: false });
addFormats(ajv);
export const schemas = Object.fromEntries(Object.entries(agent.components.schemas).map(([name, value]) => [name, resolve(value)]));
const validators = new Map();
export function valid(name, value) {
  if (!validators.has(name)) validators.set(name, ajv.compile(schemas[name]));
  return validators.get(name)(value);
}
export function validate(name, value) {
  if (!valid(name, value)) throw contractError(problems.invalidInput('/body', 'invalid-type'));
  return value;
}
export const toolDefinitions = agent['x-agent-tools'].map(tool => ({ ...tool,
  parameters: resolve(tool.parameters), response: ajv.compile(resolve(tool.response)) }));
export function agentProblem(code, extra = {}) {
  const status = ['draft-conflict', 'reference-conflict', 'turn-active', 'pending-operation', 'cursor-ahead'].includes(code) ? 409
    : code === 'model-not-allowed' ? 422 : code === 'tool-failed' ? 500 : 503;
  return { type: `/problems/agent/${code}`, status, title: ({ 'tool-failed': '读取未能完成', 'operation-unconfirmed': '写入结果待确认', 'draft-conflict': '草稿已在其他设备修改', 'reference-conflict': '引用内容已变更', 'model-unavailable': 'AI 暂不可用' })[code] ?? '暂时无法完成操作', ...extra };
}
export function agentError(code, extra) { const problem = agentProblem(code, extra); return Object.assign(new Error(problem.title), { status: problem.status, problem }); }
