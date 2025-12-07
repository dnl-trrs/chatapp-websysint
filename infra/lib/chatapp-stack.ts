import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { HttpApi, CorsHttpMethod, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { UserPool, UserPoolClient, UserPoolDomain, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class ChatAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPool = new UserPool(this, 'UserPool', {
      userPoolName: 'chatapp-user-pool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      userVerification: {
        emailStyle: VerificationEmailStyle.LINK,
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false,
    });

    userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: 'chatapp-websysint',
      },
    });

    // DynamoDB tables (fresh)
    const usersTable = new Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const conversationsTable = new Table(this, 'ConversationsTable', {
      partitionKey: { name: 'conversationId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const messagesTable = new Table(this, 'MessagesTable', {
      partitionKey: { name: 'conversationId', type: AttributeType.STRING },
      sortKey: { name: 'timestamp', type: AttributeType.NUMBER },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const friendsTable = new Table(this, 'FriendsTable', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'friendId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const friendRequestsTable = new Table(this, 'FriendRequestsTable', {
      partitionKey: { name: 'requestId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const uploadsBucket = new Bucket(this, 'UploadsBucket', {
      publicReadAccess: true, // simplify: public-read objects
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: false,
      blockPublicAccess: {
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      },
    });

    // Allow browser uploads via presigned PUT
    uploadsBucket.addCorsRule({
      allowedOrigins: ['*'], // tighten later
      allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
      allowedHeaders: ['*'],
      exposedHeaders: ['ETag'],
      maxAge: 3600,
    });

    const bff = new NodejsFunction(this, 'BffLambda', {
      entry: path.resolve(__dirname, '../../lambda/bff.ts'),
      runtime: Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(15),
      tracing: Tracing.ACTIVE,
      environment: {
        REGION: Stack.of(this).region,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        USERS_TABLE_NAME: usersTable.tableName,
        CONVERSATIONS_TABLE_NAME: conversationsTable.tableName,
        MESSAGES_TABLE_NAME: messagesTable.tableName,
        FRIENDS_TABLE_NAME: friendsTable.tableName,
        FRIEND_REQUESTS_TABLE_NAME: friendRequestsTable.tableName,
        UPLOADS_BUCKET_NAME: uploadsBucket.bucketName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2021',
      },
    });

    bff.addToRolePolicy(new PolicyStatement({
      actions: ['cognito-idp:DescribeUserPoolClient'],
      resources: [userPool.userPoolArn],
    }));

    usersTable.grantReadWriteData(bff);
    conversationsTable.grantReadWriteData(bff);
    messagesTable.grantReadWriteData(bff);
    friendsTable.grantReadWriteData(bff);
    friendRequestsTable.grantReadWriteData(bff);
    uploadsBucket.grantReadWrite(bff);

    const api = new HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowCredentials: false,
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'], // tighten later
        maxAge: Duration.hours(12),
      },
    });

    const integration = new HttpLambdaIntegration('BffIntegration', bff);
    api.addRoutes({ path: '/api', methods: [HttpMethod.ANY], integration });
    api.addRoutes({ path: '/api/{proxy+}', methods: [HttpMethod.ANY], integration });

    new CfnOutput(this, 'ApiBaseUrl', { value: api.apiEndpoint });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, 'CognitoRegion', { value: Stack.of(this).region });
    new CfnOutput(this, 'UsersTableName', { value: usersTable.tableName });
    new CfnOutput(this, 'ConversationsTableName', { value: conversationsTable.tableName });
    new CfnOutput(this, 'MessagesTableName', { value: messagesTable.tableName });
    new CfnOutput(this, 'FriendsTableName', { value: friendsTable.tableName });
    new CfnOutput(this, 'FriendRequestsTableName', { value: friendRequestsTable.tableName });
    new CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });

    // Store outputs in SSM Parameter Store
    new ssm.StringParameter(this, 'ApiBaseUrlParam', {
      parameterName: '/chatapp/prod/NEXT_PUBLIC_API_BASE_URL',
      stringValue: api.apiEndpoint,
    });
    new ssm.StringParameter(this, 'UserPoolIdParam', {
      parameterName: '/chatapp/prod/NEXT_PUBLIC_COGNITO_USER_POOL_ID',
      stringValue: userPool.userPoolId,
    });
    new ssm.StringParameter(this, 'UserPoolClientIdParam', {
      parameterName: '/chatapp/prod/NEXT_PUBLIC_COGNITO_CLIENT_ID',
      stringValue: userPoolClient.userPoolClientId,
    });
    new ssm.StringParameter(this, 'CognitoRegionParam', {
      parameterName: '/chatapp/prod/NEXT_PUBLIC_AWS_REGION',
      stringValue: Stack.of(this).region,
    });
    new ssm.StringParameter(this, 'UploadsBucketNameParam', {
        parameterName: '/chatapp/prod/NEXT_PUBLIC_S3_BUCKET',
        stringValue: uploadsBucket.bucketName,
    });
  }
}
