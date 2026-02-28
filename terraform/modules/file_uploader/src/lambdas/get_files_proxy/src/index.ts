import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";

const API_GW_SECRET_TOKEN = process.env.API_GW_SECRET_TOKEN;
const FETCH_FILES_ENDPOINT = process.env.UPSTREAM_GET_FILES_ENDPOINT;

const corsHeaders: Record<string, string> = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { id, resource } = event.queryStringParameters ?? {};

  if (!id || !resource) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing id or resource" }),
    };
  }

  if (!FETCH_FILES_ENDPOINT || !API_GW_SECRET_TOKEN) {
    console.error("Missing required env vars", {
      FETCH_FILES_ENDPOINT: Boolean(FETCH_FILES_ENDPOINT),
      API_GW_SECRET_TOKEN: Boolean(API_GW_SECRET_TOKEN),
    });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server misconfigured" }),
    };
  }

  try {
    const response = await axios.get(FETCH_FILES_ENDPOINT, {
      params: { id, resource },
      headers: { Authorization: `Bearer ${API_GW_SECRET_TOKEN}` },
      validateStatus: () => true,
    });

    if (response.status === 404) {
      console.warn(`Upstream returned 404 for id=${id}, resource=${resource}`);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([]),
      };
    }

    if (response.status < 200 || response.status >= 300) {
      console.error("Upstream returned error:", response.status, response.data);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to fetch images" }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data),
    };
  } catch (err: any) {
    console.error("Error fetching images:", err?.message ?? err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to fetch images" }),
    };
  }
};