// Only container shape belongs to structural undo. Prose, formulas and metadata
// stay at their current values when an earlier container operation is reversed.
const containers = new Set(['blocks', 'items', 'rows']);
export function structureChanged(before, after, key = '') {
  if (before === after) return false;
  if (Array.isArray(before) && Array.isArray(after)) {
    if (!containers.has(key) && key !== 'row') return false;
    if (before.length !== after.length) return true;
    if (before.some((item, i) => after.includes(item) && after.indexOf(item) !== i)) return true;
    return before.some((item, i) => structureChanged(item, after[i], key === 'rows' ? 'row' : ''));
  }
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    if (before.type !== after.type) return true;
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .some(field => structureChanged(before[field], after[field], field));
  }
  return containers.has(key) && before !== after;
}

export function undoStructure(before, after, current, key = '') {
  if (before === after || !before || !after || !current) return current;
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(current)) {
    if (!containers.has(key) && key !== 'row') return current;
    const unmatchedBefore = before.map((item, i) => after.includes(item) ? -1 : i).filter(i => i >= 0);
    const unmatchedAfter = after.map((item, i) => before.includes(item) ? -1 : i).filter(i => i >= 0);
    return before.map((item, i) => {
      let index = after.indexOf(item);
      // A changed parent retains its position, even though React replaces its object.
      if (index < 0 && unmatchedBefore.length === unmatchedAfter.length)
        index = unmatchedAfter[unmatchedBefore.indexOf(i)];
      return index < 0 ? item : undoStructure(item, after[index], current[index], key === 'rows' ? 'row' : '');
    });
  }
  if (typeof before !== 'object' || typeof after !== 'object' || typeof current !== 'object') return current;
  const result = { ...current };
  for (const field of Object.keys(before)) {
    if (containers.has(field) || typeof before[field] === 'object' && field !== 'runs')
      result[field] = undoStructure(before[field], after[field], current[field], field);
  }
  return result;
}
