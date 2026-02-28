import AWS from "aws-sdk";
import sharp from "sharp";
import type { SNSEvent, S3Event } from "aws-lambda";

const S3 = new AWS.S3();
const DynamoDB = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();

const DYNAMO_TABLE = process.env.DYNAMO_TABLE;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || "";
const THUMBNAIL_FOLDER = process.env.THUMBNAIL_FOLDER || "";
const BUCKET_AV_ENABLED = process.env.BUCKET_AV_ENABLED === "true";

const NAMESPACE_METADATA_WRITER = "Custom/MetadataWriter";
const NAMESPACE_THUMBNAIL = "Custom/ThumbnailGenerator";

async function emitMetric(metricName: string, value = 1, unit: "Count" | "Milliseconds" = "Count", namespace: string) {
  try {
    await cloudwatch
      .putMetricData({
        Namespace: namespace,
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Dimensions: [{ Name: "TableName", Value: DYNAMO_TABLE ?? "unknown" }],
          },
        ],
      })
      .promise();
  } catch (err) {
    console.error(`Failed to publish metric ${metricName}:`, err);
  }
}

type BucketAvSnsMessage = {
  bucket: string;
  key: string;
  status: string; // e.g. "clean"
};

function isSnsEvent(event: any): event is SNSEvent {
  return Array.isArray(event?.Records) && event.Records[0]?.Sns?.Message != null;
}

function isS3Event(event: any): event is S3Event {
  return Array.isArray(event?.Records) && event.Records[0]?.s3?.bucket?.name != null;
}

export const handler = async (event: unknown) => {
  try {
    console.log("Incoming event:", JSON.stringify(event, null, 2));

    if (!DYNAMO_TABLE) {
      console.error("Missing required env var DYNAMO_TABLE");
      return { statusCode: 500, body: "Server misconfigured" };
    }

    let bucket = "";
    let fileKey = "";

    if (BUCKET_AV_ENABLED) {
      if (!isSnsEvent(event)) {
        console.error("Expected SNS event but got something else");
        return { statusCode: 400, body: "Bad event type" };
      }

      const snsMessage = JSON.parse(event.Records[0].Sns.Message) as BucketAvSnsMessage;
      bucket = snsMessage.bucket;
      fileKey = decodeURIComponent(snsMessage.key);

      const uploadFolder = UPLOAD_FOLDER.trim().toLowerCase();
      if (!fileKey.toLowerCase().startsWith(uploadFolder)) {
        console.log(`Skipping (outside upload folder): ${fileKey}`);
        return { statusCode: 200, body: "File skipped" };
      }

      if (snsMessage.status !== "clean") {
        console.log(`Skipping non-clean file: ${fileKey}`);
        return { statusCode: 200, body: "File skipped (not clean)" };
      }
    } else {
      if (!isS3Event(event)) {
        console.error("Expected S3 event but got something else");
        return { statusCode: 400, body: "Bad event type" };
      }

      bucket = event.Records[0].s3.bucket.name;
      fileKey = decodeURIComponent(event.Records[0].s3.object.key);
    }

    const keyParts = fileKey.split("/");
    const apiResource = keyParts[1];
    const partitionKey = keyParts[2];
    const generatedFilename = keyParts[keyParts.length - 1];

    const obj = await S3.getObject({ Bucket: bucket, Key: fileKey }).promise();
    const contentType = obj.ContentType;
    const body = obj.Body;
    const contentLength = obj.ContentLength;
    const metadata = obj.Metadata;

    let thumbKey: string | null = null;

    if (contentType?.startsWith("image/") && body) {
      console.log(`Image detected: ${contentType}, generating thumbnail`);
      await emitMetric("ThumbnailRequested", 1, "Count", NAMESPACE_THUMBNAIL);

      try {
        const start = Date.now();
        const thumbnailBuffer = await sharp(body as Buffer).resize(200, 200).toBuffer();

        thumbKey = `${THUMBNAIL_FOLDER}${apiResource}/${partitionKey}/${generatedFilename}`;
        await S3.putObject({
          Bucket: bucket,
          Key: thumbKey,
          Body: thumbnailBuffer,
          ContentType: contentType,
        }).promise();

        await emitMetric("ThumbnailGenerated", 1, "Count", NAMESPACE_THUMBNAIL);
        await emitMetric("ThumbnailDuration", Date.now() - start, "Milliseconds", NAMESPACE_THUMBNAIL);
      } catch (err) {
        console.error("Thumbnail generation failed:", err);
        await emitMetric("ThumbnailFailed", 1, "Count", NAMESPACE_THUMBNAIL);
      }
    } else {
      console.log("Not an image — skipping thumbnail generation.");
    }

    const dynamoStart = Date.now();
    try {
      const existing = await DynamoDB.scan({
        TableName: DYNAMO_TABLE,
        FilterExpression: "#res = :res AND #id = :id AND selected = :trueVal",
        ExpressionAttributeNames: { "#res": "resource", "#id": "id" },
        ExpressionAttributeValues: { ":res": apiResource, ":id": partitionKey, ":trueVal": true },
      }).promise();

      const items = existing.Items ?? [];

      const transactItems: AWS.DynamoDB.DocumentClient.TransactWriteItemList = items.map((item) => ({
        Update: {
          TableName: DYNAMO_TABLE,
          Key: { id: (item as any).id, file_key: (item as any).file_key },
          UpdateExpression: "SET selected = :falseVal",
          ExpressionAttributeValues: { ":falseVal": false },
        },
      }));

      transactItems.push({
        Put: {
          TableName: DYNAMO_TABLE,
          Item: {
            id: partitionKey,
            resource: apiResource,
            file_key: fileKey,
            thumbnail_key: thumbKey,
            filename: metadata?.originalfilename || generatedFilename,
            uploaded_timestamp: new Date().toISOString(),
            file_size: contentLength,
            selected: true,
          },
        },
      });

      await DynamoDB.transactWrite({ TransactItems: transactItems }).promise();
      await emitMetric("DynamoWrites", 1, "Count", NAMESPACE_METADATA_WRITER);
    } catch (err) {
      console.error("DynamoDB error:", err);
      await emitMetric("DynamoWriteFailed", 1, "Count", NAMESPACE_METADATA_WRITER);
      throw err;
    }

    await emitMetric("DynamoLatency", Date.now() - dynamoStart, "Milliseconds", NAMESPACE_METADATA_WRITER);

    return { statusCode: 200, body: `Metadata recorded & thumbnail saved: ${thumbKey}` };
  } catch (err: any) {
    console.error("Fatal Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err?.message ?? "Internal server error" }) };
  }
};