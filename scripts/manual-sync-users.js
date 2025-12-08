const fs = require('fs');
const path = require('path');
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    if (!key) return;
    const value = rest.join('=');
    if (value && !process.env[key]) {
      process.env[key] = value.trim();
    }
  });
}

const region =
  process.env.NEXT_PUBLIC_AWS_REGION ||
  process.env.SSM_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'us-east-2';

const credentials = (() => {
  const accessKeyId = process.env.AMPLIFY_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AMPLIFY_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  return accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;
})();

const cognitoClient = new CognitoIdentityProviderClient({
  region,
  ...(credentials ? { credentials } : {})
});

const ddbClient = new DynamoDBClient({
  region,
  maxAttempts: 3,
  ...(credentials ? { credentials } : {})
});

const docClient = DynamoDBDocumentClient.from(ddbClient);

const USERS_TABLE =
  process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE ||
  process.env.DYNAMODB_USERS_TABLE ||
  process.env.USERS_TABLE_NAME ||
  'chatapp-users';
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID;

if (!USER_POOL_ID) {
  console.error('USER_POOL_ID is not set. Please set NEXT_PUBLIC_COGNITO_USER_POOL_ID or COGNITO_USER_POOL_ID.');
  process.exit(1);
}

async function listAllUsers() {
  let PaginationToken;
  const users = [];
  do {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60,
      PaginationToken
    });
    const response = await cognitoClient.send(command);
    if (response.Users) {
      users.push(...response.Users);
    }
    PaginationToken = response.PaginationToken;
  } while (PaginationToken);
  return users;
}

function normalizeHandle(displayName, email) {
  const fallback = email?.split('@')[0] || 'user';
  const base = (displayName || fallback).toLowerCase().replace(/[^a-z0-9]/g, '');
  return (base || fallback.toLowerCase()).slice(0, 32);
}

async function upsertUser(userId, email, displayName, cognitoUsername, existing = null) {
  const trimmedEmail = (email || '').trim();
  const trimmedDisplayName = (displayName?.trim?.() || existing?.displayName || trimmedEmail.split('@')[0] || 'User').trim();
  const normalizedHandle = normalizeHandle(trimmedDisplayName, trimmedEmail);

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression:
        'SET email = :email, emailLower = :emailLower, displayName = :displayName, displayNameLower = :displayNameLower, username = :username, usernameLower = :usernameLower, cognitoUsername = :cognitoUsername, updatedAt = :updatedAt, createdAt = if_not_exists(createdAt, :createdAt)',
      ExpressionAttributeValues: {
        ':email': trimmedEmail,
        ':emailLower': trimmedEmail.toLowerCase(),
        ':displayName': trimmedDisplayName,
        ':displayNameLower': trimmedDisplayName.toLowerCase(),
        ':username': normalizedHandle,
        ':usernameLower': normalizedHandle,
        ':cognitoUsername': cognitoUsername,
        ':updatedAt': Date.now(),
        ':createdAt': Date.now()
      }
    })
  );
}

async function main() {
  console.log(`Syncing Cognito users from pool ${USER_POOL_ID} into ${USERS_TABLE} (${region})...`);
  const users = await listAllUsers();
  const results = { synced: 0, updated: 0, errors: 0 };

  for (const cognitoUser of users) {
    try {
      const subAttr = cognitoUser.Attributes?.find((attr) => attr.Name === 'sub');
      const emailAttr = cognitoUser.Attributes?.find((attr) => attr.Name === 'email');
      const nameAttr = cognitoUser.Attributes?.find((attr) => attr.Name === 'name');
      const userId = subAttr?.Value;

      if (!userId) continue;

      const getResult = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId }
        })
      );

      await upsertUser(
        userId,
        emailAttr?.Value || '',
        nameAttr?.Value || '',
        cognitoUser.Username,
        getResult.Item || null
      );

      if (getResult.Item) {
        results.updated += 1;
      } else {
        results.synced += 1;
      }
    } catch (err) {
      results.errors += 1;
      console.error('Error syncing user:', err);
    }
  }

  console.log('Sync complete:', results);
}

main().catch((err) => {
  console.error('Failed to sync users:', err);
  process.exit(1);
});
