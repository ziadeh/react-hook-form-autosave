import React from "react";
import { UseFormReturn } from "react-hook-form";
import { ProjectFormData } from "../types";

interface DebugPanelProps {
  form: UseFormReturn<ProjectFormData>;
  config: any;
  pendingChanges: any;
  isEmpty: () => boolean;
  getMetrics: () => any;
  flush: () => void;
  abort: () => void;
}

export function DebugPanel({
  form,
  config,
  pendingChanges,
  isEmpty,
  getMetrics,
  flush,
  abort,
}: DebugPanelProps) {
  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-medium text-gray-900 mb-3">Debug Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <h4 className="font-medium text-gray-700">Form State:</h4>
          <pre className="mt-1 text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(
              {
                isDirty: form.formState.isDirty,
                isValid: form.formState.isValid,
                dirtyFields: Object.keys(form.formState.dirtyFields),
              },
              null,
              2
            )}
          </pre>
        </div>
        <div>
          <h4 className="font-medium text-gray-700">Autosave Config:</h4>
          <pre className="mt-1 text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
        <div>
          <h4 className="font-medium text-gray-700">Pending Changes:</h4>
          <pre className="mt-1 text-xs bg-white p-2 rounded overflow-auto">
            {isEmpty() ? "None" : JSON.stringify(pendingChanges, null, 2)}
          </pre>
        </div>
        <div>
          <h4 className="font-medium text-gray-700">Metrics:</h4>
          <pre className="mt-1 text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(getMetrics(), null, 2)}
          </pre>
        </div>
      </div>
      <div className="mt-4 flex space-x-3">
        <button
          onClick={flush}
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          Force Save
        </button>
        <button
          onClick={abort}
          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
        >
          Abort Save
        </button>
      </div>
    </div>
  );
}
