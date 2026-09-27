import { renderGraphic } from "./graphics.js";
import { dynamicState, dynamicPlane, snapParameter } from "./dynamic.js";
import { mountDynamic } from "./presentation.js";
export function mount(root, source, fontStyle) {
  return mountDynamic(
    root,
    source,
    renderGraphic,
    dynamicState,
    dynamicPlane,
    snapParameter,
    fontStyle,
  );
}
