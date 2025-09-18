import React from "react";

interface AutosaveStatusProps {
  isSaving: boolean;
  lastError: Error | null;
  onShowMetrics: () => void;
  showMetrics: boolean;
}

export function AutosaveStatus({
  isSaving,
  lastError,
  onShowMetrics,
  showMetrics,
}: AutosaveStatusProps) {
  return (
    <div className="flex items-center space-x-4">
      <div
        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
          isSaving
            ? "bg-blue-100 text-blue-700"
            : lastError
            ? "bg-red-100 text-red-700"
            : "bg-green-100 text-green-700"
        }`}
      >
        {isSaving && <span className="animate-spin">💾</span>}
        {!isSaving && !lastError && <span>✅</span>}
        {lastError && <span>❌</span>}
        <span>
          {isSaving
            ? "Saving..."
            : lastError
            ? "Save failed"
            : "All changes saved"}
        </span>
      </div>

      <button
        onClick={onShowMetrics}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        📊 Metrics
      </button>
    </div>
  );
}
