import type { AutosaveState, AutosaveAction } from "./types";

export const initialAutosaveState: AutosaveState = {
  isSaving: false,
  lastError: null,
  baseline: null,
  isBaselineInitialized: false,
  config: {},
  metrics: {
    totalSaves: 0,
    successfulSaves: 0,
    failedSaves: 0,
    averageSaveTime: 0,
  },
};

export function autosaveReducer(
  state: AutosaveState,
  action: AutosaveAction
): AutosaveState {
  switch (action.type) {
    case "SAVE_START":
      return {
        ...state,
        isSaving: true,
        lastError: null,
      };

    case "SAVE_SUCCESS": {
      const { totalSaves, averageSaveTime } = state.metrics;
      const newTotalSaves = totalSaves + 1;
      const newAverageSaveTime =
        (averageSaveTime * totalSaves + action.duration) / newTotalSaves;

      return {
        ...state,
        isSaving: false,
        lastError: null,
        metrics: {
          ...state.metrics,
          totalSaves: newTotalSaves,
          successfulSaves: state.metrics.successfulSaves + 1,
          averageSaveTime: newAverageSaveTime,
        },
      };
    }

    case "SAVE_ERROR": {
      const { totalSaves, averageSaveTime } = state.metrics;
      const newTotalSaves = totalSaves + 1;
      const newAverageSaveTime =
        (averageSaveTime * totalSaves + action.duration) / newTotalSaves;

      return {
        ...state,
        isSaving: false,
        lastError: action.error,
        metrics: {
          ...state.metrics,
          totalSaves: newTotalSaves,
          failedSaves: state.metrics.failedSaves + 1,
          averageSaveTime: newAverageSaveTime,
        },
      };
    }

    case "UPDATE_BASELINE":
      return {
        ...state,
        baseline: { ...state.baseline, ...action.baseline },
      };

    case "INITIALIZE_BASELINE":
      return {
        ...state,
        baseline: action.baseline,
        isBaselineInitialized: true,
      };

    case "RESET_BASELINE":
      return {
        ...state,
        baseline: null,
        isBaselineInitialized: false,
      };

    case "ABORT":
      return {
        ...state,
        isSaving: false,
      };

    default:
      return state;
  }
}
