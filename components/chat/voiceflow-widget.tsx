"use client";

import Script from "next/script";
import Link from "next/link";
import { FormExtension } from "@/components/chat/form-extension";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { InfoIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getProjectId(): string {
  return process.env.NEXT_PUBLIC_VOICEFLOW_PROJECT_ID ?? "";
}

function getSessionStorageKey(): string {
  return `voiceflow-session-${getProjectId()}`;
}

function getWidgetStorageKey(): string {
  return `voiceflow-chat-widget:${getProjectId()}`;
}

function getUserId(): string | null {
  const item = localStorage.getItem(getSessionStorageKey());
  if (!item) {
    return null;
  }

  const session = JSON.parse(item) as { userID?: string; userId?: string };
  return session.userID ?? session.userId ?? null;
}

function getSessionKey(): string | null {
  const item = localStorage.getItem(getSessionStorageKey());
  if (!item) {
    return null;
  }

  const session = JSON.parse(item) as { sessionKey?: string };
  return session.sessionKey ?? null;
}

function clearVoiceflowSession(): void {
  localStorage.removeItem(getSessionStorageKey());
  localStorage.removeItem(getWidgetStorageKey());
}

function getDeleteStateUrl(userId: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_VOICEFLOW_DELETE_STATE_URL ??
    "/api/voiceflow/state";
  return `${baseUrl}?userId=${encodeURIComponent(userId)}`;
}

async function deleteVoiceflowState(userId: string | null): Promise<void> {
  if (!userId) {
    return;
  }

  const response = await fetch(getDeleteStateUrl(userId), {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete Voiceflow state (${response.status})`);
  }
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

function destroyVoiceflowChat(): void {
  // window.voiceflow.chat.close();
  // window.voiceflow.chat.destroy();
  // window.voiceflow.chat.interact({
  //   type: "intent",
  //   payload: {
  //     intent: {
  //       name: "force_end_session", // Must match the intent name created on your canvas
  //     },
  //   },
  // });
  window.voiceflow.chat.interact({
    type: "end",
    payload: { reason: "user_requested" },
  });
  // window.voiceflow.chat.interact({
  //   action: {
  //     type: "launch",
  //   },
  // });

  const shadowRoot = document.getElementById("voiceflow-chat")?.shadowRoot as
    | (ShadowRoot & { _reactRootContainer?: { unmount: () => void } })
    | null
    | undefined;

  shadowRoot?._reactRootContainer?.unmount();

  if (shadowRoot && "_reactRootContainer" in shadowRoot) {
    delete (shadowRoot as unknown as Record<string, unknown>)
      ._reactRootContainer;
  }
}

function directChatbotInfoCard(router: ReturnType<typeof useRouter>): void {
  window.voiceflow.chat.close();
  // redirect to /dennie
  router.push("/dennie");
}

async function resetVoiceflowChat(): Promise<void> {
  const oldUserId = getUserId();
  if (!oldUserId) {
    return;
  }

  destroyVoiceflowChat();

  try {
    await deleteVoiceflowState(oldUserId);
  } catch (error) {
    console.error("[Voiceflow] Failed to delete server state:", error);
    throw error;
  } finally {
    clearVoiceflowSession();
  }
}

const VOICEFLOW_DEBUG = false;

export function VoiceflowWidget() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const router = useRouter();

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
        setIsClearConfirmOpen(false);
      }
    };

    if (VOICEFLOW_DEBUG) {
      console.log("[Voiceflow] message listener registered");
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function handleClearChatHistory(
    event: React.MouseEvent<HTMLButtonElement>,
  ): Promise<void> {
    event.preventDefault();
    setIsClearing(true);
    // setIsWidgetOpen(false);
    setIsClearConfirmOpen(false);

    try {
      await resetVoiceflowChat();
    } catch (error) {
      console.error("[Voiceflow] Failed to clear chat history:", error);
    } finally {
      setIsClearing(false);
    }
  }

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
        <div className="fixed bottom-6 right-20 z-[2147483647] flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 border-[#7a9e8e]/35 bg-white/95 text-[#4a5d54] shadow-md hover:bg-white hover:text-[#7a9e8e]"
            // asChild
            onClick={() => directChatbotInfoCard(router)}
          >
            {/* <Link href="/dennie" aria-label="Dennie chatbot info card">
              <InfoIcon className="size-4" />
              Chatbot Info Card
            </Link> */}
            <InfoIcon className="size-4" />
            Chatbot Info Card
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 bg-red-400 text-white shadow-md hover:bg-red-900 hover:text-white"
            onClick={() => setIsClearConfirmOpen(true)}
          >
            <TrashIcon className="size-4" /> Clear chat history
          </Button>
        </div>
      )}
      <AlertDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
      >
        <AlertDialogContent
          overlayClassName="z-[2147483646]"
          className="z-[2147483647]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
            <AlertDialogDescription>
              The conversation will be automatically deleted after 48 hours of
              inactivity. This action will delete the conversation immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isClearing}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleClearChatHistory}
            >
              {isClearing ? "Deleting..." : "Proceed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
