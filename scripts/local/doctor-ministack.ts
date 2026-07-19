import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { Client } from 'pg';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const possiblePaths = [
    path.resolve(__dirname, '../../.env.local.generated'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split('=');
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          process.env[key] = val;
        }
      });
      console.log(`Loaded configuration from: ${p}`);
      return;
    }
  }
}

loadEnv();

const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const AUTH_DATABASE_URL =
  process.env.AUTH_DATABASE_URL ||
  'postgresql://admin:pw123456@localhost:15432/flatren_auth?schema=public';
const TENANCY_DATABASE_URL =
  process.env.TENANCY_DATABASE_URL ||
  'postgresql://admin:pw123456@localhost:15433/flatren_tenancy?schema=public';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '16379', 10);

const DYNAMODB_MAINTENANCE_TABLE =
  process.env.DYNAMODB_MAINTENANCE_TABLE || 'flatren-maintenance-requests';
const SNS_INTEGRATION_EVENTS_TOPIC_ARN = process.env.SNS_INTEGRATION_EVENTS_TOPIC_ARN || '';
const SQS_MAINTENANCE_QUEUE_URL = process.env.SQS_MAINTENANCE_QUEUE_URL || '';

async function testDatabase(dbUrl: string, label: string): Promise<boolean> {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const result = await client.query('SELECT 1 as result');
    if (result.rows && result.rows.length > 0 && String(result.rows[0].result) === '1') {
      console.log(`  [PASS] PostgreSQL SELECT 1 check passed for: ${label}`);
      return true;
    }
    throw new Error('Unexpected output');
  } catch (error) {
    console.error(`  [FAIL] PostgreSQL connection failed for ${label}:`, (error as Error).message);
    return false;
  } finally {
    await client.end();
  }
}

async function testRedis(): Promise<boolean> {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
  });
  try {
    const pingRes = await redis.ping();
    if (pingRes === 'PONG') {
      console.log(`  [PASS] Redis PING check passed on port ${REDIS_PORT}`);
      return true;
    }
    throw new Error(`Unexpected PING reply: ${pingRes}`);
  } catch (error) {
    console.error('  [FAIL] Redis PING connection check failed:', (error as Error).message);
    return false;
  } finally {
    await redis.quit();
  }
}

async function testDynamoDB(ddb: DynamoDBClient): Promise<boolean> {
  const testId = `req-doc-${Date.now()}`;
  const pk = `REQUEST#${testId}`;
  try {
    // PutItem
    await ddb.send(
      new PutItemCommand({
        TableName: DYNAMODB_MAINTENANCE_TABLE,
        Item: {
          PK: { S: pk },
          SK: { S: pk },
          id: { S: testId },
          rentalUnitId: { S: 'unit-999' },
          description: { S: 'Doctor script test request' },
        },
      }),
    );
    console.log(`  [PASS] DynamoDB PutItem on ${DYNAMODB_MAINTENANCE_TABLE}`);

    // GetItem
    const getRes = await ddb.send(
      new GetItemCommand({
        TableName: DYNAMODB_MAINTENANCE_TABLE,
        Key: {
          PK: { S: pk },
          SK: { S: pk },
        },
      }),
    );
    if (!getRes.Item || getRes.Item.id?.S !== testId) {
      throw new Error('Retrieved DynamoDB item mismatch or not found.');
    }
    console.log('  [PASS] DynamoDB GetItem validated content integrity');

    // Cleanup PutItem
    await ddb.send(
      new DeleteItemCommand({
        TableName: DYNAMODB_MAINTENANCE_TABLE,
        Key: {
          PK: { S: pk },
          SK: { S: pk },
        },
      }),
    );
    console.log('  [PASS] DynamoDB DeleteItem cleanup success');
    return true;
  } catch (error) {
    console.error('  [FAIL] DynamoDB operations failed:', (error as Error).message);
    return false;
  }
}

async function testMessaging(sns: SNSClient, sqs: SQSClient): Promise<boolean> {
  if (!SNS_INTEGRATION_EVENTS_TOPIC_ARN || !SQS_MAINTENANCE_QUEUE_URL) {
    console.error('  [FAIL] SNS/SQS endpoint variables are missing.');
    return false;
  }

  try {
    const testPayload = JSON.stringify({
      messageId: `msg-${Date.now()}`,
      eventType: 'TenancyActivated.v1',
      producer: 'tenancy', // Required to pass the subscription filter policy!
      payload: { rentalUnitId: 'unit-123' },
    });

    // 1. Publish to SNS topic
    await sns.send(
      new PublishCommand({
        TopicArn: SNS_INTEGRATION_EVENTS_TOPIC_ARN,
        Message: testPayload,
        MessageAttributes: {
          producer: {
            DataType: 'String',
            StringValue: 'tenancy', // Required by SQS subscription FilterPolicy!
          },
        },
      }),
    );
    console.log('  [PASS] SNS Publish integration event with message attributes');

    // 2. Poll and consume from SQS Queue
    const receiveRes = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: SQS_MAINTENANCE_QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 5,
      }),
    );

    const messages = receiveRes.Messages || [];
    if (messages.length === 0) {
      throw new Error(
        'Message not delivered to SQS. SNS filter policy mapping or subscriber might be broken.',
      );
    }

    const receivedMsg = messages[0];
    const parsedBody = JSON.parse(receivedMsg.Body || '{}');
    // MiniStack emulates raw message delivery or SNS wrapper.
    // If wrapping is present, body contains parsed SNS message envelope.
    const messageContent = parsedBody.Message ? parsedBody.Message : receivedMsg.Body;

    if (!messageContent.includes('unit-123')) {
      throw new Error(`Message body mismatch. Got: ${messageContent}`);
    }
    console.log('  [PASS] SQS ReceiveMessage: Successfully received and validated SNS message');

    // 3. Delete from SQS
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: SQS_MAINTENANCE_QUEUE_URL,
        ReceiptHandle: receivedMsg.ReceiptHandle!,
      }),
    );
    console.log('  [PASS] SQS DeleteMessage: Cleanup success');
    return true;
  } catch (error) {
    console.error('  [FAIL] SNS/SQS integration failed:', (error as Error).message);
    return false;
  }
}

async function run() {
  console.log('========================================');
  console.log('      FLATREN MINISTACK DOCTOR REPORT   ');
  console.log('========================================');

  const awsConfig = {
    endpoint: AWS_ENDPOINT_URL,
    region: AWS_REGION,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  };

  const ddb = new DynamoDBClient(awsConfig);
  const sns = new SNSClient(awsConfig);
  const sqs = new SQSClient(awsConfig);

  const authDbOk = await testDatabase(AUTH_DATABASE_URL, 'Auth Context DB');
  const tenancyDbOk = await testDatabase(TENANCY_DATABASE_URL, 'Tenancy Context DB');
  const redisOk = await testRedis();
  const ddbOk = await testDynamoDB(ddb);
  const messagingOk = await testMessaging(sns, sqs);

  console.log('----------------------------------------');
  console.log('VERDICT:');
  const allOk = authDbOk && tenancyDbOk && redisOk && ddbOk && messagingOk;
  if (allOk) {
    console.log('>>> [PASS] ALL FLATREN CLOUD SYSTEMS ARE OPERATIONAL <<<');
    console.log('========================================');
    process.exit(0);
  } else {
    console.error('>>> [FAIL] SOME SYSTEMS FAILED DOCTOR CHECKS <<<');
    console.log('========================================');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Doctor script crashed:', err);
  process.exit(1);
});
