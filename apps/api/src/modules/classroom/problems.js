import { contractError, problems } from '../../workbench/problems.js';
export function conflict(code, extra = {}) {
  return Object.assign(new Error(code), {
    status: 409,
    problem: {
      type: '/problems/workbench/classroom-' + code,
      ...extra
    }
  });
}
export function account(principal) {
  if (!principal?.accountKey) {
    throw contractError(problems.unauthenticated());
  }
  return principal.accountKey;
}
export function required(repository, kind, principal, id) {
  const value = repository.get(kind, account(principal), id);
  if (!value) {
    throw contractError(problems.notFound());
  }
  return value;
}
export function active(value) {
  if (value.deletedAt) {
    throw contractError(problems.objectDeleted());
  }
  return value;
}
export function version(value, expected) {
  if (value.version !== expected) {
    throw contractError(problems.versionConflict(value.version));
  }
}
export function timestamp(clock) {
  const value = typeof clock === 'function' ? clock() : clock?.now?.() ?? new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
export function changed(value, clock, fields) {
  return {
    ...value,
    ...fields,
    version: value.version + 1,
    updatedAt: timestamp(clock)
  };
}
export function listed(values, query = {}, byDate = false) {
  const matches = values.filter(value => {
    const deletionMatches = query.deleted === 'all' || Boolean(value.deletedAt) === (query.deleted === 'deleted');
    if (!deletionMatches) {
      return false;
    }
    if (query.q && !JSON.stringify(value).toLocaleLowerCase().includes(query.q.trim().toLocaleLowerCase())) {
      return false;
    }
    if (query.from && value.occurredOn < query.from) {
      return false;
    }
    if (query.to && value.occurredOn > query.to) {
      return false;
    }
    return true;
  });
  matches.sort((left, right) => {
    if (byDate) {
      const dateOrder = right.occurredOn.localeCompare(left.occurredOn);
      if (dateOrder) {
        return dateOrder;
      }
    }
    return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
  });
  return {
    items: matches,
    total: matches.length
  };
}
