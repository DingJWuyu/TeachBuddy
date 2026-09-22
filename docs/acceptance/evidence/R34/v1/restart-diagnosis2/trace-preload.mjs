// Scoped diagnostic preload. Records transport metadata only, never headers/bodies.
import fs from 'node:fs';
import http from 'node:http';
import dc from 'node:diagnostics_channel';
const events = [];
const ids = new WeakMap();
let sequence = 0;
const id = (object) => {
  if (!ids.has(object)) ids.set(object, ++sequence);
  return ids.get(object);
};
const record = (event, detail = {}) => events.push({ ms: performance.now(), event, ...detail });
const errorDetail = (error) => error && ({ name: error.name, message: error.message,
  code: error.code, syscall: error.syscall, address: error.address, port: error.port,
  socket: error.socket, cause: errorDetail(error.cause), errors: error.errors?.map(errorDetail) });
const socketDetail = (socket) => ({ socket: id(socket), localPort: socket.localPort,
  remotePort: socket.remotePort, destroyed: socket.destroyed, readableEnded: socket.readableEnded });
const watch = (socket, side) => {
  if (ids.has(socket)) return;
  record(`${side}:socket`, socketDetail(socket));
  for (const event of ['connect', 'end', 'close', 'error']) socket.on(event, (error) =>
    record(`${side}:${event}`, { ...socketDetail(socket), ...(event === 'error' ? { error: errorDetail(error) } : {}) }));
};
for (const event of ['create', 'headers', 'error']) dc.channel(`undici:request:${event}`).subscribe(({ request, response, error }) => {
  record(`request:${event}`, { request: id(request), method: request.method, path: request.path,
    origin: request.origin, status: response?.statusCode, error: errorDetail(error) });
});
dc.channel('undici:client:sendHeaders').subscribe(({ request, socket }) => {
  watch(socket, 'client');
  record('client:send', { request: id(request), ...socketDetail(socket) });
});
dc.channel('undici:client:connectError').subscribe(({ error }) => record('client:connectError', { error: errorDetail(error) }));
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  const server = id(this);
  record('server:listen', { server, port: args[0], host: args[1] });
  this.on('listening', () => record('server:listening', { server, address: this.address() }));
  this.on('close', () => record('server:close', { server }));
  this.on('error', (error) => record('server:error', { server, error: errorDetail(error) }));
  this.on('connection', (socket) => watch(socket, 'server'));
  this.prependListener('request', (request, response) => {
    record('server:request', { server, method: request.method, path: request.url, ...socketDetail(request.socket) });
    response.on('finish', () => record('server:response', { server, status: response.statusCode, ...socketDetail(request.socket) }));
  });
  return listen.apply(this, args);
};
const close = http.Server.prototype.close;
http.Server.prototype.close = function (...args) {
  record('server:close-called', { server: id(this) });
  return close.apply(this, args);
};
process.on('exit', () => {
  if (events.length) fs.writeFileSync(`${process.env.R34_TRACE_DIR}/${process.pid}.json`,
    JSON.stringify({ node: process.version, undici: process.versions.undici,
      pid: process.pid, argv: process.argv, cwd: process.cwd(), events }, null, 2));
});
