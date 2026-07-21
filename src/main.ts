import '@aws-sdk/client-dynamodb';
import '@aws-sdk/client-sns';
import '@aws-sdk/client-sqs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLogger } from './shared/infrastructure/logging/json-logger.service';

async function bootstrap() {
  const logger = new JsonLogger();
  const app = await NestFactory.create(AppModule, { logger });

  app.enableShutdownHooks();

  logger.log('Bootstrap: Initializing Flatren Modular Monolith application...', 'Main');
  await app.listen(3000);
  logger.log('Bootstrap: Flatren running on port 3000', 'Main');
}
bootstrap();
