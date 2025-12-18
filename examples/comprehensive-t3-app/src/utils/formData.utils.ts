import type { FormData } from "@/types/formData.type";

export const DefaultFormValues = (): FormData => ({
  // Nested profile
  profile: {
    firstName: "",
    lastName: "",
    bio: "",
    email: "",
  },

  // Nested address
  address: {
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  },

  // Nested social links
  socialLinks: {
    github: "",
    linkedin: "",
    twitter: "",
    website: "",
  },

  // Nested settings
  settings: {
    notifications: false,
    newsletter: false,
    theme: "system",
  },

  // Array of nested objects
  teamMembers: [],

  // Legacy fields
  skills: [],
  role: undefined,
  yearsOfExperience: undefined,
  availableFrom: undefined,
  hobbies: [],
  isAnyInputFocused: false,
});
