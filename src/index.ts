// Core exports
export * from "./core/types";
export * from "./core/errors";
export { AutosaveManager } from "./core/autosave";

// Adapters
export * from "./adapters/rhf/useRhfAutosave";
export { trpcTransport } from "./adapters/trpc/transport";

// Strategies
export * from "./strategies/validation";
export * from "./strategies/transport/retry";
export * from "./strategies/transport/compose";

// State management
export * from "./state/types";
export { autosaveReducer, initialAutosaveState } from "./state/reducer";

// Utilities
export * from "./utils/pickChanged";
export * from "./utils/mapKeys";
export * from "./utils/debounce";
export { createLogger, type Logger } from "./utils/logger";

// Cache
export { PayloadCache } from "./cache/payloadCache";
export { ValidationCache } from "./cache/validationCache";

// Metrics
export { MetricsCollector, type AutosaveMetrics } from "./metrics/collector";

// Configuration

// Testing utilities
export * from "./testing/testUtils";
export * from "./helpers/pendingChanges";
