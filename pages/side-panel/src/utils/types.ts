/**
 * Event severity levels for categorizing different types of events.
 */
export enum Severity {
  Success = 'success',
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
}

/**
 * Unified event message structure.
 */
export interface EventMessage {
  readonly message: string;
  readonly timestamp: number;
  readonly severity: Severity;
  readonly source?: string;
  readonly duration?: number;
  readonly details?: Record<string, unknown>;
  readonly error?: Error;
  readonly stackTrace?: string;
}
