"use client";

import Script from "next/script";
import { FormExtension } from "@/components/chat/form-extension";

export function VoiceflowWidget() {
  return (
    <Script
      src="https://cdn.voiceflow.com/widget-next/bundle.mjs"
      strategy="lazyOnload"
      onLoad={() => {
        window.voiceflow.chat
          .load({
            verify: { projectID: process.env.NEXT_PUBLIC_VOICEFLOW_PROJECT_ID },
            url: "https://general-runtime.voiceflow.com",
            voice: {
              url: "https://runtime-api.voiceflow.com",
            },
            assistant: {
              extensions: [FormExtension],
            },
          })
          .then(() => {
            window.voiceflow.chat.proactive.push({
              type: "text",
              payload: { message: "Have other questions about me?" },
            });
          });
      }}
    />
  );
}
