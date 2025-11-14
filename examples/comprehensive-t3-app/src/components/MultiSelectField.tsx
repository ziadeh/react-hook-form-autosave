"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "./ui/label";

// Types
type MultiSelectOption = {
  id: number;
  label: string;
};

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: { id: number }[];
  onChange: (value: { id: number }[]) => void;
  placeholder?: string;
  error?: string;
}

// Clean MultiSelectField component (no RHF logic inside)
export function MultiSelectField({
  options,
  value = [],
  onChange,
  placeholder = "Select options...",
  error,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Get selected items with labels
  const selectedItems = value
    .map((v) => options.find((opt) => opt.id === v.id))
    .filter(Boolean) as MultiSelectOption[];

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelect = (option: MultiSelectOption) => {
    const isSelected = value.some((v) => v.id === option.id);
    if (isSelected) {
      const newValue = value.filter((v) => v.id !== option.id);
      onChange(newValue);
    } else {
      const newValue = [...value, { id: option.id }];
      onChange(newValue);
    }
  };

  const handleRemove = (optionId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newValue = value.filter((v) => v.id !== optionId);
    onChange(newValue);
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <Label htmlFor="multiselect" className="block text-sm font-medium">
        Skills
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "multiselect-trigger h-auto",
              error && "error",
              !selectedItems.length && "placeholder",
            )}
            style={{
              width: "100%",
              minHeight: "40px",
              padding: "8px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: error ? "2px solid #ef4444" : "1px solid #d1d5db",
              borderRadius: "6px",
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "4px",
                flex: 1,
                alignItems: "center",
              }}
            >
              {selectedItems.length > 0 ? (
                selectedItems.slice(0, 3).map((item) => (
                  <Badge
                    key={item.id}
                    variant="secondary"
                    style={{
                      backgroundColor: "#f3f4f6",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {item.label}
                    <X
                      size={12}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => handleRemove(item.id, e)}
                    />
                  </Badge>
                ))
              ) : (
                <span style={{ color: "#9ca3af" }}>{placeholder}</span>
              )}
              {selectedItems.length > 3 && (
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: "#f3f4f6",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                >
                  +{selectedItems.length - 3} more
                </Badge>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <ChevronsUpDown size={16} style={{ opacity: 0.5 }} />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search options..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            {filteredOptions.length === 0 ? (
              <CommandEmpty>No options found.</CommandEmpty>
            ) : (
              <ScrollArea>
                <CommandGroup>
                  {filteredOptions.map((option) => {
                    const isSelected = value.some((v) => v.id === option.id);
                    return (
                      <CommandItem
                        key={option.id}
                        onSelect={() => handleSelect(option)}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: isSelected
                            ? "#f0f9ff"
                            : "transparent",
                        }}
                      >
                        <Check
                          size={16}
                          style={{
                            marginRight: "8px",
                            opacity: isSelected ? 1 : 0,
                          }}
                        />
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </ScrollArea>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p style={{ color: "#ef4444", fontSize: "14px", marginTop: "4px" }}>
          {error}
        </p>
      )}
    </div>
  );
}
