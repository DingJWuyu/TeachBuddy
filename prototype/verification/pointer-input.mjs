// Match the pointer used by the declared viewport, including real touch events.
export function activate(locator, options) {
  return locator.page().viewportSize().width <= 700 ? locator.tap(options) : locator.click(options);
}
