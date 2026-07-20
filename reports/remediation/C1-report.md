# Checkpoint C1 Report — Architectural Foundation

- TASK_ID: FLATREN_PRODUCTION_GRADE_REMEDIATION_AND_CERTIFICATION_V1
- CHECKPOINT: C1_ARCHITECTURAL_FOUNDATION_FINAL
- STATUS: PASS
- DECISION: CONTINUE

## Summary of Changes

1. **Removed `@Global()` decorator**:
   - `src/shared/composition/shared.module.ts` is no longer `@Global()`.
   - Explicitly imported `SharedModule` in `src/tenancy/composition/tenancy.module.ts` to satisfy dependencies of `MetricsRegistry` in Tenancy messaging and outbox.
2. **Strengthened Knip rules**:
   - Updated `knip.json` to make `exports: "error"` instead of `warn`.
   - Removed blanket `ignoreExports` rule to catch all dead code and unused exports.
3. **Fixed Unused Exports and Dead Code**:
   - Removed unused dependency injection token constants across all contexts.
   - Audited `@public` annotations to prevent silencing of genuine dead exports (such as domain events, repositories, and entities).
   - Annotated legitimate domain events and errors with JSDoc `/** @public */` only where genuinely justified as an external consumer surface.
4. **Onion Architecture and Dependency Verification**:
   - Verified that all imports conform strictly to interfaces -> application -> domain constraints.
   - Verified dependency-cruiser passes with 0 violations.

## Finding Matrix Summary

- **CHECKPOINT_LOCAL_OPEN_P0**: 0
- **CHECKPOINT_LOCAL_OPEN_P1**: 0
- **GLOBAL_OPEN_P0**: 19
- **GLOBAL_OPEN_P1**: 23

### Partially Fixed Global Findings
- **P0-19**: `STATUS=PARTIALLY_FIXED`
  - *Evidence*: Local quality gates (eslint, prettier, typecheck, dependency-cruiser, knip) are actively passing, but full CI pipelines with SBOM, mutation, security scans, and container smoke are not fully completed. It remains OPEN until verify:full genuinely invokes and passes all required gates in C10.

### Remaining Global Risks
- Unresolved C2-C10 defects across domain logic, transaction boundaries, local event dispatch, SQS consumers, outbox relays, and projections remain open, presenting potential transactional and boundary risks until their respective checkpoints are completed.

## Evidence

- `knip.json` config.
- `pnpm deadcode:check` output: 0 errors.
- `pnpm architecture:check` output: 0 errors.
- `pnpm typecheck` output: 0 errors.
- Unit and Application tests passed completely.
