import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { JwtIssuer, JwtPayload } from '../../application/ports/jwt-issuer.interface';
import { JwtVerifier } from '../../application/ports/jwt-verifier.interface';

export class JwtTokenService implements JwtIssuer, JwtVerifier {
  private readonly privateKey: string;
  private readonly publicKey: string;

  private readonly issuer = 'flatren-auth';
  private readonly audience = 'flatren-clients';

  constructor() {
    // Generate secure 2048-bit RSA keypair dynamically at boot
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  public async issueAccessToken(payload: JwtPayload): Promise<string> {
    const options: jwt.SignOptions = {
      algorithm: 'RS256',
      issuer: this.issuer,
      audience: this.audience,
      subject: payload.sub,
      jwtid: crypto.randomUUID(), // unique jti per token
      expiresIn: '15m', // 15 minutes access token expiry
      notBefore: '0s', // valid immediately
    };

    // Keep payload minimal (no credentials or large profiles)
    const data: Omit<JwtPayload, 'iss' | 'aud' | 'jti' | 'iat' | 'exp' | 'nbf' | 'sub'> = {
      email: payload.email,
      role: payload.role,
      sid: payload.sid,
    };

    return jwt.sign(data, this.privateKey, options);
  }

  public async verifyAccessToken(token: string): Promise<JwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.publicKey,
        {
          algorithms: ['RS256'],
          issuer: this.issuer,
          audience: this.audience,
        },
        (err: jwt.VerifyErrors | null, decoded: unknown) => {
          if (err) {
            return reject(err);
          }
          resolve(decoded as JwtPayload);
        },
      );
    });
  }

  public getPublicKey(): string {
    return this.publicKey;
  }
}
