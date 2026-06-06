export const VOICEFLOW_RUNTIME_URL = "https://general-runtime.voiceflow.com";

export function getVoiceflowConfig() {
  const projectId = process.env.NEXT_PUBLIC_VOICEFLOW_PROJECT_ID;
  const apiKey = process.env.VOICEFLOW_API_KEY;
  const versionId =
    process.env.VOICEFLOW_VERSION_ID ??
    process.env.NEXT_PUBLIC_VOICEFLOW_VERSION_ID ??
    process.env.NEXT_PUBLIC_VERSION_ID ??
    "main";

  if (!projectId || !apiKey) {
    throw new Error("Missing Voiceflow configuration");
  }

  return { projectId, apiKey, versionId };
}
