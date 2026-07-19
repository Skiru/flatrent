import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from './auth/application/commands/register-user/register-user.command';
import { RevokeSessionsCommand } from './auth/application/commands/revoke-sessions/revoke-sessions.command';
import { GetCurrentActorQuery } from './auth/application/queries/get-current-actor/get-current-actor.query';
import { UserRole } from './auth/domain/model/user-account.aggregate';

async function run() {
  // Headless context setup
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const commandBus = app.get(CommandBus);
  const queryBus = app.get(QueryBus);

  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'auth:create-user') {
      const [id, email, password, role] = args.slice(1);
      if (!id || !email || !password || !role) {
        console.error('Usage: auth:create-user <id> <email> <password> <role>');
        await app.close();
        process.exit(1);
      }
      const res = await commandBus.execute(
        new RegisterUserCommand(id, email, password, role as UserRole),
      );
      console.log(JSON.stringify({ status: 'SUCCESS', result: res }));
    } else if (command === 'auth:revoke-user-sessions') {
      const [userId] = args.slice(1);
      if (!userId) {
        console.error('Usage: auth:revoke-user-sessions <userId>');
        await app.close();
        process.exit(1);
      }
      await commandBus.execute(new RevokeSessionsCommand(userId));
      console.log(JSON.stringify({ status: 'SUCCESS', userId }));
    } else if (command === 'auth:inspect-user') {
      const [userId] = args.slice(1);
      if (!userId) {
        console.error('Usage: auth:inspect-user <userId>');
        await app.close();
        process.exit(1);
      }
      const res = await queryBus.execute(new GetCurrentActorQuery(userId));
      console.log(JSON.stringify({ status: 'SUCCESS', result: res }));
    } else {
      console.error(`Unknown command: ${command}`);
      await app.close();
      process.exit(1);
    }
    await app.close();
    process.exit(0);
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        status: 'ERROR',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    await app.close();
    process.exit(1);
  }
}

run();
export {};
