import type { VoiceflowAction } from "@/lib/voiceflow/create-session";
import { NextRequest, NextResponse } from "next/server";
import {
  createVoiceflowSession,
  interactVoiceflowSession,
  startVoiceflowSession,
} from "@/lib/voiceflow/create-session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      sessionKey?: string;
      action?: VoiceflowAction;
    };

    const action = body.action;

    if (!action?.type) {
      return NextResponse.json(
        { error: "action.type is required" },
        { status: 400 },
      );
    }

    if (body.sessionKey) {
      const result = await interactVoiceflowSession(body.sessionKey, action);
      return NextResponse.json(result);
    }

    if (!body.userId) {
      return NextResponse.json(
        { error: "userId or sessionKey is required" },
        { status: 400 },
      );
    }

    const result = await createVoiceflowSession(body.userId, action);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Voiceflow] Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create Voiceflow session" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { userId?: string };

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const sessionKey = await startVoiceflowSession(body.userId);
    return NextResponse.json({ sessionKey });
  } catch (error) {
    console.error("[Voiceflow] Failed to start session:", error);
    return NextResponse.json(
      { error: "Failed to start Voiceflow session" },
      { status: 500 },
    );
  }
}
