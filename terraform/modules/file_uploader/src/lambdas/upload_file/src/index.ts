import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import crypto from "node:crypto";
import AWS from "aws-sdk";

const REGION = process.env.REGION || "eu-central-1";
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET || "s3-bucket-name";
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || "uploads/";
const EXPIRATION_TIME_S = Number.parseInt(process.env.EXPIRATION_TIME_S ?? "300", 10);
const API_NAME = process.env.API_NAME || "upload-file-api";
const PARTITION_KEY = process.env.PARTITION_KEY || "id";
const SORT_KEY = process.env.SORT_KEY || "file_key";

const s3 = new AWS.S3({
  region: REGION,
  signatureVersion: "v4",
  useAccelerateEndpoint: process.env.USE_S3_ACCEL === "true",
});

const corsHeaders: Record<string, string> = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,OPTIONS,PUT",
};

const cloudwatch = new AWS.CloudWatch();
async function emitMetric(metricName: string, value = 1): Promise<void> {
  try {
    await cloudwatch
      .putMetricData({
        Namespace: "Custom/API",
        MetricData: [
          {
            MetricName: metricName,
            Dimensions: [{ Name: "ApiName", Value: API_NAME }],
            Unit: "Count",
            Value: value,
          },
        ],
      })
      .promise();
  } catch (err) {
    console.error(`Failed to publish metric ${metricName}:`, err);
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  await emitMetric("PresignURLRequests");

  const query = event.queryStringParameters ?? {};
  const partitionKey = query[PARTITION_KEY];
  const originalFilename = query[SORT_KEY];
  const apiResource = query.resource;
  const mimeType = query.mimeType;
  const ext = query.ext;

  const missingParams: string[] = [];
  if (!partitionKey) missingParams.push(PARTITION_KEY);
  if (!originalFilename) missingParams.push(SORT_KEY);
  if (!apiResource) missingParams.push("resource");

  if (missingParams.length > 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Missing query params: ${missingParams.join(", ")}` }),
    };
  }

  try {
    const randomId = crypto.randomBytes(16).toString("base64url");
    const fileKey = `${UPLOAD_FOLDER}${apiResource}/${partitionKey}/${randomId}_${originalFilename}${ext ? `.${ext}` : ""}`;

    const presignedUrl = s3.getSignedUrl("putObject", {
      Bucket: UPLOAD_BUCKET,
      Key: fileKey,
      Expires: EXPIRATION_TIME_S,
      ContentType: mimeType,
      Metadata: { originalfilename: originalFilename },
    });

    await emitMetric("PresignURLSuccess");

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ upload_url: presignedUrl, file_key: fileKey }),
    };
  } catch (error: any) {
    console.error("Error generating putObject presigned URL:", error);
    await emitMetric("PresignURLFailed");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error?.message ?? "Internal server error" }),
    };
  }
};