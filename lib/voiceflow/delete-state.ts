import { getVoiceflowConfig, VOICEFLOW_RUNTIME_URL } from "@/lib/voiceflow/config";

export async function deleteVoiceflowStateForUser(
  userId: string,
): Promise<void> {
  const { projectId, apiKey, versionId } = getVoiceflowConfig();

  const response = await fetch(
    `${VOICEFLOW_RUNTIME_URL}/state/user/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: {
        authorization: apiKey,
        projectID: projectId,
        versionID: versionId,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Voiceflow delete failed (${response.status}): ${body || response.statusText}`,
    );
  }
}
