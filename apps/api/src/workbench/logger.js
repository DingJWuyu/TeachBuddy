/**
 * Isolated run logging.
 *
 * Each runner instance writes JSONL under its own data directory so a failure
 * can be handed to the next person with the request summary, the tested SHA and
 * the isolated data location. Cookies, tokens and request bodies are never
 * logged; only method, path, status, account key and problem type.
 */
import fs from 'node:fs';
import path from 'node:path';

export function createWorkbenchLogger({ logDir = null, clock = () => new Date(), consoleOutput = true } = {}) {
  let requestsFile = null;
  let errorsFile = null;

  if (logDir) {
    fs.mkdirSync(logDir, { recursive: true });
    requestsFile = path.join(logDir, 'requests.jsonl');
    errorsFile = path.join(logDir, 'errors.jsonl');
  }

  function append(file, record) {
    if (!file) return;
    try {
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf-8');
    } catch (error) {
      if (consoleOutput) console.error('[workbench] failed to write log', error.message);
    }
  }

  return {
    logDir,

    request(record) {
      append(requestsFile, { at: clock().toISOString(), ...record });
    },

    error(scope, error) {
      append(errorsFile, {
        at: clock().toISOString(),
        scope,
        name: error?.name,
        message: error?.message,
        code: error?.code
      });
      if (consoleOutput) console.error(`[workbench] ${scope}:`, error);
    },

    info(message) {
      if (consoleOutput) console.log(`[workbench] ${message}`);
    }
  };
}

export function createRequestLogger(logger) {
  return function logRequest(req, res, next) {
    if (!logger?.logDir) return next();
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.request({
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        accountKey: req.workbenchPrincipal?.accountKey ?? null,
        problemType: res.locals?.workbenchProblemType ?? null,
        durationMs: Math.round(durationMs * 100) / 100
      });
    });
    return next();
  };
}
