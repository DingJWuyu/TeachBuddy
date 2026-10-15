/**
 * Shared save-status vocabulary.
 *
 * The statuses themselves live in the save lifecycle; these helpers exist so the
 * status lists are written once instead of being repeated in every consumer.
 */

/** A result the teacher still has to confirm with the original key. */
export const UNCONFIRMED_STATUSES = Object.freeze(['unconfirmed', 'identity']);

/** The server gave an explicit answer the teacher has to act on. */
export const EXPLICIT_FAILURE_STATUSES = Object.freeze(['failed', 'conflict', 'deleted']);

/** Statuses that must keep the local draft and the original request. */
export const DRAFT_KEEPING_STATUSES = Object.freeze([
  'dirty',
  'failed',
  'conflict',
  'unconfirmed',
  'identity',
  'deleted'
]);

/** Statuses where the save action must send the original request again. */
export const CONFIRMATION_STATUSES = Object.freeze(['unconfirmed', 'identity']);

export function keepsDraft(status) {
  return DRAFT_KEEPING_STATUSES.includes(status);
}

export function needsConfirmation(status) {
  return CONFIRMATION_STATUSES.includes(status);
}

export function isSettled(status) {
  return status === 'saved' || status === 'clean';
}

export function isBlockingWrite(status) {
  return status === 'saving' || status === 'identity' || status === 'deleted' || status === 'missing';
}
