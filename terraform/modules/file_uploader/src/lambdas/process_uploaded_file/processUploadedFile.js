const AWS = require("aws-sdk");
const S3 = new AWS.S3();
const DynamoDB = new AWS.DynamoDB.DocumentClient();
const sharp = require("sharp");

const PARTITION_KEY = process.env.PARTITION_KEY || "id";
const SORT_KEY = process.env.SORT_KEY || "file_key";
const TABLE_NAME = process.env.DYNAMO_TABLE;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || "";
const THUMBNAIL_FOLDER = process.env.THUMBNAIL_FOLDER;
const IS_BUCKETAV_ENABLED = process.env.BUCKET_AV_ENABLED || false;

const NAMESPACE_METADATA_WRITER = "Custom/MetadataWriter";
const NAMESPACE_THUMBNAIL = "Custom/ThumbnailGenerator";
const cloudwatch = new AWS.CloudWatch();

/**
 * CloudWatch Metric Helper
 */
async function emitMetric(metricName, value, unit = "Count", namespace) {
    try {
        await cloudwatch
            .putMetricData({
                Namespace: namespace,
                MetricData: [
                    {
                        MetricName: metricName,
                        Value: value,
                        Unit: unit,
                        Dimensions: [
                            { Name: "TableName", Value: TABLE_NAME }
                        ]
                    }
                ]
            })
            .promise();
    } catch (err) {
        console.error(`❌ Failed to publish metric ${metricName}:`, err);
    }
}

exports.handler = async (event) => {
    try {
        console.log("Incoming event:", JSON.stringify(event, null, 2));

        let bucket = "";
        let fileKey = "";

        if (IS_BUCKETAV_ENABLED === "true") {
            // BucketAV SNS message
            const snsMessage = event.Records[0].Sns.Message;
            const message = JSON.parse(snsMessage);

            bucket = message.bucket;
            fileKey = decodeURIComponent(message.key);

            const uploadFolder = UPLOAD_FOLDER.trim().toLowerCase();
            const keyLower = fileKey.toLowerCase();

            if (!keyLower.startsWith(uploadFolder)) {
                console.log(`Skipping (outside upload folder): ${fileKey}`);
                return { statusCode: 200, body: "File skipped" };
            }

            if (message.status !== "clean") {
                console.log(`Skipping non-clean file: ${fileKey}`);
                return { statusCode: 200, body: "File skipped (not clean)" };
            }
        } else {
            // Simple S3 trigger
            bucket = event.Records[0].s3.bucket.name;
            fileKey = decodeURIComponent(event.Records[0].s3.object.key);
        }

        // ------------ Parse Key: uploads/trips/1/background.png ------------
        const keyParts = fileKey.split("/");
        const apiResource = keyParts[1];
        const partitionKey = keyParts[2];
        const filename = keyParts[keyParts.length - 1];

        // ------------ Download file ------------
        const { ContentType, Body } = await S3.getObject({
            Bucket: bucket,
            Key: fileKey,
        }).promise();

        // ------------ Thumbnail generation ------------
        let thumbKey = null;

        if (ContentType && ContentType.startsWith("image/")) {
            console.log(`Image File detected: ${ContentType}. Generating thumbnail.`);

            await emitMetric("ThumbnailRequested", 1, "Count", NAMESPACE_THUMBNAIL);

            const start = Date.now();
            try {
                // Generate thumbnail
                const thumbnailBuffer = await sharp(Body)
                    .resize(200, 200)
                    .toBuffer();

                // Upload back to S3
                thumbKey = `${THUMBNAIL_FOLDER}${apiResource}/${partitionKey}/${filename}`;

                await S3.putObject({
                    Bucket: bucket,
                    Key: thumbKey,
                    Body: thumbnailBuffer,
                    ContentType: ContentType
                }).promise();

                // Success metrics
                await emitMetric("ThumbnailGenerated", 1, "Count", NAMESPACE_THUMBNAIL);
                await emitMetric("ThumbnailDuration", Date.now() - start, "Milliseconds", NAMESPACE_THUMBNAIL);

            } catch (err) {
                console.error("❌ Thumbnail generation failed:", err);

                // Error metrics
                await emitMetric("ThumbnailFailed", 1, "Count", NAMESPACE_THUMBNAIL);
                await emitMetric("ThumbnailLambdaErrors", 1, "Count", NAMESPACE_THUMBNAIL);
            }

        } else {
            console.log("Not an image — skipping thumbnail generation.");
        }


        // ------------ DynamoDB metadata write ------------
        const dynamoStart = Date.now();

        try {
            const existing = await DynamoDB.scan({
                TableName: TABLE_NAME,
                FilterExpression: "#res = :res AND #id = :id AND selected = :trueVal",
                ExpressionAttributeNames: {
                    "#res": "resource",
                    "#id": "id",
                },
                ExpressionAttributeValues: {
                    ":res": apiResource,
                    ":id": partitionKey,
                    ":trueVal": true,
                },
            }).promise();


            const transactItems = [];

            // Set previous selected=true → false
            existing.Items.forEach((item) => {
                transactItems.push({
                    Update: {
                        TableName: TABLE_NAME,
                        Key: {
                            id: item.id,
                            file_key: item.file_key,
                        },
                        UpdateExpression: "SET selected = :falseVal",
                        ExpressionAttributeValues: { ":falseVal": false },
                    },
                });
            });

            // Insert new item with selected=true
            const newItem = {
                id: partitionKey,
                file_key: fileKey,
                resource: apiResource,
                thumbnail_key: thumbKey,
                selected: true,
            };

            transactItems.push({
                Put: {
                    TableName: TABLE_NAME,
                    Item: newItem,
                },
            });

            await DynamoDB.transactWrite({
                TransactItems: transactItems,
            }).promise();

            await emitMetric("DynamoWrites", 1, "Count", NAMESPACE_METADATA_WRITER);
        } catch (err) {
            console.error("DynamoDB error:", err);

            await emitMetric("DynamoWriteFailed", 1, "Count", NAMESPACE_METADATA_WRITER);

            // Optional: latency metric even on failure
            await emitMetric("DynamoLatency", Date.now() - dynamoStart, "Milliseconds", NAMESPACE_METADATA_WRITER);

            throw err;
        }

        // Dynamo latency metric (success path)
        await emitMetric("DynamoLatency", Date.now() - dynamoStart, "Milliseconds", NAMESPACE_METADATA_WRITER);

        return {
            statusCode: 200,
            body: `Metadata recorded & thumbnail saved: ${thumbKey}`,
        };

    } catch (err) {
        console.error("Fatal Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
