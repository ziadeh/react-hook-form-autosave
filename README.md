# react-hook-form-autosave

[![npm version](https://img.shields.io/npm/v/react-hook-form-autosave.svg)](https://www.npmjs.com/package/react-hook-form-autosave)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-hook-form-autosave)](https://bundlephobia.com/package/react-hook-form-autosave)
[![license](https://img.shields.io/github/license/ziadeh/react-hook-form-autosave)](./LICENSE)

Advanced autosave utilities for [React Hook Form](https://react-hook-form.com/) with comprehensive features for building production-ready autosaving forms.

**Perfect for building autosaving forms in React, Next.js apps with tRPC, and complex enterprise applications.**

---

## ✨ Features

### 🚀 **Core Autosave**
- 🔄 **Automatic saving** as users type with intelligent debouncing
- ⏱️ **Configurable debounce** timing to optimize API calls
- 🎯 **Smart payload selection** - only save changed fields
- ✅ **Validation-aware** - only save when fields are valid
- 🚫 **Abort support** - cancel in-flight requests when needed

### 🏗️ **Advanced Architecture** 
- 🧩 **Modular design** with pluggable validation and transport strategies
- 📊 **Built-in metrics** collection for monitoring and debugging
- 🗄️ **Intelligent caching** system with TTL and size limits
- 🔄 **Retry mechanisms** with exponential backoff
- 🎭 **Multiple transport composition** (sequential or parallel)

### 🛠️ **Data Transformation**
- 🗝️ **Key mapping** - transform form field names to API field names
- 🔄 **Value transformations** - convert data types and formats
- ➕➖ **Diff-based operations** - handle array add/remove operations
- 🌳 **Nested data support** with deep change detection

### 🧪 **Developer Experience**
- 🐛 **Comprehensive debugging** with structured logging
- 📈 **Performance monitoring** with detailed metrics
- 🧪 **Testing utilities** and mocks included
- 📖 **TypeScript-first** with full type safety
- 🔍 **Runtime introspection** of configuration and state

---

## 📦 Installation

```bash
# With pnpm (recommended)
pnpm add react-hook-form-autosave

# With npm
npm install react-hook-form-autosave

# With yarn
yarn add react-hook-form-autosave
```

---

## 🚀 Quick Start

```tsx
import { useForm } from "react-hook-form";
import { useRhfAutosave } from "react-hook-form-autosave";

function MyForm() {
  const form = useForm({
    defaultValues: { name: "", email: "" },
    mode: "onChange",
  });

  const { isSaving, lastError } = useRhfAutosave({
    form,
    transport: async (payload) => {
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { ok: response.ok };
    },
    config: {
      debounceMs: 600,
      enableDebugLogs: true,
    },
  });

  return (
    <form>
      <input {...form.register("name")} placeholder="Name" />
      <input {...form.register("email")} placeholder="Email" />
      
      <div>
        Status: {isSaving ? "💾 Saving..." : "✅ Saved"}
        {lastError && <span style={{ color: "red" }}>❌ {lastError.message}</span>}
      </div>
    </form>
  );
}
```

---

## 📚 API Reference

### Hook Signature

```tsx
const autosave = useRhfAutosave<FormData>(options)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `form` | `UseFormReturn<T>` | **Required** | React Hook Form instance |
| `transport` | `Transport` | **Required** | Async function to save data |
| `config` | `Partial<AutosaveConfig>` | `{}` | Configuration object |
| `shouldSave` | `(ctx) => boolean` | `({ isDirty }) => isDirty` | Predicate for when to save |
| `selectPayload` | `(values, dirtyFields) => Partial<T>` | `pickChanged` | Extract payload from form |
| `keyMap` | `KeyMap` | `undefined` | Map form keys to API keys |
| `mapPayload` | `(payload) => any` | `undefined` | Final payload transformation |
| `validateBeforeSave` | `"none" \| "payload" \| "all"` | `"payload"` | Validation strategy |
| `diffMap` | `Record<string, DiffHandler>` | `undefined` | Array diff operations |
| `onSaved` | `(result, payload) => void` | `undefined` | Success/failure callback |
| `debug` | `boolean` | `false` | Enable debug logging |

### Configuration Object

```tsx
interface AutosaveConfig {
  debounceMs: number;        // Debounce delay (default: 600)
  maxRetries: number;        // Retry attempts (default: 3)
  enableMetrics: boolean;    // Collect metrics (default: false)
  enableCache: boolean;      // Enable caching (default: true)
  cacheSize: number;         // Cache size limit (default: 100)
  cacheTtlMs: number;        // Cache TTL (default: 5min)
  enableDebugLogs: boolean;  // Debug logging (default: false)
}
```

### Return Value

```tsx
interface AutosaveResult {
  // Status
  isSaving: boolean;
  lastError: Error | null;
  metrics: AutosaveMetrics;
  config: AutosaveConfig;

  // Actions
  flush: () => Promise<SaveResult>;
  abort: () => void;
  forceBaselineUpdate: () => void;

  // Introspection
  getBaseline: () => Record<string, any> | null;
  isBaselineInitialized: () => boolean;
  getMetrics: () => AutosaveMetrics;
  getCacheStats: () => CacheStats;
  getPendingChanges: () => SavePayload;
  isEmpty: () => boolean;
}
```

---

## 🎯 Advanced Examples

### 🔑 Key Mapping & Transformations

Transform form field names and values before sending to your API:

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  keyMap: {
    // Simple field name mapping
    fullName: "name",
    
    // With value transformation
    age: ["age_years", Number],
    
    // Complex transformation
    isSubscribed: ["subscription_status", (value) => value ? "active" : "inactive"],
  },
  // Additional payload transformation
  mapPayload: (payload) => ({
    ...payload,
    updated_at: new Date().toISOString(),
    version: "2.0",
  }),
});
```

### ➕➖ Array Diff Operations

Handle many-to-many relationships with targeted API calls:

```tsx
const { isSaving } = useRhfAutosave({
  form,
  transport,
  diffMap: {
    tags: {
      idOf: (tag) => tag.id,
      onAdd: async (tag) => {
        await api.addTag({ tagId: tag.id, entityId: currentId });
      },
      onRemove: async (tag) => {
        await api.removeTag({ tagId: tag.id, entityId: currentId });
      },
    },
    categories: {
      idOf: (cat) => cat.slug,
      onAdd: async (category) => {
        await api.assignCategory(category.slug);
      },
      onRemove: async (category) => {
        await api.unassignCategory(category.slug);
      },
    },
  },
});
```

### 🎛️ Advanced Configuration

```tsx
const { isSaving, config, getMetrics } = useRhfAutosave({
  form,
  transport,
  config: {
    debounceMs: 1000,
    maxRetries: 5,
    enableMetrics: true,
    enableCache: true,
    cacheSize: 200,
    cacheTtlMs: 10 * 60 * 1000, // 10 minutes
    enableDebugLogs: process.env.NODE_ENV === "development",
  },
  shouldSave: ({ isDirty, isValid, values }) => {
    // Custom save logic
    return isDirty && isValid && values.title?.length > 3;
  },
  validateBeforeSave: "payload", // Only validate changed fields
  onSaved: (result, payload) => {
    if (result.ok) {
      toast.success("Changes saved!");
      analytics.track("form_autosaved", { fields: Object.keys(payload) });
    } else {
      toast.error(`Save failed: ${result.error.message}`);
    }
  },
});

// Monitor performance
useEffect(() => {
  const metrics = getMetrics();
  console.log(`Success rate: ${metrics.successfulSaves / metrics.totalSaves * 100}%`);
}, [getMetrics]);
```

### 🔗 Transport Composition

Combine multiple save operations:

```tsx
import { composeTransports, parallelTransports, withRetry } from "react-hook-form-autosave";

// Sequential operations
const sequentialTransport = composeTransports(
  async (payload) => {
    await validatePayload(payload);
    return { ok: true };
  },
  async (payload) => {
    await saveToDatabase(payload);
    return { ok: true };
  },
  async (payload) => {
    await updateSearchIndex(payload);
    return { ok: true };
  }
);

// Parallel operations with retry
const parallelTransport = withRetry(
  parallelTransports(
    async (payload) => saveToDatabase(payload),
    async (payload) => saveToCache(payload),
    async (payload) => logAnalytics(payload)
  ),
  { maxRetries: 3, baseDelayMs: 1000 }
);

const { isSaving } = useRhfAutosave({
  form,
  transport: sequentialTransport, // or parallelTransport
});
```

### 🧪 Testing

```tsx
import { createMockTransport, createMockForm, MockTimer } from "react-hook-form-autosave";

describe("Autosave", () => {
  it("should debounce saves", async () => {
    const mockTimer = new MockTimer();
    const transport = createMockTransport([{ ok: true }]);
    const form = createMockForm({
      formState: { isDirty: true, isValid: true }
    });

    const { result } = renderHook(() =>
      useRhfAutosave({
        form,
        transport,
        config: { debounceMs: 500 }
      })
    );

    // Simulate rapid changes
    act(() => {
      form.setValue("name", "John");
      form.setValue("name", "John Doe");
    });

    // Fast-forward time
    act(() => {
      mockTimer.tick(500);
    });

    expect(transport.getCalls()).toHaveLength(1);
  });
});
```

---

## 🔧 Integration Guides

### 📡 tRPC Integration

```tsx
import { trpcTransport } from "react-hook-form-autosave";

function MyComponent() {
  const updateMutation = api.posts.update.useMutation();
  
  const { isSaving } = useRhfAutosave({
    form,
    transport: trpcTransport(updateMutation),
    config: { debounceMs: 800 }
  });
}
```

---

## 📊 Monitoring & Debugging

### 📈 Metrics Collection

```tsx
const { getMetrics, getCacheStats } = useRhfAutosave({
  form,
  transport,
  config: { enableMetrics: true }
});

// Monitor performance
useEffect(() => {
  const interval = setInterval(() => {
    const metrics = getMetrics();
    const cacheStats = getCacheStats();
    
    console.log({
      totalSaves: metrics.totalSaves,
      successRate: metrics.successfulSaves / metrics.totalSaves,
      averageSaveTime: metrics.averageSaveTime,
      cacheHitRate: cacheStats.validationCacheSize,
    });
  }, 30000);

  return () => clearInterval(interval);
}, [getMetrics, getCacheStats]);
```

### 🐛 Debug Mode

```tsx
const { config, getPendingChanges, isEmpty } = useRhfAutosave({
  form,
  transport,
  config: { enableDebugLogs: true }, // Enables detailed console logging
});

// Runtime debugging
const debugInfo = {
  config,
  hasPendingChanges: !isEmpty(),
  pendingChanges: getPendingChanges(),
};
```

---

## 🎯 Best Practices

### ⚡ Performance

```tsx
// ✅ Good: Reasonable debounce for user experience
config: { debounceMs: 600 }

// ❌ Bad: Too aggressive, may impact UX
config: { debounceMs: 100 }

// ✅ Good: Enable caching for repeated validations
config: { enableCache: true, cacheSize: 100 }

// ✅ Good: Only save valid, dirty forms
shouldSave: ({ isDirty, isValid }) => isDirty && isValid
```

### 🔒 Error Handling

```tsx
const { lastError, isSaving } = useRhfAutosave({
  form,
  transport,
  onSaved: (result, payload) => {
    if (!result.ok) {
      // Log error for debugging
      console.error("Autosave failed:", result.error, { payload });
      
      // Show user-friendly message
      toast.error("Failed to save changes. Please try again.");
      
      // Optional: Send to error tracking
      errorTracker.captureException(result.error, {
        context: "autosave",
        payload,
      });
    }
  },
});

// Display error state
if (lastError) {
  return <ErrorBoundary error={lastError} />;
}
```

### 🧹 Cleanup

```tsx
useEffect(() => {
  return () => {
    // Autosave automatically cleans up, but you can force it
    abort();
  };
}, [abort]);
```

---

## 🗺️ Roadmap

### ✅ Completed Features

- ✅ **Status tracking** (`lastSavedAt`, `lastErrorAt`, metrics)
- ✅ **Error lifecycle** (automatic error clearing)
- ✅ **Advanced caching** (validation and payload caching)
- ✅ **Enhanced transport system** (composition, retry, abort support)
- ✅ **Comprehensive testing utilities**
- ✅ **Production-ready architecture**

### 🚧 In Progress

- 🔄 **Nested field support** (dot notation paths, wildcards)
- 🔄 **Enhanced diffing** (nested object diff operations)
- 🔄 **Scoped validation** (validate specific nested slices)

### 🔮 Future Plans

#### **🎯 High Priority**
- ↶ **Undo/Redo System** 
  - Simple undo (revert to last saved state)
  - Advanced undo stack with granular history
  - Configurable history depth and retention
  - Smart conflict resolution on undo
  - Integration with diff operations for complex undos
  
- 📋 **Conflict handling** (concurrent edit resolution strategies)
- 💾 **Persistence** (cross-session state storage)
- 🛠️ **DevTools integration** (browser extension for debugging)
- 🌍 **Offline support** (queue operations when offline)
- 📱 **React Native support**

---

## 📄 License

MIT © [Ziad Ziadeh](https://github.com/ziadeh)

---

## 🙏 Acknowledgments

- Built with ❤️ for the React Hook Form community
- Inspired by modern form management needs

---

**Star ⭐ this repo if it helped you build better forms!**