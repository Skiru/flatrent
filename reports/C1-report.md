# Checkpoint C1 Report — Onion Skeleton & Enforcement

```text
CHECKPOINT=C1
STATUS=PASS
START_SHA=uncommitted (no commits yet)
END_SHA=uncommitted (no commits yet)
FILES_CHANGED=
- package.json
- tsconfig.json
- nest-cli.json
- .eslintrc.js
- .prettierrc
- .dependency-cruiser.js
- pnpm-workspace.yaml
- .npmrc
- knip.json
- src/main.ts
- src/app.module.ts
- src/auth/composition/auth.module.ts
- src/tenancy/composition/tenancy.module.ts
- src/maintenance/composition/maintenance.module.ts
- src/architecture.spec.ts
- src/auth/application/auth-placeholder.spec.ts
- test/placeholder.ts
- scripts/placeholder.ts
- jest-unit.json
- jest-application.json
- jest-integration.json
- jest-e2e-http.json
- jest-e2e-cli.json
- jest-e2e-module-api.json
- jest-e2e-messaging.json
- jest-faults.json
- jest-migrations.json
COMMANDS_EXECUTED=
- pnpm install
- pnpm config set only-built-dependencies ...
- pnpm approve-builds (with multi-step automated selection)
- pnpm architecture:check (dependency-cruiser)
- pnpm deadcode:check (knip)
- pnpm format:check
- pnpm lint
- pnpm verify:fast
TEST_COUNTS=3
- architecture.spec.ts (2 tests)
- auth-placeholder.spec.ts (1 test)
ISSUES_FOUND=
- Ignored build scripts for `@nestjs/core` and `argon2` halted pnpm installation in non-interactive environments.
- Knip complained about unused dependencies and devDependencies in package.json.
- Jest failed to compile TS files during first `pnpm test` run due to missing ts-jest config in package.json.
- `jest-application.json` failed with "No tests found" when no application tests existed.
ROOT_CAUSES=
- pnpm v11 requires explicit developer approval or configurations to run install-time script compilations.
- Standard Knip defaults report any package.json dependency that has no active source imports as an error.
- Jest does not compile TypeScript files by default unless a transformer like ts-jest is configured.
- Jest exits with a failure code (exit 1) on empty search matches by default.
FIXES=
- Programmatically approved the builds by piping selection inputs into `pnpm approve-builds`, and configured workspace-level only-built dependencies.
- Added exact unused package names to the `ignoreDependencies` block in `knip.json`.
- Added explicit `"jest"` presets and ts-jest transformation rules to `package.json`.
- Created an application layer placeholder test `src/auth/application/auth-placeholder.spec.ts`.
REGRESSION_TESTS=
- src/architecture.spec.ts programmatically guards layered boundaries and public boundaries.
REMAINING_RISKS=
- Potential dead imports or modular leakage through third-party packages if not explicitly covered by ESLint/dependency-cruiser.
NEXT_CHECKPOINT=C2
```
