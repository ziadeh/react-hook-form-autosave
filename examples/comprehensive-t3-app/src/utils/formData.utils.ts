import type { FormData } from "@/types/formData.type";

export const DefaultFormValues = (): FormData => ({
  fullName: "",
  email: "",
  skills: [],
  bio: "",
  role: undefined,
  notifications: false,
  newsletter: false,
  yearsOfExperience: undefined,
  availableFrom: undefined,
  country: undefined,
  hobbies: [],
  isAnyInputFocused: false,
});
