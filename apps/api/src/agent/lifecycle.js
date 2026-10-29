import express from 'express';
import { createGuards, asyncHandler, createWorkbenchErrorHandler } from '../workbench/http.js';
import { sendProblem } from '../workbench/problems.js';
import { portableObject, readableContent, reference } from '../workbench/reliability/portable-records.js';
import { assertRelation } from '../workbench/reliability/inspection.js';

const labels = {"messages": "对话", "draft": "已保存输入", "references": "关联资料", "snapshot": "已采用的历史快照", "source": "来源与源码", "content": "内容", "text": "正文"};
const record = (kind, value, options) => portableObject(kind, value, { html: readableContent(value, labels), ...options });

export function snapshot(db, principal) {
  const objects = db.prepare('SELECT id,document FROM agent_conversations WHERE accountKey=?').all(principal.accountKey).map(row => {
    const value = JSON.parse(row.document).snapshot;
    const relations = [];
    function visit(value, location = '') {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'references' && Array.isArray(child)) child.forEach((ref, index) => {
          const input = ref.input ?? ref;
          relations.push(reference(input.kind, input.id, 'conversation-reference', `${location}/${key}/${index}`, input.version ?? null, true));
        });
        visit(child, `${location}/${key}`);
      }
    }
    visit(value);
    return { ...record('conversation', value, { id: row.id, label: '对话', title: value.conversation?.title || '对话', relations }), allowMissingFiles: true };
  });
  return { objects };
}
export function validateStorage(db) {
  assertRelation(db, 'agent_events', 'conversationId', 'agent_conversations');
  return [{ name: 'agent-native', version: 'opaque-preserved' }];
}
export function prepareRestoredAgent(db) {
  for (const row of db.prepare('SELECT id,accountKey,document FROM agent_conversations').all()) {
    const document = JSON.parse(row.document);
    for (const operation of document.snapshot.operations ?? []) if (['prepared', 'executing', 'unconfirmed'].includes(operation.state)) db.prepare('INSERT OR IGNORE INTO reliability_frozen_operations VALUES (?,?,?)').run(operation.id, row.id, row.accountKey);
  }
}
export function deleteAccountData(db, accountKey) {
  db.prepare('DELETE FROM agent_events WHERE conversationId IN (SELECT id FROM agent_conversations WHERE accountKey=?)').run(accountKey);
  db.prepare('DELETE FROM reliability_frozen_operations WHERE accountKey=?').run(accountKey);
  db.prepare('DELETE FROM agent_conversations WHERE accountKey=?').run(accountKey);
}
export function createAgentRecoveryGuard({ db, identity, trustedOrigins, ready, logger }) {
  const agentRecoveryGuard = express.Router();
  const guards = createGuards({ identity, trustedOrigins });
  agentRecoveryGuard.post(
    [
      "/conversations/:conversationId/operations/:operationId/reconcile",
      "/conversations/:conversationId/proposals/:proposalId/execute",
    ],
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    guards.originGuard,
    guards.protectionGuard,
    guards.identityGuard,
    express.json({ limit: "2mb" }),
    asyncHandler(async (req, res, next) => {
      await ready();
      let operationId = req.params.operationId;
      if (req.params.proposalId) {
        const row = db.prepare("SELECT document FROM agent_conversations WHERE id=? AND accountKey=?")
          .get(req.params.conversationId, req.workbenchPrincipal.accountKey);
        const operation = row && JSON.parse(row.document).snapshot.operations.find(item =>
          item.proposalSource?.proposalId === req.params.proposalId && item.proposalSource.slot === req.body?.slot);
        operationId = operation?.id;
      }
      if (!operationId) return next();
      const frozen = db
        .prepare(
          "SELECT 1 FROM reliability_frozen_operations WHERE id=? AND conversationId=? AND accountKey=?",
        )
        .get(
          operationId,
          req.params.conversationId,
          req.workbenchPrincipal.accountKey,
        );
      if (frozen)
        return sendProblem(res, 409, {
          type: "/problems/reliability/recovery-review-required",
          status: 409,
          title: "工作台已从备份恢复，请基于当前资料重新核对这项操作。",
        });
      next();
    }),
  );
  agentRecoveryGuard.use(createWorkbenchErrorHandler({ logger }));
  return agentRecoveryGuard;
}
