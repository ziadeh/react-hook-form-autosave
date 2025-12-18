# Nested Fields Demo - Comprehensive T3 App

This example demonstrates the **full power** of nested field support in react-hook-form-autosave.

## 🎯 Features Demonstrated

### 1. Nested Object Fields
- `profile.firstName`, `profile.lastName`, `profile.email`
- `address.street`, `address.city`, `address.zipCode`
- `socialLinks.github`, `socialLinks.linkedin`
- `settings.notifications`, `settings.theme`

### 2. Array of Nested Objects
- `teamMembers[0].name`, `teamMembers[0].role`, `teamMembers[0].email`
- Auto-detection of array changes with `findArrayFields()`
- Intelligent diffing with `detectNestedArrayChanges()`

### 3. Nested Key Mapping
Transform nested form fields to match API structure:
```typescript
mapNestedKeys(formData, {
  'profile.firstName': 'first_name',
  'profile.lastName': 'last_name',
  'profile.email': 'email_address',
  'address.zipCode': 'address.postal_code',
  'socialLinks.github': 'github_url',
})
```

### 4. Safe Path Operations
```typescript
const firstName = getByPath(data, 'profile.firstName');
const city = getByPath(data, 'address.city');
const teamMemberName = getByPath(data, 'teamMembers[0].name');
```

## 🚀 Running the Demo

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Server
```bash
pnpm dev
```

### 3. Open Browser
Navigate to [http://localhost:3000](http://localhost:3000)

## 📝 What to Try

### Test Nested Fields
1. Switch to the **"Nested Fields (NEW!)"** tab
2. Fill in the Profile section (firstName, lastName, email, bio)
3. Watch the console for:
   - `🚀 TRANSPORT CALLED` - Shows original payload
   - `🔄 Transformed payload for API` - Shows mapped keys
   - `✅ Extracted values` - Shows getByPath() in action

### Test Array Changes
1. Add team members using the **"Add Team Member"** button
2. Fill in their details (name, role, email)
3. Watch the console for:
   - `📋 Array fields detected: ["teamMembers"]`
   - `🔍 Array changes detected` - Shows added/removed/modified
   - Toast notifications showing `+1 -0 ~0` (added, removed, modified)

### Test Key Mapping
1. Change profile fields
2. Check the server console for:
   ```
   ✨ Nested key transformation detected:
     Frontend: profile.firstName → Backend: first_name
   ```

### Test Nested Address
1. Fill in address fields (street, city, state, zipCode)
2. Notice how `zipCode` → `postal_code` transformation works

### Test Autosave Features
All standard autosave features work with nested fields:
- ⏱️ **Debounce** - 600ms delay before saving
- ↩️ **Undo/Redo** - Press Cmd/Ctrl+Z to undo
- ✅ **Validation** - Zod validation before save
- 📊 **Metrics** - View metrics in DemoHeader
- 🐛 **Debug Mode** - Console logging enabled

## 🔧 Code Structure

### Key Files

**Form Schema** - `src/types/formData.type.ts`
- Defines nested structure with Zod
- Profile, Address, SocialLinks, Settings schemas
- TeamMember schema for array of objects

**Hook with Nested Support** - `src/hooks/useFormData.tsx`
- Imports: `mapNestedKeys`, `detectNestedArrayChanges`, `findArrayFields`, `getByPath`
- Transport function demonstrates all utilities
- Auto-detection of array changes
- Transformation logging

**Nested Form Component** - `src/app/_components/autosave-demo/NestedFormFields.tsx`
- Profile section (nested object)
- Address section (nested object)
- Social Links section (nested URLs)
- Settings section (nested booleans)
- Team Members section (array of objects with useFieldArray)

**API Router** - `src/server/api/routers/sample.ts`
- Updated sample data with nested structure
- Logs key transformations
- Handles nested updates

## 📊 Console Output Example

When you change nested fields, you'll see:

```
🚀 TRANSPORT CALLED - Sending to API:
{
  profile: { firstName: "Jane", lastName: "Doe", ... },
  address: { city: "New York", ... },
  teamMembers: [...]
}

🔄 Transformed payload for API:
{
  first_name: "Jane",
  last_name: "Doe",
  email_address: "jane@example.com",
  address: { postal_code: "10001", ... }
}

📋 Array fields detected: ["teamMembers", "skills", "hobbies"]

🔍 Array changes detected:
{
  teamMembers: {
    added: [{ id: 3, name: "Charlie", ... }],
    removed: [],
    modified: [{ before: {...}, after: {...}, changes: {...} }],
    hasChanges: true
  }
}

✅ Extracted values: { firstName: "Jane", city: "New York" }
```

## 🎨 UI Features

- **Card-based layout** for each nested section
- **Code snippets** showing path notation (`profile.firstName`)
- **Tab navigation** to switch between nested and legacy demos
- **Real-time validation** with error messages
- **Array manipulation** with add/remove buttons
- **Toast notifications** for array changes

## 🧪 Testing Your Progress

### Verify Nested Field Support
1. ✅ Can you register nested fields? (`profile.firstName`)
2. ✅ Does autosave work on nested changes?
3. ✅ Are nested fields validated correctly?
4. ✅ Can you undo/redo nested changes?

### Verify Array Support
1. ✅ Can you add/remove array items?
2. ✅ Are array changes detected automatically?
3. ✅ Does autosave track array modifications?

### Verify Key Mapping
1. ✅ Are keys transformed in transport?
2. ✅ Is the transformation logged correctly?

### Verify Path Operations
1. ✅ Can you extract values with `getByPath`?
2. ✅ Are nested paths parsed correctly?

## 📚 Learn More

See the main documentation:
- [Nested Fields Guide](../../docs/NESTED_FIELDS.md)
- [API Reference](../../README.md)
- [Examples](../)

## 🐛 Troubleshooting

**Issue: Fields not saving**
- Check console for validation errors
- Ensure nested structure matches schema
- Verify transport function is called

**Issue: Key mapping not working**
- Check mapNestedKeys configuration
- Look for transformation logs in console
- Verify paths are correct

**Issue: Array changes not detected**
- Ensure items have unique `id` field
- Check `findArrayFields()` output
- Verify array is registered with useFieldArray

## 🎉 Success Indicators

You know nested fields are working when:
- ✅ You can edit `profile.firstName` and it autosaves
- ✅ Array changes show in console with `+1 -0 ~0` format
- ✅ Key transformations appear in server logs
- ✅ Undo/redo works on nested fields
- ✅ Toast notifications show array changes
