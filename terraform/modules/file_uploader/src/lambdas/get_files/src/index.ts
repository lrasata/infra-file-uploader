import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";

const DynamoDB = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();
const cloudwatch = new AWS.CloudWatch();

const DYNAMO_TABLE = process.env.DYNAMO_TABLE;
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET;
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
    await emitMetric("GetFilesRequests");

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

    if (!DYNAMO_TABLE || !UPLOAD_BUCKET) {
      console.error("Missing required env vars", { DYNAMO_TABLE, UPLOAD_BUCKET });
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Server misconfigured" }),
      };
    }

    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: DYNAMO_TABLE,
      IndexName: "ResourceIndex",      // Use the GSI
      KeyConditionExpression: "#res = :res",
      FilterExpression: "#id = :id",   // filter by id if needed
      ExpressionAttributeNames: {
        "#res": "resource",
        "#id": "id",
      },
      ExpressionAttributeValues: {
        ":res": resource,
        ":id": id,
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

      const url =
        fileKey
          ? S3.getSignedUrl("getObject", {
              Bucket: UPLOAD_BUCKET,
              Key: fileKey,
              Expires: EXPIRATION_TIME_S,
            })
          : undefined;

      return {
        filename: (item as any).filename,
        uploaded_timestamp: (item as any).uploaded_timestamp,
        size: (item as any).file_size,
        url: url,
        ...(typeof (item as any).metadata === "object" && (item as any).metadata ? (item as any).metadata : {}),
      };
    });

    await emitMetric("GetFilesSuccess");
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ images }),
    };
  } catch (err) {
    console.error("Error fetching data:", err);
    await emitMetric("GetFilesFailed");
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};