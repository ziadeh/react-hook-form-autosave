import { Label } from "@/components/ui/label";
import React, { useId } from "react";

interface FormFieldProps {
  label: string;
  error?: string | null | undefined;
  children: React.ReactNode;
  required?: boolean;
  id?: string;
}

// Type for elements that can accept an id prop
type ElementWithId = React.ReactElement<{ id?: string }>;

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  children,
  required = false,
  id,
}) => {
  // If no id provided, generate a unique one
  const generatedId = useId();
  const inputId = id ?? generatedId;

  // Helper function to add id to children
  const childrenWithId = React.Children.map(children, (child) => {
    // Check if it's a valid React element that can accept props
    if (React.isValidElement(child)) {
      // Clone and add the id prop
      return React.cloneElement(child as ElementWithId, { id: inputId });
    }
    return child;
  });

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {childrenWithId}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};
