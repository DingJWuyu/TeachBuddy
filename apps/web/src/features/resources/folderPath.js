// Use the same ancestry everywhere a flat folder choice or attribution is shown.
export function folderPath(folders, id) {
  const names = [], visited = new Set();
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  for (let folder = byId.get(id); folder && !visited.has(folder.id); folder = byId.get(folder.parentId)) {
    visited.add(folder.id);
    names.unshift(folder.name);
  }
  return names.join(" / ");
}
