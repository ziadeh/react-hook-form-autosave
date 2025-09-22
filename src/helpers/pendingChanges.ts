import type {
  FieldPath,
  PendingChanges,
  UndoRedoOptions,
} from "../types/types";

export function isPending(
  name: FieldPath,
  currentValue: unknown,
  opts: UndoRedoOptions
): boolean {
  const initial = opts.get(opts.initialValuesRef.current, name);
  return !opts.deepEqual(currentValue, initial);
}

export function reconcilePendingField(
  name: FieldPath,
  currentValue: unknown,
  pending: PendingChanges,
  opts: UndoRedoOptions
) {
  if (isPending(name, currentValue, opts)) {
    pending.add(name);
  } else {
    pending.delete(name);
  }
}
