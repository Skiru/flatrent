import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  GiveNoticeCommand,
  GiveNoticeResult,
} from '../../../application/commands/give-notice/give-notice.command';
import { GiveNoticeUseCase } from '../../../application/commands/give-notice/give-notice.use-case';

@CommandHandler(GiveNoticeCommand)
export class GiveNoticeNestHandler implements ICommandHandler<GiveNoticeCommand, GiveNoticeResult> {
  constructor(private readonly useCase: GiveNoticeUseCase) {}

  public async execute(command: GiveNoticeCommand): Promise<GiveNoticeResult> {
    return this.useCase.execute(command);
  }
}
