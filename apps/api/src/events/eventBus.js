import { EventEmitter } from 'node:events';

export class ModuleEventBus extends EventEmitter {
  emitEvent(eventName, payload = {}) {
    this.emit(eventName, {
      timestamp: new Date().toISOString(),
      ...payload
    });
  }

  onEvent(eventName, handler) {
    this.on(eventName, handler);
  }
}

export const eventBus = new ModuleEventBus();
