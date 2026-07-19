# ADR-006: MiniStack Local AWS Emulation Environment

## Status
Accepted

## Context
For testing and local development, we require realistic AWS cloud services (S3, SQS, SNS, DynamoDB, RDS PostgreSQL, ElastiCache Redis) without deploying to the real cloud, which is slow, expensive, and requires active internet connections.

## Decision
We adopt **MiniStack** (Docker image `ministackorg/ministack:1.3.72`) as our official, offline AWS emulation environment.
1. **Compose Configuration**: We run MiniStack as a single Docker container exposing the control port `4566`.
2. **Real Data-Plane Containers**: RDS PostgreSQL and ElastiCache Redis inside MiniStack are real, physically isolated data-plane containers managed dynamically. Therefore, we mount `/var/run/docker.sock:/var/run/docker.sock` to allow MiniStack to spin up these containers.
3. **No Hardcoded Endpoints**: Instead of assuming fixed port assignments, we discover allocated ports dynamically through MiniStack's HTTP control plane APIs at startup. We generate a `.runtime/ministack.endpoints.json` manifest validated by Zod.
4. **Automated Bootstrap & Verification**: We write concrete TypeScript scripts:
   - `bootstrap-ministack.ts` — Provisions all resources (RDS Postgres DB instances, DynamoDB tables, SNS topics, SQS standard queues, SQS DLQs, ElastiCache Redis clusters).
   - `doctor-ministack.ts` — Verifies physical connectivity and executes actual data-plane read/write/message-relay checks to prove operational readiness.

## Consequences
- 100% offline, local development loop with excellent parity with real AWS service capabilities.
- Real transactional isolation: different database instances on Postgres are physically isolated from each other.
- Verified and resilient setup that runs identically on local developers' machines and CI systems.
