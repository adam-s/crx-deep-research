export interface Progress {
  /** record a message (e.g. for logging or debugging) */
  log(message: string): void;

  /** register a cleanup callback that only runs if the operation is aborted or times out */
  cleanupOnAbort(cleanup: (error?: Error) => void): void;

  /** race your promise against the internal abort signal */
  race<T>(promise: Promise<T>): Promise<T>;
}

export class ProgressController implements Progress {
  private readonly _abortPromise: Promise<never>;
  private _rejectAbort!: (err: Error) => void;
  private readonly _cleanupCallbacks: Array<(error?: Error) => void> = [];
  private readonly _timeoutMs: number;

  constructor(timeoutMs = 30_000) {
    this._timeoutMs = timeoutMs;
    this._abortPromise = new Promise<never>((_, reject) => {
      this._rejectAbort = reject;
    });
  }

  public log(message: string): void {
    console.debug(`[goto] ${message}`);
  }

  public cleanupOnAbort(cleanup: (error?: Error) => void): void {
    this._cleanupCallbacks.push(cleanup);
  }

  public race<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([promise, this._abortPromise]);
  }

  /**
   * Run your task, enforcing timeout and cleanup.
   * @param task The async task to run.
   * @returns The result of the task.
   */
  public async run<T>(task: (progress: Progress) => Promise<T>): Promise<T> {
    let timer: number | undefined;
    if (this._timeoutMs > 0) {
      timer = window.setTimeout(
        () => this._doAbort(new Error(`Timeout ${this._timeoutMs}ms exceeded`)),
        this._timeoutMs,
      );
    }

    try {
      return await task(this);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * Aborts with a given error (or a timeout error).
   * @param err The error to abort with.
   */
  private _doAbort(err: Error): void {
    for (const fn of this._cleanupCallbacks) {
      safe(call => call(err))(fn);
    }
    this._rejectAbort(err);
  }
}

/**
 * Helper to guard cleanup calls from throwing exceptions.
 * @param fn The function to protect.
 * @returns A new function that swallows exceptions.
 */
function safe(fn: (cleanup: (err?: Error) => void) => void) {
  return (cleanup: (err?: Error) => void) => {
    try {
      fn(cleanup);
    } catch {
      /* swallow */
    }
  };
}
