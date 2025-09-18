# react-hook-form-autosave

[![npm version](https://img.shields.io/npm/v/react-hook-form-autosave.svg)](https://www.npmjs.com/package/react-hook-form-autosave)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-hook-form-autosave)](https://bundlephobia.com/package/react-hook-form-autosave)
[![license](https://img.shields.io/github/license/ziadeh/react-hook-form-autosave)](./LICENSE)

**Effortless autosave for React Hook Form. Save user changes automatically as they type, with smart debouncing and validation.**

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport: (data) => fetch('/api/save', { method: 'POST', body: JSON.stringify(data) })
});
```

✅ **Zero configuration** - Works out of the box  
✅ **Smart debouncing** - Optimized API calls  
✅ **Validation aware** - Only saves valid data  
✅ **Production ready** - Error handling, retries, metrics  

---

## Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Why Choose This?](#-why-choose-this)
- [Basic Examples](#-basic-examples)
- [Common Patterns](#-common-patterns)
- [Advanced Features](#-advanced-features)
- [API Reference](#-api-reference)
- [Framework Integration](#-framework-integration)
- [Best Practices](#-best-practices)

---

## 📦 Installation

```bash
npm install react-hook-form-autosave
# or
pnpm add react-hook-form-autosave
# or  
yarn add react-hook-form-autosave
```

---

## 🚀 Quick Start

**Step 1:** Add the hook to your form

```tsx
import { useForm } from "react-hook-form";
import { useRhfAutosave } from "react-hook-form-autosave";

function MyForm() {
  const form = useForm({
    defaultValues: { name: "", email: "" }
  });

  const { isSaving } = useRhfAutosave({
    form,
    transport: async (data) => {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return { ok: response.ok };
    },
  });

  return (
    <form>
      <input {...form.register("name")} placeholder="Name" />
      <input {...form.register("email")} placeholder="Email" />
      <div>{isSaving ? "💾 Saving..." : "✅ Saved"}</div>
    </form>
  );
}
```

**That's it!** Your form now autosaves as users type.

---

## 💡 Why Choose This?

### The Problem
- Users lose work when browsers crash or accidentally navigate away
- Manual save buttons are easily forgotten  
- Building autosave from scratch is complex (debouncing, validation, error handling, etc.)

### The Solution
```tsx
// Without this library (complex)
const [saving, setSaving] = useState(false);
const debouncedSave = useMemo(() => debounce(async (data) => {
  setSaving(true);
  try {
    if (form.formState.isValid) {
      await saveData(data);
    }
  } catch (error) {
    // handle error...
  } finally {
    setSaving(false);
  }
}, 600), []);

useEffect(() => {
  if (form.formState.isDirty) {
    debouncedSave(form.getValues());
  }
}, [form.watch()]);

// With this library (simple)
const { isSaving } = useRhfAutosave({ form, transport: saveData });
```

### Key Benefits
- **🔄 Smart debouncing** - Reduces API calls while maintaining responsiveness
- **✅ Validation integration** - Only saves when data is valid
- **🚫 Automatic abort** - Cancels outdated requests
- **🔁 Built-in retry** - Handles network failures gracefully  
- **📊 Performance metrics** - Monitor save success rates and timing
- **🧪 TypeScript first** - Full type safety out of the box

---

## 🎯 Basic Examples

### Simple Status Display

```tsx
function MyForm() {
  const form = useForm({ defaultValues: { title: "" } });
  
  const { isSaving, lastError, hasPendingChanges } = useRhfAutosave({
    form,
    transport: async (data) => {
      await fetch("/api/save", { method: "POST", body: JSON.stringify(data) });
      return { ok: true };
    },
  });

  return (
    <form>
      <input {...form.register("title")} />
      
      {/* Status indicator */}
      <div>
        {isSaving && "💾 Saving..."}
        {!isSaving && hasPendingChanges && "✏️ Editing..."}
        {!isSaving && !hasPendingChanges && "✅ Saved"}
        {lastError && `❌ Error: ${lastError.message}`}
      </div>
    </form>
  );
}
```

### Custom Debounce Timing

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  config: {
    debounceMs: 1000, // Wait 1 second after user stops typing
    enableDebugLogs: true, // See what's happening in console
  }
});
```

### Only Save Valid Data

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  shouldSave: ({ isDirty, isValid }) => isDirty && isValid,
  validateBeforeSave: "payload", // Only validate changed fields
});
```

---

## 🔧 Common Patterns

### Manual Save Button

Sometimes you want both autosave AND a manual save button:

```tsx
function MyForm() {
  const form = useForm();
  const { isSaving, flush, hasPendingChanges } = useRhfAutosave({
    form,
    transport,
    config: { debounceMs: 2000 } // Auto-save after 2 seconds of inactivity
  });

  const handleManualSave = async () => {
    const result = await flush(); // Save immediately
    if (result.ok) {
      toast.success("Saved!");
    }
  };

  return (
    <form>
      <input {...form.register("title")} />
      
      <button 
        type="button" 
        onClick={handleManualSave}
        disabled={!hasPendingChanges || isSaving}
      >
        {isSaving ? "Saving..." : "Save Now"}
      </button>
    </form>
  );
}
```

### Form Submission Integration

Ensure all changes are saved before final submission:

```tsx
function MyForm() {
  const form = useForm();
  const { flush, hasPendingChanges } = useRhfAutosave({
    form,
    transport
  });

  const onSubmit = async (data) => {
    // Save any pending autosave changes first
    if (hasPendingChanges) {
      await flush();
    }
    
    // Then do final submission
    await submitForm(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register("title")} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Error Handling

```tsx
const { isSaving, lastError } = useRhfAutosave({
  form,
  transport,
  onSaved: (result, payload) => {
    if (result.ok) {
      toast.success("Changes saved!");
    } else {
      toast.error(`Save failed: ${result.error.message}`);
      // Log for debugging
      console.error("Autosave failed:", result.error, payload);
    }
  },
});

// Show persistent error state
if (lastError) {
  return <div className="error">Failed to save: {lastError.message}</div>;
}
```

---

## 🚀 Advanced Features

### Field Name Mapping

Transform form field names to match your API:

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  keyMap: {
    // Simple rename
    fullName: "name",
    
    // Rename + transform value
    age: ["age_years", Number],
    
    // Complex transformation  
    isActive: ["status", (value) => value ? "active" : "inactive"],
  },
});

// Form has: { fullName: "John", age: "25", isActive: true }
// API gets: { name: "John", age_years: 25, status: "active" }
```

### Array Operations

Handle many-to-many relationships with targeted API operations:

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport: async (payload) => {
    // Main entity update (tags/categories excluded automatically)
    return await api.updatePost(payload);
  },
  diffMap: {
    tags: {
      idOf: (tag) => tag.id,
      onAdd: async (tag) => {
        // Called for each newly added tag
        await api.addTagToPost(tag.id, postId);
      },
      onRemove: async (tag) => {
        // Called for each removed tag  
        await api.removeTagFromPost(tag.id, postId);
      },
    },
  },
});
```

### Multiple Transport Operations

Compose multiple save operations:

```tsx
import { composeTransports, parallelTransports } from "react-hook-form-autosave";

// Sequential operations
const transport = composeTransports(
  async (data) => {
    await validateData(data);
    return { ok: true };
  },
  async (data) => {
    await saveToDatabase(data);
    return { ok: true };
  },
  async (data) => {
    await updateSearchIndex(data);
    return { ok: true };
  }
);

// Or parallel operations
const parallelTransport = parallelTransports(
  async (data) => saveToDatabase(data),
  async (data) => saveToCache(data),  
  async (data) => logAnalytics(data)
);

const { isSaving } = useRhfAutosave({
  form,
  transport, // or parallelTransport
});
```

### Performance Monitoring

```tsx
const { getMetrics } = useRhfAutosave({
  form,
  transport,
  config: { 
    enableMetrics: true,
    enableDebugLogs: process.env.NODE_ENV === "development"
  }
});

// Monitor performance
useEffect(() => {
  const interval = setInterval(() => {
    const metrics = getMetrics();
    console.log({
      successRate: (metrics.successfulSaves / metrics.totalSaves * 100).toFixed(1) + '%',
      avgSaveTime: metrics.averageSaveTime + 'ms',
      totalSaves: metrics.totalSaves
    });
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

---

## 📚 API Reference

### Hook Signature

```tsx
const result = useRhfAutosave<FormData>(options)
```

### Core Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `form` | `UseFormReturn<T>` | ✅ | React Hook Form instance |
| `transport` | `(data) => Promise<{ok: boolean}>` | ✅ | Function to save data |

### Configuration Options

```tsx
interface AutosaveConfig {
  debounceMs?: number;        // Delay before saving (default: 600)
  maxRetries?: number;        // Retry attempts (default: 3)
  enableMetrics?: boolean;    // Collect performance data (default: false)
  enableCache?: boolean;      // Cache validation results (default: true)
  enableDebugLogs?: boolean;  // Console logging (default: false)
}

const { isSaving } = useRhfAutosave({
  form,
  transport,
  config: {
    debounceMs: 1000,
    enableDebugLogs: true
  }
});
```

### Advanced Options

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  
  // When to save
  shouldSave: ({ isDirty, isValid, values }) => isDirty && isValid,
  
  // What to save  
  selectPayload: (values, dirtyFields) => pickChanged(values, dirtyFields),
  
  // Transform data
  keyMap: { fullName: "name" },
  mapPayload: (payload) => ({ ...payload, updatedAt: new Date() }),
  
  // Validation
  validateBeforeSave: "payload", // "none" | "payload" | "all"
  
  // Array operations
  diffMap: {
    tags: {
      idOf: (tag) => tag.id,
      onAdd: async (tag) => { /* add logic */ },
      onRemove: async (tag) => { /* remove logic */ }
    }
  },
  
  // Callbacks
  onSaved: (result, payload) => {
    if (result.ok) console.log("Saved:", payload);
  },
});
```

### Return Value

```tsx
interface AutosaveResult {
  // Status
  isSaving: boolean;                    // Currently saving
  lastError: Error | null;              // Last error that occurred
  hasPendingChanges: boolean;           // Unsaved changes exist
  
  // Actions
  flush: () => Promise<SaveResult>;     // Save immediately
  abort: () => void;                    // Cancel pending saves
  forceSave: () => Promise<SaveResult>; // Save even without changes
  
  // Metrics & Debug
  getMetrics: () => AutosaveMetrics;
  getPendingChanges: () => any;         // See what will be saved
  isEmpty: () => boolean;               // No pending changes
}
```

### Transport Function

Your transport function should return a result object:

```tsx
// Simple success/failure
const transport = async (data) => {
  try {
    await fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
};

// With additional data
const transport = async (data) => {
  const response = await api.save(data);
  return { 
    ok: response.success, 
    error: response.error,
    data: response.savedData 
  };
};
```

---

## 🔗 Framework Integration

### Next.js + tRPC

```tsx
import { api } from "~/utils/api";

function MyForm() {
  const form = useForm();
  const updateMutation = api.posts.update.useMutation();
  
  const { isSaving } = useRhfAutosave({
    form,
    transport: async (data) => {
      try {
        await updateMutation.mutateAsync({ id: postId, ...data });
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },
  });

  // ... rest of component
}
```

### Remix

```tsx
import { useFetcher } from "@remix-run/react";

function MyForm() {
  const form = useForm();
  const fetcher = useFetcher();
  
  const { isSaving } = useRhfAutosave({
    form,
    transport: async (data) => {
      fetcher.submit(data, { method: "POST", encType: "application/json" });
      return { ok: true }; // Remix handles the actual request
    },
  });

  // ... rest of component  
}
```

### React Query

```tsx
import { useMutation } from "@tanstack/react-query";

function MyForm() {
  const form = useForm();
  const saveMutation = useMutation({
    mutationFn: (data) => fetch('/api/save', { method: 'POST', body: JSON.stringify(data) })
  });
  
  const { isSaving } = useRhfAutosave({
    form,
    transport: async (data) => {
      try {
        await saveMutation.mutateAsync(data);
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },
  });
}
```

---

## 🎯 Best Practices

### ⚡ Performance

```tsx
// ✅ Good: Reasonable debounce timing
config: { debounceMs: 600 } // 600ms is a good balance

// ❌ Bad: Too fast, hammers your API
config: { debounceMs: 100 }

// ❌ Bad: Too slow, users lose more work on crash  
config: { debounceMs: 5000 }

// ✅ Good: Only save when it makes sense
shouldSave: ({ isDirty, isValid }) => isDirty && isValid

// ✅ Good: Enable caching for better performance  
config: { enableCache: true }
```

### 🔒 Error Handling

```tsx
// ✅ Good: Handle errors gracefully
const transport = async (data) => {
  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }
    
    return { ok: true };
  } catch (error) {
    // Log for debugging but don't throw
    console.error('Autosave transport error:', error);
    return { ok: false, error };
  }
};

// ✅ Good: Show user-friendly error messages
const { lastError } = useRhfAutosave({
  form,
  transport,
  onSaved: (result) => {
    if (!result.ok) {
      toast.error('Failed to save changes. They will retry automatically.');
    }
  }
});
```

### 🧹 Memory Management

```tsx
// ✅ Good: The hook automatically cleans up
// No manual cleanup needed in most cases

// ✅ Good: For complex cases, you can force cleanup
const { abort } = useRhfAutosave({ form, transport });

useEffect(() => {
  return () => {
    // Only needed if you're unmounting while saves are pending
    abort();
  };
}, [abort]);
```

### 🧪 Testing

```tsx
import { act, renderHook } from '@testing-library/react';
import { useRhfAutosave } from 'react-hook-form-autosave';

test('should autosave after debounce period', async () => {
  const mockTransport = jest.fn(() => Promise.resolve({ ok: true }));
  const mockForm = {
    formState: { isDirty: true, isValid: true },
    getValues: () => ({ name: 'John' }),
    watch: () => ({ name: 'John' })
  };

  const { result } = renderHook(() =>
    useRhfAutosave({
      form: mockForm,
      transport: mockTransport,
      config: { debounceMs: 100 }
    })
  );

  // Wait for debounce
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 150));
  });

  expect(mockTransport).toHaveBeenCalledWith({ name: 'John' });
});
```

---

## 🙋‍♀️ FAQ

<details>
<summary><strong>How do I prevent saving invalid data?</strong></summary>

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  shouldSave: ({ isDirty, isValid }) => isDirty && isValid,
  validateBeforeSave: "payload" // Only validate changed fields
});
```
</details>

<details>
<summary><strong>Can I save only specific fields?</strong></summary>

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  selectPayload: (values, dirtyFields) => {
    // Only save name and email fields
    return { name: values.name, email: values.email };
  }
});
```
</details>

<details>
<summary><strong>How do I handle slow networks?</strong></summary>

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  config: {
    debounceMs: 1000,    // Wait longer before saving
    maxRetries: 5,       // More retry attempts
  }
});
```
</details>

<details>
<summary><strong>Can I use this with server components?</strong></summary>

This is a client-side hook that requires React Hook Form, so it needs to be used in client components. However, the transport function can call server actions:

```tsx
'use client';

import { useRhfAutosave } from 'react-hook-form-autosave';
import { saveFormData } from './actions'; // Server action

const { isSaving } = useRhfAutosave({
  form,
  transport: async (data) => {
    try {
      await saveFormData(data);
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }
});
```
</details>

---

## 📄 License

MIT © [Ziad Ziadeh](https://github.com/ziadeh)

---

**⭐ Star this repo if it saved you time building forms!**