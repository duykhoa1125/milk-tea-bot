import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const adminApiKey = process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";
  const { searchParams } = new URL(request.url);

  try {
    const res = await fetch(`${backendUrl}/api/orders/history?${searchParams.toString()}`, {
      headers: {
        "x-admin-key": adminApiKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Backend responded with status: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying orders history request:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders history" },
      { status: 500 }
    );
  }
}
