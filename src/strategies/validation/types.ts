import type {
  FieldErrors,
  FieldValues,
  UseFormTrigger,
} from "react-hook-form";
import type { SavePayload } from "../../core/types";

/**
 * A subset of UseFormReturn that contains the methods and properties
 * needed by the autosave hook. This uses flexible typing to support
 * different versions of react-hook-form (>=7).
 */
export interface FormSubset<T extends FieldValues> {
  watch: (...args: any[]) => any;
  formState: {
    isDirty: boolean;
    isValid: boolean;
    dirtyFields: any;
    isValidating: boolean;
    errors?: FieldErrors<T>;
  };
  reset: (...args: any[]) => void;
  getValues: (...args: any[]) => any;
  setValue: (...args: any[]) => void;
  register: (...args: any[]) => any;
  trigger: UseFormTrigger<T>;
}

export interface ValidationStrategy<T extends FieldValues> {
  validate(form: FormSubset<T>, payload: SavePayload): Promise<boolean>;
}
