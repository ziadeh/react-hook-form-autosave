import type { FieldValues } from "react-hook-form";
import {
  NoValidationStrategy,
  PayloadValidationStrategy,
  AllFieldsValidationStrategy,
} from "./strategies";
import type { ValidationStrategy } from "./types";

export * from "./types";
export * from "./strategies";

export type ValidationMode = "none" | "payload" | "all";

export function createValidationStrategy<T extends FieldValues>(
  mode: ValidationMode = "payload"
): ValidationStrategy<T> {
  switch (mode) {
    case "none":
      return new NoValidationStrategy<T>();
    case "payload":
      return new PayloadValidationStrategy<T>();
    case "all":
      return new AllFieldsValidationStrategy<T>();
    default:
      throw new Error(`Unknown validation mode: ${mode}`);
  }
}
