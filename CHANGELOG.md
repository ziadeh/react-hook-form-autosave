# Changelog

All notable changes to **react-hook-form-autosave** will be documented here.

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
