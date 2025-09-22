import type {
  FieldErrors,
  FieldValues,
  UseFormReturn,
  UseFormTrigger,
} from "react-hook-form";
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
  reset: (
    values?: T,
    options?: {
      keepErrors?: boolean;
      keepDirty?: boolean;
      keepDirtyValues?: boolean;
      keepValues?: boolean;
      keepDefaultValues?: boolean;
      keepIsSubmitted?: boolean;
      keepTouched?: boolean;
      keepIsValid?: boolean;
      keepSubmitCount?: boolean;
    }
  ) => void;
  getValues: UseFormReturn<T>["getValues"];
  setValue: UseFormReturn<T>["setValue"]; // ✅ add this
  register: UseFormReturn<T>["register"]; // ✅ add this for {...register("field")}

  trigger: UseFormTrigger<T>;
}

export interface ValidationStrategy<T extends FieldValues> {
  validate(form: FormSubset<T>, payload: SavePayload): Promise<boolean>;
}
