import { GeoGebraError } from './controller.js';
import { tx } from '../../../i18n/presentation.js';

// Legacy sources own only a GGB construction. Keep its revision and cancellation
// checks in the controller while presenting the assistant's editing interface.
export function legacyAssistantController(controller) {
  function read() {
    const { revision, ...current } = controller.read();
    return { ...current, editRevision: revision };
  }
  async function apply({ baseEditRevision, changes }, signal) {
    if (!changes || Object.keys(changes).some(key => key !== 'operations')) throw new GeoGebraError('operation', tx('修改内容格式不正确。'));
    const { revision, ...current } = await controller.apply({ revision: baseEditRevision, operations: changes.operations, signal });
    return { ...current, editRevision: revision };
  }
  return { read, apply };
}
