import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { SNSClient, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { RDSClient, CreateDBInstanceCommand } from '@aws-sdk/client-rds';
import { ElastiCacheClient, CreateCacheClusterCommand } from '@aws-sdk/client-elasticache';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

const AWS_ENDPOINT_URL = 'http://localhost:4566';
const AWS_REGION = 'us-east-1';

// Databases
const AUTH_DB_NAME = 'flatren_auth';
const AUTH_DB_PORT = 15432;
const TENANCY_DB_NAME = 'flatren_tenancy';
const TENANCY_DB_PORT = 15433;

// Cache
const REDIS_HOST = 'localhost';
const REDIS_PORT = 16379;

// DynamoDB
const DYNAMODB_TABLE = 'flatren-maintenance-requests';

// SQS / SNS Messaging
const SNS_TOPIC_NAME = 'flatren-integration-events';
const SQS_MAINTENANCE_QUEUE = 'flatren-maintenance-tenancy-events';
const SQS_MAINTENANCE_DLQ = 'flatren-maintenance-tenancy-events-dlq';
const SQS_TENANCY_QUEUE = 'flatren-tenancy-maintenance-events';
const SQS_TENANCY_DLQ = 'flatren-tenancy-maintenance-events-dlq';

async function checkMiniStackHealth(): Promise<boolean> {
  console.log('Checking MiniStack health...');
  try {
    const response = await fetch(`${AWS_ENDPOINT_URL}/_ministack/health`);
    if (response.ok) {
      const data = await response.json();
      console.log(
        'MiniStack health status: Operational. Services:',
        Object.keys(data.services).length,
      );
      return true;
    }
  } catch (error) {
    console.warn('MiniStack is not yet ready:', (error as Error).message);
  }
  return false;
}

async function waitTcpPort(host: string, port: number, timeoutMs = 60000): Promise<boolean> {
  const start = Date.now();
  console.log(`Waiting for TCP port ${host}:${port}...`);
  while (Date.now() - start < timeoutMs) {
    try {
      const socket = new net.Socket();
      const promise = new Promise<boolean>((resolve) => {
        socket.setTimeout(1000);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
      });
      socket.connect(port, host);
      const isConnected = await promise;
      if (isConnected) {
        console.log(`Port ${host}:${port} is open!`);
        return true;
      }
    } catch {
      // Ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  console.error(`Timeout waiting for port ${host}:${port}`);
  return false;
}

async function bootstrapRDS(rds: RDSClient) {
  console.log('Provisioning Auth and Tenancy PostgreSQL RDS instances...');

  // Auth DB
  try {
    await rds.send(
      new CreateDBInstanceCommand({
        DBInstanceIdentifier: 'flatren-auth-db',
        Engine: 'postgres',
        DBInstanceClass: 'db.t3.micro',
        MasterUsername: 'admin',
        MasterUserPassword: 'pw123456',
        DBName: AUTH_DB_NAME,
        AllocatedStorage: 10,
      }),
    );
    console.log('RDS Auth Postgres creation initiated.');
  } catch (err: any) {
    console.log('RDS Auth Postgres already exists or is creating:', err.message);
  }

  // Tenancy DB
  try {
    await rds.send(
      new CreateDBInstanceCommand({
        DBInstanceIdentifier: 'flatren-tenancy-db',
        Engine: 'postgres',
        DBInstanceClass: 'db.t3.micro',
        MasterUsername: 'admin',
        MasterUserPassword: 'pw123456',
        DBName: TENANCY_DB_NAME,
        AllocatedStorage: 10,
      }),
    );
    console.log('RDS Tenancy Postgres creation initiated.');
  } catch (err: any) {
    console.log('RDS Tenancy Postgres already exists or is creating:', err.message);
  }
}

async function bootstrapElastiCache(elasticache: ElastiCacheClient) {
  console.log('Provisioning ElastiCache Redis cluster...');
  try {
    await elasticache.send(
      new CreateCacheClusterCommand({
        CacheClusterId: 'flatren-redis',
        Engine: 'redis',
        CacheNodeType: 'cache.t3.micro',
        NumCacheNodes: 1,
      }),
    );
    console.log('ElastiCache Redis creation initiated.');
  } catch (err: any) {
    console.log('Redis cluster already exists or is creating:', err.message);
  }
}

async function bootstrapDynamoDB(ddb: DynamoDBClient) {
  console.log(`Provisioning DynamoDB Table: ${DYNAMODB_TABLE}...`);
  try {
    await ddb.send(
      new CreateTableCommand({
        TableName: DYNAMODB_TABLE,
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }, // Primary Key (requestId)
        ],
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'rentalUnitId', AttributeType: 'S' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'RentalUnitIndex',
            KeySchema: [
              { AttributeName: 'rentalUnitId', KeyType: 'HASH' },
              { AttributeName: 'id', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
    console.log(`DynamoDB table ${DYNAMODB_TABLE} created successfully with RentalUnitIndex.`);
  } catch (err: any) {
    console.log('DynamoDB table already exists:', err.message);
  }
}

async function bootstrapSNSAndSQS(sns: SNSClient, sqs: SQSClient) {
  console.log('Provisioning SNS topic and SQS queues...');

  // Create SNS Topic
  const topicRes = await sns.send(new CreateTopicCommand({ Name: SNS_TOPIC_NAME }));
  const topicArn = topicRes.TopicArn || `arn:aws:sns:${AWS_REGION}:000000000000:${SNS_TOPIC_NAME}`;
  console.log(`SNS Topic created: ${topicArn}`);

  // Helper to create SQS Queue with DLQ
  const setupQueue = async (queueName: string, dlqName: string) => {
    // 1. Create DLQ
    const dlqRes = await sqs.send(new CreateQueueCommand({ QueueName: dlqName }));
    const dlqUrl = dlqRes.QueueUrl || '';
    const dlqAttr = await sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ['QueueArn'] }),
    );
    const dlqArn =
      dlqAttr.Attributes?.QueueArn || `arn:aws:sqs:${AWS_REGION}:000000000000:${dlqName}`;
    console.log(`DLQ ${dlqName} created: ${dlqArn}`);

    // 2. Create Main Queue pointing to DLQ
    const queueRes = await sqs.send(
      new CreateQueueCommand({
        QueueName: queueName,
        Attributes: {
          VisibilityTimeout: '60',
          ReceiveMessageWaitTimeSeconds: '20', // Long Polling
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: 5,
          }),
        },
      }),
    );
    const queueUrl = queueRes.QueueUrl || '';
    const queueAttr = await sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ['QueueArn'] }),
    );
    const queueArn =
      queueAttr.Attributes?.QueueArn || `arn:aws:sqs:${AWS_REGION}:000000000000:${queueName}`;
    console.log(`Main SQS ${queueName} created: ${queueArn}`);

    // 3. Set queue policy to allow SNS publishing
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'Allow-SNS-SendMessage',
          Effect: 'Allow',
          Principal: '*',
          Action: 'sqs:SendMessage',
          Resource: queueArn,
          Condition: {
            ArnEquals: {
              'aws:SourceArn': topicArn,
            },
          },
        },
      ],
    };
    await sqs.send(
      new SetQueueAttributesCommand({
        QueueUrl: queueUrl,
        Attributes: { Policy: JSON.stringify(policy) },
      }),
    );

    return { queueUrl, queueArn };
  };

  // Setup Tenancy and Maintenance Consumers
  const maintenanceInfo = await setupQueue(SQS_MAINTENANCE_QUEUE, SQS_MAINTENANCE_DLQ);
  const tenancyInfo = await setupQueue(SQS_TENANCY_QUEUE, SQS_TENANCY_DLQ);

  // Subscribe SQS to SNS Topic
  await sns.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'sqs',
      Endpoint: maintenanceInfo.queueArn,
      Attributes: {
        FilterPolicy: JSON.stringify({
          // Route Tenancy integration events to Maintenance queue
          producer: ['tenancy'],
        }),
      },
    }),
  );
  console.log(`Subscribed SQS ${SQS_MAINTENANCE_QUEUE} to SNS topic ${SNS_TOPIC_NAME}`);

  await sns.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'sqs',
      Endpoint: tenancyInfo.queueArn,
      Attributes: {
        FilterPolicy: JSON.stringify({
          // Route Maintenance integration events to Tenancy queue
          producer: ['maintenance'],
        }),
      },
    }),
  );
  console.log(`Subscribed SQS ${SQS_TENANCY_QUEUE} to SNS topic ${SNS_TOPIC_NAME}`);

  return {
    topicArn,
    maintenanceQueueUrl: maintenanceInfo.queueUrl,
    tenancyQueueUrl: tenancyInfo.queueUrl,
  };
}

async function run() {
  console.log('--- FLATREN MINISTACK BOOTSTRAP START ---');

  let healthy = false;
  for (let i = 0; i < 30; i++) {
    if (await checkMiniStackHealth()) {
      healthy = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (!healthy) {
    console.error('MiniStack did not become ready. Exiting.');
    process.exit(1);
  }

  const clientsConfig = {
    endpoint: AWS_ENDPOINT_URL,
    region: AWS_REGION,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  };

  const rds = new RDSClient(clientsConfig);
  const elasticache = new ElastiCacheClient(clientsConfig);
  const ddb = new DynamoDBClient(clientsConfig);
  const sns = new SNSClient(clientsConfig);
  const sqs = new SQSClient(clientsConfig);

  // Trigger parallel background provisioning in MiniStack
  await Promise.all([bootstrapRDS(rds), bootstrapElastiCache(elasticache), bootstrapDynamoDB(ddb)]);

  // Sync messaging setup
  const messaging = await bootstrapSNSAndSQS(sns, sqs);

  // Wait for real DB containers to be booted and ports bound
  console.log('Waiting for physical RDS and ElastiCache containers...');
  const isAuthDbReady = await waitTcpPort('localhost', AUTH_DB_PORT);
  const isTenancyDbReady = await waitTcpPort('localhost', TENANCY_DB_PORT);
  const isRedisReady = await waitTcpPort(REDIS_HOST, REDIS_PORT);

  if (!isAuthDbReady || !isTenancyDbReady || !isRedisReady) {
    console.error('Critical database or Redis container failed to become ready.');
    process.exit(1);
  }

  // Generate local env config
  const envContent = `# Flatren local AWS endpoints
AWS_REGION=${AWS_REGION}
AWS_ENDPOINT_URL=${AWS_ENDPOINT_URL}
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Database configs
AUTH_DATABASE_URL=postgresql://admin:pw123456@localhost:${AUTH_DB_PORT}/${AUTH_DB_NAME}?schema=public
TENANCY_DATABASE_URL=postgresql://admin:pw123456@localhost:${TENANCY_DB_PORT}/${TENANCY_DB_NAME}?schema=public

# Redis cache
REDIS_HOST=localhost
REDIS_PORT=${REDIS_PORT}
REDIS_TTL=3600

# DynamoDB table
DYNAMODB_MAINTENANCE_TABLE=${DYNAMODB_TABLE}

# SQS Queue URLs
SNS_INTEGRATION_EVENTS_TOPIC_ARN=${messaging.topicArn}
SQS_MAINTENANCE_QUEUE_URL=${messaging.maintenanceQueueUrl}
SQS_TENANCY_QUEUE_URL=${messaging.tenancyQueueUrl}
`;

  const targetPath = path.resolve(__dirname, '../../.env.local.generated');
  fs.writeFileSync(targetPath, envContent, 'utf-8');
  console.log(`Generated configuration successfully written to ${targetPath}`);

  const mainEnvPath = path.resolve(__dirname, '../../.env');
  fs.copyFileSync(targetPath, mainEnvPath);
  console.log(`Copied local generation to .env`);

  console.log('--- FLATREN MINISTACK BOOTSTRAP COMPLETE ---');
}

run().catch((err) => {
  console.error('Bootstrap script failed:', err);
  process.exit(1);
});
