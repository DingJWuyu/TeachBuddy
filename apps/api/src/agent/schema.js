import fs from 'node:fs';
import YAML from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { contractError, problems } from '../workbench/problems.js';
const agent = JSON.parse(fs.readFileSync(new URL('../contracts/agent.openapi.json', import.meta.url)));
const business = YAML.parse(fs.readFileSync(new URL('../contracts/workbench.openapi.yaml', import.meta.url), 'utf8'));
// Keep the C26 tool names and legacy bodies; consume current business schemas
// for the same operations without projecting away material or math content.
const contractRoot = new URL('../contracts/', import.meta.url);
const documents = new Map([['agent.openapi.json', agent], ['workbench.openapi.yaml', business]]);
const currentSchemas = Object.fromEntries([
  ...['Question', 'QuestionList', 'CreateQuestion', 'UpdateQuestion', 'CopyQuestion'].map(name => [name, ['materials.openapi.yaml', name]]),
]);
function resolve(value, file = 'agent.openapi.json', adapt = true) {
  if (Array.isArray(value)) return value.map(v => resolve(v, file, adapt));
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) {
    const [relative, pointer] = value.$ref.split('#');
    const url = relative ? new URL(relative, new URL(file, contractRoot)) : new URL(file, contractRoot);
    const target = url.href.slice(contractRoot.href.length);
    if (!documents.has(target)) documents.set(target, YAML.parse(fs.readFileSync(url, 'utf8')));
    const child = pointer.slice(1).split('/').reduce((v, key) => v[key], documents.get(target));
    const legacy = resolve(child, target, adapt);
    const mapped = file === 'agent.openapi.json' && relative && currentSchemas[pointer.split('/').at(-1)];
    if (adapt && mapped) {
      const [, name] = mapped;
      return { anyOf: [legacy, { $ref: `urn:teachbuddy:current:${name}` }] };
    }
    return legacy;
  }
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, resolve(v, file, adapt)]));
}
const ajv = new Ajv({ strict: false, allErrors: false, inlineRefs: false });
addFormats(ajv);
const currentDefinitions = new Map();
for (const [file, name] of Object.values(currentSchemas)) {
  const definition = resolve({ $ref: `${file}#/components/schemas/${name}` }, 'agent.openapi.json', false);
  const id = `urn:teachbuddy:current:${name}`;
  currentDefinitions.set(id, definition);
  ajv.addSchema(definition, id);
}
function providerSchema(value) {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (!value || typeof value !== 'object') return value;
  if (currentDefinitions.has(value.$ref)) return currentDefinitions.get(value.$ref);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, providerSchema(child)]));
}
export const schemas = Object.fromEntries(Object.entries(agent.components.schemas).map(([name, value]) => [name, resolve(value)]));
const validators = new Map();
const legacyValidators = new Map();
export function legacyArguments(operationId, args) {
  if (!legacyValidators.has(operationId)) legacyValidators.set(operationId, ajv.compile(resolve(agent.components.schemas[`Tool_${operationId}`], 'agent.openapi.json', false)));
  return legacyValidators.get(operationId)(args);
}
export function valid(name, value) {
  if (!validators.has(name)) validators.set(name, ajv.compile(schemas[name]));
  return validators.get(name)(value);
}
export function validate(name, value) {
  if (!valid(name, value)) throw contractError(problems.invalidInput('/body', 'invalid-type'));
  return value;
}
export const toolDefinitions = agent['x-agent-tools'].map(tool => ({ ...tool,
  parameters: providerSchema(resolve(tool.parameters)), response: ajv.compile(resolve(tool.response)) }));
export function agentProblem(code, extra = {}) {
  const status = ['draft-conflict', 'reference-conflict', 'turn-active', 'pending-operation', 'cursor-ahead'].includes(code) ? 409
    : code === 'model-not-allowed' ? 422 : code === 'tool-failed' ? 500 : 503;
  return { type: `/problems/agent/${code}`, status, title: ({ 'tool-failed': '读取未能完成', 'operation-unconfirmed': '写入结果待确认', 'draft-conflict': '草稿已在其他设备修改', 'reference-conflict': '引用内容已变更', 'model-unavailable': 'AI 暂不可用', 'turn-active': '对话正在生成，请等待完成或先停止', 'pending-operation': '请先确认待核实的写入结果' })[code] ?? '暂时无法完成操作', ...extra };
}
export function agentError(code, extra) { const problem = agentProblem(code, extra); return Object.assign(new Error(problem.title), { status: problem.status, problem }); }
