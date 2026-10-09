/** GeoGebra Classic perspective grammar; all views share one construction. */
export function workshopPerspective(view) {
  const perspectives = { plane: 'G', space: 'T', split: 'GT' };
  const perspective = Object.hasOwn(perspectives, view) ? perspectives[view] : null;
  if (!perspective) throw new Error('数学视图需要 plane、space 或 split。');
  return perspective;
}
export function applyWorkshopView(api, view) {
  api.setPerspective(workshopPerspective(view));
  api.showToolBar(false); api.showMenuBar(false); api.showAlgebraInput(false);
}

// Pinned GeoGebra EuclidianConstants: these are native construction tools.
export const workshopToolModes = Object.freeze({ select: 0, point: 1, parallel: 3, perpendicular: 4, intersect: 5, circle: 10, segment: 15, polygon: 16, midpoint: 19 });
export function workshopToolMode(tool) {
  const key = tool === 'move' ? 'select' : tool;
  const mode = Object.hasOwn(workshopToolModes, key) ? workshopToolModes[key] : undefined;
  if (mode === undefined) throw new Error('不支持此画布工具。');
  return mode;
}
