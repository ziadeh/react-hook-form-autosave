# Testing Checklist - Nested Fields Demo

## 🚀 Quick Start

**Server is running at: http://localhost:3001**

Click the **"🎯 Nested Fields (NEW!)"** tab to see the demo.

---

## ✅ Test Scenarios

### 1. Basic Nested Field Editing

**Profile Section:**
- [ ] Edit `firstName` - Type "Jane" and wait 600ms
- [ ] Edit `lastName` - Type "Doe"
- [ ] Edit `email` - Type "jane@example.com"
- [ ] Edit `bio` - Type a longer bio

**Expected Console Output:**
```
🚀 TRANSPORT CALLED - Sending to API:
  profile: { firstName: "Jane", lastName: "Doe", ... }
  
🔄 Transformed payload for API:
  first_name: "Jane"
  last_name: "Doe"
  email_address: "jane@example.com"
  
✅ Extracted values: { firstName: "Jane", ... }
```

**Server Console Should Show:**
```
✨ Nested key transformation detected:
  Frontend: profile.firstName → Backend: first_name
```

---

### 2. Nested Address Fields

**Address Section:**
- [ ] Edit `street` - Type "456 Oak Ave"
- [ ] Edit `city` - Type "Los Angeles"
- [ ] Edit `state` - Type "CA"
- [ ] Edit `zipCode` - Type "90001"
- [ ] Edit `country` - Type "USA"

**Expected Console Output:**
```
🔄 Transformed payload for API:
  address: {
    street: "456 Oak Ave",
    city: "Los Angeles",
    postal_code: "90001"  // ← Note: zipCode → postal_code
  }
```

**Server Console Should Show:**
```
✨ Nested key transformation detected:
  Frontend: address.zipCode → Backend: address.postal_code
```

---

### 3. Social Links (Nested URLs)

**Social Links Section:**
- [ ] Edit `github` - Type "https://github.com/testuser"
- [ ] Edit `linkedin` - Type "https://linkedin.com/in/testuser"
- [ ] Try invalid URL - Should show validation error
- [ ] Clear a field - Should accept empty string

**Expected:**
- ✅ Valid URLs save successfully
- ✅ Invalid URLs show red error message
- ✅ Empty URLs are accepted (optional fields)

---

### 4. Settings (Nested Booleans)

**Settings Section:**
- [ ] Toggle `notifications` checkbox
- [ ] Toggle `newsletter` checkbox
- [ ] Change `theme` dropdown (light/dark/system)

**Expected Console Output:**
```
🚀 TRANSPORT CALLED:
  settings: {
    notifications: true,
    newsletter: false,
    theme: "dark"
  }
```

---

### 5. Team Members (Array of Nested Objects) 🎯

**This is the most important test - it shows array diffing in action!**

#### Test A: Add Team Member
- [ ] Click **"Add Team Member"** button
- [ ] Fill in:
  - Name: "Charlie Brown"
  - Role: "Product Manager"
  - Email: "charlie@example.com"
- [ ] Wait for autosave

**Expected Console Output:**
```
📋 Array fields detected: ["teamMembers", "skills", "hobbies"]

🔍 Array changes detected:
{
  teamMembers: {
    added: [
      { id: <timestamp>, name: "Charlie Brown", role: "Product Manager", ... }
    ],
    removed: [],
    modified: [],
    hasChanges: true
  }
}
```

**Expected Toast:**
```
ℹ️ teamMembers: +1 -0 ~0
```

#### Test B: Modify Team Member
- [ ] Change existing team member's name
- [ ] Change their role
- [ ] Wait for autosave

**Expected Console Output:**
```
🔍 Array changes detected:
{
  teamMembers: {
    added: [],
    removed: [],
    modified: [{
      before: { id: 1, name: "Alice Johnson", ... },
      after: { id: 1, name: "Alice Smith", ... },
      changes: { name: { before: "Alice Johnson", after: "Alice Smith" } }
    }],
    hasChanges: true
  }
}
```

**Expected Toast:**
```
ℹ️ teamMembers: +0 -0 ~1
```

#### Test C: Remove Team Member
- [ ] Click trash icon on a team member
- [ ] Wait for autosave

**Expected Console Output:**
```
🔍 Array changes detected:
{
  teamMembers: {
    added: [],
    removed: [{ id: 2, name: "Bob Williams", ... }],
    modified: [],
    hasChanges: true
  }
}
```

**Expected Toast:**
```
ℹ️ teamMembers: +0 -1 ~0
```

---

### 6. Undo/Redo with Nested Fields

- [ ] Make a change to `profile.firstName`
- [ ] Press `Cmd+Z` (Mac) or `Ctrl+Z` (Windows)
- [ ] Change should revert
- [ ] Press `Cmd+Shift+Z` for redo
- [ ] Change should come back

**Expected:**
- ✅ Undo restores previous nested value
- ✅ Redo applies the change again
- ✅ Works across all nested fields

---

### 7. Validation Errors

**Test Invalid Data:**
- [ ] Clear `profile.firstName` (required, min 2 chars)
- [ ] Type just "A" - Should show error
- [ ] Type "AB" - Error should clear
- [ ] Enter invalid email format
- [ ] Enter invalid URL in social links

**Expected:**
- ✅ Red error messages appear below fields
- ✅ Form does NOT autosave when invalid
- ✅ Console shows: `shouldSave: false` (invalid)
- ✅ Errors clear when fixed

---

### 8. Multiple Nested Changes at Once

**Rapid Fire Test:**
- [ ] Quickly change:
  1. `profile.firstName`
  2. `address.city`
  3. `settings.theme`
  4. Add a team member
- [ ] All changes should be debounced
- [ ] Single save should include all changes

**Expected Console Output:**
```
🚀 TRANSPORT CALLED - Sending to API:
{
  profile: { firstName: "Updated", ... },
  address: { city: "New City", ... },
  settings: { theme: "light" },
  teamMembers: [... new member ...]
}

📋 Array fields detected: ["teamMembers", ...]
🔍 Array changes detected: { teamMembers: { added: [...] } }
```

---

### 9. Path Extraction Demo

**Watch the Console:**
Every save shows:
```
✅ Extracted values: { firstName: "<value>", city: "<value>" }
```

This demonstrates `getByPath()` working on:
- `profile.firstName`
- `address.city`

**Try:**
- [ ] Change firstName - See it extracted
- [ ] Change city - See it extracted
- [ ] Both values appear in console

---

### 10. Key Mapping Verification

**Check Server Console:**
When you save, look for these transformation messages:

```
✨ Nested key transformation detected:
  Frontend: profile.firstName → Backend: first_name

✨ Nested key transformation detected:
  Frontend: profile.email → Backend: email_address

✨ Nested key transformation detected:
  Frontend: address.zipCode → Backend: address.postal_code
```

**Expected:**
- ✅ Transformations are logged
- ✅ Original form uses `firstName`, `email`, `zipCode`
- ✅ API receives `first_name`, `email_address`, `postal_code`

---

## 🎯 Success Criteria

### You've successfully tested nested fields when:

#### ✅ Nested Objects Work
- [x] Can edit profile.firstName, address.city, etc.
- [x] Changes autosave after 600ms
- [x] Validation works on nested fields
- [x] Undo/redo works on nested fields

#### ✅ Array Diffing Works
- [x] Adding team members shows `+1 -0 ~0`
- [x] Removing team members shows `+0 -1 ~0`
- [x] Modifying team members shows `+0 -0 ~1`
- [x] Toast notifications appear for changes

#### ✅ Key Mapping Works
- [x] Console shows transformed keys
- [x] Server receives mapped field names
- [x] Original form uses friendly names

#### ✅ Path Operations Work
- [x] `getByPath()` extracts values correctly
- [x] Nested paths are logged in console
- [x] No errors in browser console

#### ✅ All Autosave Features Work
- [x] Debouncing (600ms delay)
- [x] Validation before save
- [x] Undo/redo with nested fields
- [x] Metrics collection
- [x] Debug logging

---

## 🐛 Common Issues & Solutions

### Issue: "Property does not exist on type..."
**Solution:** The TypeScript types were updated for nested structure. Restart the dev server.

### Issue: Form not saving
**Solution:** 
1. Check browser console for validation errors
2. Ensure all required fields are filled
3. Look for red error messages

### Issue: Array changes not detected
**Solution:**
1. Ensure team members have unique IDs
2. Check console for `📋 Array fields detected`
3. Verify `findArrayFields()` is working

### Issue: Key mapping not showing
**Solution:**
1. Check server console (not browser)
2. Ensure fields are actually changing
3. Look for `✨ Nested key transformation detected`

---

## 📊 What to Look For

### Browser Console (Chrome DevTools)
- `🚀 TRANSPORT CALLED` - Shows payload
- `🔄 Transformed payload` - Shows mapped keys
- `📋 Array fields detected` - Lists arrays
- `🔍 Array changes detected` - Shows diff
- `✅ Extracted values` - Shows getByPath()

### Server Console (Terminal)
- `✨ Nested key transformation detected` - Key mapping
- `📦 Full update payload` - What server receives

### UI Elements
- ℹ️ Toast notifications for array changes
- ✅ Success toasts on save
- ❌ Error messages for validation
- 🔄 Saving indicator in header

---

## 🎉 Completion

Once you've checked all the boxes above, you've successfully verified that:

1. ✅ All nested field utilities work in production
2. ✅ Array diffing accurately tracks changes
3. ✅ Key mapping transforms fields correctly
4. ✅ Path operations extract values safely
5. ✅ All autosave features work with nested data

**Your nested fields implementation is PRODUCTION READY! 🚀**

---

## 📸 Take Screenshots

Capture these for documentation:
1. Nested form with all sections filled
2. Console showing array diff output
3. Server console showing key transformations
4. Toast notification for array change
5. DemoHeader showing metrics

---

## Next Steps

- Try the **"📋 Legacy Demo"** tab to compare
- Review the code in `NestedFormFields.tsx`
- Check `useFormData.tsx` for utility usage
- Read `NESTED_FIELDS_DEMO.md` for detailed explanations
- Explore the main docs at `docs/NESTED_FIELDS.md`
