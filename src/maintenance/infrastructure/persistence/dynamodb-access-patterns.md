# Maintenance Context DynamoDB Access Patterns

We implement a highly performant **Single Table Design** for our Maintenance Context in the DynamoDB table `flatren-maintenance-requests`.

## Table Keys

- **Partition Key (PK)**: `VARCHAR / String`
- **Sort Key (SK)**: `VARCHAR / String`

## Global Secondary Indexes (GSI)

- **RentalUnitIndex**:
  - Partition Key: `rentalUnitId` (String)
  - Sort Key: `PK` (String)

---

## Access Pattern Mapping

### 1. Register / Save Maintenance Request
- **Command**: `PutItem` or `TransactWriteItems`
- **Keys**:
  - `PK` = `REQUEST#<id>`
  - `SK` = `REQUEST#<id>`
- **Attributes**:
  - `id` (String)
  - `rentalUnitId` (String)
  - `reporterId` (String)
  - `description` (String)
  - `status` (String)
  - `isEmergency` (Boolean)
  - `assignedHandymanId` (String / Null)
  - `visitDate` (String / Null)
  - `resolutionDescription` (String / Null)
  - `isClosed` (Boolean)
  - `version` (Number, for Optimistic Concurrency Control)

### 2. Load Maintenance Request by ID
- **Command**: `GetItem`
- **Keys**:
  - `PK` = `REQUEST#<id>`
  - `SK` = `REQUEST#<id>`
- **Query Pattern**: Exact Primary Key lookup (P99 < 10ms, no Scan!).

### 3. Verify Tenant Unit Access Snapshot (Inbox ACL)
- **Command**: `GetItem`
- **Keys**:
  - `PK` = `ACCESS#<tenantId>`
  - `SK` = `UNIT#<rentalUnitId>`
- **Attributes**:
  - `tenantId` (String)
  - `rentalUnitId` (String)
  - `isActive` (Boolean)
- **Query Pattern**: O(1) single-key lookup to verify if the tenant is currently authorized to access the unit (P99 < 10ms, no Scan!).

### 4. List All Maintenance Requests for a Rental Unit
- **Command**: `Query` on Global Secondary Index `RentalUnitIndex`
- **Expression**: `rentalUnitId = :rentalUnitId`
- **Query Pattern**: GSI lookup, returns all requests belonging to the unit instantly. Completely avoids table scans.
