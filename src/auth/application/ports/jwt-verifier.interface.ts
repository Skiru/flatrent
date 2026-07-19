import { JwtPayload } from './jwt-issuer.interface';

export interface JwtVerifier {
  verifyAccessToken(token: string): Promise<JwtPayload>;
}
export const JWT_VERIFIER_TOKEN = 'JwtVerifier';
