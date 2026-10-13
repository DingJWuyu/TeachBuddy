import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createIntegration } from './fixtures/auth-integration/harness.js';
export const C = '/api/modules/classroom';
const contract = JSON.parse(fs.readFileSync(new URL('../src/contracts/classroom.openapi.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
  multipleOfPrecision: 12
});
addFormats(ajv);
ajv.addSchema({
  ...contract,
  $id: 'classroom-contract'
}, 'classroom-contract');
const validators = new Map();
function validateResponse(method, url, status, value) {
  const requestPath = url.split('?')[0];
  const endpoint = Object.keys(contract.paths).find(path => {
    const expression = '^' + path.replace('{id}', '[^/]+') + '$';
    return new RegExp(expression).test(requestPath);
  });
  if (!endpoint) {
    return;
  }
  const response = contract.paths[endpoint][method.toLowerCase()]?.responses[String(status)];
  if (!response) {
    return;
  }
  const media = status < 400 ? 'application/json' : 'application/problem+json';
  let responsePointer = '#/paths/' + endpoint.replaceAll('~', '~0').replaceAll('/', '~1') + '/' + method.toLowerCase() + '/responses/' + status;
  if (response.$ref) {
    responsePointer = response.$ref;
  }
  const schemaPointer = responsePointer + '/content/' + media.replaceAll('/', '~1') + '/schema';
  const key = method + endpoint + status;
  if (!validators.has(key)) {
    validators.set(key, ajv.compile({
      $ref: 'classroom-contract' + schemaPointer
    }));
  }
  const validate = validators.get(key);
  assert.ok(validate(value), JSON.stringify(validate.errors));
}
export async function createClassroomWorld() {
  const world = await createIntegration();
  const originalClose = world.close;
  world.close = async (passed = false) => {
    let closed = false;
    try {
      await originalClose();
      closed = true;
    } finally {
      if (passed && closed) {
        fs.rmSync(world.directory, {
          recursive: true,
          force: true
        });
      } else {
        console.error('Classroom failure evidence retained at ' + world.directory);
      }
    }
  };
  return world;
}
export async function teacher(world, email = 'classroom-a@example.test') {
  const client = world.client();
  await client.request('POST', '/api/auth/session', {
    body: {
      action: 'bootstrap'
    }
  });
  const sent = await client.request('POST', '/api/auth/registration-codes', {
    body: {
      email
    }
  });
  const pending = await client.request('POST', '/api/auth/register', {
    body: {
      email,
      nickname: '班级教师',
      password: 'password-classroom',
      termsAccepted: true,
      rememberMe: true,
      challengeId: sent.json.challengeId,
      verificationCode: world.mailer.lastCode('registration', email)
    }
  });
  assert.equal(pending.status, 201, pending.text);
  assert.equal((await client.request('POST', '/api/auth/session', {
    body: {
      action: 'activate',
      sessionId: pending.json.id,
      rememberMe: true
    }
  })).status, 200);
  return {
    client,
    session: pending.json,
    call: call(client)
  };
}
export function call(client) {
  return async (method, path, body, status = 200, key = randomUUID(), options = {}) => {
    const result = await client.request(method, path, {
      ...options,
      body,
      headers: {
        'Idempotency-Key': key,
        ...options.headers
      }
    });
    assert.equal(result.status, status, method + ' ' + path + ': ' + result.text);
    assert.equal(result.headers['cache-control'], 'no-store');
    validateResponse(method, path, status, result.json);
    return result.json;
  };
}
export const studentBody = (classId, name = '小明', studentNumber = null) => ({
  classId,
  name,
  studentNumber,
  birthday: null,
  interests: '',
  description: ''
});
export async function upload(client, name, bytes, type = 'application/octet-stream') {
  const boundary = 'classroom-' + randomUUID();
  const response = await client.request('POST', '/api/workbench/files', {
    headers: {
      'Idempotency-Key': randomUUID()
    },
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)])
  });
  assert.equal(response.status, 201, response.text);
  return response.json;
}
