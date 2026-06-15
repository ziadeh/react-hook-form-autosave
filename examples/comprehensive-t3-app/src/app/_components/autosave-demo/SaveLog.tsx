"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SaveLogEntry } from "@/hooks/useFormData";

/**
 * Live log of every autosave that hit the (tRPC) transport — the visible
 * proof that editing a field actually persists, and which fields were sent.
 */
export function SaveLog({
  entries,
  onClear,
}: {
  entries: SaveLogEntry[];
  onClear: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <span>🛰️</span> Save log
          </CardTitle>
          <CardDescription className="text-xs">
            Each autosave request sent to the API
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={entries.length === 0}
          className="text-xs"
        >
          Clear
        </Button>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No saves yet — edit a field and pause.
          </p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                data-testid="save-log-entry"
                className="border-border/50 flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <span
                  className={
                    e.ok
                      ? "text-green-500"
                      : "text-destructive font-bold"
                  }
                  aria-hidden
                >
                  {e.ok ? "✓" : "✕"}
                </span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {e.at}
                </span>
                <span className="flex flex-wrap gap-1">
                  {e.keys.length === 0 ? (
                    <span className="text-muted-foreground text-xs">
                      (empty)
                    </span>
                  ) : (
                    e.keys.map((k) => (
                      <Badge key={k} variant="secondary" className="text-xs">
                        {k}
                      </Badge>
                    ))
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
