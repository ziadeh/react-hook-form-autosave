import React from "react";
import { UseFormSetValue } from "react-hook-form";
import { ProjectFormData, Tag } from "../types";
import { availableTags } from "../constants";

interface TagsSectionProps {
  currentTags: Tag[];
  setValue: UseFormSetValue<ProjectFormData>;
}

export function TagsSection({ currentTags, setValue }: TagsSectionProps) {
  const handleRemoveTag = (tagId: number) => {
    const newTags = currentTags.filter((t) => t.id !== tagId);
    setValue("tags", newTags, { shouldDirty: true });
  };

  const handleAddTag = (tag: Tag) => {
    const newTags = [...currentTags, tag];
    setValue("tags", newTags, { shouldDirty: true });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Tags (Demonstrates diffMap for arrays)
      </label>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {currentTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm"
              style={{ backgroundColor: tag.color + "20", color: tag.color }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags
            .filter((tag) => !currentTags.find((t) => t.id === tag.id))
            .map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50"
              >
                + {tag.name}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
