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
export { fetchTransport } from "./strategies/transport/fetch";
export type { FetchTransportOptions } from "./strategies/transport/fetch";
export { serverActionTransport } from "./strategies/transport/serverAction";
export type { ServerActionTransportOptions } from "./strategies/transport/serverAction";

// State management
export * from "./state/types";
export { autosaveReducer, initialAutosaveState } from "./state/reducer";

// Utilities
export * from "./utils/pickChanged";
export * from "./utils/mapKeys";
export * from "./utils/debounce";
export { createLogger, type Logger } from "./utils/logger";

// Nested field utilities
export * from "./utils/fieldPath";
export * from "./utils/nestedKeyMap";
export * from "./utils/nestedArrayDiff";
export * from "./utils/deepMerge";

// Cache
export { PayloadCache } from "./cache/payloadCache";
export { ValidationCache } from "./cache/validationCache";

// Metrics
export { MetricsCollector, type AutosaveMetrics } from "./metrics/collector";

// Configuration

// Navigation guard
export { useBeforeUnload } from "./hooks/useBeforeUnload";

// Status types
export type { AutosaveStatus } from "./adapters/rhf/utils/types";

// Helpers
export * from "./helpers/pendingChanges";
