import { NextRequest, NextResponse } from 'next/server';
import { COGNITO_CONFIG, DYNAMODB_CONFIG, getAWSRegion, getServerAWSCredentials } from '@/lib/aws/unified-config';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const credentials = getServerAWSCredentials();

const cognitoClient = new CognitoIdentityProviderClient({
  region: getAWSRegion(),
  credentials
});

const dbClient = new DynamoDBClient({
  region: getAWSRegion(),
  credentials
});

const docClient = DynamoDBDocumentClient.from(dbClient);
const USERS_TABLE = DYNAMODB_CONFIG.tables.users;
const USER_POOL_ID = COGNITO_CONFIG.userPoolId;

export async function POST(request: NextRequest) {
  try {
    // Get all users from Cognito
    const cognitoUsers = await cognitoClient.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 60 // Max per request
    }));

    const results = {
      synced: 0,
      updated: 0,
      errors: 0
    };

    if (!cognitoUsers.Users) {
      return NextResponse.json({ results, message: 'No users found in Cognito' });
    }

    // For each Cognito user
    for (const cognitoUser of cognitoUsers.Users) {
      try {
        // Get the sub (unique user ID) from attributes
        const subAttr = cognitoUser.Attributes?.find(a => a.Name === 'sub');
        const userId = subAttr?.Value; // This is the Cognito sub (UUID)
        const cognitoUsername = cognitoUser.Username; // The actual Cognito username stored in pool
        
        if (!userId) continue;
        
        // Get email and name from attributes
        const emailAttr = cognitoUser.Attributes?.find(a => a.Name === 'email');
        const nameAttr = cognitoUser.Attributes?.find(a => a.Name === 'name');
        const email = emailAttr?.Value;
        const displayName = nameAttr?.Value;

        if (!email) continue;

        // Check if user exists in DynamoDB
        const getResult = await docClient.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId }
        }));

        if (getResult.Item) {
          // User exists - check if cognitoUsername is missing
          if (!getResult.Item.cognitoUsername) {
            // Update with cognitoUsername
            await docClient.send(new UpdateCommand({
              TableName: USERS_TABLE,
              Key: { userId },
              UpdateExpression: 'SET cognitoUsername = :cu',
              ExpressionAttributeValues: {
                ':cu': cognitoUsername
              }
            }));
            results.updated++;
          }
        } else {
          // User doesn't exist in DynamoDB - create entry
          // Get username from Cognito or derive from email
          const username = displayName?.toLowerCase().replace(/\s+/g, '_') || email.split('@')[0];
          
          await docClient.send(new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { userId },
            UpdateExpression: 'SET email = :e, displayName = :dn, username = :u, cognitoUsername = :cu, createdAt = if_not_exists(createdAt, :now)',
            ExpressionAttributeValues: {
              ':e': email,
              ':dn': displayName || email.split('@')[0],
              ':u': username,
              ':cu': cognitoUsername,
              ':now': Date.now()
            }
          }));
          results.synced++;
        }
      } catch (err) {
        console.error('Error syncing user:', err);
        results.errors++;
      }
    }

    return NextResponse.json({ 
      results, 
      message: 'Sync completed',
      totalCognitoUsers: cognitoUsers.Users.length
    });
  } catch (error) {
    console.error('Sync error:', error);
    const err = error as any;
    return NextResponse.json(
      { error: err.message || 'Sync failed' },
      { status: 500 }
    );
  }
}
