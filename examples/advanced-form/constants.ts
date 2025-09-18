import { Tag, User } from "./types";

export const availableTags: Tag[] = [
  { id: 1, name: "Frontend", color: "#3B82F6" },
  { id: 2, name: "Backend", color: "#EF4444" },
  { id: 3, name: "Design", color: "#8B5CF6" },
  { id: 4, name: "Urgent", color: "#F59E0B" },
];

export const availableUsers: User[] = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com" },
  { id: 2, name: "Bob Smith", email: "bob@example.com" },
  { id: 3, name: "Carol Davis", email: "carol@example.com" },
];

export const defaultFormValues = {
  title: "",
  description: "",
  status: "draft" as const,
  priority: "medium" as const,
  tags: [],
  assignees: [],
  settings: {
    notifications: true,
    publicVisible: false,
  },
};
