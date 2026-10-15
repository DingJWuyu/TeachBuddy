/** T50 problem constructors use the shared frozen vocabulary. */
import { workbenchProblemStatus, workbenchProblemTypes } from '@teachbuddy/shared';
import { ContractError } from '../../workbench/problems.js';

function problem(type, extra) {
  return { type, ...extra };
}

function raise(status, value) {
  return new ContractError(status, value);
}

export const scheduleProblems = {
  invalidTimeZone: (field = '/timeZone') => raise(
    workbenchProblemStatus[workbenchProblemTypes.invalidTimeZone],
    problem(workbenchProblemTypes.invalidTimeZone, { field })
  ),
  reminderNotFuture: (field = '/reminder') => raise(
    workbenchProblemStatus[workbenchProblemTypes.reminderNotFuture],
    problem(workbenchProblemTypes.reminderNotFuture, { field })
  ),
  immutableSeries: () => raise(
    workbenchProblemStatus[workbenchProblemTypes.immutableSeries],
    problem(workbenchProblemTypes.immutableSeries)
  ),
  invalidMove: () => raise(
    workbenchProblemStatus[workbenchProblemTypes.invalidMove],
    problem(workbenchProblemTypes.invalidMove)
  ),
  /** version-conflict keeps the shared type and adds the conflicting object ID. */
  versionConflict: (objectId, currentVersion) => raise(
    workbenchProblemStatus[workbenchProblemTypes.versionConflict],
    problem(workbenchProblemTypes.versionConflict, { currentVersion, objectId })
  )
};
