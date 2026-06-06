import { deleteVoiceflowStateForUser } from "@/lib/voiceflow/delete-state";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    await deleteVoiceflowStateForUser(userId);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Voiceflow] Failed to delete state:", error);
    return NextResponse.json(
      { error: "Failed to delete Voiceflow state" },
      { status: 500 },
    );
  }
}
