import { getVoiceflowConfig, VOICEFLOW_RUNTIME_URL } from "@/lib/voiceflow/config";

export type VoiceflowInteractActionType = "launch" | "end";

export type VoiceflowAction = {
  type: VoiceflowInteractActionType | string;
  payload?: Record<string, unknown>;
  diagramID?: string;
  time?: number;
  metadata?: Record<string, unknown>;
};

export const voiceflowActions = {
  launch: (): VoiceflowAction => ({ type: "launch" }),
  end: (reason = "user_requested"): VoiceflowAction => ({
    type: "end",
    payload: { reason },
  }),
};

export type VoiceflowInteractResponse = {
  traces: unknown[];
};

export type VoiceflowCreateSessionResponse = {
  sessionKey: string;
  traces: unknown[];
};

export async function startVoiceflowSession(userId: string): Promise<string> {
  const { projectId, apiKey } = getVoiceflowConfig();

  const response = await fetch(
    `${VOICEFLOW_RUNTIME_URL}/v4/project/${encodeURIComponent(projectId)}/session`,
    {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userID: userId }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Voiceflow start session failed (${response.status}): ${body || response.statusText}`,
    );
  }

  const data = (await response.json()) as { sessionKey: string };
  return data.sessionKey;
}

export async function interactVoiceflowSession(
  sessionKey: string,
  action: VoiceflowAction,
): Promise<VoiceflowInteractResponse> {
  const response = await fetch(`${VOICEFLOW_RUNTIME_URL}/v4/interact`, {
    method: "POST",
    headers: {
      authorization: sessionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Voiceflow interact failed (${response.status}): ${body || response.statusText}`,
    );
  }

  return response.json() as Promise<VoiceflowInteractResponse>;
}

export async function createVoiceflowSession(
  userId: string,
  action: VoiceflowAction = { type: "launch" },
): Promise<VoiceflowCreateSessionResponse> {
  const sessionKey = await startVoiceflowSession(userId);
  const { traces } = await interactVoiceflowSession(sessionKey, action);

  return { sessionKey, traces };
}
