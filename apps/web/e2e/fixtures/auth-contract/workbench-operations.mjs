/*
 * The fifteen protected workbench operations declared by
 * docs/contracts/workbench/first-flow.openapi.yaml. The harness drives them
 * through useAuth.request; the transport spec checks the page header, the
 * protection header, bodies and keys on every one.
 */
export const WORKBENCH_OPERATIONS = [
  {
    id: 'getWorkbenchContext',
    status: 200,
    method: 'GET',
    path: '/api/workbench/context',
  },
  {
    id: 'listQuestions',
    status: 200,
    method: 'GET',
    path: '/api/modules/questions/items?state=active',
  },
  {
    id: 'createQuestion',
    status: 201,
    method: 'POST',
    path: '/api/modules/questions/items',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    body: { title: '契约替身题目', prompt: '题面', answer: '答案' },
  },
  {
    id: 'getQuestion',
    status: 200,
    method: 'GET',
    path: '/api/modules/questions/items/q-1',
  },
  {
    id: 'updateQuestion',
    status: 200,
    method: 'PUT',
    path: '/api/modules/questions/items/q-1',
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    body: { title: '更新题目', version: 1 },
  },
  {
    id: 'listDerivatives',
    status: 200,
    method: 'GET',
    path: '/api/modules/questions/items/q-1/copies',
  },
  {
    id: 'copyQuestion',
    status: 201,
    method: 'POST',
    path: '/api/modules/questions/items/q-1/copies',
    idempotencyKey: '33333333-3333-4333-8333-333333333333',
    body: { title: '副本' },
  },
  {
    id: 'setQuestionDeletion',
    status: 200,
    method: 'POST',
    path: '/api/modules/questions/items/q-1/deletion',
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
    body: { deleted: true },
  },
  {
    id: 'listLessons',
    status: 200,
    method: 'GET',
    path: '/api/modules/lessons/items?state=active',
  },
  {
    id: 'createLesson',
    status: 201,
    method: 'POST',
    path: '/api/modules/lessons/items',
    idempotencyKey: '55555555-5555-4555-8555-555555555555',
    body: { title: '契约替身备课' },
  },
  {
    id: 'getLesson',
    status: 200,
    method: 'GET',
    path: '/api/modules/lessons/items/l-1',
  },
  {
    id: 'updateLesson',
    status: 200,
    method: 'PUT',
    path: '/api/modules/lessons/items/l-1',
    idempotencyKey: '66666666-6666-4666-8666-666666666666',
    body: { title: '更新备课', version: 1 },
  },
  {
    id: 'setLessonDeletion',
    status: 200,
    method: 'POST',
    path: '/api/modules/lessons/items/l-1/deletion',
    idempotencyKey: '77777777-7777-4777-8777-777777777777',
    body: { deleted: true },
  },
  {
    id: 'listQuestionUsages',
    status: 200,
    method: 'GET',
    path: '/api/modules/lessons/question-usages/q-1',
  },
  {
    id: 'getModuleCatalog',
    status: 200,
    method: 'GET',
    path: '/api/modules',
  },
];

export function buildInit(operation) {
  const init = { method: operation.method };
  if (operation.body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(operation.body);
  }
  if (operation.idempotencyKey) {
    init.headers = { ...(init.headers || {}), 'Idempotency-Key': operation.idempotencyKey };
  }
  return init;
}

/* Shaped key -> success status, shared with the substitute so tests can assert
 * the exact contract result of every protected operation. */
export function workbenchKey(method, pathname) {
  const segments = String(pathname).split('?')[0].split('/').filter(Boolean);
  const shaped = segments.map((segment) => (/^(q-|l-)[\w-]+$/.test(segment) ? ':id' : segment));
  return `${method} /${shaped.join('/')}`;
}

export const WORKBENCH_STATUS = new Map(
  WORKBENCH_OPERATIONS.map((operation) => [workbenchKey(operation.method, operation.path), operation.status]),
);
