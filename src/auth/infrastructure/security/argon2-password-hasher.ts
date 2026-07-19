import * as argon2 from 'argon2';
import { PasswordHasher } from '../../application/ports/password-hasher.interface';

/**
 * Argon2PasswordHasher implements secure Argon2id password hashing
 * using OWASP recommended parameters:
 * - memoryCost: 65536 KB (64 MB)
 * - timeCost: 3 iterations
 * - parallelism: 4 threads
 * - type: Argon2id
 */
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly options = {
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
    type: argon2.argon2id,
  };

  public async hash(password: string): Promise<string> {
    if (!password) {
      throw new Error('Password cannot be empty');
    }
    return argon2.hash(password, this.options);
  }

  public async compare(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
