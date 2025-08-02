import { Emitter, Event } from 'vs/base/common/event';
import { EventMessage, Severity } from './types';
import { makeEvent } from './eventFactory';

/**
 * Simplified event emitter with automatic source attribution.
 */
export class SimpleEventEmitter {
  private readonly _emitter = new Emitter<EventMessage>();
  public readonly event: Event<EventMessage> = this._emitter.event;

  constructor(private readonly _source = 'default') {}

  /**
   * Emits an event with the specified severity and options.
   */
  public emit(
    severity: Severity,
    message: string,
    options?: {
      duration?: number;
      details?: Record<string, unknown>;
      error?: Error;
    },
  ): void {
    const event = makeEvent(severity, message, {
      source: this._source,
      duration: options?.duration,
      details: options?.details,
      error: options?.error,
    });
    this._emitter.fire(event);
  }

  /**
   * Disposes the underlying emitter.
   */
  public dispose(): void {
    this._emitter.dispose();
  }
}
