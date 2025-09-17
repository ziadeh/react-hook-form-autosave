# react-hook-form-autosave
[![npm version](https://img.shields.io/npm/v/react-hook-form-autosave.svg)](https://www.npmjs.com/package/react-hook-form-autosave)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-hook-form-autosave)](https://bundlephobia.com/package/react-hook-form-autosave)
[![license](https://img.shields.io/github/license/ziadeh/react-hook-form-autosave)](./LICENSE)

Autosave utilities for [React Hook Form](https://react-hook-form.com/) with debounce, validation, key mapping, and diff handling.  
Perfect for building autosaving forms in React (including **Next.js** apps with **tRPC**).

---

## ✨ Features

- 🔄 **Autosave on change** — save form data automatically as the user types
- ⏱ **Debounced** requests to avoid spammy saves
- ✅ **Validation-aware** — only save when fields are valid
- 🗝 **Key mapping** — remap form field names to API field names
- ➕➖ **Diff-based handling** — handle add/remove operations for array fields (e.g. sectors, tags)
- ⚡️ Works seamlessly with **React Hook Form**, **zod**, and **tRPC**

---

## 📦 Installation

```bash
# With pnpm (recommended)
pnpm add react-hook-form-autosave

# Or with npm
npm install react-hook-form-autosave

# Or with yarn
yarn add react-hook-form-autosave
```


---

## API

### Hook

```ts
const {
  isSaving,
  lastError,
  flush,
  abort,
  forceBaselineUpdate
} = useRhfAutosave(options)
```

### Options

| Option              | Type / Values                               | Description |
|---------------------|---------------------------------------------|-------------|
| `form`              | `UseFormReturn<T>`                          | Required. RHF form instance. |
| `transport`         | `(payload: any, signal?: AbortSignal) => Promise<{ ok: boolean; error?: Error }>` | Required. Async save function. Receives an `AbortSignal`. |
| `debounceMs`        | `number`                                    | Debounce interval in ms. |
| `shouldSave`        | `(ctx: { isDirty: boolean; dirtyFields: any }) => boolean` | Predicate to decide whether to fire save. |
| `validateBeforeSave`| `"none" | "payload" | "all"`                 | When to validate before save. |
| `keyMap`            | `Record<string, [apiKey: string, transform?: (val: any) => any]>` | Map form keys to API payload keys. |
| `mapPayload`        | `(payload: any) => any`                     | Final transform on payload before sending. |
| `diffMap`           | Object                                      | Special diff handlers for array fields. |
| `onSaved`           | `(result: { ok: boolean; error?: Error }) => void` | Callback after save completes. |

### Returns

| Return value        | Type          | Description |
|---------------------|---------------|-------------|
| `isSaving`          | `boolean`     | True while a save is in flight. |
| `lastError`         | `Error?`      | Last transport error. |
| `flush()`           | `() => void`  | Immediately trigger a save (ignore debounce). |
| `abort()`           | `() => void`  | Cancel current in-flight request. |
| `forceBaselineUpdate()` | `() => void` | Reset “dirty baseline” to current values. |

---

## AbortController & out-of-order requests

Autosave often needs to cancel or ignore stale requests.

- `abort()` cancels the current in-flight request.  
- The `transport` function receives an `AbortSignal`. If possible, pass it into `fetch`:

```ts
transport: async (payload, signal) => {
  const res = await fetch("/api/update", { method: "PATCH", body: JSON.stringify(payload), signal });
  return { ok: res.ok };
}
```

- Internally, the hook guards against **out-of-order responses** by tracking request IDs. Late responses are ignored.

---

## Recipes

- **Save only valid payloads**:
  ```ts
  validateBeforeSave: "payload"
  ```
- **Global “Save all” button**: call `flush()`.
- **Manual reset** after refetch: `form.reset(newDefaults); forceBaselineUpdate();`

---

## 🚀 Usage Example

A simple autosave form with validation:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRhfAutosave } from "react-hook-form-autosave";
import { z } from "zod";

// 1. Define schema
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  bio: z.string().max(280).optional(),
});

// 2. Setup form
const form = useForm({
  defaultValues: { name: "", bio: "" },
  resolver: zodResolver(schema),
  mode: "onChange",
});

// 3. Define transport (API call)
const transport = async (payload: any) => {
  await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: true };
};

// 4. Hook into autosave
const { isSaving, lastError } = useRhfAutosave({
  form,
  transport,
  debounceMs: 600,
  shouldSave: ({ isDirty }) => isDirty, // optional
});

export function ProfileForm() {
  return (
    <form>
      <input {...form.register("name")} placeholder="Name" />
      <textarea {...form.register("bio")} placeholder="Bio" />

      <div>
        {isSaving ? "Saving..." : "Idle"}
        {lastError && <span style={{ color: "red" }}>{lastError.message}</span>}
      </div>
    </form>
  );
}
```

---

## ⚙️ Advanced Features

### 🔑 Key Mapping (form → API)

Map form field names to API field names (with optional transforms):

```ts
keyMap: {
  age: ["age_years", Number],
  fullName: ["name", (val) => val.trim()],
  isSubscribed: ["subscribed_flag", (val) => (val ? 1 : 0)]
}
```

- `age: "30"` → API receives `{ age_years: 30 }` (cast to number)  
- `fullName: "  Alice Doe  "` → API receives `{ name: "Alice Doe" }` (trimmed)  
- `isSubscribed: true` → API receives `{ subscribed_flag: 1 }` (boolean → numeric)

---

### ➕➖ Diff Handling (arrays)

Handle many-to-many fields like `sectors` or `tags` with `onAdd` / `onRemove`:

```ts
diffMap: {
  tags: {
    idOf: (tag: { id: number }) => tag.id,
    onAdd: async (tag) => {
      await api.addTag({ tagId: tag.id });
    },
    onRemove: async (tag) => {
      await api.removeTag({ tagId: tag.id });
    },
  },
}
```

It triggers specific API calls.

---

### ✅ Validation Before Save

You can control when validation runs:

```ts
validateBeforeSave: "payload"; // validate only changed fields
validateBeforeSave: "all"; // validate the whole form
validateBeforeSave: "none"; // skip validation
```

---

# 📌 Roadmap for react-hook-form-autosave

## Core improvements
1. **Status tracking**
   - Expose `lastSavedAt`, `lastAttemptAt`, `lastErrorAt`, `inFlightSince`, and optionally `serverUpdatedAt`.
   - Provide a `useAutosaveStatus` hook for read-only consumption.

2. **Nested field support**
   - Support dot/bracket paths in `keyMap` (e.g. `profile.address.city`).
   - Allow wildcards for arrays (`items[*].title`, `items[*].tags[*].label`).
   - Generate minimal payloads with correct parent scaffolding.

3. **Nested diffing**
   - Add/remove/update detection for arrays-of-objects.
   - Identity matching via `id` or custom function.
   - Emit per-item “changed fields” diffs.

4. **Scoped validation**
   - Run validation only on the affected nested slice (e.g., one array item) instead of the entire form.

5. **Error lifecycle**
   - Add optional `errorClearMs` configuration to auto-clear `lastError` after N ms (default: off).
   - Always clear `lastError` when a new save attempt starts or a save succeeds.
   - Document accessibility considerations and debugging trade-offs.

---

## Advanced / future ideas
6. **Conflict handling**
   - Strategies for concurrent edits: API-driven overwrite vs merge.

7. **Persistence**
   - Optional `persistStatus` flag to store autosave state across reloads or sessions.

8. **DevTools integration**
   - A browser DevTools panel to visualize autosave lifecycle (in-flight, saved, errors, timestamps).


---

## 📜 License

MIT © [Ziad Ziadeh](https://github.com/ziadeh)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to open an [issue](https://github.com/ziadeh/react-hook-form-autosave/issues) or a pull request.
