import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";

const DynamoDB = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();
const cloudwatch = new AWS.CloudWatch();

const TABLE_NAME = process.env.DYNAMO_TABLE;
const BUCKET_NAME = process.env.UPLOAD_BUCKET;
const EXPIRATION_TIME_S = Number.parseInt(process.env.EXPIRATION_TIME_S ?? "3600", 10);

const API_NAME = process.env.API_NAME || "get-files-api";

const corsHeaders: Record<string, string> = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};

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
  try {
    // Validate Bearer token
    const headers = event.headers ?? {};
    const authHeader = headers.Authorization ?? headers.authorization;

    const expectedToken = process.env.API_GW_SECRET_TOKEN;

    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      await emitMetric("PresignURLUnauthorized");
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const query = event.queryStringParameters ?? {};
    const id = query.id;
    const resource = query.resource;

    if (!id || !resource) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "id and resource are required" }),
      };
    }

    if (!TABLE_NAME || !BUCKET_NAME) {
      console.error("Missing required env vars", { TABLE_NAME, BUCKET_NAME });
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Server misconfigured" }),
      };
    }

    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#id = :id",
      FilterExpression: "#res = :res",
      ExpressionAttributeNames: {
        "#id": "id",
        "#res": "resource",
      },
      ExpressionAttributeValues: {
        ":id": id,
        ":res": resource,
      },
    };

    const data = await DynamoDB.query(params).promise();

    if (!data.Items || data.Items.length === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No images found" }),
      };
    }

    const images = data.Items.map((item) => {
      const fileKey = (item as any).file_key as string | undefined;

      const imageUrl =
        fileKey
          ? S3.getSignedUrl("getObject", {
              Bucket: BUCKET_NAME,
              Key: fileKey,
              Expires: EXPIRATION_TIME_S,
            })
          : undefined;

      return {
        filename: (item as any).filename,
        uploaded_timestamp: (item as any).uploaded_timestamp,
        file_size: (item as any).file_size,
        image_url: imageUrl,
        ...(typeof (item as any).metadata === "object" && (item as any).metadata ? (item as any).metadata : {}),
      };
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ images }),
    };
  } catch (err) {
    console.error("Error fetching data:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};