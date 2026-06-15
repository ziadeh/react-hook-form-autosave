"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRhfAutosave, type SavePayload } from "react-hook-form-autosave";

/**
 * Autosave + undo/redo bench (the primary use case of the library).
 *
 * Validates that:
 *  - editing a field auto-saves (transport fires with the changed field),
 *  - undo reverts the value AND auto-saves the reverted value,
 *  - redo re-applies the value AND auto-saves it,
 *  - hasPendingChanges settles back to false after each settled save.
 */
type Saved = { payload: SavePayload; at: number };

export default function AutosaveUndoPage() {
  const form = useForm<{ name: string; email: string }>({
    defaultValues: { name: "Ada", email: "ada@lovelace.dev" },
  });

  const savesRef = useRef<Saved[]>([]);
  const counterRef = useRef(0);
  const [saveCount, setSaveCount] = useState(0);
  const [lastPayload, setLastPayload] = useState("—");

  const { hasPendingChanges, isSaving, undo, redo, canUndo, canRedo } =
    useRhfAutosave<{ name: string; email: string }>({
      form,
      undo: { enabled: true, hotkeys: true, captureInInputs: true },
      config: { debounceMs: 400 },
      transport: async (payload: SavePayload): Promise<{ ok: true }> => {
        counterRef.current += 1;
        savesRef.current.push({ payload, at: counterRef.current });
        // eslint-disable-next-line no-console
        console.log("AUTOSAVE fired:", payload);
        setSaveCount(savesRef.current.length);
        setLastPayload(JSON.stringify(payload));
        return { ok: true };
      },
    });
  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#2e026d] to-[#15162c] py-16 text-white">
      <div className="flex w-full max-w-xl flex-col gap-6 px-8">
        <div>
          <h1 className="text-2xl font-bold">
            Minimal example — Autosave + Undo/Redo
          </h1>
          <p className="mt-2 text-sm text-white/70">
            The smallest useful setup: edit a field and it auto-saves; Undo/Redo
            (buttons or ⌘/Ctrl+Z) revert/reapply and auto-save the result.
          </p>
          <a href="/" className="mt-2 inline-block text-sm text-white/50 underline hover:text-white">
            ← Back to the full demo
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            data-testid="pending-status"
            className={
              hasPendingChanges
                ? "rounded bg-red-500/20 px-3 py-1 font-semibold text-red-300"
                : "rounded bg-green-500/20 px-3 py-1 font-semibold text-green-300"
            }
          >
            {hasPendingChanges ? "✏️ Unsaved" : "✅ Saved"}
          </span>
          <span data-testid="pending-value" className="font-mono">
            pending = {String(hasPendingChanges)}
          </span>
          <span data-testid="canundo-value" className="font-mono">
            canUndo = {String(canUndo)}
          </span>
          <span data-testid="canredo-value" className="font-mono">
            canRedo = {String(canRedo)}
          </span>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            data-testid="name-input"
            className="rounded border border-white/30 bg-white/5 px-3 py-2"
            {...form.register("name")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input
            data-testid="email-input"
            className="rounded border border-white/30 bg-white/5 px-3 py-2"
            {...form.register("email")}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            data-testid="undo-btn"
            disabled={!canUndo}
            onClick={() => undo?.()}
            className="rounded bg-white/10 px-4 py-2 font-medium disabled:opacity-40"
          >
            ↶ Undo
          </button>
          <button
            type="button"
            data-testid="redo-btn"
            disabled={!canRedo}
            onClick={() => redo?.()}
            className="rounded bg-white/10 px-4 py-2 font-medium disabled:opacity-40"
          >
            ↷ Redo
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded bg-black/30 p-3 text-sm">
          <dt className="text-white/60">Auto-saves fired</dt>
          <dd data-testid="save-count" className="font-mono font-bold">
            {saveCount}
          </dd>
          <dt className="text-white/60">Last payload</dt>
          <dd data-testid="last-payload" className="font-mono">
            {lastPayload}
          </dd>
          <dt className="text-white/60">isSaving</dt>
          <dd data-testid="saving-value" className="font-mono">
            {String(isSaving)}
          </dd>
        </dl>
      </div>
    </main>
  );
}
