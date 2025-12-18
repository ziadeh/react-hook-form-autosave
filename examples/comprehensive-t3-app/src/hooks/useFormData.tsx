import { useCallback, useEffect, useRef } from "react";
import { 
  type Transport, 
  useRhfAutosave,
  mapNestedKeys,
  detectNestedArrayChanges,
  findArrayFields,
  getByPath,
  pickChanged,
} from "react-hook-form-autosave";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  FormDataSchema,
  type FormData,
  type formOptions,
} from "@/types/formData.type";
import { DefaultFormValues } from "@/utils/formData.utils";
import { api } from "@/trpc/react";

const userId = "123";
export const useFormData = () => {
  const form = useForm<FormData>({
    defaultValues: DefaultFormValues(),
    resolver: zodResolver(FormDataSchema),
    mode: "onChange",
    // Prevent validation during render
    criteriaMode: "firstError",
    reValidateMode: "onChange",
  });

  const { data: sampleFormData, isLoading } = api.sample.getData.useQuery(
    { id: userId },
    {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  const { data: skillsOptions } = api.sample.getSkillsOptions.useQuery();
  const updateMutation = api.sample.updateForm.useMutation();
  const { mutateAsync: addSkill } = api.sample.addSkill.useMutation();
  const { mutateAsync: removeSkill } = api.sample.removeSkill.useMutation();

  // Store baseline for array diffing
  const baselineRef = useRef<FormData | null>(null);
  
  // Update baseline when form is reset/loaded
  useEffect(() => {
    if (sampleFormData && !isLoading) {
      baselineRef.current = sampleFormData as FormData;
    }
  }, [sampleFormData, isLoading]);

  // Create stable transport function with nested field support
  const transport: Transport = useCallback(
    async (payload: any, context: any) => {
      console.log("🚀 TRANSPORT CALLED - Payload received:", payload);
      console.log("🚀 Payload keys:", Object.keys(payload || {}));

      // If payload is empty, just return success without making API call
      if (!payload || Object.keys(payload).length === 0) {
        console.log("⚠️ Empty payload received, skipping API call");
        return { ok: true };
      }

      try {
        // ===== FEATURE: Nested Key Mapping =====
        // Transform nested form fields to match API structure
        const keyMapConfig = {
          'profile.firstName': 'first_name',
          'profile.lastName': 'last_name', 
          'profile.email': 'email_address',
          'profile.bio': 'biography',
          'address.zipCode': 'postal_code',
          'address.street': 'street_address',
          'socialLinks.github': 'github_url',
          'socialLinks.linkedin': 'linkedin_url',
          'socialLinks.twitter': 'twitter_url',
          'socialLinks.website': 'website_url',
          'settings.notifications': 'notify_enabled',
          'settings.newsletter': 'newsletter_subscribed',
        };

        const transformedPayload = mapNestedKeys(payload, keyMapConfig, { 
          preserveUnmapped: true 
        });
        
        console.log("🔄 Transformed payload (mapNestedKeys):", transformedPayload);

        // ===== FEATURE: Array Change Detection =====
        // Detect what changed in arrays (added/removed/modified)
        if (payload.teamMembers && baselineRef.current?.teamMembers) {
          const arrayChanges = detectNestedArrayChanges(
            { teamMembers: baselineRef.current.teamMembers },
            { teamMembers: payload.teamMembers },
            ['teamMembers'],
            { identityKey: 'id', trackFieldChanges: true }
          );
          
          if (arrayChanges.teamMembers?.hasChanges) {
            const { added, removed, modified } = arrayChanges.teamMembers;
            console.log("📊 Team Members Changes:", {
              added: added.length,
              removed: removed.length, 
              modified: modified.length,
              details: arrayChanges.teamMembers
            });
            
            // Show detailed toast for array changes
            const parts = [];
            if (added.length > 0) parts.push(`+${added.length} added`);
            if (removed.length > 0) parts.push(`-${removed.length} removed`);
            if (modified.length > 0) parts.push(`${modified.length} modified`);
            if (parts.length > 0) {
              toast.info(`Team Members: ${parts.join(', ')}`);
            }
          }
        }

        // ===== FEATURE: Safe Path Extraction =====
        // Demonstrate getByPath for logging
        const extractedValues = {
          firstName: getByPath(payload, 'profile.firstName'),
          lastName: getByPath(payload, 'profile.lastName'),
          city: getByPath(payload, 'address.city'),
          theme: getByPath(payload, 'settings.theme'),
        };
        console.log("✅ Extracted values (getByPath):", extractedValues);

        // ===== FEATURE: Find All Array Fields =====
        const arrayFields = findArrayFields(payload);
        if (arrayFields.length > 0) {
          console.log("📋 Array fields in payload:", arrayFields);
        }

        // Send to API
        console.log("📤 Sending to API:", transformedPayload);
        await updateMutation.mutateAsync({
          id: userId,
          data: transformedPayload,
        });
        
        // Update baseline after successful save
        const currentValues = form.getValues();
        baselineRef.current = currentValues;
        
        return { ok: true };
      } catch (error) {
        console.error("❌ Save error:", error);
        return {
          ok: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
    [userId, updateMutation, form],
  );
  const shouldSave = useCallback(
    ({
      isDirty,
      isValid,
      dirtyFields,
      values,
    }: {
      isDirty: boolean;
      isValid: boolean;
      dirtyFields: any;
      values: FormData;
    }) => {
      const hasDirtyFields = Object.keys(dirtyFields || {}).length > 0;
      console.log("🔍 shouldSave check:", { 
        isDirty, 
        isValid, 
        hasDirtyFields,
        dirtyFields: JSON.parse(JSON.stringify(dirtyFields || {})),
        willSave: (isDirty || hasDirtyFields) && isValid
      });
      // For nested fields demo, check isDirty OR hasDirtyFields (for nested)
      return (isDirty || hasDirtyFields) && isValid;
    },
    [],
  );

  // Custom selectPayload that handles nested fields and arrays
  const selectPayload = useCallback(
    (values: FormData, dirtyFields: any) => {
      console.log("📦 selectPayload called");
      console.log("📦 dirtyFields:", JSON.stringify(dirtyFields, null, 2));
      
      // If no dirty fields, return empty
      if (!dirtyFields || Object.keys(dirtyFields).length === 0) {
        console.log("📦 No dirty fields, returning empty payload");
        return {};
      }
      
      // Helper to check if any value in an object/array is truthy
      const hasAnyDirty = (obj: any): boolean => {
        if (obj === true) return true;
        if (Array.isArray(obj)) {
          return obj.some(item => hasAnyDirty(item));
        }
        if (obj && typeof obj === 'object') {
          return Object.values(obj).some(val => hasAnyDirty(val));
        }
        return false;
      };
      
      // Custom extraction that handles arrays properly
      const extractDirtyValues = (vals: any, dirty: any, path: string = ''): any => {
        console.log(`📦 extractDirtyValues at "${path}":`, { vals: typeof vals, dirty });
        
        if (dirty === undefined || dirty === null) return undefined;
        if (vals === undefined || vals === null) return undefined;
        
        // If dirty is exactly true, return the value
        if (dirty === true) {
          console.log(`📦 "${path}" is dirty=true, returning value`);
          return vals;
        }
        
        // If dirty is an array (for array fields like teamMembers)
        if (Array.isArray(dirty)) {
          console.log(`📦 "${path}" dirty is array with ${dirty.length} items`);
          if (!Array.isArray(vals)) {
            console.log(`📦 "${path}" vals is not array, skipping`);
            return undefined;
          }
          
          // For arrays, if ANY item is dirty, return the ENTIRE array
          // This is simpler and more reliable for autosave
          if (hasAnyDirty(dirty)) {
            console.log(`📦 "${path}" array has dirty items, returning full array`);
            return vals;
          }
          
          return undefined;
        }
        
        // If dirty is an object, recurse into it
        if (typeof dirty === 'object') {
          const result: any = {};
          
          for (const key of Object.keys(dirty)) {
            const childPath = path ? `${path}.${key}` : key;
            const extracted = extractDirtyValues(vals?.[key], dirty[key], childPath);
            if (extracted !== undefined) {
              result[key] = extracted;
            }
          }
          
          if (Object.keys(result).length > 0) {
            console.log(`📦 "${path}" extracted nested:`, result);
            return result;
          }
          return undefined;
        }
        
        return undefined;
      };
      
      const payload = extractDirtyValues(values, dirtyFields) || {};
      
      console.log("📦 Final extracted payload:", JSON.stringify(payload, null, 2));
      return payload;
    },
    [],
  );
  // Setup autosave with nested fields support
  const autosave = useRhfAutosave<FormData>({
    form,
    transport,
    // Re-enable undo/redo with nested field support
    undo: {
      enabled: true,
      hotkeys: true, // Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z to redo
      captureInInputs: true, // Capture undo/redo even when focused on inputs
    },
    config: {
      debug: true,
      debounceMs: 800,
      enableMetrics: true,
    },
    shouldSave,
    selectPayload,
    validateBeforeSave: "payload",
    onSaved: async (result) => {
      console.log("💾 onSaved callback:", result);
      if (result.ok) {
        toast.success("Changes saved!");
      } else {
        toast.error("Failed to save changes");
        console.log("❌ Save failed:", result);
      }
    },
  });

  useEffect(() => {
    if (sampleFormData && !isLoading) {
      // Use setTimeout to avoid state updates during render
      setTimeout(() => {
        form.reset({
          ...sampleFormData,
          isAnyInputFocused: false,
        });
      }, 0);
    }
  }, [form, sampleFormData, isLoading]);

  return {
    form,
    userId,
    isLoading,
    options: {
      skillsOptions,
    } as formOptions,
    sampleFormData,
    autosave,
    addSkill,
  };
};
