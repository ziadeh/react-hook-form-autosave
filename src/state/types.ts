export interface AutosaveState {
  isSaving: boolean;
  lastError: Error | null;
  baseline: Record<string, any> | null;
  isBaselineInitialized: boolean;
  config: object;
  metrics: {
    totalSaves: number;
    successfulSaves: number;
    failedSaves: number;
    averageSaveTime: number;
  };
}

export type AutosaveAction =
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS"; duration: number }
  | { type: "SAVE_ERROR"; error: Error; duration: number }
  | { type: "UPDATE_BASELINE"; baseline: Record<string, any> }
  | { type: "INITIALIZE_BASELINE"; baseline: Record<string, any> }
  | { type: "RESET_BASELINE" }
  | { type: "ABORT" };
