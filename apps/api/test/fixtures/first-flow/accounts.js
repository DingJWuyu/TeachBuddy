/**
 * The two runner-bound test identities (test-only).
 *
 * Single source for the API test context, the isolated runner and the browser
 * fixture, so a spec can never use an account the runner did not bind.
 */
export const TEST_ACCOUNT_KEYS = Object.freeze(['fixture-teacher-a', 'fixture-teacher-b']);
