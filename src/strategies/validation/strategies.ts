import type { FieldValues } from "react-hook-form";
import type { ValidationStrategy, FormSubset } from "./types";
import type { SavePayload } from "../../core/types";

export class NoValidationStrategy<T extends FieldValues>
  implements ValidationStrategy<T>
{
  async validate(): Promise<boolean> {
    return true;
  }
}

export class PayloadValidationStrategy<T extends FieldValues>
  implements ValidationStrategy<T>
{
  async validate(form: FormSubset<T>, payload: SavePayload): Promise<boolean> {
    const fields = Object.keys(payload);
    if (fields.length === 0) return true;

    // Cast to any to bypass the strict typing - this is safe because we're validating existing form fields
    return form.trigger(fields as any, { shouldFocus: false });
  }
}

export class AllFieldsValidationStrategy<T extends FieldValues>
  implements ValidationStrategy<T>
{
  async validate(form: FormSubset<T>): Promise<boolean> {
    return form.trigger(undefined, { shouldFocus: false });
  }
}
