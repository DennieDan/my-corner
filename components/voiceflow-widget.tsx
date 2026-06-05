"use client";

import Script from "next/script";

export function VoiceflowWidget() {
  return (
    <Script
      src="https://cdn.voiceflow.com/widget-next/bundle.mjs"
      strategy="lazyOnload"
      onLoad={() => {
        window.voiceflow.chat.load({
          verify: { projectID: "6a1d03ef495496cb314ca703" },
          url: "https://general-runtime.voiceflow.com",
          voice: {
            url: "https://runtime-api.voiceflow.com",
          },
        });
      }}
    />
  );
}
