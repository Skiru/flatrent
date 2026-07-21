# Knip Entry Export Failure Capture Report

This report captures the results of running the repository-pinned Knip binary under Node 22.23.1 and pnpm 11.13.1 for all required variants.

- **Knip Version**: `5.0.1` (reported as `4.4.0` in `--version` output but resolved via `package.json` and `node_modules` as `5.0.1`)
- **Node Version**: `22.23.1`
- **pnpm Version**: `11.13.1`

---

## 1. Command Outputs and Exit Codes

### Command 1: `pnpm exec knip`
- **Exit Code**: `0`
- **Output Path**: Standard Output
- **Unused Files**: `0`
- **Unused Exports**: `0`
- **Unused Types**: `0`
- **Unused Dependencies**: `0`
- **Config Hints**:
  - `Unused item in ignoreDependencies: @aws-sdk/client-dynamodb`
  - `Unused item in ignoreDependencies: @aws-sdk/client-sns`
  - `Unused item in ignoreDependencies: @aws-sdk/client-sqs`
  - `Unused item in ignoreBinaries: nest`
- **Tag Hints**: `0`

### Command 2: `pnpm exec knip --production`
- **Exit Code**: `0`
- **Output Path**: Standard Output
- **Unused Files**: `0`
- **Unused Exports**: `0`
- **Unused Types**: `0`
- **Unused Dependencies**: `0`
- **Config Hints**: `0`
- **Tag Hints**: `0`

### Command 3: `pnpm exec knip --include-entry-exports`
- **Exit Code**: `1`
- **Output Path**: Standard Output
- **Unused Files**: `0`
- **Unused Exports**: `1`
  - `LOCAL_EVENT_DISPATCHER_TENANCY_TOKEN` (`src/tenancy/composition/tenancy.module.ts:195:14`)
- **Unused Types**: `0`
- **Unused Dependencies**: `0`
- **Config Hints**:
  - `Unused item in ignoreDependencies: @aws-sdk/client-dynamodb`
  - `Unused item in ignoreDependencies: @aws-sdk/client-sns`
  - `Unused item in ignoreDependencies: @aws-sdk/client-sqs`
  - `Unused item in ignoreBinaries: nest`
- **Tag Hints**: `0`

### Command 4: `pnpm exec knip --production --include-entry-exports`
- **Exit Code**: `1`
- **Output Path**: Standard Output
- **Unused Files**: `0`
- **Unused Exports**: `3`
  - `authDataSource` (`src/auth/infrastructure/persistence/auth-data-source.ts:28:14`)
  - `LOCAL_EVENT_DISPATCHER_TENANCY_TOKEN` (`src/tenancy/composition/tenancy.module.ts:195:14`)
  - `tenancyDataSource` (`src/tenancy/infrastructure/persistence/tenancy-data-source.ts:37:14`)
- **Unused Types**: `0`
- **Unused Dependencies**: `0`
- **Config Hints**: `0`
- **Tag Hints**: `0`

### Command 5: `pnpm exec knip --include-entry-exports --debug`
- **Exit Code**: `1`
- **Output Path**: Saved to `/Users/mkoziol/.local/share/kilo/tool-output/tool_f8322b354001vzerqT9Btc4fqN`
- **Unused Files**: `0`
- **Unused Exports**: `1`
  - `LOCAL_EVENT_DISPATCHER_TENANCY_TOKEN` (`src/tenancy/composition/tenancy.module.ts:195:14`)
- **Unused Types**: `0`
- **Unused Dependencies**: `0`
- **Config Hints**:
  - `Unused item in ignoreDependencies: @aws-sdk/client-dynamodb`
  - `Unused item in ignoreDependencies: @aws-sdk/client-sns`
  - `Unused item in ignoreDependencies: @aws-sdk/client-sqs`
  - `Unused item in ignoreBinaries: nest`
- **Tag Hints**: `0`

---

## 2. Unused Exports Breakdown

1. **`LOCAL_EVENT_DISPATCHER_TENANCY_TOKEN`** in `src/tenancy/composition/tenancy.module.ts:195:14`
   - **Type**: Unused Export
   - **Status**: Completely dead code, not imported or referenced anywhere in production, test, or infrastructure configuration.
   - **Classification**: `DELETE_DEAD_CODE` / `REMOVE_EXPORT`

2. **`authDataSource`** in `src/auth/infrastructure/persistence/auth-data-source.ts:28:14`
   - **Type**: Unused Entry Export (Production Mode)
   - **Status**: Genuinely consumed by the external TypeORM CLI migration runner (external tool). It is imported dynamically via cli execution but is not statically imported in any other production source code files. It is also statically imported in integration and fault tests.
   - **Classification**: `RETAIN_WITH_DOCUMENTED_EXCEPTION`

3. **`tenancyDataSource`** in `src/tenancy/infrastructure/persistence/tenancy-data-source.ts:37:14`
   - **Type**: Unused Entry Export (Production Mode)
   - **Status**: Genuinely consumed by the external TypeORM CLI migration runner (external tool). It is imported dynamically via cli execution but is not statically imported in any other production source code files. It is also statically imported in integration tests.
   - **Classification**: `RETAIN_WITH_DOCUMENTED_EXCEPTION`
