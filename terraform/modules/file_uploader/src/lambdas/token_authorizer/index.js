import AWS from "aws-sdk";

const API_GW_SECRET_TOKEN = process.env.API_GW_SECRET_TOKEN;

exports.handler = async function handler(event) {
  const token = event.authorizationToken;

  if (token === `Bearer ${API_GW_SECRET_TOKEN}`) {
    return {
      principalId: "user",
      policyDocument: {
        Version: "2012-10-17",
        Statement: [{ Action: "execute-api:Invoke", Effect: "Allow", Resource: event.methodArn }]
      }
    };
  }
  throw new Error("Unauthorized");
}
