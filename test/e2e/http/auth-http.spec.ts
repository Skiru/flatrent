import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { authDataSource } from '../../../src/auth/infrastructure/persistence/auth-data-source';
import { HttpExceptionFilter } from '../../../src/shared/interfaces/http/http-exception.filter';
import * as crypto from 'crypto';

describe('Auth Bounded Context HTTP E2E Tests (Supertest)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Initialize Auth database schemas
    if (!authDataSource.isInitialized) {
      await authDataSource.initialize();
    }
    await authDataSource.dropDatabase();
    await authDataSource.runMigrations();

    // Bootstrap full NestJS application
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter()); // Use our custom RFC 9457 filter!
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (authDataSource.isInitialized) {
      await authDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Truncate tables for a completely clean clean-room run!
    await authDataSource.query('TRUNCATE TABLE user_accounts CASCADE');
    await authDataSource.query('TRUNCATE TABLE refresh_sessions CASCADE');
  });

  it('should register a new landlord, reject duplicates, and enforce local Zod validation schemas', async () => {
    const userId = crypto.randomUUID();

    // 1. Success Registration
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        id: userId,
        email: 'landlord@test.com',
        password: 'SecurePassword123',
        role: 'LANDLORD',
      })
      .expect(HttpStatus.CREATED);

    expect(regRes.body.id).toBe(userId);
    expect(regRes.body.email).toBe('landlord@test.com');

    // 2. Duplicate Registration Conflict
    const dupRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        id: crypto.randomUUID(),
        email: 'landlord@test.com',
        password: 'AnotherPassword999',
        role: 'LANDLORD',
      })
      .expect(HttpStatus.CONFLICT);

    expect(dupRes.body.errorCode).toBe('RESOURCE_ALREADY_EXISTS');
    expect(dupRes.body.title).toBe('Conflict');

    // 3. Schema Validation Failures (Invalid Email and Short Password)
    const failRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        id: crypto.randomUUID(),
        email: 'bad-email',
        password: 'short',
        role: 'LANDLORD',
      })
      .expect(HttpStatus.BAD_REQUEST);

    expect(failRes.body.errorCode).toBe('VALIDATION_FAILED');
    expect(failRes.body.invalidParams).toBeDefined();
    expect(failRes.body.invalidParams.length).toBeGreaterThan(0);
  });

  it('should authenticate user, rotate refresh tokens on refresh, and block access after logout', async () => {
    const userId = crypto.randomUUID();

    // Register
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        id: userId,
        email: 'tenant@test.com',
        password: 'SecurePassword123',
        role: 'TENANT',
      })
      .expect(HttpStatus.CREATED);

    // 1. Successful Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'tenant@test.com',
        password: 'SecurePassword123',
      })
      .expect(HttpStatus.OK);

    const { sessionId, refreshToken } = loginRes.body;
    expect(sessionId).toBeDefined();
    expect(refreshToken).toBeDefined();

    // 2. Successful Token Refresh & Rotation
    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        sessionId,
        refreshToken,
      })
      .expect(HttpStatus.OK);

    const nextRefreshToken = refreshRes.body.nextRefreshToken;
    expect(nextRefreshToken).toBeDefined();
    expect(nextRefreshToken).not.toBe(refreshToken); //rotated!

    // 3. Successful Logout
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ sessionId })
      .expect(HttpStatus.NO_CONTENT);

    // 4. Invalidation check: attempting to refresh again with the consumed token is rejected
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        sessionId,
        refreshToken: nextRefreshToken,
      })
      .expect(HttpStatus.BAD_REQUEST); // Revoked sessions throw validation/error detailing invalid session!
  });

  it('should block logins for accounts with BLOCKED status', async () => {
    const userId = crypto.randomUUID();

    // Register active user
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        id: userId,
        email: 'blocked@test.com',
        password: 'SecurePassword123',
        role: 'TENANT',
      })
      .expect(HttpStatus.CREATED);

    // Manually block the user account in database to test status-block invariant
    await authDataSource.query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE id = $1`, [
      userId,
    ]);

    // Attempt login must be rejected with 403 Forbidden
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'blocked@test.com',
        password: 'SecurePassword123',
      })
      .expect(HttpStatus.FORBIDDEN);

    expect(loginRes.body.errorCode).toBe('ACCOUNT_BLOCKED');
  });

  it('should revoke entire token family and raise security alert upon detecting token reuse', async () => {
    const userId = crypto.randomUUID();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        id: userId,
        email: 'attacker@test.com',
        password: 'SecurePassword123',
        role: 'TENANT',
      })
      .expect(HttpStatus.CREATED);

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'attacker@test.com',
        password: 'SecurePassword123',
      })
      .expect(HttpStatus.OK);

    const { sessionId, refreshToken } = loginRes.body;

    // Refresh 1 (legitimate client consumes initial token, rotates) -> yields nextToken
    const refreshRes1 = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ sessionId, refreshToken })
      .expect(HttpStatus.OK);

    const nextToken = refreshRes1.body.nextRefreshToken;

    // Refresh 2 (attacker submits reused initial token) -> reuse detected!
    const reuseRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ sessionId, refreshToken })
      .expect(HttpStatus.BAD_REQUEST); // Revoked/Reused sessions throw 400 Bad Request/Validation or details.

    expect(reuseRes.body.errorCode).toBe('VALIDATION_FAILED');

    // Legitimate client attempts to refresh using nextToken -> rejected due to family revocation!
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ sessionId, refreshToken: nextToken })
      .expect(HttpStatus.BAD_REQUEST);
  });
});
