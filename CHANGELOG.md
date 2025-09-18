# Changelog

All notable changes to **react-hook-form-autosave** will be documented here.

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
