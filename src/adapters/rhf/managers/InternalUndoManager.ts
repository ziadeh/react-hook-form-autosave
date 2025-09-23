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
    private getCurrentValues: () => Record<string, any>, // NEW: Get current form values
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
    this.past.push(entry);
    if (this.maxEntries && this.past.length > this.maxEntries) {
      this.past.shift();
    }
    this.future = []; // user change clears redo
    this.lastOp = "user";
    this.notify();
  }

  /** Explicit: allow callers to clear future on first sign of user input */
  clearFuture(): void {
    if (this.future.length) {
      this.future = [];
      this.notify();
    }
  }

  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) return false;

    // NEW: Capture current state before undoing for redo
    const currentValues = this.getCurrentValues();
    const redoEntry: HistoryEntry = entry.map((patch) => ({
      name: patch.name,
      prevValue: patch.nextValue, // What we're about to change FROM
      nextValue: currentValues[patch.name] || patch.prevValue, // Current value
      rootField: patch.rootField,
    }));

    this.future.push(redoEntry);

    // Apply the undo
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

    // NEW: Capture current state before redoing for undo
    const currentValues = this.getCurrentValues();
    const undoEntry: HistoryEntry = entry.map((patch) => ({
      name: patch.name,
      prevValue: currentValues[patch.name] || patch.prevValue, // Current value
      nextValue: patch.nextValue, // What we're about to change TO
      rootField: patch.rootField,
    }));

    this.past.push(undoEntry);

    // Apply the redo
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

  undoToLastCheckpoint(): void {
    const target = this.checkpoints.pop();
    if (target === undefined) return;
    while (this.past.length > target) {
      if (!this.undo()) break; // Stop if we can't undo anymore
    }
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
}
