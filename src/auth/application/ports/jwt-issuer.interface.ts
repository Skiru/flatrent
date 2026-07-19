export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  sid: string; // sessionId
  iss?: string;
  aud?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface JwtIssuer {
  issueAccessToken(payload: JwtPayload): Promise<string>;
}
export const JWT_ISSUER_TOKEN = 'JwtIssuer';
