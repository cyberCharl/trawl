import { EventEmitter } from "node:events";

type QueueEvents = {
  "item:queued": [itemId: string];
  "item:processed": [itemId: string];
  "item:failed": [itemId: string, errorDetails: string];
};

class CaptureQueue {
  private readonly emitter = new EventEmitter();

  enqueue(itemId: string): void {
    queueMicrotask(() => {
      this.emitter.emit("item:queued", itemId);
    });
  }

  emit<EventName extends keyof QueueEvents>(
    eventName: EventName,
    ...args: QueueEvents[EventName]
  ): void {
    queueMicrotask(() => {
      this.emitter.emit(eventName, ...args);
    });
  }

  on<EventName extends keyof QueueEvents>(
    eventName: EventName,
    listener: (...args: QueueEvents[EventName]) => void,
  ): void {
    this.emitter.on(eventName, listener);
  }
}

export const captureQueue = new CaptureQueue();
