const axios = require("axios");

const API_TOKEN = process.env.API_GW_SECRET_TOKEN;
const FETCH_FILES_ENDPOINT = process.env.UPSTREAM_GET_FILES_ENDPOINT;

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,OPTIONS"
};

exports.handler = async (event) => {
  const { id, resource } = event.queryStringParameters || {};

  if (!id || !resource) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing id or resource" }),
    };
  }

  try {
    // Don't throw on non-2xx so we can handle 404 specifically
    const response = await axios.get(FETCH_FILES_ENDPOINT, {
      params: { id, resource },
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      validateStatus: null
    });

    // Treat 404 as empty array
    if (response.status === 404) {
      console.warn(`Upstream returned 404 for id=${id}, resource=${resource}`);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    // Treat other non-2xx as actual errors
    if (response.status < 200 || response.status >= 300) {
      console.error("Upstream returned error:", response.status, response.data);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Failed to fetch images" })
      };
    }

    // Normal successful response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data)
    };
  } catch (err) {
    console.error("Error fetching images:", err.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to fetch images" }),
    };
  }
};
