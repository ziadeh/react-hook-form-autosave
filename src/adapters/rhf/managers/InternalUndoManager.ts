import type { FieldPath, HistoryEntry } from "../utils/types";

/** Minimal manager that writes via RHF setValue */
export class InternalUndoManager {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private listeners = new Set<() => void>();
  private lastOp: "user" | "undo" | "redo" | null = null;
  private checkpoints: number[] = [];

  constructor(
    private setValue: (
      name: FieldPath,
      value: unknown,
      shouldDirty?: boolean
    ) => void,
    private getCurrentValues: () => Record<string, any>,
    private onHistoryApplied?: (
      entry: HistoryEntry,
      op: "undo" | "redo"
    ) => void,
    private maxEntries?: number
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  record(entry: HistoryEntry): void {
    if (!entry.length) return;

    // Add to past
    this.past.push(entry);

    // Trim if too many entries
    if (this.maxEntries && this.past.length > this.maxEntries) {
      this.past.shift();
      // Adjust checkpoints if we removed old entries
      this.checkpoints = this.checkpoints
        .map((cp) => cp - 1)
        .filter((cp) => cp >= 0);
    }

    // NOTE: We do NOT clear future here anymore
    // clearFuture() should be called explicitly by the caller if needed

    this.lastOp = "user";
    this.notify();
  }

  /** Clear future stack (called when user starts typing after undo) */
  clearFuture(): void {
    if (this.future.length) {
      this.future = [];
      this.notify();
    }
  }

  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) return false;

    // Get current state BEFORE applying undo
    const currentValues = this.getCurrentValues();

    // Build redo entry from current state
    const redoEntry: HistoryEntry = entry.map((patch) => ({
      name: patch.name,
      prevValue: patch.nextValue, // What we had (will undo from)
      nextValue:
        currentValues[patch.name] !== undefined
          ? currentValues[patch.name]
          : patch.nextValue, // Current value to restore on redo
      rootField: patch.rootField,
    }));

    // Add to future stack for redo
    this.future.push(redoEntry);

    // Apply the undo (restore previous values)
    for (const { name, prevValue } of entry) {
      this.setValue(name, prevValue, true);
    }

    this.lastOp = "undo";
    this.onHistoryApplied?.(entry, "undo");
    this.notify();
    return true;
  }

  redo(): boolean {
    const entry = this.future.pop();
    if (!entry) return false;

    // Get current state BEFORE applying redo
    const currentValues = this.getCurrentValues();

    // Build undo entry from current state
    const undoEntry: HistoryEntry = entry.map((patch) => ({
      name: patch.name,
      prevValue:
        currentValues[patch.name] !== undefined
          ? currentValues[patch.name]
          : patch.prevValue, // Current value to restore on undo
      nextValue: patch.nextValue, // What we're about to set
      rootField: patch.rootField,
    }));

    // Add to past stack for undo
    this.past.push(undoEntry);

    // Apply the redo (restore next values)
    for (const { name, nextValue } of entry) {
      this.setValue(name, nextValue, true);
    }

    this.lastOp = "redo";
    this.onHistoryApplied?.(entry, "redo");
    this.notify();
    return true;
  }

  markCheckpoint(): void {
    this.checkpoints.push(this.past.length);
  }

  undoToLastCheckpoint(): boolean {
    const target = this.checkpoints.pop();
    if (target === undefined) {
      // No checkpoint found - undo everything
      console.debug("[UndoManager] No checkpoint found, undoing all changes");
      let undidSomething = false;
      while (this.past.length > 0) {
        if (!this.undo()) break;
        undidSomething = true;
      }
      return undidSomething;
    }

    // Undo until we reach the checkpoint
    console.debug(`[UndoManager] Undoing to checkpoint at position ${target}`);
    let undidSomething = false;
    while (this.past.length > target) {
      if (!this.undo()) break;
      undidSomething = true;
    }
    return undidSomething;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  getLastOp(): "user" | "undo" | "redo" | null {
    return this.lastOp;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.lastOp = null;
    this.checkpoints = [];
    this.notify();
  }

  // Debug helper
  getState(): { past: number; future: number; checkpoints: number[] } {
    return {
      past: this.past.length,
      future: this.future.length,
      checkpoints: [...this.checkpoints],
    };
  }
}
