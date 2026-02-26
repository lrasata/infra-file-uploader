const AWS = require("aws-sdk");
const sharp = require("sharp");

const S3 = new AWS.S3();
const DynamoDB = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();

const PARTITION_KEY = process.env.PARTITION_KEY || "id";
const SORT_KEY = process.env.SORT_KEY || "file_key";
const TABLE_NAME = process.env.DYNAMO_TABLE;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || "";
const THUMBNAIL_FOLDER = process.env.THUMBNAIL_FOLDER;
const IS_BUCKETAV_ENABLED = process.env.BUCKET_AV_ENABLED === "true";

const NAMESPACE_METADATA_WRITER = "Custom/MetadataWriter";
const NAMESPACE_THUMBNAIL = "Custom/ThumbnailGenerator";

// CloudWatch helper
async function emitMetric(metricName, value = 1, unit = "Count", namespace) {
  try {
    await cloudwatch.putMetricData({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Dimensions: [{ Name: "TableName", Value: TABLE_NAME }],
        },
      ],
    });
  } catch (err) {
    console.error(`❌ Failed to publish metric ${metricName}:`, err);
  }
}

export const handler = async (event) => {
  try {
    console.log("Incoming event:", JSON.stringify(event, null, 2));

    let bucket = "";
    let fileKey = "";

    if (IS_BUCKETAV_ENABLED) {
      const snsMessage = JSON.parse(event.Records[0].Sns.Message);
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
      bucket = event.Records[0].s3.bucket.name;
      fileKey = decodeURIComponent(event.Records[0].s3.object.key);
    }

    const keyParts = fileKey.split("/");
    const apiResource = keyParts[1];
    const partitionKey = keyParts[2];
    const filename = keyParts[keyParts.length - 1];

    // Download file
    const { ContentType, Body, ContentLength, Metadata } = await S3.getObject({
      Bucket: bucket,
      Key: fileKey,
    });

    let thumbKey = null;

    if (ContentType?.startsWith("image/")) {
      console.log(`Image detected: ${ContentType}, generating thumbnail`);
      await emitMetric("ThumbnailRequested", 1, "Count", NAMESPACE_THUMBNAIL);

      try {
        const start = Date.now();
        const thumbnailBuffer = await sharp(Body).resize(200, 200).toBuffer();

        thumbKey = `${THUMBNAIL_FOLDER}${apiResource}/${partitionKey}/${filename}`;
        await S3.putObject({
          Bucket: bucket,
          Key: thumbKey,
          Body: thumbnailBuffer,
          ContentType,
        });

        await emitMetric("ThumbnailGenerated", 1, "Count", NAMESPACE_THUMBNAIL);
        await emitMetric("ThumbnailDuration", Date.now() - start, "Milliseconds", NAMESPACE_THUMBNAIL);
      } catch (err) {
        console.error("❌ Thumbnail generation failed:", err);
        await emitMetric("ThumbnailFailed", 1, "Count", NAMESPACE_THUMBNAIL);
      }
    } else {
      console.log("Not an image — skipping thumbnail generation.");
    }

    // DynamoDB metadata
    const dynamoStart = Date.now();
    try {
      const existing = await DynamoDB.scan({
        TableName: TABLE_NAME,
        FilterExpression: "#res = :res AND #id = :id AND selected = :trueVal",
        ExpressionAttributeNames: { "#res": "resource", "#id": "id" },
        ExpressionAttributeValues: { ":res": apiResource, ":id": partitionKey, ":trueVal": true },
      });

      const transactItems = existing.Items.map((item) => ({
        Update: {
          TableName: TABLE_NAME,
          Key: { id: item.id, file_key: item.file_key },
          UpdateExpression: "SET selected = :falseVal",
          ExpressionAttributeValues: { ":falseVal": false },
        },
      }));

      transactItems.push({
        Put: {
        TableName: TABLE_NAME,
        Item: {
            id: partitionKey,
            resource: apiResource,
            file_key: fileKey,
            thumbnail_key: thumbKey,
            filename: Metadata?.originalfilename;
            uploaded_timestamp: new Date().toISOString(),
            file_size: ContentLength,
            selected: true
          }
        },
      });

      await DynamoDB.transactWrite({ TransactItems: transactItems });
      await emitMetric("DynamoWrites", 1, "Count", NAMESPACE_METADATA_WRITER);
    } catch (err) {
      console.error("DynamoDB error:", err);
      await emitMetric("DynamoWriteFailed", 1, "Count", NAMESPACE_METADATA_WRITER);
      throw err;
    }

    await emitMetric("DynamoLatency", Date.now() - dynamoStart, "Milliseconds", NAMESPACE_METADATA_WRITER);

    return { statusCode: 200, body: `Metadata recorded & thumbnail saved: ${thumbKey}` };
  } catch (err) {
    console.error("Fatal Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
