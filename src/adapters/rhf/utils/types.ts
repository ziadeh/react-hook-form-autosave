import type { FieldValues } from "react-hook-form";
import type { Transport, SavePayload } from "../../../core/types";
import type { FormSubset } from "../../../strategies/validation/types";
import type { KeyMap } from "../../../utils/mapKeys";
import type { AutosaveConfig } from "../../../config/schema";

/* ============================= Undo/Redo Types ============================= */

export type FieldPath = string;
export type UndoOp = "user" | "undo" | "redo" | "hydrate" | null;

export interface Patch {
  name: FieldPath;
  prevValue: unknown;
  nextValue: unknown;
  rootField?: string;
}

export type HistoryEntry = Patch[];

/* ================================ Diff Handler Types ================================== */

export interface DiffHandler {
  idOf: (item: any) => string | number;
  onAdd: (item: any) => Promise<void> | void;
  onRemove: (item: any) => Promise<void> | void;
}

/* ================================ Undo Options ================================== */

export interface UndoOptions {
  enabled?: boolean;
  /** Skip autosave after undo/redo; call forceSave() manually if you enable this. */
  ignoreHistoryOps?: boolean;

  /** Enable keyboard shortcuts (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z). Default: true */
  hotkeys?: boolean;

  /**
   * If false, do NOT intercept when focus is in inputs/textareas/contentEditable.
   * If true, intercept everywhere. Default: false (safer).
   */
  captureInInputs?: boolean;

  /** Where to attach the listener. Default: document */
  target?: Document | HTMLElement;
}

/* ================================ Main Hook Options ================================== */

export interface RhfAutosaveOptions<T extends FieldValues> {
  form: FormSubset<T>;
  transport: Transport;
  config?: Partial<AutosaveConfig>;
  hasPendingChanges?: boolean;
  selectPayload?: (values: T, dirtyFields: any) => Partial<T>;
  shouldSave?: (ctx: {
    values: T;
    isValid: boolean;
    isDirty: boolean;
    dirtyFields: any;
  }) => boolean;
  onSaved?: (result: any, payload: SavePayload) => void;
  keyMap?: KeyMap;
  mapPayload?: (payload: Record<string, any>) => Record<string, any>;
  validateBeforeSave?: ValidationMode;
  diffMap?: Record<string, DiffHandler>;
  debug?: boolean;
  undo?: UndoOptions;
  autoHydrate?: boolean; // NEW: enable/disable auto-hydration (default: true)
}

export type ValidationMode = "none" | "payload" | "all";

/* ================================ Internal State Types ================================== */

export interface BaselineState {
  baseline: Record<string, any> | null;
  isInitialized: boolean;
}

export interface UndoRedoState {
  undoAffectedFields: Set<string>;
  isHydrating: boolean;
  lastOp: UndoOp;
  suppressRecord: UndoOp;
  lastValues: any;
  lastRecordedValuesSig: string;
}

export interface PendingState {
  historyPending: boolean;
  noPendingGuard: boolean;
  pendingPayload: SavePayload;
  lastQueuedSig: string;
}

/* ================================ Return Types ================================== */

export interface UndoRedoAPI {
  undo: () => void;
  redo: () => void;
  undoLastSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface AutosaveReturn {
  // Status
  isSaving: boolean;
  lastError: Error | null;
  metrics: any;

  // Pending
  hasPendingChanges: boolean;

  // Actions
  flush: () => Promise<any>;
  abort: () => void;
  forceSave: () => Promise<any>;

  // Baseline (diffMap) helpers
  forceBaselineUpdate: () => void;
  getBaseline: () => Record<string, any> | null;
  isBaselineInitialized: () => boolean;

  // Metrics / debug
  getMetrics: () => any;
  getCacheStats: () => any;
  getPendingChanges: () => any;
  isEmpty: () => boolean;

  // Undo/redo
  undo: (() => void) | undefined;
  redo: (() => void) | undefined;
  undoLastSave: (() => void) | undefined;
  canUndo: boolean;
  canRedo: boolean;

  // Hydrate safely from server
  hydrateFromServer: (data: any) => void;
}
