import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class JsonLogger implements LoggerService {
  private redact(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'string') {
      if (
        /bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/i.test(obj) ||
        /auth/i.test(obj)
      ) {
        return '[REDACTED_SENSITIVE_STRING]';
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.redact(item));
    }
    if (typeof obj === 'object') {
      const typedObj = obj as Record<string, unknown>;
      const redacted: Record<string, unknown> = {};
      for (const key of Object.keys(typedObj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('authorization') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key') ||
          lowerKey.includes('credential') ||
          lowerKey.includes('hash') ||
          lowerKey.includes('salt')
        ) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = this.redact(typedObj[key]);
        }
      }
      return redacted;
    }
    return obj;
  }

  private logMessage(
    level: string,
    message: unknown,
    context?: string,
    ...optionalParams: unknown[]
  ) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      context: context || 'Application',
      message: typeof message === 'string' ? message : this.redact(message),
      optionalParams: optionalParams.length > 0 ? this.redact(optionalParams) : undefined,
    };

    const output = JSON.stringify(logObject);
    if (level === 'error' || level === 'warn') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  public log(message: unknown, context?: string, ...optionalParams: unknown[]) {
    this.logMessage('info', message, context, ...optionalParams);
  }

  public error(message: unknown, trace?: string, context?: string, ...optionalParams: unknown[]) {
    this.logMessage('error', message, context, trace, ...optionalParams);
  }

  public warn(message: unknown, context?: string, ...optionalParams: unknown[]) {
    this.logMessage('warn', message, context, ...optionalParams);
  }

  public debug?(message: unknown, context?: string, ...optionalParams: unknown[]) {
    this.logMessage('debug', message, context, ...optionalParams);
  }

  public verbose?(message: unknown, context?: string, ...optionalParams: unknown[]) {
    this.logMessage('verbose', message, context, ...optionalParams);
  }
}
