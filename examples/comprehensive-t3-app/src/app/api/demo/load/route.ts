import { NextRequest, NextResponse } from "next/server";

// Mock data that simulates what a server would return
const MOCK_SERVER_DATA = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane.smith@example.com",
  bio: "Full-stack developer with 5 years of experience in React, Node.js, and cloud technologies. Passionate about building scalable applications and mentoring junior developers.",
  role: "developer",
  notifications: true,
  newsletter: true,
  skills: [
    { id: "skill-1", name: "React", level: "Expert" },
    { id: "skill-2", name: "TypeScript", level: "Advanced" },
    { id: "skill-3", name: "Node.js", level: "Advanced" },
    { id: "skill-4", name: "GraphQL", level: "Intermediate" },
  ],
  userId: "user_456",
  lastSaved: "2024-01-15T10:30:00Z",
};

export async function GET(request: NextRequest) {
  try {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    console.log("📤 API sending mock data to client");

    // Simulate occasional errors (5% chance)
    if (Math.random() < 0.05) {
      console.error("❌ Simulated load error");
      return NextResponse.json(
        { ok: false, error: "Failed to load data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: MOCK_SERVER_DATA,
      message: "Data loaded successfully",
    });
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load data" },
      { status: 500 }
    );
  }
}
