import siteMetadata from "@/lib/site-config";

export const dennieInfoCard = {
  chatbotName: "Dennie",
  deployer: siteMetadata.author,
  purpose:
    "Dennie is a generative AI chatbot on My Corner. It is solely intended to help visitors discover information about Dan Dinh.",
  lastUpdated: "2026-10-20",
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
        "Recent chat history stays in this browser. Messages are sent to the Dennie agent to answer each question.",
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
      "Your current question, up to 12 recent messages, and a random browser session identifier are sent to the agent API",
    ],
    storage: [
      "Up to 12 recent messages are kept in this browser's local storage for at most seven days, or until you clear them or your browser removes site data",
      "The question is sent to an AWS-hosted agent. AWS Bedrock retrieves relevant public source material, and the question, recent conversation, and selected sources are sent to OpenAI to generate an answer",
      "The agent does not keep a server-side chat transcript. AWS CloudWatch keeps operational logs, including request IDs, outcomes, timing, token counts, and source IDs, for 30 days without complete prompts or answers",
      "OpenAI's API may retain abuse-monitoring logs for up to 30 days under its data controls. The agent requests that OpenAI not store the generated response as application state",
    ],
    training:
      "Dennie's API request does not opt in to model training. OpenAI says API data is not used to train its models by default unless the API account separately opts in to data sharing.",
    controls: [
      "Select Clear conversation in the chat interface to remove recent messages and replace the random session identifier in this browser immediately. Clearing this browser does not delete data already processed by AWS or OpenAI.",
      "You can stop a response while it is streaming.",
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
