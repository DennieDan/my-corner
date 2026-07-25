import siteMetadata from "@/lib/site-config";

export const dennieInfoCard = {
  chatbotName: "Dennie",
  deployer: siteMetadata.author,
  purpose:
    "Dennie is a generative AI chatbot on My Corner. It is solely intended to help visitors discover information about Dan Dinh.",
  lastUpdated: "2026-07-23",
  version: "1.0",
  sections: [
    {
      id: "capabilities",
      title: "What Dennie can and cannot do",
      summary:
        "Dennie answers questions about Dan Dinh. It is not a general assistant and should not be used for advice outside that purpose.",
    },
    {
      id: "reliability",
      title: "Reliability and safety",
      summary:
        "Outputs may be incomplete, outdated, or incorrect. Verify important information before relying on it.",
    },
    {
      id: "data",
      title: "How user data is handled",
      summary:
        "Conversation data is processed by Voiceflow. Chat history is retained for a limited period. Conversations are not used to train models.",
    },
    {
      id: "reporting",
      title: "How to report issues",
      summary:
        "Contact Dan directly by email to report problems, inaccuracies, or concerns.",
    },
  ],
  capabilities: {
    intendedUses: [
      "Answer questions about Dan Dinh’s background, experience, and projects as presented on this website",
      "Help visitors discover information about Dan in a conversational format",
    ],
    limitations: [
      "Content may not be up to date",
      "Responses may be inaccurate or fabricated (hallucinations)",
      "Not intended for medical, legal, financial, or other professional advice",
      "Not a substitute for contacting Dan directly for consequential matters",
      "Not designed for crisis support, counselling, or emotional companionship",
    ],
  },
  reliability: {
    statements: [
      "Dennie is solely intended to help you discover information about Dan Dinh.",
      "Generative AI systems can produce incorrect or misleading answers. Treat Dennie’s replies as informational, not authoritative.",
      "For hiring, collaboration, or other consequential decisions, verify details against this website, Dan’s résumé, or by contacting Dan directly.",
    ],
    userPrecautions: [
      "Do not share sensitive personal, financial, or confidential information in chat.",
      "Do not rely on Dennie for urgent, high-stakes, or professional advice.",
    ],
  },
  data: {
    collected: [
      "Conversation history associated with your chat session (processed via Voiceflow)",
      "If you submit the contact form in chat: name, email, phone, and company — these fields are sent to Dan, the website owner",
    ],
    storage: [
      "Chat history is stored in the backend for up to 48 hours after inactivity, and may be deleted sooner if you clear the chat",
      "Content shown in the chat interface on your device is separate from backend state and is not visible in the backend after chat session deletion",
      "Voiceflow processes conversation data to operate the chatbot",
    ],
    training:
      "Conversations with Dennie are not used to train or fine-tune models.",
    controls: [
      "You can clear chat history from the chat interface when the chat is open. This deletes the conversation from the backend immediately where possible.",
      "Chat history is otherwise removed after about 48 hours of inactivity.",
    ],
  },
  reporting: {
    email: siteMetadata.email,
    issues: [
      "Inaccurate or misleading responses",
      "Inappropriate or unexpected behaviour",
      "Privacy or data concerns",
      "Other feedback about Dennie",
    ],
    process:
      "Send a clear description of the issue to the email above. Reports are reviewed by Dan. There is no automated acknowledgement; response time may vary.",
  },
} as const;
