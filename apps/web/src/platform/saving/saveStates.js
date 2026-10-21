/** Draft retention and settled-state checks for the shared save lifecycle. */

/** Statuses that must keep the local draft and the original request. */
const DRAFT_KEEPING_STATUSES = Object.freeze([
  'dirty',
  'failed',
  'conflict',
  'unconfirmed',
  'identity',
  'deleted'
]);

export function keepsDraft(status) {
  return DRAFT_KEEPING_STATUSES.includes(status);
}

export function isSettled(status) {
  return status === 'saved' || status === 'clean';
}
