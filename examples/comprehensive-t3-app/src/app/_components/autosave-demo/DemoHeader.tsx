"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { useFormData } from "@/hooks/useFormData";

type Metrics = {
  totalSaves?: number;
  failedSaves?: number;
  averageSaveTime?: number;
};

/**
 * Status bar: live autosave status, undo/redo, manual flush, and metrics.
 * Metrics are read on render (no polling interval) so there is no console noise.
 */
export function DemoHeader({
  autosave,
}: {
  autosave: ReturnType<typeof useFormData>["autosave"];
}) {
  const {
    undo,
    redo,
    flush,
    canUndo,
    canRedo,
    hasPendingChanges,
    isSaving,
    lastError,
    getMetrics,
  } = autosave;

  const metrics = (getMetrics?.() ?? {}) as Metrics;

  const status = isSaving
    ? { label: "Saving…", cls: "bg-blue-500/15 text-blue-400", dot: "⟳" }
    : lastError
      ? { label: "Save failed", cls: "bg-red-500/15 text-red-400", dot: "✕" }
      : hasPendingChanges
        ? {
            label: "Unsaved changes",
            cls: "bg-amber-500/15 text-amber-400",
            dot: "✏️",
          }
        : {
            label: "All changes saved",
            cls: "bg-green-500/15 text-green-400",
            dot: "✓",
          };

  return (
    <Card className="border-primary/20 bg-card/60 sticky top-4 z-10 backdrop-blur-md">
      <CardContent className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            data-testid="autosave-status"
            data-pending={String(hasPendingChanges)}
            data-saving={String(isSaving)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${status.cls}`}
          >
            <span aria-hidden>{status.dot}</span>
            {status.label}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              data-testid="undo-btn"
              onClick={() => undo?.()}
              disabled={!canUndo}
              variant="outline"
              size="sm"
            >
              ↶ Undo
            </Button>
            <Button
              type="button"
              data-testid="redo-btn"
              onClick={() => redo?.()}
              disabled={!canRedo}
              variant="outline"
              size="sm"
            >
              ↷ Redo
            </Button>
            <Button
              type="button"
              data-testid="save-now-btn"
              onClick={(e) => {
                e.preventDefault();
                void flush();
              }}
              disabled={!hasPendingChanges || isSaving}
              size="sm"
            >
              {isSaving ? "Saving…" : "Save now"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary" data-testid="metric-total">
            Saves: {metrics.totalSaves ?? 0}
          </Badge>
          <Badge variant="secondary" data-testid="metric-failed">
            Failed: {metrics.failedSaves ?? 0}
          </Badge>
          <Badge variant="secondary">
            Avg:{" "}
            {metrics.averageSaveTime
              ? `${Math.round(metrics.averageSaveTime)}ms`
              : "—"}
          </Badge>
          <span className="text-muted-foreground ml-auto hidden sm:inline">
            ⌘/Ctrl+Z undo · Shift+⌘/Ctrl+Z redo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
