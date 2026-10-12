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

/** Playback follows the same slider increments in the editor and classroom. */
export function workshopPlaybackValue(slider, progress) {
  const low = Number(slider.min), high = Number(slider.max);
  const increment = Number(slider.step), step = increment > 0 ? increment : 0.1;
  const fraction = Math.max(0, Math.min(1, progress));
  return Math.max(low, Math.min(high, low + Math.round(fraction * (high - low) / step) * step));
}

/** Read the original GGB document, before native loading replaces its view size. */
export function savedWorkshopPlaneViewport(document) {
  const view = Array.from(document.getElementsByTagName('euclidianView')).find(node => node.getElementsByTagName('viewNumber')[0]?.getAttribute('viewNo') !== '2');
  const size = view?.getElementsByTagName('size')[0], coordinates = view?.getElementsByTagName('coordSystem')[0];
  const value = (node, name) => node?.hasAttribute(name) ? Number(node.getAttribute(name)) : NaN;
  const result = { width: value(size, 'width'), height: value(size, 'height'), xZero: value(coordinates, 'xZero'), yZero: value(coordinates, 'yZero'), scale: value(coordinates, 'scale'), yscale: coordinates?.hasAttribute('yscale') ? value(coordinates, 'yscale') : value(coordinates, 'scale') };
  return Object.values(result).every(Number.isFinite) && result.width > 0 && result.height > 0 && result.scale > 0 && result.yscale > 0 ? result : null;
}

export function captureWorkshopPlaneViewport(api) {
  const raw = api.getViewProperties(1), view = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (![view.width, view.height, view.invXscale, view.invYscale, view.xMin, view.yMin].every(Number.isFinite) || view.width <= 0 || view.height <= 0 || view.invXscale <= 0 || view.invYscale <= 0) return null;
  return { width: view.width, height: view.height, xZero: -view.xMin / view.invXscale, yZero: view.height + view.yMin / view.invYscale, scale: 1 / view.invXscale, yscale: 1 / view.invYscale };
}

/** Contain the saved world rectangle, preserving its center and axes ratio. */
export function fitWorkshopPlaneViewport(api, saved) {
  const current = captureWorkshopPlaneViewport(api);
  // Older GGB documents without a usable size keep the native opening view.
  // Capture it once so later resizes can preserve it without inventing bounds.
  if (!saved) return current;
  if (!current) return saved;
  const factor = Math.min(current.width / saved.width, current.height / saved.height);
  const centerX = (saved.width / 2 - saved.xZero) / saved.scale;
  const centerY = (saved.yZero - saved.height / 2) / saved.yscale;
  const halfWidth = current.width / (2 * saved.scale * factor), halfHeight = current.height / (2 * saved.yscale * factor);
  api.setCoordSystem(centerX - halfWidth, centerX + halfWidth, centerY - halfHeight, centerY + halfHeight);
  return saved;
}

// Pinned GeoGebra EuclidianConstants: these are native construction tools.
export const workshopToolModes = Object.freeze({ select: 0, point: 1, parallel: 3, perpendicular: 4, intersect: 5, circle: 10, segment: 15, polygon: 16, midpoint: 19 });
export function workshopToolMode(tool) {
  const key = tool === 'move' ? 'select' : tool;
  const mode = Object.hasOwn(workshopToolModes, key) ? workshopToolModes[key] : undefined;
  if (mode === undefined) throw new Error('不支持此画布工具。');
  return mode;
}
