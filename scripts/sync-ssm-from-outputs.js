const fs = require('fs');
const path = require('path');
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');

const outputsPath = path.join(__dirname, '../infra/cdk-outputs.json');

if (!fs.existsSync(outputsPath)) {
  console.error('Could not find infra/cdk-outputs.json. Run "cd infra && cdk deploy" first.');
  process.exit(1);
}

const outputsFile = JSON.parse(fs.readFileSync(outputsPath, 'utf8'));
const outputsRaw =
  outputsFile.ChatAppStack && typeof outputsFile.ChatAppStack === 'object'
    ? outputsFile.ChatAppStack
    : outputsFile;

const defaultRegion = outputsRaw['ChatAppStack.CognitoRegion'] || outputsRaw.CognitoRegion || 'us-east-2';
const region =
  process.env.SSM_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  defaultRegion;

const basePath = (process.env.SSM_BASE_PATH || '/chatapp/prod/').replace(/\/?$/, '/');
const overwrite = process.env.SSM_OVERWRITE !== 'false';

const envMapping = {
  NEXT_PUBLIC_API_GATEWAY_URL: outputsRaw['ChatAppStack.ApiBaseUrl'] || outputsRaw.ApiBaseUrl,
  NEXT_PUBLIC_API_BASE_URL: outputsRaw['ChatAppStack.ApiBaseUrl'] || outputsRaw.ApiBaseUrl,
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: outputsRaw['ChatAppStack.UserPoolId'] || outputsRaw.UserPoolId,
  NEXT_PUBLIC_COGNITO_CLIENT_ID: outputsRaw['ChatAppStack.UserPoolClientId'] || outputsRaw.UserPoolClientId,
  NEXT_PUBLIC_COGNITO_DOMAIN: outputsRaw['ChatAppStack.CognitoDomain'] || outputsRaw.CognitoDomain,
  NEXT_PUBLIC_AWS_REGION: outputsRaw['ChatAppStack.CognitoRegion'] || outputsRaw.CognitoRegion,
  NEXT_PUBLIC_DYNAMODB_USERS_TABLE: outputsRaw['ChatAppStack.UsersTableName'] || outputsRaw.UsersTableName,
  NEXT_PUBLIC_DYNAMODB_CONVERSATIONS_TABLE:
    outputsRaw['ChatAppStack.ConversationsTableName'] || outputsRaw.ConversationsTableName,
  NEXT_PUBLIC_DYNAMODB_MESSAGES_TABLE:
    outputsRaw['ChatAppStack.MessagesTableName'] || outputsRaw.MessagesTableName,
  NEXT_PUBLIC_DYNAMODB_FRIENDS_TABLE:
    outputsRaw['ChatAppStack.FriendsTableName'] || outputsRaw.FriendsTableName,
  NEXT_PUBLIC_DYNAMODB_FRIEND_REQUESTS_TABLE:
    outputsRaw['ChatAppStack.FriendRequestsTableName'] || outputsRaw.FriendRequestsTableName,
  NEXT_PUBLIC_S3_BUCKET: outputsRaw['ChatAppStack.UploadsBucketName'] || outputsRaw.UploadsBucketName,
  S3_BUCKET_NAME: outputsRaw['ChatAppStack.UploadsBucketName'] || outputsRaw.UploadsBucketName,
};

const entries = Object.entries(envMapping).filter(([, value]) => Boolean(value));

if (!entries.length) {
  console.error('No usable outputs detected in infra/cdk-outputs.json');
  process.exit(1);
}

const client = new SSMClient({ region });

async function main() {
  console.log(`Using region: ${region}`);
  console.log(`Writing parameters under: ${basePath}`);
  console.log(`Overwrite existing values: ${overwrite}`);

  for (const [envName, value] of entries) {
    const parameterName = `${basePath}${envName}`;
    console.log(`→ ${parameterName}`);

    await client.send(
      new PutParameterCommand({
        Name: parameterName,
        Value: value,
        Type: 'String',
        Overwrite: overwrite,
      }),
    );
  }

  console.log(`Successfully synced ${entries.length} parameters to SSM.`);
}

main().catch((err) => {
  console.error('Failed to sync parameters:', err);
  process.exit(1);
});
