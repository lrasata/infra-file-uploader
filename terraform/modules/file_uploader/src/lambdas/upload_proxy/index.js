const axios = require("axios");

const API_TOKEN = process.env.API_GW_SECRET_TOKEN;
const UPLOAD_FILE_ENDPOINT = process.env.UPSTREAM_UPLOAD_FILE_ENDPOINT;

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,OPTIONS,PUT"
};

exports.handler = async (event) => {

    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: null,
      };
    }
  // Extract query parameters
  const { id, fileKey, resource, mimeType } = event.queryStringParameters || {};

  if (!id || !fileKey || !resource || !mimeType) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing query parameters" }),
    };
  }

  try {
    // Call upstream API with injected token
    const response = await axios.get(UPLOAD_FILE_ENDPOINT, {
      params: { id, file_key: fileKey, resource, mimeType },
      headers: { Authorization: `Bearer ${API_TOKEN}` }
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response.data),
      headers: corsHeaders,
    };
  } catch (err) {
    console.error("Error getting presigned URL for upload:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to get upload URL" }),
      headers: corsHeaders,
    };
  }
};
