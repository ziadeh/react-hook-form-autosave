import { NextRequest, NextResponse } from "next/server";

// In-memory storage (resets on server restart)
let savedData: any = null;

export async function POST(request: NextRequest) {
  try {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const body = await request.json();

    console.log("📥 API received data:", body);

    // Store the data
    savedData = {
      ...body,
      lastSaved: new Date().toISOString(),
    };

    // Simulate occasional errors (10% chance)
    if (Math.random() < 0.1) {
      console.error("❌ Simulated save error");
      return NextResponse.json(
        { ok: false, error: "Simulated server error" },
        { status: 500 }
      );
    }

    console.log("✅ API saved data successfully");

    return NextResponse.json({
      ok: true,
      data: savedData,
      message: "Data saved successfully",
    });
  } catch (error) {
    console.error("❌ API error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save data" },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to retrieve current saved data
export async function GET() {
  return NextResponse.json({
    ok: true,
    data: savedData,
  });
}
