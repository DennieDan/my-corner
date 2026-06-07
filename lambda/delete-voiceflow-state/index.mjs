const VOICEFLOW_RUNTIME_URL = "https://general-runtime.voiceflow.com";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS ?? process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getRequestOrigin(event) {
  const headers = event.headers ?? {};
  return headers.origin ?? headers.Origin ?? "";
}

function getRequestMethod(event) {
  return event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
}

function resolveAllowedOrigin(requestOrigin, allowedOrigins) {
  if (!requestOrigin) {
    return null;
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

function corsHeaders(requestOrigin, allowedOrigins) {
  const allowOrigin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
  if (!allowOrigin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(statusCode, body, requestOrigin, allowedOrigins) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(requestOrigin, allowedOrigins),
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = getRequestOrigin(event);
  const method = getRequestMethod(event);

  if (method === "OPTIONS") {
    if (!resolveAllowedOrigin(requestOrigin, allowedOrigins)) {
      return { statusCode: 403, body: "" };
    }

    return {
      statusCode: 204,
      headers: corsHeaders(requestOrigin, allowedOrigins),
      body: "",
    };
  }

  if (method !== "DELETE") {
    return jsonResponse(
      405,
      { error: "Method not allowed" },
      requestOrigin,
      allowedOrigins,
    );
  }

  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return jsonResponse(
      400,
      { error: "userId is required" },
      requestOrigin,
      allowedOrigins,
    );
  }

  const projectId = process.env.NEXT_PUBLIC_VOICEFLOW_PROJECT_ID;
  const apiKey = process.env.VOICEFLOW_API_KEY;
  const versionId =
    process.env.VOICEFLOW_VERSION_ID ??
    process.env.NEXT_PUBLIC_VOICEFLOW_VERSION_ID ??
    process.env.NEXT_PUBLIC_VERSION_ID ??
    "main";

  if (!projectId || !apiKey) {
    return jsonResponse(
      500,
      { error: "Missing Voiceflow configuration" },
      requestOrigin,
      allowedOrigins,
    );
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
      return jsonResponse(
        response.status,
        { error: "Failed to delete Voiceflow state" },
        requestOrigin,
        allowedOrigins,
      );
    }

    return jsonResponse(200, { ok: true }, requestOrigin, allowedOrigins);
  } catch (error) {
    console.error("[Voiceflow] delete error:", error);
    return jsonResponse(
      500,
      { error: "Failed to delete Voiceflow state" },
      requestOrigin,
      allowedOrigins,
    );
  }
}
