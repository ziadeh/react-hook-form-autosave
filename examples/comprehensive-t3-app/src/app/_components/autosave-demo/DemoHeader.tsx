import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormData } from "@/hooks/useFormData";
import React, { useState, useEffect } from "react";

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
    getMetrics,
    getBaseline,
  } = autosave;

  const [metrics, setMetrics] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Update metrics every second
  useEffect(() => {
    if (getMetrics) {
      const interval = setInterval(() => {
        setMetrics(getMetrics());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [getMetrics]);

  return (
    <div className="w-full space-y-4">
      {/* Controls Bar */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={undo} disabled={!canUndo} variant="outline" size="sm">
                <span className="text-lg mr-1">↶</span> Undo
              </Button>
              <Button type="button" onClick={redo} disabled={!canRedo} variant="outline" size="sm">
                <span className="text-lg mr-1">↷</span> Redo
              </Button>
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  flush();
                }}
                disabled={!hasPendingChanges || isSaving}
                size="sm"
              >
                {isSaving ? "💾 Saving..." : "💾 Save Now"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isSaving ? "default" : "secondary"}
                className="text-xs"
              >
                {isSaving ? "💾 Saving..." : "💤 Idle"}
              </Badge>
              <Badge
                variant={hasPendingChanges ? "destructive" : "default"}
                className="text-xs"
              >
                {hasPendingChanges ? "✏️ Unsaved" : "✅ Saved"}
              </Badge>
              <Button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                {showDebug ? "▼ Hide" : "▶ Show"} Debug
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      {showDebug && (
        <Card className="border-2 border-muted bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-primary">🔧</span> Debug & Metrics
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time autosave information and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Status Indicators</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant={canUndo ? "default" : "secondary"} className="text-xs">
                  Can Undo: {canUndo ? "✓" : "✗"}
                </Badge>
                <Badge variant={canRedo ? "default" : "secondary"} className="text-xs">
                  Can Redo: {canRedo ? "✓" : "✗"}
                </Badge>
                <Badge variant={hasPendingChanges ? "destructive" : "secondary"} className="text-xs">
                  Pending: {hasPendingChanges ? "✓" : "✗"}
                </Badge>
                <Badge variant={isSaving ? "default" : "secondary"} className="text-xs">
                  Saving: {isSaving ? "✓" : "✗"}
                </Badge>
              </div>
            </div>

            {/* Metrics */}
            {metrics && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">
                  📊 Metrics (enableMetrics: true)
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Saves</p>
                    <p className="text-2xl font-bold text-primary">{metrics.totalSaves || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Failed Saves</p>
                    <p className="text-2xl font-bold text-destructive">{metrics.failedSaves || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Avg Save Time</p>
                    <p className="text-2xl font-bold text-primary">
                      {metrics.averageSaveTime ? `${metrics.averageSaveTime.toFixed(0)}ms` : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">⚡ Active Features</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">autoHydrate</Badge>
                <Badge variant="outline" className="text-xs">undo/redo</Badge>
                <Badge variant="outline" className="text-xs">diffMap (skills)</Badge>
                <Badge variant="outline" className="text-xs">keyMap (country→country_code)</Badge>
                <Badge variant="outline" className="text-xs">shouldSave</Badge>
                <Badge variant="outline" className="text-xs">validateBeforeSave</Badge>
                <Badge variant="outline" className="text-xs">onSaved</Badge>
                <Badge variant="outline" className="text-xs">debug mode</Badge>
                <Badge variant="outline" className="text-xs">enableMetrics</Badge>
              </div>
            </div>

            {/* Baseline Debug */}
            {getBaseline && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={() => {
                    const baseline = getBaseline();
                    console.log("🔍 Current Baseline:", baseline);
                    console.log("🔍 Form Values:", autosave);
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  🔍 Log Baseline to Console
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
