const AWS = require("aws-sdk");

const DynamoDB = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();

const TABLE_NAME = process.env.DYNAMO_TABLE;
const BUCKET_NAME = process.env.UPLOAD_BUCKET;

exports.handler = async (event) => {
  try {
    const { id, resource } = event;

    if (!id || !resource) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "id and resource are required" }),
      };
    }


    // Fetch selected image for this id + resource
    const imageResult = await DynamoDB.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: "#id = :id",
      FilterExpression: "#res = :res AND selected = :trueVal",
      ExpressionAttributeNames: {
        "#id": "id",
        "#res": "resource",
      },
      ExpressionAttributeValues: {
        ":id": id,
        ":res": resource,
        ":trueVal": true,
      },
    }).promise();

    const imageItem = imageResult.Items?.[0];

    if (!imageItem) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "No selected image found" }),
      };
    }

    // Generate presigned URL for image
    const imageUrl = S3.getSignedUrl("getObject", {
      Bucket: BUCKET_NAME,
      Key: imageItem.file_key,
      Expires: 3600,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        user: userData,
        image: {
          filename: imageItem.filename,
          uploaded_timestamp: imageItem.uploaded_timestamp,
          file_size: imageItem.file_size,
          image_url: imageUrl,
        },
      }),
    };

  } catch (err) {
    console.error("Error fetching data:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
