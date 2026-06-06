"use client";

import Script from "next/script";
import { FormExtension } from "@/components/chat/form-extension";
import { Button } from "../ui/button";
import { TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";

function getUserId(): string | null {
  const item = localStorage.getItem(
    `voiceflow-session-${process.env.NEXT_PUBLIC_VOICEFLOW_PROJECT_ID}`,
  );
  if (!item) {
    return null;
  }
  const { userId } = JSON.parse(item) as { userId: string };
  return userId;
}

async function deleteVoiceflowState(_userId: string | null): Promise<void> {
  // Stub: future DELETE /state/user/{userId} via API route
}

function buildLoadConfig() {
  return {
    verify: { projectID: process.env.NEXT_PUBLIC_VOICEFLOW_PROJECT_ID },
    url: "https://general-runtime.voiceflow.com",
    voice: {
      url: "https://runtime-api.voiceflow.com",
    },
    assistant: {
      extensions: [FormExtension],
      persistence: "localStorage" as const,
    },
  };
}

async function loadVoiceflowChat() {
  await window.voiceflow.chat.load(buildLoadConfig());
  window.voiceflow.chat.proactive.push({
    type: "text",
    payload: { message: "Have other questions about me?" },
  });
}

async function resetVoiceflowChat(): Promise<void> {
  const oldUserId = getUserId();
  if (!oldUserId) {
    return;
  }
  await deleteVoiceflowState(oldUserId);
  await loadVoiceflowChat();
}

const VOICEFLOW_DEBUG = false;

export function VoiceflowWidget() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  useEffect(() => {
    if (VOICEFLOW_DEBUG) {
      console.log("[Voiceflow] isWidgetOpen:", isWidgetOpen);
    }
  }, [isWidgetOpen]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        typeof event.data !== "string" ||
        !event.data.startsWith('{"type":"voiceflow:')
      ) {
        return;
      }

      let data: { type: string };
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        if (VOICEFLOW_DEBUG) {
          console.warn("[Voiceflow] Failed to parse event:", event.data, error);
        }
        return;
      }

      if (VOICEFLOW_DEBUG) {
        console.log("[Voiceflow] event received:", data.type, data);
      }

      if (data.type === "voiceflow:open") {
        if (VOICEFLOW_DEBUG) {
          console.log("[Voiceflow] chat opened");
        }
        setIsWidgetOpen(true);
      } else if (data.type === "voiceflow:close") {
        if (VOICEFLOW_DEBUG) {
          console.log("[Voiceflow] chat closed");
        }
        setIsWidgetOpen(false);
      }
    };

    if (VOICEFLOW_DEBUG) {
      console.log("[Voiceflow] message listener registered");
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  return (
    <>
      <Script
        src="https://cdn.voiceflow.com/widget-next/bundle.mjs"
        strategy="lazyOnload"
        onLoad={() => {
          if (VOICEFLOW_DEBUG) {
            console.log("[Voiceflow] script loaded, calling chat.load()");
          }
          loadVoiceflowChat();
        }}
      />
      {isWidgetOpen && (
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-6 right-20 z-[2147483647] shadow-md bg-red-400 text-white hover:bg-red-900 hover:text-white h-10"
          onClick={() => resetVoiceflowChat()}
        >
          <TrashIcon className="size-4" /> Clear chat history
        </Button>
      )}
    </>
  );
}
