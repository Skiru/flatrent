import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';
import { JwtPayload } from '../../../application/ports/jwt-issuer.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(jwtTokenService: JwtTokenService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtTokenService.getPublicKey(),
      algorithms: ['RS256'],
      passReqToCallback: true,
    });
  }

  public async validate(_req: unknown, payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException('Malformed token payload');
    }
    return payload;
  }
}
