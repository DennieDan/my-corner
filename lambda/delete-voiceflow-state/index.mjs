const VOICEFLOW_RUNTIME_URL = "https://general-runtime.voiceflow.com";

export async function handler(event) {
  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "userId is required" }),
    };
  }

  const projectId = process.env.NEXT_PUBLIC_VOICEFLOW_PROJECT_ID;
  const apiKey = process.env.VOICEFLOW_API_KEY;
  const versionId =
    process.env.VOICEFLOW_VERSION_ID ??
    process.env.NEXT_PUBLIC_VOICEFLOW_VERSION_ID ??
    process.env.NEXT_PUBLIC_VERSION_ID ??
    "main";

  if (!projectId || !apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing Voiceflow configuration" }),
    };
  }

  try {
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
      console.error("[Voiceflow] delete failed:", response.status, body);
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to delete Voiceflow state" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    console.error("[Voiceflow] delete error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to delete Voiceflow state" }),
    };
  }
}
