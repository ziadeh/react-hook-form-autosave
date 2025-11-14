import { FormField } from "@/components/FormField";
import MultipleCheckboxes from "@/components/MultipleCheckboxes";
import { MultiSelectField } from "@/components/MultiSelectField";
import { RHFArrayIdField } from "@/components/RHFArrayIdField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FormData, formOptions } from "@/types/formData.type";
import { useFormContext } from "react-hook-form";

interface DemoFormFieldsProps {
  options: formOptions;
}

/**
 * DemoFormFields - Form fields showcasing various input types and autosave features
 *
 * Sections:
 * - Basic Information: Text inputs with validation
 * - Skills: Multi-select with diffMap (onAdd/onRemove callbacks)
 * - Role & Experience: Radio buttons, number, and date inputs
 * - Location: Select dropdown with keyMap transformation
 * - Preferences: Checkbox controls
 */
export const DemoFormFields: React.FC<DemoFormFieldsProps> = ({ options }) => {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<FormData>();

  const handleFocus = () =>
    setValue("isAnyInputFocused", true, { shouldDirty: false });
  const handleBlur = () =>
    setValue("isAnyInputFocused", false, { shouldDirty: false });

  return (
    <div className="w-full space-y-6">
      {/* Basic Information */}
      <Card className="border-primary/20 border-2 bg-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-primary">📝</span> Basic Information
          </CardTitle>
          <CardDescription>Text inputs with Zod validation</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Full name" error={errors.fullName?.message}>
            <Input
              type="text"
              placeholder="John Doe"
              {...register("fullName")}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <Input
              type="email"
              placeholder="john@example.com"
              {...register("email")}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </FormField>
          <div className="col-span-2">
            <FormField label="Bio" error={errors.bio?.message}>
              <Textarea
                placeholder="Tell us about yourself..."
                {...register("bio")}
                onFocus={handleFocus}
                onBlur={handleBlur}
                rows={4}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Skills (diffMap Example) */}
      <Card className="border-primary/20 border-2 bg-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-primary">🎯</span> Skills (diffMap Demo)
          </CardTitle>
          <CardDescription>
            Array field with onAdd/onRemove callbacks - separate API calls for
            each operation
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RHFArrayIdField
            name="skills"
            render={(value, setValue, error) => (
              <MultiSelectField
                options={options.skillsOptions || []}
                value={value}
                onChange={setValue}
                placeholder="Select your skills..."
                error={error}
              />
            )}
          />
          <MultipleCheckboxes skillsOptions={options.skillsOptions || []} />
        </CardContent>
      </Card>

      {/* Role & Experience */}
      <Card className="border-primary/20 border-2 bg-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-primary">💼</span> Role & Experience
          </CardTitle>
          <CardDescription>
            Radio buttons, number input, and date picker
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label="Role" error={errors.role?.message}>
            <RadioGroup
              value={watch("role") || ""}
              onValueChange={(value) =>
                setValue("role", value as any, { shouldDirty: true })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="developer" id="role-developer" />
                <Label htmlFor="role-developer">Developer</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="designer" id="role-designer" />
                <Label htmlFor="role-designer">Designer</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manager" id="role-manager" />
                <Label htmlFor="role-manager">Manager</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="role-other" />
                <Label htmlFor="role-other">Other</Label>
              </div>
            </RadioGroup>
          </FormField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Years of Experience"
              error={errors.yearsOfExperience?.message}
            >
              <Input
                type="number"
                placeholder="0"
                {...register("yearsOfExperience", { valueAsNumber: true })}
                onFocus={handleFocus}
                onBlur={handleBlur}
                min="0"
                max="50"
              />
            </FormField>

            <FormField
              label="Available From"
              error={errors.availableFrom?.message}
            >
              <Input
                type="date"
                {...register("availableFrom")}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Location (keyMap Example) */}
      <Card className="border-primary/20 border-2 bg-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-primary">🌍</span> Location (keyMap Demo)
          </CardTitle>
          <CardDescription>
            Field "country" is transformed to "country_code" when saving to server via keyMap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField label="Country" error={errors.country?.message}>
            <select
              {...register("country")}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a country...</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
            </select>
          </FormField>
          <p className="text-muted-foreground mt-2 text-xs">
            ✨ When you save, this field is sent to the server as "country_code" (check server console logs)
          </p>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="border-primary/20 border-2 bg-white backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-primary">⚙️</span> Preferences
          </CardTitle>
          <CardDescription>
            Checkbox controls for user preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border-border/50 bg-muted/30 hover:bg-muted/50 flex items-start space-x-3 rounded-lg border p-4 transition-colors">
            <Checkbox
              id="notifications"
              checked={watch("notifications") || false}
              onCheckedChange={(checked) =>
                setValue("notifications", checked as boolean, {
                  shouldDirty: true,
                })
              }
              className="mt-1"
            />
            <div className="space-y-1">
              <Label
                htmlFor="notifications"
                className="cursor-pointer text-sm font-medium"
              >
                Enable email notifications
              </Label>
              <p className="text-muted-foreground text-xs">
                Receive updates and alerts via email
              </p>
            </div>
          </div>
          <div className="border-border/50 bg-muted/30 hover:bg-muted/50 flex items-start space-x-3 rounded-lg border p-4 transition-colors">
            <Checkbox
              id="newsletter"
              checked={watch("newsletter") || false}
              onCheckedChange={(checked) =>
                setValue("newsletter", checked as boolean, {
                  shouldDirty: true,
                })
              }
              className="mt-1"
            />
            <div className="space-y-1">
              <Label
                htmlFor="newsletter"
                className="cursor-pointer text-sm font-medium"
              >
                Subscribe to newsletter
              </Label>
              <p className="text-muted-foreground text-xs">
                Get the latest news and updates
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
