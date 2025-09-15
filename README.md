# react-hook-form-autosave

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
  jurisdiction_id: ["geo_entity_id", Number],
  regulatory_type: ["reg_type_id", Number],
}
```

Example:

- `jurisdiction_id: 5` → API receives `{ geo_entity_id: 5 }`
- `regulatory_type: "2"` → API receives `{ reg_type_id: 2 }` (cast to number)

---

### ➕➖ Diff Handling (arrays)

Handle many-to-many fields like `sectors` or `tags` with `onAdd` / `onRemove`:

```ts
diffMap: {
  sectors: {
    idOf: (x: { id: number }) => x.id,
    onAdd: async (item) => {
      await addSector({ regulatoryId: 123, tagId: item.id });
    },
    onRemove: async (item) => {
      await removeSector({ regulatoryId: 123, tagId: item.id });
    },
  },
}
```

This prevents sending the full array on every change — instead, it triggers specific API calls.

---

### ✅ Validation Before Save

You can control when validation runs:

```ts
validateBeforeSave: "payload"; // validate only changed fields
validateBeforeSave: "all"; // validate the whole form
validateBeforeSave: "none"; // skip validation
```

---

## 📚 API Reference

### `useRhfAutosave(options)`

Hook to enable autosave for your React Hook Form.

**Options:**

- `form` — RHF form instance (subset of `UseFormReturn`)
- `transport(payload)` — async save function, must return `{ ok: boolean, error?: Error }`
- `debounceMs` — debounce delay in ms
- `shouldSave(ctx)` — predicate to decide when to save
- `keyMap` — map form fields to API keys
- `mapPayload(payload)` — custom payload transform
- `validateBeforeSave` — `"none" | "payload" | "all"`
- `diffMap` — diff-based handlers for arrays
- `onSaved(res)` — callback after save success/failure

**Returns:**

- `isSaving: boolean` — true while saving
- `lastError: Error | null` — last error encountered
- `flush(): Promise<void>` — force save now
- `abort(): void` — cancel pending save
- `forceBaselineUpdate(): void` — reset diff baseline (after loading new data)

---

## 📜 License

MIT © [Ziad Ziadeh](https://github.com/ziadeh)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to open an [issue](https://github.com/ziadeh/react-hook-form-autosave.git/issues) or a pull request.
