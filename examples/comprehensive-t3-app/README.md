# React Hook Form Autosave - Comprehensive Demo

> **Note:** This is an example project within the [react-hook-form-autosave](https://github.com/ziadeh/react-hook-form-autosave) monorepo.

A full-featured demonstration application showcasing all capabilities of react-hook-form-autosave, a powerful autosave solution for React Hook Form.

## Features Demonstrated

This demo showcases **all major features** of react-hook-form-autosave:

- **Auto-save with debounce** - Automatic form persistence with configurable delay
- **Undo/Redo** - Full undo/redo support with keyboard shortcuts (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
- **diffMap** - Array operations with separate `onAdd`/`onRemove` callbacks for optimized API calls
- **keyMap** - Field name transformation (e.g., `country` → `country_code`) when saving to server
- **shouldSave** - Conditional save logic based on form state
- **validateBeforeSave** - Zod schema validation before transport
- **Metrics collection** - Real-time statistics (total saves, failed saves, average save time)
- **Debug mode** - Comprehensive logging for development
- **autoHydrate** - Automatic baseline synchronization after server updates
- **hasPendingChanges** - Track unsaved changes
- **Customizable transport** - Flexible save function for any backend

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (required for monorepo workspace)

### Installation

From the root of the react-hook-form-autosave repository:

```bash
# Install all dependencies (including this example)
pnpm install

# Navigate to this example
cd examples/comprehensive-t3-app

# Copy environment variables
cp .env.example .env
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the demo.

## Project Structure

```
src/
├── app/
│   ├── _components/
│   │   └── autosave-demo/
│   │       ├── AutosaveDemo.tsx      # Main demo component
│   │       ├── DemoFormFields.tsx    # Form fields showcasing various input types
│   │       └── DemoHeader.tsx        # Controls and debug panel
│   └── page.tsx                      # Home page
├── hooks/
│   └── useFormData.tsx               # Autosave configuration
├── types/
│   └── formData.type.ts              # Form schema with Zod validation
└── server/
    └── api/
        └── routers/
            └── sample.ts             # tRPC endpoints
```

## Form Sections

The demo includes comprehensive examples of:

1. **Basic Information** - Text inputs with Zod validation
2. **Skills (diffMap)** - Multi-select with separate API calls for add/remove operations
3. **Role & Experience** - Radio buttons, number input, date picker
4. **Location (keyMap)** - Select dropdown with field name transformation
5. **Preferences** - Checkbox controls

## Key Implementation Details

### Autosave Configuration

See `src/hooks/useFormData.tsx` for the complete autosave setup:

```typescript
const autosave = useRhfAutosave<FormData>({
  form,
  transport,
  undo: {
    enabled: true,
    hotkeys: true,
  },
  config: {
    debug: true,
    debounceMs: 600,
    enableMetrics: true,
  },
  shouldSave,
  validateBeforeSave: "payload",
  keyMap: {
    country: ["country_code", String],
  },
  diffMap: {
    skills: {
      idOf: (skill) => skill.id,
      onAdd: async ({ id }) => {
        /* API call */
      },
      onRemove: async ({ id }) => {
        /* API call */
      },
    },
  },
  onSaved: async (result) => {
    /* Success/error handling */
  },
});
```

### Important: useCallback for Stable References

The `transport` and `shouldSave` functions **must** be wrapped in `useCallback` to ensure stable references:

```typescript
const transport = React.useCallback(async (data: FormData) => {
  // Your save logic
}, []);

const shouldSave = React.useCallback(({ isDirty, values }) => {
  // Your conditional logic
}, []);
```

## Tech Stack

Built with the [T3 Stack](https://create.t3.gg/):

- [Next.js 15](https://nextjs.org) - React framework
- [React Hook Form](https://react-hook-form.com) - Form state management
- [react-hook-form-autosave](https://github.com/ziadalzarka/react-hook-form-autosave) - Autosave functionality
- [Zod](https://zod.dev) - Schema validation
- [tRPC](https://trpc.io) - End-to-end typesafe API
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Sonner](https://sonner.emilkowal.ski) - Toast notifications

## Learn More

- [react-hook-form-autosave Documentation](https://github.com/ziadalzarka/react-hook-form-autosave)
- [React Hook Form Documentation](https://react-hook-form.com/get-started)
- [T3 Stack Documentation](https://create.t3.gg/)

## License

MIT
