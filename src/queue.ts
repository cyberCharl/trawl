import { EventEmitter } from "node:events";

type QueueEvents = {
  "item:queued": [itemId: string];
};

class CaptureQueue {
  private readonly emitter = new EventEmitter();

  enqueue(itemId: string): void {
    queueMicrotask(() => {
      this.emitter.emit("item:queued", itemId);
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
