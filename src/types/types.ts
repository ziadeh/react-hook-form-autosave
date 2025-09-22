export type FieldPath = string;

export type Patch = {
  name: FieldPath;
  prevValue: unknown;
  nextValue: unknown;
};

export type HistoryEntry = Patch[];

export type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

export type PendingChanges = Set<FieldPath>;

export type GetValues = (name?: FieldPath) => any;
export type SetValue = (
  name: FieldPath,
  value: unknown,
  options?: { shouldDirty?: boolean; shouldTouch?: boolean }
) => void;

export type DeepEqualFn = (a: any, b: any) => boolean;
export type GetterFn = (obj: any, path: FieldPath) => any;

export type UndoRedoOptions = {
  initialValuesRef: { current: any };
  deepEqual: DeepEqualFn;
  get: GetterFn;
};

export type HistoryListener = () => void;
