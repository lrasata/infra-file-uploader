const AWS = require("aws-sdk");
const crypto = require("crypto");

const REGION = process.env.REGION || "eu-central-1";
const BUCKET_NAME = process.env.UPLOAD_BUCKET || "s3-bucket-name";
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || "uploads/";
const EXPIRATION_TIME_S = parseInt(process.env.EXPIRATION_TIME_S || "300");
const API_GW_AUTH_SECRET = process.env.API_GW_AUTH_SECRET;
const API_NAME = process.env.API_NAME || "get-presigned-url-api";
const PARTITION_KEY = process.env.PARTITION_KEY || "id";
const SORT_KEY = process.env.SORT_KEY || "file_key";

const s3 = new AWS.S3({
  region: REGION,
  signatureVersion: "v4",
  useAccelerateEndpoint: process.env.USE_S3_ACCEL === "true"
});

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-api-gateway-file-upload-auth,content-type",
  "access-control-allow-methods": "GET,OPTIONS,PUT"
};

const cloudwatch = new AWS.CloudWatch();
async function emitMetric(metricName, value = 1) {
  try {
    await cloudwatch.putMetricData({
      Namespace: "Custom/API",
      MetricData: [{
        MetricName: metricName,
        Dimensions: [{ Name: "ApiName", Value: API_NAME }],
        Unit: "Count",
        Value: value
      }]
    });
  } catch (err) {
    console.error(`❌ Failed to publish metric ${metricName}:`, err);
  }
}

exports.handler = async (event) => {
  await emitMetric("PresignURLRequests");

  const headers = event.headers || {};
  const customHeader = headers["x-api-gateway-file-upload-auth"];

  if (customHeader !== API_GW_AUTH_SECRET) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Forbidden: Invalid or missing custom auth header" })
    };
  }

  const query = event.queryStringParameters || {};
  const partitionKey = query[PARTITION_KEY];
  const originalFilename = query[SORT_KEY];
  const extension = query.ext;
  const apiResource = query.resource;

  const missingParams = [];
  if (!partitionKey) missingParams.push(PARTITION_KEY);
  if (!originalFilename) missingParams.push(SORT_KEY);
  if (!extension) missingParams.push("ext");
  if (!apiResource) missingParams.push("resource");

  if (missingParams.length > 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Missing query params: ${missingParams.join(', ')}` })
    };
  }

  try {
    const randomId = crypto.randomBytes(16).toString("base64url");
    const fileKey = `${UPLOAD_FOLDER}${apiResource}/${partitionKey}/${randomId}_${originalFilename}${extension ? "." + extension : ""}`;

    const presignedUrl = s3.getSignedUrl("putObject", {
      Bucket: BUCKET_NAME,
      Key: fileKey,
      Expires: EXPIRATION_TIME_S
    });

    await emitMetric("PresignURLSuccess");

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        upload_url: presignedUrl,
        file_key: fileKey
      })
    };

  } catch (error) {
    console.error("Error generating presigned URL:", error);
    await emitMetric("PresignURLFailed");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
