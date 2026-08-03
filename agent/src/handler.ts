import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "GET" && event.rawPath.endsWith("/health")) {
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ status: "ok" }),
    };
  }

  return {
    statusCode: 501,
    headers: jsonHeaders,
    body: JSON.stringify({
      code: "NOT_IMPLEMENTED",
      message: "The chat agent is not implemented yet.",
    }),
  };
};
