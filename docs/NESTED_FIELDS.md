# Nested Fields Support

Comprehensive utilities for working with nested form fields and complex data structures.

## Features

- 🔍 **Path Utilities** - Parse, traverse, and manipulate field paths
- 🔄 **Nested Key Mapping** - Transform nested fields for API compatibility
- 📊 **Array Diffing** - Track changes in arrays of objects
- 🔀 **Deep Merging** - Safely merge and update nested structures

---

## 1. Field Path Utilities

Work with nested field paths using dot notation and bracket notation.

### Parsing Paths

```typescript
import { parsePath, joinPath } from 'react-hook-form-autosave';

// Parse path strings to segments
parsePath('user.profile.name');
// ['user', 'profile', 'name']

parsePath('users[0].name');
// ['users', 0, 'name']

parsePath('data.items[0].values[1]');
// ['data', 'items', 0, 'values', 1]

// Convert back to string
joinPath(['users', 0, 'name']);
// 'users[0].name'
```

### Getting and Setting Values

```typescript
import { getByPath, setByPath, deleteByPath, hasPath } from 'react-hook-form-autosave';

const formData = {
  user: {
    profile: {
      name: 'John',
      email: 'john@example.com'
    }
  },
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]
};

// Get nested values
getByPath(formData, 'user.profile.name');
// 'John'

getByPath(formData, 'users[0].name');
// 'Alice'

// Set nested values (creates intermediate objects)
const updated = {};
setByPath(updated, 'user.profile.email', 'new@example.com');
// { user: { profile: { email: 'new@example.com' } } }

// Check if path exists
hasPath(formData, 'user.profile.name'); // true
hasPath(formData, 'user.profile.age'); // false

// Delete values
deleteByPath(formData, 'user.profile.email'); // true
```

### Path Operations

```typescript
import { 
  getParentPath, 
  getFieldName, 
  isParentPath,
  getAllPaths 
} from 'react-hook-form-autosave';

// Get parent path
getParentPath('user.profile.name'); // 'user.profile'
getParentPath('users[0].name'); // 'users[0]'

// Get field name
getFieldName('user.profile.name'); // 'name'
getFieldName('users[0]'); // 0

// Check path relationships
isParentPath('user', 'user.profile.name'); // true
isParentPath('user.profile', 'user.email'); // false

// Get all paths in an object
getAllPaths({
  user: {
    name: 'John',
    tags: ['a', 'b']
  }
});
// ['user', 'user.name', 'user.tags', 'user.tags[0]', 'user.tags[1]']
```

---

## 2. Nested Key Mapping

Transform nested form fields to match your API structure.

### Basic Usage

```typescript
import { mapNestedKeys } from 'react-hook-form-autosave';

const formData = {
  user: {
    firstName: 'John',
    lastName: 'Doe',
    profile: {
      email: 'john@example.com'
    }
  }
};

const keyMap = {
  'user.firstName': 'user.first_name',
  'user.lastName': 'user.last_name',
  'user.profile.email': 'contact_email'
};

const apiData = mapNestedKeys(formData, keyMap);
// {
//   user: {
//     first_name: 'John',
//     last_name: 'Doe'
//   },
//   contact_email: 'john@example.com'
// }
```

### With Transformations

```typescript
const keyMap = {
  'user.name': ['userName', (v) => v.toUpperCase()],
  'user.age': ['userAge', (v) => parseInt(v, 10)],
  'settings.theme': {
    to: 'ui_theme',
    transform: (v) => v.toLowerCase()
  }
};

const result = mapNestedKeys(formData, keyMap);
```

### Flattening Nested Structures

```typescript
import { flattenObject, unflattenObject } from 'react-hook-form-autosave';

// Flatten nested object
const nested = {
  user: {
    profile: {
      name: 'John',
      email: 'john@example.com'
    }
  }
};

flattenObject(nested);
// {
//   'user.profile.name': 'John',
//   'user.profile.email': 'john@example.com'
// }

// Unflatten back
const flat = { 'user.name': 'John', 'user.age': 30 };
unflattenObject(flat);
// { user: { name: 'John', age: 30 } }
```

### Bi-directional Mapping

```typescript
import { reverseNestedKeyMap } from 'react-hook-form-autosave';

const formToApi = {
  'user.firstName': 'first_name',
  'user.lastName': 'last_name'
};

// Reverse for API to form mapping
const apiToForm = reverseNestedKeyMap(formToApi);
// { 'first_name': 'user.firstName', 'last_name': 'user.lastName' }

// Use both directions
const apiData = mapNestedKeys(formData, formToApi);
const formData2 = mapNestedKeys(apiData, apiToForm);
```

---

## 3. Nested Array Diffing

Track changes in arrays of objects with intelligent diffing.

### Basic Diffing

```typescript
import { diffArrays } from 'react-hook-form-autosave';

const oldUsers = [
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob', age: 30 }
];

const newUsers = [
  { id: 1, name: 'Alice', age: 26 }, // Modified
  { id: 3, name: 'Charlie', age: 35 } // Added
  // id: 2 (Bob) removed
];

const diff = diffArrays(oldUsers, newUsers);
// {
//   added: [{ id: 3, name: 'Charlie', age: 35 }],
//   removed: [{ id: 2, name: 'Bob', age: 30 }],
//   modified: [{
//     before: { id: 1, name: 'Alice', age: 25 },
//     after: { id: 1, name: 'Alice', age: 26 },
//     changes: { age: { before: 25, after: 26 } }
//   }],
//   hasChanges: true
// }
```

### Detect Changes in Nested Arrays

```typescript
import { detectNestedArrayChanges, findArrayFields } from 'react-hook-form-autosave';

const oldData = {
  users: [{ id: 1, name: 'Alice' }],
  settings: {
    tags: [{ id: 1, label: 'tag1' }]
  }
};

const newData = {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ],
  settings: {
    tags: [{ id: 2, label: 'tag2' }]
  }
};

// Auto-detect array fields
const arrayPaths = findArrayFields(oldData);
// ['users', 'settings.tags']

// Get diffs for all arrays
const diffs = detectNestedArrayChanges(oldData, newData, arrayPaths);
// {
//   'users': { added: [...], removed: [], modified: [] },
//   'settings.tags': { added: [...], removed: [...], modified: [] }
// }
```

### Apply Diffs

```typescript
import { applyArrayDiff } from 'react-hook-form-autosave';

const users = [{ id: 1, name: 'Alice' }];
const diff = {
  added: [{ id: 2, name: 'Bob' }],
  removed: [],
  modified: [],
  hasChanges: true
};

const updated = applyArrayDiff(users, diff);
// [
//   { id: 1, name: 'Alice' },
//   { id: 2, name: 'Bob' }
// ]
```

### Advanced Options

```typescript
const diff = diffArrays(oldArray, newArray, {
  identityKey: '_id', // Use custom ID field
  trackFieldChanges: true, // Track which fields changed
  trackOrder: true, // Detect reordering
  equalityFn: (a, b) => a.toLowerCase() === b.toLowerCase() // Custom comparison
});
```

---

## 4. Deep Merge & Update

Safely merge and update complex nested structures.

### Deep Merge

```typescript
import { deepMerge } from 'react-hook-form-autosave';

const serverData = {
  user: {
    id: 1,
    name: 'John',
    email: 'john@example.com',
    profile: {
      bio: 'Developer'
    }
  }
};

const clientUpdates = {
  user: {
    name: 'John Doe', // Update
    profile: {
      bio: 'Senior Developer' // Update nested
    }
  }
};

const merged = deepMerge(serverData, clientUpdates);
// {
//   user: {
//     id: 1, // Preserved
//     name: 'John Doe', // Updated
//     email: 'john@example.com', // Preserved
//     profile: {
//       bio: 'Senior Developer' // Updated
//     }
//   }
// }
```

### Array Merge Strategies

```typescript
// Replace arrays (default)
deepMerge(
  { items: [1, 2, 3] },
  { items: [4, 5] }
);
// { items: [4, 5] }

// Concat arrays
deepMerge(
  { items: [1, 2, 3] },
  { items: [4, 5] },
  { arrayMergeStrategy: 'concat' }
);
// { items: [1, 2, 3, 4, 5] }

// Merge arrays by ID
deepMerge(
  {
    users: [
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob', age: 30 }
    ]
  },
  {
    users: [
      { id: 1, age: 26 }, // Update Alice
      { id: 3, name: 'Charlie', age: 35 } // Add Charlie
    ]
  },
  { arrayMergeStrategy: 'merge' }
);
// {
//   users: [
//     { id: 1, name: 'Alice', age: 26 },
//     { id: 2, name: 'Bob', age: 30 },
//     { id: 3, name: 'Charlie', age: 35 }
//   ]
// }
```

### Path-Based Updates

```typescript
import { deepUpdate } from 'react-hook-form-autosave';

const formData = {
  user: {
    name: 'John',
    age: 30
  }
};

const updated = deepUpdate(formData, {
  'user.age': 31,
  'user.email': 'john@example.com',
  'settings.theme': 'dark'
});
// {
//   user: {
//     name: 'John',
//     age: 31,
//     email: 'john@example.com'
//   },
//   settings: {
//     theme: 'dark'
//   }
// }
```

### Computing Diffs

```typescript
import { getDiff, applyDiff } from 'react-hook-form-autosave';

const before = {
  user: { name: 'John', age: 30 }
};

const after = {
  user: { name: 'John', age: 31, email: 'john@example.com' }
};

// Compute diff
const diff = getDiff(before, after);
// {
//   'user.age': { old: 30, new: 31 },
//   'user.email': { old: undefined, new: 'john@example.com' }
// }

// Apply diff to original
const updated = applyDiff(before, diff);
// Same as 'after'
```

---

## Complete Example: Form with Nested Fields

```typescript
import { useForm } from 'react-hook-form';
import { 
  useRhfAutosave,
  mapNestedKeys,
  diffArrays,
  detectNestedArrayChanges
} from 'react-hook-form-autosave';

interface FormData {
  user: {
    firstName: string;
    lastName: string;
    profile: {
      bio: string;
      email: string;
    };
  };
  settings: {
    notifications: boolean;
    theme: string;
  };
  tags: Array<{
    id: number;
    label: string;
    color: string;
  }>;
}

function MyForm() {
  const form = useForm<FormData>({
    defaultValues: {
      user: {
        firstName: '',
        lastName: '',
        profile: {
          bio: '',
          email: ''
        }
      },
      settings: {
        notifications: true,
        theme: 'light'
      },
      tags: []
    }
  });

  // Configure autosave with nested field support
  const { isSaving, hasPendingChanges } = useRhfAutosave({
    form,
    transport: async (data) => {
      // Transform nested fields for API
      const apiData = mapNestedKeys(data, {
        'user.firstName': 'user.first_name',
        'user.lastName': 'user.last_name',
        'user.profile.email': 'contact_email',
        'settings.notifications': 'notify_enabled'
      });

      // Detect array changes
      const arrayChanges = detectNestedArrayChanges(
        form.getValues(),
        data,
        ['tags']
      );

      // Send to API
      return await fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify({
          ...apiData,
          arrayChanges
        })
      }).then(r => r.ok ? { ok: true } : { ok: false, error: new Error('Failed') });
    }
  });

  return (
    <form>
      {/* Nested field inputs */}
      <input {...form.register('user.firstName')} />
      <input {...form.register('user.lastName')} />
      <input {...form.register('user.profile.email')} />
      <textarea {...form.register('user.profile.bio')} />
      
      {/* Status */}
      {isSaving && <p>Saving...</p>}
      {hasPendingChanges && <p>You have unsaved changes</p>}
    </form>
  );
}
```

---

## API Reference

### Path Utilities

| Function | Description |
|----------|-------------|
| `parsePath(path)` | Parse path string to segments |
| `joinPath(segments)` | Convert segments to path string |
| `getByPath(obj, path)` | Get value at path |
| `setByPath(obj, path, value)` | Set value at path |
| `deleteByPath(obj, path)` | Delete value at path |
| `hasPath(obj, path)` | Check if path exists |
| `getParentPath(path)` | Get parent of path |
| `getFieldName(path)` | Get last segment of path |
| `isParentPath(parent, child)` | Check if path is parent |
| `getAllPaths(obj)` | Get all paths in object |
| `cloneAlongPath(obj, path)` | Clone objects along path |

### Nested Key Mapping

| Function | Description |
|----------|-------------|
| `mapNestedKeys(payload, keyMap, options?)` | Map nested keys with transformations |
| `createNestedKeyMapper(keyMap, options?)` | Create reusable mapper |
| `reverseNestedKeyMap(keyMap)` | Reverse mapping direction |
| `flattenObject(obj, separator?)` | Flatten to dot notation |
| `unflattenObject(obj, separator?)` | Unflatten from dot notation |
| `mergeNestedKeyMaps(...maps)` | Combine multiple key maps |
| `validateNestedKeyMap(keyMap)` | Check for conflicts |

### Array Diffing

| Function | Description |
|----------|-------------|
| `diffArrays(old, new, options?)` | Compute array diff |
| `applyArrayDiff(array, diff, identityKey?)` | Apply diff to array |
| `detectNestedArrayChanges(old, new, paths, options?)` | Detect changes in nested arrays |
| `findArrayFields(obj)` | Find all array fields |
| `summarizeArrayDiff(diff)` | Create human-readable summary |
| `mergeArrayDiffs(...diffs)` | Combine multiple diffs |

### Deep Merge

| Function | Description |
|----------|-------------|
| `deepMerge(target, source, options?)` | Deep merge objects |
| `deepUpdate(obj, updates)` | Update using path notation |
| `cloneDeep(obj)` | Deep clone object |
| `mergeAtPath(obj, path, updates, options?)` | Merge at specific path |
| `isDeepEqual(a, b)` | Deep equality check |
| `getDiff(old, new)` | Get changed paths |
| `applyDiff(obj, diff)` | Apply path-based changes |

---

## Best Practices

### 1. Use Path Utilities for Type Safety

```typescript
import { getByPath, setByPath } from 'react-hook-form-autosave';

// Instead of:
const email = formData?.user?.profile?.email;

// Use:
const email = getByPath(formData, 'user.profile.email');
```

### 2. Validate Key Maps

```typescript
import { validateNestedKeyMap } from 'react-hook-form-autosave';

const keyMap = {
  'user.name': 'userName',
  'user.email': 'userName' // Oops, duplicate!
};

const conflicts = validateNestedKeyMap(keyMap);
if (conflicts.length > 0) {
  console.error('Key map conflicts:', conflicts);
}
```

### 3. Combine with Autosave

```typescript
const { isSaving } = useRhfAutosave({
  form,
  transport: async (data) => {
    // Auto-detect array changes
    const arrayPaths = findArrayFields(data);
    const arrayDiffs = detectNestedArrayChanges(
      lastSavedData,
      data,
      arrayPaths
    );

    // Transform keys
    const apiData = mapNestedKeys(data, keyMap);

    // Send optimized payload
    return await api.update({
      ...apiData,
      _arrayChanges: arrayDiffs
    });
  }
});
```

### 4. Handle Partial Updates

```typescript
// Only send changed fields
const diff = getDiff(baseline, currentValues);
const changedPaths = Object.keys(diff);

if (changedPaths.length > 0) {
  const updates = {};
  changedPaths.forEach(path => {
    updates[path] = diff[path].new;
  });
  
  await savePartialUpdate(updates);
}
```

---

## Performance Considerations

- Path parsing is cached internally for repeated operations
- Array diffing is O(n) with Map-based lookups
- Deep cloning is optimized for common types
- Use `preserveUnmapped: false` for smaller payloads when possible

---

## TypeScript Support

All utilities are fully typed with generics:

```typescript
interface User {
  profile: {
    name: string;
    email: string;
  };
}

const name = getByPath<string>(user, 'profile.name'); // string
const users = getByPath<User[]>(data, 'users'); // User[]
```

---

## Migration Guide

If you're using the legacy `mapKeys` utility:

```typescript
// Before (flat keys only)
import { mapKeys } from 'react-hook-form-autosave';
const mapped = mapKeys(data, { firstName: 'first_name' });

// After (supports nested)
import { mapNestedKeys } from 'react-hook-form-autosave';
const mapped = mapNestedKeys(data, { 
  'user.firstName': 'user.first_name' 
});

// Or continue using mapKeys for flat structures (still supported)
```

---

## See Also

- [Main README](../README.md)
- [API Reference](./API_REFERENCE.md)
- [Examples](../examples/)
