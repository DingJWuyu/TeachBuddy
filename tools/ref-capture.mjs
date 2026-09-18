// Minimal CDP client for a Chrome 152 remote-debugging endpoint.
//
// Two Chrome 152 behaviours force a hand-rolled client here:
//   1. /json/version and /json/list return 404, so the HTTP discovery API is unusable.
//   2. The WebSocket handshake is rejected with 403 when it carries an Origin header,
//      which rules out Playwright's connectOverCDP.
// A raw ws:// handshake with no Origin header receives 101.
//
// Temporary tooling for Issue #16 visual reference capture.

import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class RawWebSocket {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.onmessage = null;
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
  }

  static connect(url) {
    const u = new URL(url);
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const socket = net.connect(Number(u.port), u.hostname, () => {
        // No Origin header: Chrome 152 answers 403 if one is present.
        socket.write(
          `GET ${u.pathname} HTTP/1.1\r\n` +
          `Host: ${u.host}\r\n` +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${key}\r\n` +
          'Sec-WebSocket-Version: 13\r\n\r\n',
        );
      });
      socket.once('error', reject);
      let handshake = Buffer.alloc(0);
      const onData = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const end = handshake.indexOf('\r\n\r\n');
        if (end === -1) return;
        socket.removeListener('data', onData);
        const head = handshake.subarray(0, end).toString();
        if (!head.startsWith('HTTP/1.1 101')) {
          reject(new Error(`handshake failed: ${head.split('\r\n')[0]}`));
          return;
        }
        const expected = crypto
          .createHash('sha1')
          .update(key + GUID)
          .digest('base64');
        if (!head.includes(expected)) {
          reject(new Error('handshake failed: bad Sec-WebSocket-Accept'));
          return;
        }
        const ws = new RawWebSocket(socket);
        ws.buffer = handshake.subarray(end + 4);
        resolve(ws);
        ws.drain();
      };
      socket.on('data', onData);
    });
  }

  drain() {
    for (;;) {
      const frame = this.readFrame();
      if (!frame) return;
      if (frame.opcode === 0x8) {
        this.socket.end();
        return;
      }
      if (frame.opcode === 0x9) {
        this.writeFrame(0xa, frame.payload);
        continue;
      }
      if (frame.opcode === 0x0) {
        this.fragments.push(frame.payload);
        if (frame.fin) {
          const full = Buffer.concat(this.fragments);
          this.fragments = [];
          this.emit(full);
        }
        continue;
      }
      if (frame.opcode === 0x1) {
        if (frame.fin) this.emit(frame.payload);
        else this.fragments.push(frame.payload);
      }
    }
  }

  emit(payload) {
    if (!this.onmessage) return;
    try {
      this.onmessage(JSON.parse(payload.toString('utf8')));
    } catch {
      // Ignore frames that are not JSON.
    }
  }

  readFrame() {
    const b = this.buffer;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let length = b[1] & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (b.length < 4) return null;
      length = b.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (b.length < 10) return null;
      length = Number(b.readBigUInt64BE(2));
      offset = 10;
    }
    let mask;
    if (masked) {
      if (b.length < offset + 4) return null;
      mask = b.subarray(offset, offset + 4);
      offset += 4;
    }
    if (b.length < offset + length) return null;
    const payload = Buffer.from(b.subarray(offset, offset + length));
    if (masked) {
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
    }
    this.buffer = b.subarray(offset + length);
    return { fin, opcode, payload };
  }

  writeFrame(opcode, payload) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const mask = crypto.randomBytes(4);
    const len = data.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(6);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | len;
      mask.copy(header, 2);
    } else if (len < 65536) {
      header = Buffer.alloc(8);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
      mask.copy(header, 4);
    } else {
      header = Buffer.alloc(14);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
      mask.copy(header, 10);
    }
    const masked = Buffer.from(data);
    for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i % 4];
    this.socket.write(Buffer.concat([header, masked]));
  }

  send(text) {
    this.writeFrame(0x1, Buffer.from(text, 'utf8'));
  }

  close() {
    try {
      this.writeFrame(0x8, Buffer.alloc(0));
    } catch {
      // Socket already gone.
    }
    this.socket.end();
  }
}

export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.sessions = new Set();
    ws.onmessage = (msg) => {
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
      }
    };
  }

  static async attach(host = '127.0.0.1:9222', path) {
    const wsPath = path
      || fs.readFileSync(`${os.homedir()}/.config/google-chrome/DevToolsActivePort`, 'utf8').split('\n')[1];
    const ws = await RawWebSocket.connect(`ws://${host}${wsPath}`);
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }

  async attachTo(targetId) {
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    this.sessions.add(sessionId);
    return sessionId;
  }

  async createPage(url) {
    const { targetId } = await this.send('Target.createTarget', { url, background: true });
    const sessionId = await this.attachTo(targetId);
    return { targetId, sessionId };
  }

  async closeTarget(targetId) {
    await this.send('Target.closeTarget', { targetId });
  }

  async evaluate(sessionId, expression) {
    const res = await this.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'evaluation failed');
    }
    return res.result.value;
  }

  async screenshot(sessionId, file) {
    const { data } = await this.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false },
      sessionId,
    );
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return file;
  }

  close() {
    this.ws.close();
  }
}

// Device metrics override so a capture matches an exact CSS viewport.
export async function setViewport(cdp, sessionId, width, height, dpr = 1) {
  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: dpr, mobile: false },
    sessionId,
  );
}

export async function goto(cdp, sessionId, url, settleMs = 2500) {
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  await new Promise((r) => setTimeout(r, settleMs));
}
