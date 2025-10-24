# Changelog

All notable changes to **react-hook-form-autosave** will be documented here.

## [3.0.3] - 2024-10-24

### Fixed

#### Undo/Redo & Optimistic Updates

- **Fixed false positive pending changes detection**: Resolved issue where `hasPendingChanges` would incorrectly return `true` even when form values matched the last saved state. The hook now maintains a `lastSavedStateRef` to accurately track successfully saved values independently of React Hook Form's dirty state.

- **Fixed form dirty state persistence after save**: Corrected behavior where form would remain marked as dirty after successful save operations. The system now properly resets form state while preserving values and handling partial save failures in diffMap operations.

- **Fixed baseline desynchronization during hydration**: Resolved issue where baseline and last saved state could become out of sync during form hydration. Both states are now updated atomically during auto-hydration and manual hydration operations.

- **Fixed undo/redo not updating saved state**: Corrected behavior where undo/redo operations wouldn't update the last saved state, causing incorrect pending change detection. History operations now properly update both baseline and saved state tracking.

### Enhanced

#### State Management

- **Enhanced auto-hydration detection**: Improved automatic detection of form hydration events by analyzing form state transitions (dirty → clean, values changed, no errors). The system now automatically updates baseline and saved state when hydration is detected.

- **Added last saved state tracking**: Introduced `updateLastSavedState` function throughout the autosave pipeline to maintain accurate record of successfully persisted values, enabling more reliable pending change detection.

- **Improved pending change computation**: Enhanced `computeHasPendingChanges` logic with multiple layers of validation:
  - Active debounce timer detection
  - React-layer pending payload check
  - Manager-level pending changes
  - History operation status
  - Comparison with last saved state
  - Baseline equality check

#### Undo/Redo System

- **Added checkpoint system**: Implemented `markCheckpoint()` and `undoToLastCheckpoint()` methods in `InternalUndoManager` to support undoing to the last saved state, enabling "undo all unsaved changes" functionality.

- **Improved history stack management**: Enhanced undo/redo stack to properly handle checkpoints and prevent accidental clearing of redo stack during save operations. The future stack is now only cleared when users make new changes, not during programmatic state updates.

- **Better suppression of history recording**: Refined the `suppressRecordRef` mechanism to prevent recording changes that originate from undo/redo/hydrate operations, avoiding infinite loops and duplicate history entries.

#### Transport & Save Pipeline

- **Enhanced composed transport error handling**: Improved error handling in `createComposedTransport` to:
  - Track successful vs failed diffMap operations separately
  - Provide detailed error messages for partial save failures
  - Maintain dirty state for failed fields while clearing successful ones
  - Update baseline only with successfully saved data

- **Coordinated state updates on successful save**: After successful saves, the system now atomically:
  1. Updates the baseline with saved payload
  2. Updates last saved state with current form values
  3. Resets form dirty state
  4. Marks undo checkpoint
  5. Clears operation tracking flags

#### Hydration

- **Manual hydration support**: Added `hydrateFromServer()` method that allows manual form hydration with proper state management, including baseline updates, saved state tracking, and history clearing.

- **Auto-hydration opt-out**: Added `autoHydrate` option (default: `true`) to allow users to disable automatic hydration detection when they want full control over hydration timing.

### Internal Improvements

- **Unified state update pattern**: Established consistent pattern where `updateBaseline` and `updateLastSavedState` are called together throughout the codebase to prevent state desynchronization.

- **Enhanced debug logging**: Added comprehensive debug logging across all state transitions for easier troubleshooting of undo/redo and save operations.

- **Better TypeScript types**: Added `UndoRedoHookParams` interface to explicitly type the baseline and saved state update functions passed to the undo hook.

## [3.0.2] - 2024-09-23

### Changed
- Documentation polish in README intro section.

## [3.0.1] - 2024-09-23

### Fixed
- **undoLastSave**: Corrected checkpoint handling so that calling `undoLastSave` now reliably reverts all changes made since the last successful save.

## [3.0.0] - 2024-09-23

### 🎉 Major Release - Undo/Redo Support & Perfect State Synchronization

This release introduces powerful undo/redo capabilities and fixes all state tracking issues that have plagued autosave implementations.

### ⭐ Headline Features

#### Full Undo/Redo Support
- **NEW**: Complete undo/redo system with keyboard shortcuts
  - Automatic keyboard shortcuts: `Cmd/Ctrl+Z` for undo, `Shift+Cmd/Ctrl+Z` for redo
  - Programmatic API: `undo()`, `redo()`, `canUndo`, `canRedo`
  - Smart integration with autosave - only saves when needed after undo/redo
  - `undoLastSave()` - Revert all changes since the last successful save
  - Configurable via `undo: { enabled: true }` option
  - Optional: Disable keyboard shortcuts or customize target element
  - Works seamlessly with all field types including arrays

#### Perfect State Synchronization
- **FIXED**: `hasPendingChanges` now always returns the correct value
  - Accurately tracks unsaved changes in all scenarios
  - Properly syncs when data loads from API
  - Correctly handles array field saves via `diffMap`
  - Maintains accuracy through undo/redo operations

#### Auto-Hydration
- **NEW**: Automatic form synchronization when server data loads
  - Detects when form is reset with new data from API
  - Updates baseline and saved state automatically
  - Prevents false "unsaved changes" after data loads
  - Zero configuration required (enabled by default)
  - Can be disabled with `autoHydrate: false`

### 🔄 Breaking Changes

#### Configuration Restructure
- **MOVED**: Debug flag relocated to config object for consistency
  ```typescript
  // Before (v2.x)
  useRhfAutosave({ form, transport, debug: true });
  
  // After (v3.x)
  useRhfAutosave({ form, transport, config: { debug: true } });
  ```

#### Debug Behavior
- **CHANGED**: Debug logging now defaults to `false` (previously auto-detected)
  - Must explicitly enable with `config: { debug: true }`
  - No automatic enabling in development mode
  - Prevents accidental sensitive data exposure in production

### 🐛 Critical Bug Fixes

#### State Tracking Issues
- **FIXED**: `hasPendingChanges` always returning `true` (#43)
  - Introduced internal `lastSavedState` tracking
  - Properly compares current state with last successful save
  - Correctly handles server data hydration

- **FIXED**: Array fields remaining dirty after successful save (#45)
  - Form now properly resets dirty state for `diffMap` fields
  - Arrays handled via `diffMap` are correctly marked as clean

- **FIXED**: Form state out of sync after API data loads (#44)
  - Auto-hydration detects and syncs server data
  - Baseline updates when data loads
  - Eliminates false positives in pending state

#### Technical Issues
- **FIXED**: Manager initialization circular dependency error
- **FIXED**: `flush()` not working correctly
- **FIXED**: Undo/redo stack corruption when reaching boundaries

### 🔧 Improvements

#### Enhanced Developer Experience
- **NEW**: `hydrateFromServer(data)` method for manual sync control
- **NEW**: Comprehensive debug logging with namespaces
- **IMPROVED**: Better TypeScript types throughout
- **SIMPLIFIED**: Single `debug` configuration flag

#### Performance Optimizations
- **OPTIMIZED**: Reduced unnecessary re-renders
- **IMPROVED**: More efficient state comparisons
- **ENHANCED**: Better debounce handling for complex operations

#### Reliability
- **IMPROVED**: More robust error handling
- **ENHANCED**: Better cleanup on unmount
- **FIXED**: Race conditions in concurrent operations

### 📝 Documentation
- Complete rewrite with undo/redo examples
- New section on state synchronization
- Comprehensive migration guide from v2 to v3
- Better troubleshooting guides
- Interactive examples for common patterns

### 🎯 What This Means For You

**If you're upgrading from v2.x:**
1. Move `debug` into the config object
2. Enjoy automatic undo/redo support
3. No more `hasPendingChanges` issues
4. Better array field handling out of the box

**If you're new to the library:**
- Get professional undo/redo UX with zero effort
- Never worry about state synchronization
- Reliable autosave that just works

## [2.2.0] - 2025-09-20
- Removed `zod` dependency

## [2.1.1] - 2025-09-19

### Fixed
- **types**: Added missing `hasPendingChanges?: boolean` property to `RhfAutosaveOptions` interface

## [2.1.1] - 2025-09-19

### Fixed

- **types**: Added missing `hasPendingChanges?: boolean` property to `RhfAutosaveOptions` interface

## [2.1.0] - 2025-09-19

### Fixed

- **autosave**: Fixed multiple critical issues with debouncing and diff operations

  - Fixed "Request aborted" errors when using diffMap with higher debounce times
  - Fixed immediate flush in queueChange that was bypassing debounce
  - Improved abort controller lifecycle management to prevent race conditions
  - Enhanced error handling to properly distinguish between user aborts and failures
  - Fixed retry logic to respect abort signals

- **diffMap**: Fixed fields handled by diffMap being incorrectly included in main transport

  - Fields with diff handlers are now properly excluded from the main payload
  - Diff operations (onAdd/onRemove) are executed separately as intended
  - Prevents timeout errors when diff fields have different endpoints

- **Pending state tracking**: Fixed `isEmpty()` and `getPendingChanges()` always returning empty
  - Now properly tracks pending changes during debounce period
  - `flush()` now properly includes pending changes
  - `forceSave()` now returns a Promise for consistency

### Added

- **hasPendingChanges**: New boolean property for checking if there are unsaved changes

### Improved

- Better documentation for diffMap behavior

## [2.0.1] - 2025-09-18

### Fixed

- **autosave**: Fixed multiple network requests being sent during typing
  - Now batches all keystrokes into single request after debounce period

## [2.0.0] - 2025-09-18

### 🚀 Major Release - Complete Architecture Overhaul

This release represents a complete rewrite of the library with significant breaking changes and new features.

### ✨ New Features

#### Core Architecture

- **NEW**: Complete modular architecture with pluggable strategies
- **NEW**: `AutosaveManager` class for robust lifecycle management
- **NEW**: State management with reducer pattern (`autosaveReducer`)
- **NEW**: Configuration system with Zod schema validation (`AutosaveConfig`)

#### Advanced Configuration

- **NEW**: `config` object support with comprehensive options
- **NEW**: Configurable debouncing, retry logic, and caching
- **NEW**: `enableMetrics`, `enableCache`, `maxRetries`, `cacheTtlMs` options
- **NEW**: Environment-based debug logging control

#### Caching System

- **NEW**: `ValidationCache` - intelligent caching of validation results
- **NEW**: `PayloadCache` - caching with TTL and hit tracking
- **NEW**: Cache statistics and monitoring (`getCacheStats()`)

#### Transport Enhancements

- **NEW**: Transport composition with `composeTransports()` and `parallelTransports()`
- **NEW**: Automatic retry with exponential backoff (`withRetry()`)
- **NEW**: Full `AbortSignal` support for request cancellation
- **NEW**: Out-of-order request protection

#### Validation System

- **NEW**: Pluggable validation strategies (`NoValidationStrategy`, `PayloadValidationStrategy`, `AllFieldsValidationStrategy`)
- **NEW**: Cached validation results to avoid redundant checks
- **NEW**: Type-safe validation with proper React Hook Form integration

#### Metrics & Monitoring

- **NEW**: `MetricsCollector` class for comprehensive performance tracking
- **NEW**: Success rates, average save times, cache hit rates
- **NEW**: `getMetrics()` method for runtime monitoring

#### Developer Experience

- **NEW**: Comprehensive testing utilities (`createMockTransport`, `createMockForm`, `MockTimer`)
- **NEW**: Enhanced debugging with structured logging
- **NEW**: Runtime introspection methods (`getPendingChanges`, `isEmpty`, `getBaseline`)
- **NEW**: Configuration exposure in return object (`config`)

#### Error Handling

- **NEW**: Custom error types (`AutosaveError`, `TransportError`, `ValidationError`, `DiffError`)
- **NEW**: Automatic error clearing on successful saves
- **NEW**: Enhanced error propagation with metadata

### 🔄 API Changes

#### Breaking Changes

- **BREAKING**: `useRhfAutosave` now accepts `config` object instead of individual properties
- **BREAKING**: Enhanced `FormSubset` interface with proper React Hook Form typing
- **BREAKING**: Transport function signature updated with `SaveContext`
- **BREAKING**: Return object structure expanded with new methods

#### New Methods

- `getMetrics()` - Get performance metrics
- `getCacheStats()` - Get cache statistics
- `getPendingChanges()` - Get queued changes
- `isEmpty()` - Check if manager has pending work
- `getBaseline()` - Get current baseline state
- `isBaselineInitialized()` - Check baseline status

#### Enhanced Options

```typescript
// Old (still supported for backward compatibility)
useRhfAutosave({ debounceMs: 600, debug: true });

// New (recommended)
useRhfAutosave({
  config: {
    debounceMs: 600,
    enableDebugLogs: true,
    enableMetrics: true,
    maxRetries: 3,
  },
});
```

### 🐛 Bug Fixes

- Fixed debounce timing issues with rapid form changes
- Fixed baseline initialization race conditions
- Fixed validation strategy selection and caching

### 🔧 Improvements

- **Performance**: Significantly improved memory usage and performance
- **TypeScript**: Full type safety with strict typing throughout
- **Testing**: 100% test coverage with comprehensive test utilities
- **Debugging**: Enhanced logging and error messages

## [1.0.3] - 2025-09-17

- Added **Roadmap** section to README:
  - Status tracking (`lastSavedAt`, `lastErrorAt`, etc.)
  - Nested field support
  - Nested diffing
  - Scoped validation
  - Error lifecycle (`errorClearMs` option)
  - Conflict handling
  - Persistence (`persistStatus` flag)
  - DevTools integration

## [1.0.2] - 2025-09-17

- docs: expand README with more detailed examples for keyMap and diffMap

## [1.0.1] - 2025-09-16

- Initial public release with:
  - Autosave hook for React Hook Form (`useRhfAutosave`)
  - TRPC transport adapter
  - Key mapping & value transforms
  - Diff handling (array fields like sectors)
  - Validation before save
