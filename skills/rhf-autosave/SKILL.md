---
name: rhf-autosave
description: Use when building forms with react-hook-form that need autosave, debounced saving, undo/redo, server hydration, or dirty-field diffing. Use when integrating react-hook-form-autosave into a project or troubleshooting autosave behavior.
trigger:
  - "useRhfAutosave"
  - "react-hook-form-autosave"
  - "autosave"
  - "fetchTransport"
  - "serverActionTransport"
  - "trpcTransport"
  - "useBeforeUnload"
files:
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "app/**/*.tsx"
  - "pages/**/*.tsx"
  - "components/**/*.tsx"
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

## Core Concepts

The library is built around three pillars: a pluggable **Transport** layer for saving, a **Validation** strategy that gates saves, and a **Baseline** tracker that diffs dirty fields against the last-known server state.

### Transport

A transport is `(payload, ctx?) => Promise<{ ok: true } | { ok: false, error: Error }>`.

| Transport | Use case |
|-----------|----------|
| `fetchTransport(url, opts?)` | REST API |
| `serverActionTransport(action, opts?)` | Next.js Server Actions |
| `trpcTransport(mutation)` | tRPC |

Custom transport:

```ts
const myTransport: Transport = async (payload) => {
  try {
    await myApi.save(payload);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
};
```

Wrap any transport with retry: `withRetry(transport, { maxRetries: 3, baseDelayMs: 1000 })`.

### Validation

Control via `validateBeforeSave`: `"payload"` (default, changed fields only), `"all"` (full form), or `"none"` (skip).

### Key Mapping & Payload Transform

```ts
// Rename keys (camelCase → snake_case)
keyMap: { fullName: "full_name" }

// Transform entire payload
mapPayload: (payload) => ({ data: payload, updatedAt: Date.now() })

// Select specific fields
selectPayload: (values, dirtyFields) => ({ name: values.name })
```

## Undo / Redo

```ts
const { undo, redo, canUndo, canRedo, undoLastSave } = useRhfAutosave({
  form,
  transport,
  undo: { enabled: true, hotkeys: true },
});
```

`undoLastSave()` reverts the most recent successfully saved payload.

## Server Hydration

Update form from server without triggering a save:

```ts
const { hydrateFromServer } = useRhfAutosave({ form, transport });
hydrateFromServer(newServerData);
```

`autoHydrate: true` (default) detects `form.reset()` calls and updates the baseline automatically.

## Diff Map (Array Diffing)

Calls discrete add/remove handlers for array fields instead of sending the whole array:

```ts
diffMap: {
  skills: {
    idOf: (item) => item.id,
    onAdd: async (item) => { await api.addSkill(item); },
    onRemove: async (item) => { await api.removeSkill(item.id); },
  },
}
```

## Status & Lifecycle

Returns: `isSaving`, `hasPendingChanges`, `lastError`, `flush()`, `forceSave()`, `abort()`.

Callbacks: `onStatusChange(status)` where state is `'idle' | 'saving' | 'saved' | 'error'`, and `onSaved(result, payload)`.

Prevent tab close: `useBeforeUnload(hasPendingChanges)`.

## Common Patterns

Recipes for the most frequent integration scenarios.

**shouldSave gate** — prevent saves conditionally:

```ts
shouldSave: ({ isDirty, isValid, values }) => isDirty && isValid && values.name.length > 0
```

**Server Action (Next.js):**

```ts
transport: serverActionTransport(saveProfile)
```

## Quick Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `form` | `UseFormReturn` | required | react-hook-form instance |
| `transport` | `Transport` | required | Save function |
| `config.debounceMs` | `number` | `600` | Debounce delay |
| `validateBeforeSave` | `"payload" \| "all" \| "none"` | `"payload"` | Validation strategy |
| `keyMap` | `Record<string, string>` | - | Rename payload keys |
| `mapPayload` | `(payload) => payload` | - | Transform payload |
| `selectPayload` | `(values, dirty) => Partial<T>` | - | Custom field selection |
| `shouldSave` | `(ctx) => boolean` | - | Gate saves |
| `diffMap` | `Record<string, DiffHandler>` | - | Array diffing |
| `undo` | `UndoOptions` | - | Undo/redo with history |
| `autoHydrate` | `boolean` | `true` | Auto-detect form.reset() |
| `onSaved` | `(result, payload) => void` | - | Post-save callback |
| `onStatusChange` | `(status) => void` | - | Status callback |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `mode: "onChange"` | Required on `useForm()` for dirty field tracking |
| Transport missing `{ ok }` return | Must return `{ ok: true }` or `{ ok: false, error }` |
| Double saves on `form.reset()` | Use `hydrateFromServer()` or `autoHydrate: true` |
| Undo not working | Set `undo: { enabled: true }` and `mode: "onChange"` |
| `keyMap` ignores nested keys | Use `mapPayload` for nested transforms |
