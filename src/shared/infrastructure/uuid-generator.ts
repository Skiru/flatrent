import * as crypto from 'crypto';
import { IdGenerator } from '../application/ports/id-generator.interface';

export class UuidGenerator implements IdGenerator {
  public generate(): string {
    return crypto.randomUUID();
  }
}
