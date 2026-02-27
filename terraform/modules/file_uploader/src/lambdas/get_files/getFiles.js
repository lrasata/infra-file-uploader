const AWS = require("aws-sdk");

const DynamoDB = new AWS.DynamoDB.DocumentClient();
const S3 = new AWS.S3();

const TABLE_NAME = process.env.DYNAMO_TABLE;
const BUCKET_NAME = process.env.UPLOAD_BUCKET;
const EXPIRATION_TIME_S = parseInt(process.env.EXPIRATION_TIME_S || "3600");

const corsHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-api-gateway-file-upload-auth,content-type",
  "access-control-allow-methods": "GET,OPTIONS,PUT"
};

exports.handler = async (event) => {
  try {
    const query = event.queryStringParameters || {};
    const id = query.id;
    const resource = query.resource;


    if (!id || !resource) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "id and resource are required" }),
      };
    }

    // Query DynamoDB for all matching items
    const params = {
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
        body: JSON.stringify({ error: "No images found" }),
      };
    }

    // Build a list of all items with presigned URLs
    const images = data.Items.map((item) => {
      const imageUrl = S3.getSignedUrl("getObject", {
        Bucket: BUCKET_NAME,
        Key: item.file_key,
        Expires: EXPIRATION_TIME_S,
      });

      return {
        filename: item.filename,
        uploaded_timestamp: item.uploaded_timestamp,
        file_size: item.file_size,
        image_url: imageUrl,
        // include any other metadata stored in DynamoDB
        ...item.metadata, // if you have a nested 'metadata' field
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
