import { z } from "zod";

export const AutosaveConfigSchema = z.object({
  debounceMs: z.number().min(0).default(600),
  maxRetries: z.number().min(0).default(3),
  enableMetrics: z.boolean().default(false),
  enableCache: z.boolean().default(true),
  cacheSize: z.number().min(1).default(100),
  cacheTtlMs: z
    .number()
    .min(1000)
    .default(5 * 60 * 1000),
  enableDebugLogs: z.boolean().optional(),
});

export type AutosaveConfig = z.infer<typeof AutosaveConfigSchema>;

export function createConfig(
  input: Partial<AutosaveConfig> = {}
): AutosaveConfig {
  return AutosaveConfigSchema.parse(input);
}
