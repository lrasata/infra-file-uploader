const AWS = require("aws-sdk");

const API_GW_SECRET_TOKEN = process.env.API_GW_SECRET_TOKEN;

exports.handler = async (event) => {
  const token = event.authorizationToken || "";

  // Strip "Bearer " prefix if present
  const incomingToken = token.startsWith("Bearer ") ? token.slice(7) : token;

  if (incomingToken === API_GW_SECRET_TOKEN) {
    return {
      principalId: "user", // can be any string
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: event.methodArn
          }
        ]
      }
    };
  }

  // Throw an error for denied access
  throw new Error("Unauthorized");
};