"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFormContext, useFieldArray } from "react-hook-form";
import type { FormData } from "@/types/formData.type";
import { IconPlus, IconTrash } from "@tabler/icons-react";

/**
 * NestedFormFields - Demonstrates nested field capabilities
 * 
 * Features:
 * - Nested object fields (profile.firstName, address.city)
 * - Nested arrays (teamMembers[0].name)
 * - Path-based field registration
 * - Array field manipulation
 */
export function NestedFormFields() {
  const { register, control, formState: { errors } } = useFormContext<FormData>();
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "teamMembers",
  });

  const addTeamMember = () => {
    append({
      id: Date.now(),
      name: "",
      role: "",
      email: "",
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Section - Nested Object */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Nested fields: <code className="text-xs">profile.firstName</code>, <code className="text-xs">profile.lastName</code>, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="profile.firstName">First Name</Label>
              <Input
                id="profile.firstName"
                {...register("profile.firstName")}
                placeholder="John"
              />
              {errors.profile?.firstName && (
                <p className="text-sm text-red-500 mt-1">{errors.profile.firstName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="profile.lastName">Last Name</Label>
              <Input
                id="profile.lastName"
                {...register("profile.lastName")}
                placeholder="Doe"
              />
              {errors.profile?.lastName && (
                <p className="text-sm text-red-500 mt-1">{errors.profile.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="profile.email">Email</Label>
            <Input
              id="profile.email"
              type="email"
              {...register("profile.email")}
              placeholder="john@example.com"
            />
            {errors.profile?.email && (
              <p className="text-sm text-red-500 mt-1">{errors.profile.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="profile.bio">Bio</Label>
            <Textarea
              id="profile.bio"
              {...register("profile.bio")}
              placeholder="Tell us about yourself..."
              rows={3}
            />
            {errors.profile?.bio && (
              <p className="text-sm text-red-500 mt-1">{errors.profile.bio.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Address Section - Nested Object */}
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>
            Nested optional fields: <code className="text-xs">address.street</code>, <code className="text-xs">address.city</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address.street">Street Address</Label>
            <Input
              id="address.street"
              {...register("address.street")}
              placeholder="123 Main St"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="address.city">City</Label>
              <Input
                id="address.city"
                {...register("address.city")}
                placeholder="New York"
              />
            </div>
            <div>
              <Label htmlFor="address.state">State</Label>
              <Input
                id="address.state"
                {...register("address.state")}
                placeholder="NY"
              />
            </div>
            <div>
              <Label htmlFor="address.zipCode">Zip Code</Label>
              <Input
                id="address.zipCode"
                {...register("address.zipCode")}
                placeholder="10001"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address.country">Country</Label>
            <Input
              id="address.country"
              {...register("address.country")}
              placeholder="United States"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links - Nested Object */}
      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>
            Nested URL fields: <code className="text-xs">socialLinks.github</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="socialLinks.github">GitHub</Label>
            <Input
              id="socialLinks.github"
              {...register("socialLinks.github")}
              placeholder="https://github.com/username"
            />
            {errors.socialLinks?.github && (
              <p className="text-sm text-red-500 mt-1">{errors.socialLinks.github.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="socialLinks.linkedin">LinkedIn</Label>
            <Input
              id="socialLinks.linkedin"
              {...register("socialLinks.linkedin")}
              placeholder="https://linkedin.com/in/username"
            />
            {errors.socialLinks?.linkedin && (
              <p className="text-sm text-red-500 mt-1">{errors.socialLinks.linkedin.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="socialLinks.twitter">Twitter</Label>
            <Input
              id="socialLinks.twitter"
              {...register("socialLinks.twitter")}
              placeholder="https://twitter.com/username"
            />
            {errors.socialLinks?.twitter && (
              <p className="text-sm text-red-500 mt-1">{errors.socialLinks.twitter.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="socialLinks.website">Website</Label>
            <Input
              id="socialLinks.website"
              {...register("socialLinks.website")}
              placeholder="https://yoursite.com"
            />
            {errors.socialLinks?.website && (
              <p className="text-sm text-red-500 mt-1">{errors.socialLinks.website.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settings - Nested Object with Checkboxes */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Nested settings: <code className="text-xs">settings.notifications</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="settings.notifications"
              {...register("settings.notifications")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="settings.notifications">
              Enable email notifications
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="settings.newsletter"
              {...register("settings.newsletter")}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="settings.newsletter">
              Subscribe to newsletter
            </Label>
          </div>

          <div>
            <Label htmlFor="settings.theme">Theme</Label>
            <select
              id="settings.theme"
              {...register("settings.theme")}
              className="w-full border rounded px-3 py-2"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Team Members - Nested Array of Objects */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Array of nested objects: <code className="text-xs">teamMembers[0].name</code>
            <br />
            <span className="text-xs text-muted-foreground mt-1 block">
              Changes to this array are auto-detected by <code>detectNestedArrayChanges</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">No team members yet. Add one below!</p>
          )}

          {fields.map((field, index) => (
            <Card key={field.id} className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Member #{index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`teamMembers.${index}.name`}>Name</Label>
                    <Input
                      id={`teamMembers.${index}.name`}
                      {...register(`teamMembers.${index}.name` as const)}
                      placeholder="Jane Smith"
                    />
                    {errors.teamMembers?.[index]?.name && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.teamMembers[index]?.name?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`teamMembers.${index}.role`}>Role</Label>
                    <Input
                      id={`teamMembers.${index}.role`}
                      {...register(`teamMembers.${index}.role` as const)}
                      placeholder="Developer"
                    />
                    {errors.teamMembers?.[index]?.role && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.teamMembers[index]?.role?.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor={`teamMembers.${index}.email`}>Email (optional)</Label>
                  <Input
                    id={`teamMembers.${index}.email`}
                    type="email"
                    {...register(`teamMembers.${index}.email` as const)}
                    placeholder="jane@example.com"
                  />
                  {errors.teamMembers?.[index]?.email && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.teamMembers[index]?.email?.message}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addTeamMember}
            className="w-full"
          >
            <IconPlus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
