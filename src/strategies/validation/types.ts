import type { FieldErrors, FieldValues, UseFormTrigger } from "react-hook-form";
import type { SavePayload } from "../../core/types";

export interface FormSubset<T extends FieldValues> {
  watch: () => T;
  formState: {
    isDirty: boolean;
    isValid: boolean;
    dirtyFields: any;
    isValidating: boolean;
    errors?: FieldErrors<T>;
  };
  reset: (values?: T) => void;
  getValues: () => T;
  trigger: UseFormTrigger<T>;
}

export interface ValidationStrategy<T extends FieldValues> {
  validate(form: FormSubset<T>, payload: SavePayload): Promise<boolean>;
}
