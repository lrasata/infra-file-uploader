import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";

const API_TOKEN = process.env.API_GW_SECRET_TOKEN;
const UPLOAD_FILE_ENDPOINT = process.env.UPSTREAM_UPLOAD_FILE_ENDPOINT;

const corsHeaders: Record<string, string> = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,OPTIONS,PUT",
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const { id, fileKey, resource, mimeType } = event.queryStringParameters ?? {};

  if (!id || !fileKey || !resource || !mimeType) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing query parameters" }),
    };
  }

  if (!UPLOAD_FILE_ENDPOINT || !API_TOKEN) {
    console.error("Missing required env vars", {
      UPLOAD_FILE_ENDPOINT: Boolean(UPLOAD_FILE_ENDPOINT),
      API_TOKEN: Boolean(API_TOKEN),
    });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server misconfigured" }),
    };
  }

  try {
    const response = await axios.get(UPLOAD_FILE_ENDPOINT, {
      params: { id, file_key: fileKey, resource, mimeType },
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data),
    };
  } catch (err: any) {
    console.error("Error getting presigned URL for upload:", err?.message ?? err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to get upload URL" }),
    };
  }
};