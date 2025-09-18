import type { SavePayload, SaveResult, Transport, SaveContext } from "./types";
import { AutosaveError } from "./errors";
import type { Logger } from "../utils/logger";

export interface AutosaveManagerOptions {
  transport: Transport;
  debounceMs?: number;
  logger?: Logger;
  timer?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
}

export class AutosaveManager {
  private pending: SavePayload = {};
  private isInflight = false;
  private shouldRerun = false;
  private abortController: AbortController | null = null;
  private retryCount = 0;
  private readonly maxRetries = 3;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastChangeAt = 0;

  constructor(
    private readonly transport: Transport,
    private readonly debounceMs = 600,
    private readonly logger?: Logger,
    private readonly timer = { setTimeout, clearTimeout }
  ) {}

  queueChange(delta: SavePayload): void {
    this.logger?.debug("Queueing change", {
      delta,
      currentPending: this.pending,
    });
    this.pending = { ...this.pending, ...delta };
    this.lastChangeAt = Date.now();
    this.scheduleFlush();
  }

  async flush(): Promise<SaveResult> {
    this.clearScheduledFlush();

    if (this.isEmpty()) {
      return { ok: true };
    }

    if (this.isInflight) {
      this.shouldRerun = true;
      this.logger?.debug("Flush requested while save in progress, will rerun");
      return { ok: true };
    }

    const payload = this.takePendingPayload();
    this.isInflight = true;
    this.abortController = new AbortController();

    const startTime = performance.now();

    try {
      this.logger?.debug("Starting save", { payload });

      const context: SaveContext = {
        signal: this.abortController.signal,
        timestamp: Date.now(),
        retryCount: this.retryCount,
      };

      const result = await this.transport(payload, context);

      const duration = performance.now() - startTime;
      this.logger?.debug("Save completed", { result, duration });

      if (result.ok) {
        this.retryCount = 0;
      } else {
        this.handleFailure(payload, result.error);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const autosaveError = AutosaveError.fromUnknown(error, "TRANSPORT_ERROR");

      this.logger?.error("Save failed", autosaveError, { payload, duration });
      this.handleFailure(payload, autosaveError);

      return { ok: false, error: autosaveError };
    } finally {
      this.isInflight = false;
      this.abortController = null;

      if (this.shouldRerun) {
        this.shouldRerun = false;
        this.scheduleFlush();
      }
    }
  }

  abort(): void {
    this.logger?.debug("Aborting autosave");
    this.pending = {};
    this.shouldRerun = false;
    this.clearScheduledFlush();
    this.abortController?.abort();
  }

  isEmpty(): boolean {
    return Object.keys(this.pending).length === 0;
  }

  getPendingChanges(): Readonly<SavePayload> {
    return { ...this.pending };
  }

  private takePendingPayload(): SavePayload {
    const payload = this.pending;
    this.pending = {};
    return payload;
  }

  private handleFailure(payload: SavePayload, error: Error): void {
    // Re-queue failed payload for retry
    this.pending = { ...payload, ...this.pending };
    this.retryCount++;

    if (this.retryCount <= this.maxRetries) {
      this.logger?.warn(
        `Save failed, will retry (${this.retryCount}/${this.maxRetries})`,
        { error }
      );
    } else {
      this.logger?.error(`Save failed after ${this.maxRetries} retries`, error);
    }
  }

  private scheduleFlush(): void {
    if (this.isEmpty()) {
      this.clearScheduledFlush();
      return;
    }

    if (this.debounceMs <= 0) {
      this.clearScheduledFlush();
      void this.flush();
      return;
    }

    this.clearScheduledFlush();

    const elapsedSinceChange = Date.now() - this.lastChangeAt;
    const delay = Math.max(this.debounceMs - elapsedSinceChange, 0);

    const schedule = this.timer.setTimeout as typeof setTimeout;
    const scheduleWithContext = schedule.bind?.(undefined) ?? schedule;

    this.flushTimeout = scheduleWithContext(() => {
      this.flushTimeout = null;

      const elapsed = Date.now() - this.lastChangeAt;
      if (elapsed < this.debounceMs) {
        this.scheduleFlush();
        return;
      }

      void this.flush();
    }, delay);
  }

  private clearScheduledFlush(): void {
    if (this.flushTimeout !== null) {
      const cancel = this.timer.clearTimeout as typeof clearTimeout;
      const cancelWithContext = cancel.bind?.(undefined) ?? cancel;
      cancelWithContext(this.flushTimeout);
      this.flushTimeout = null;
    }
  }
}
