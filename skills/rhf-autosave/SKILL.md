---
name: rhf-autosave
description: Use when building forms with react-hook-form that need autosave, debounced saving, undo/redo, server hydration, or dirty-field diffing. Use when integrating react-hook-form-autosave into a project or troubleshooting autosave behavior.
---

# react-hook-form-autosave

Drop-in autosave for react-hook-form. Watches dirty fields, debounces, validates, and sends only changed data via a pluggable transport layer.

```bash
npm install react-hook-form-autosave
```

Requires `react-hook-form >=7` and `react >=18` as peer dependencies.

## Minimal Setup

```tsx
import { useForm } from "react-hook-form";
import { useRhfAutosave, fetchTransport } from "react-hook-form-autosave";

const form = useForm({ defaultValues: { name: "", email: "" } });

const { isSaving, hasPendingChanges } = useRhfAutosave({
  form,
  transport: fetchTransport("/api/save", { method: "PATCH" }),
  config: { debounceMs: 600 },
});
```

That's it. Every dirty-field change is debounced and sent as a PATCH with only changed keys.

## Core Concepts

### Transport

A transport is a function: `(payload, ctx?) => Promise<{ ok: true } | { ok: false, error: Error }>`.

Three built-in transports:

| Transport | Use case | Example |
|-----------|----------|---------|
| `fetchTransport(url, opts?)` | REST API | `fetchTransport("/api/save", { method: "PATCH" })` |
| `serverActionTransport(action, opts?)` | Next.js Server Actions | `serverActionTransport(saveProfile)` |
| `trpcTransport(mutation)` | tRPC | `trpcTransport(trpc.profile.save)` |

Custom transport:

```ts
const myTransport: Transport = async (payload, ctx) => {
  try {
    await myApi.save(payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
};
```

### Retry

Wrap any transport with exponential backoff:

```ts
import { withRetry } from "react-hook-form-autosave";

const transport = withRetry(
  fetchTransport("/api/save"),
  { maxRetries: 3, baseDelayMs: 1000 }
);
```

### Validation Before Save

Control when validation runs via `validateBeforeSave`:

| Value | Behavior |
|-------|----------|
| `"payload"` (default) | Validate only changed fields before saving |
| `"all"` | Validate entire form before saving |
| `"none"` | Skip validation, always save |

### Key Mapping

Rename fields before they hit the transport (e.g., camelCase to snake_case):

```ts
useRhfAutosave({
  form,
  transport,
  keyMap: { fullName: "full_name", emailAddress: "email_address" },
});
// payload sent: { full_name: "...", email_address: "..." }
```

### Payload Transformation

For more control, use `mapPayload` to transform the entire payload:

```ts
useRhfAutosave({
  form,
  transport,
  mapPayload: (payload) => ({ data: payload, updatedAt: Date.now() }),
});
```

Or use `selectPayload` to control which fields are included:

```ts
useRhfAutosave({
  form,
  transport,
  selectPayload: (values, dirtyFields) => {
    // Only send specific fields
    return { name: values.name };
  },
});
```

## Diff Map (Array Diffing)

For array fields like tags or skills, `diffMap` calls discrete add/remove handlers instead of sending the whole array:

```ts
useRhfAutosave({
  form,
  transport,
  diffMap: {
    skills: {
      idOf: (item) => item.id,
      onAdd: async (item) => { await api.addSkill(item); },
      onRemove: async (item) => { await api.removeSkill(item.id); },
    },
  },
});
```

## Undo / Redo

Enable with the `undo` option. Keyboard shortcuts (Cmd/Ctrl+Z) are on by default:

```ts
const { undo, redo, canUndo, canRedo, undoLastSave } = useRhfAutosave({
  form,
  transport,
  undo: {
    enabled: true,
    hotkeys: true,           // Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z (default: true)
    captureInInputs: false,  // Don't intercept inside inputs (default: false)
    ignoreHistoryOps: false, // Auto-save after undo/redo (default: false)
  },
});
```

`undoLastSave()` reverts the most recent successfully saved payload.

## Server Hydration

When the server pushes new data (e.g., real-time sync), use `hydrateFromServer` to update the form without triggering a save:

```ts
const { hydrateFromServer } = useRhfAutosave({ form, transport });

// When server data arrives:
hydrateFromServer(newServerData);
```

Auto-hydration is on by default (`autoHydrate: true`). It detects when `form.reset()` is called with new data and automatically updates the baseline. Set `autoHydrate: false` to handle hydration manually.

## Status & Lifecycle

```ts
const {
  isSaving,          // boolean - save in flight
  hasPendingChanges, // boolean - unsaved dirty fields exist
  lastError,         // Error | null
  flush,             // () => Promise - force immediate save
  forceSave,         // () => Promise - same as flush
  abort,             // () => void - cancel in-flight save
} = useRhfAutosave({ form, transport });
```

### Status Change Callback

```ts
useRhfAutosave({
  form,
  transport,
  onStatusChange: (status) => {
    // status.state: 'idle' | 'saving' | 'saved' | 'error'
    if (status.state === "error") console.error(status.error);
  },
  onSaved: (result, payload) => {
    // Called after each successful save with the result and sent payload
  },
});
```

### Prevent Tab Close

```ts
import { useBeforeUnload } from "react-hook-form-autosave";

useBeforeUnload(hasPendingChanges);
```

## Quick Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `form` | `UseFormReturn` | required | react-hook-form instance |
| `transport` | `Transport` | required | Save function |
| `config.debounceMs` | `number` | `600` | Debounce delay in ms |
| `validateBeforeSave` | `"payload" \| "all" \| "none"` | `"payload"` | Validation strategy |
| `keyMap` | `Record<string, string>` | - | Rename keys in payload |
| `mapPayload` | `(payload) => payload` | - | Transform entire payload |
| `selectPayload` | `(values, dirtyFields) => Partial<T>` | - | Custom field selection |
| `shouldSave` | `(ctx) => boolean` | - | Gate saves on custom logic |
| `diffMap` | `Record<string, DiffHandler>` | - | Array field add/remove diffing |
| `undo` | `UndoOptions` | - | Enable undo/redo with history |
| `autoHydrate` | `boolean` | `true` | Auto-detect form.reset() as hydration |
| `onSaved` | `(result, payload) => void` | - | Callback after successful save |
| `onStatusChange` | `(status) => void` | - | Status transition callback |

## Common Patterns

### shouldSave Gate

Prevent saves when form is in a specific state:

```ts
shouldSave: ({ isDirty, isValid, values }) => {
  return isDirty && isValid && values.name.length > 0;
},
```

### Server Action (Next.js App Router)

```tsx
import { serverActionTransport } from "react-hook-form-autosave";
import { saveProfile } from "./actions";

useRhfAutosave({
  form,
  transport: serverActionTransport(saveProfile),
});
```

### Full Example with All Features

```tsx
const form = useForm({ defaultValues: initialData, mode: "onChange" });

const transport = withRetry(
  fetchTransport(`/api/profiles/${id}`, { method: "PATCH" }),
  { maxRetries: 2 }
);

const {
  isSaving, hasPendingChanges, lastError,
  undo, redo, canUndo, canRedo,
  hydrateFromServer, flush,
} = useRhfAutosave({
  form,
  transport,
  config: { debounceMs: 600 },
  validateBeforeSave: "payload",
  keyMap: { fullName: "full_name" },
  undo: { enabled: true },
  diffMap: {
    tags: { idOf: (t) => t.id, onAdd: addTag, onRemove: removeTag },
  },
  onStatusChange: (s) => {
    if (s.state === "error") toast.error(s.error.message);
    if (s.state === "saved") toast.success("Saved");
  },
});

useBeforeUnload(hasPendingChanges);
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Form not in `mode: "onChange"` | Set `mode: "onChange"` on `useForm()` so `dirtyFields` updates on every keystroke |
| Transport doesn't return `{ ok: true/false }` | Every transport must return a `SaveResult` object |
| Calling `form.reset()` and getting double saves | Use `hydrateFromServer()` instead, or set `autoHydrate: true` (default) |
| Undo not working | Ensure `undo: { enabled: true }` and form has `mode: "onChange"` |
| `keyMap` not applying | `keyMap` only renames top-level keys. For nested transforms use `mapPayload` |
