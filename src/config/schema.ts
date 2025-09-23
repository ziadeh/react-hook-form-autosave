// config/schema.ts

export type ConflictResolution = "client" | "server" | "merge";

export interface AutosaveConfig {
  debug: boolean; // Enable debug logging (default: false)
  debounceMs: number; // >= 0
  maxRetries: number; // >= 0
  enableMetrics: boolean;
  enableCache: boolean;
  cacheSize: number; // >= 1
  cacheTtlMs: number; // >= 1000
  maxPayloadSize?: number; // any positive number; optional
  rateLimitMs: number; // >= 0
  offlineSupport: boolean;
  conflictResolution: ConflictResolution;
}

const DEFAULT_CONFIG: AutosaveConfig = {
  debug: false, // Explicitly disabled by default
  debounceMs: 600,
  maxRetries: 3,
  enableMetrics: false,
  enableCache: true,
  cacheSize: 100,
  cacheTtlMs: 5 * 60 * 1000,
  // maxPayloadSize: undefined,
  rateLimitMs: 0,
  offlineSupport: false,
  conflictResolution: "client",
};

// ---- runtime validation helpers (minimal, no zod) ----
function isNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function assertNumber(
  name: keyof AutosaveConfig,
  value: unknown,
  min?: number
): number {
  if (!isNumber(value)) {
    throw new TypeError(`"${String(name)}" must be a finite number`);
  }
  if (min !== undefined && value < min) {
    throw new RangeError(`"${String(name)}" must be >= ${min}`);
  }
  return value;
}

function assertBoolean(name: keyof AutosaveConfig, value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`"${String(name)}" must be a boolean`);
  }
  return value;
}

function assertConflictResolution(value: unknown): ConflictResolution {
  if (value === "client" || value === "server" || value === "merge") {
    return value;
  }
  throw new TypeError(
    `"conflictResolution" must be one of "client" | "server" | "merge"`
  );
}

// ---- public API ----
export function createConfig(
  input: Partial<AutosaveConfig> = {}
): AutosaveConfig {
  // merge with defaults first, then validate
  const merged: AutosaveConfig = { ...DEFAULT_CONFIG, ...input };

  // required numeric fields with mins
  merged.debounceMs = assertNumber("debounceMs", merged.debounceMs, 0);
  merged.maxRetries = assertNumber("maxRetries", merged.maxRetries, 0);
  merged.cacheSize = assertNumber("cacheSize", merged.cacheSize, 1);
  merged.cacheTtlMs = assertNumber("cacheTtlMs", merged.cacheTtlMs, 1000);
  merged.rateLimitMs = assertNumber("rateLimitMs", merged.rateLimitMs, 0);

  // booleans
  merged.debug = assertBoolean("debug", merged.debug);
  merged.enableMetrics = assertBoolean("enableMetrics", merged.enableMetrics);
  merged.enableCache = assertBoolean("enableCache", merged.enableCache);
  merged.offlineSupport = assertBoolean(
    "offlineSupport",
    merged.offlineSupport
  );

  // enum
  merged.conflictResolution = assertConflictResolution(
    merged.conflictResolution
  );

  // optional fields (validate only if provided)
  if (input.maxPayloadSize !== undefined) {
    merged.maxPayloadSize = assertNumber(
      "maxPayloadSize",
      input.maxPayloadSize
    );
  }

  return merged;
}

export type { AutosaveConfig as default };
