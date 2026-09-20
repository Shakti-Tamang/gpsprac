# Universal GPS Tracking Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pluggable, hexagonal GPS tracking backend that ingests data from any provider/protocol, stores normalized positions in TimescaleDB/PostgreSQL, leverages Traccar for hardware protocol decoding, and exposes REST endpoints and a live test map.

**Architecture:** Hexagonal (Ports & Adapters). Ingestion adapters implement `GpsAdapterPort` producing a strict `NormalizedPosition` schema. The domain persists positions into TimescaleDB. Traccar runs via Docker Compose as the catch-all hardware protocol decoder, polled by `TraccarAdapter`.

**Tech Stack:** Node.js 20+, TypeScript, NestJS 12, TypeORM, PostgreSQL 16 + TimescaleDB, Traccar (Docker), Leaflet.js.

**Spec:** [`docs/specs/2026-09-18-universal-gps-backend-design.md`](file:///c:/Users/Shakti/Desktop/trackon/gpsprac/gpsprac/docs/specs/2026-09-18-universal-gps-backend-design.md)

## Global Constraints
- Every adapter must implement `GpsAdapterPort` and output `NormalizedPosition`.
- Vendor-specific payload details remain inside `raw: Record<string, unknown>`.
- Config & secrets exclusively via environment variables (`.env.example` mandatory).
- TimescaleDB hypertable for `positions` partitioned on `timestamp`, indexed on `(device_id, timestamp DESC)`.
- Direct DB writes from adapter for MVP (no message queue).
- Hand-written binary decoders strictly forbidden — use Traccar.

---

### Task 1: Environment & Dependencies Setup

**Files:**
- Create: `.env.example`
- Create: `.env`
- Modify: `package.json`
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: None
- Produces: Base dependencies (`@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/config`, `axios`), Docker services (`db`, `traccar`, `backend`).

- [x] **Step 1: Install required dependencies in package.json**
Run:
```bash
npm install @nestjs/typeorm typeorm pg @nestjs/config @nestjs/schedule axios class-validator class-transformer
npm install -D @types/pg
```

- [x] **Step 2: Create `.env.example` and `.env`**
Write `.env.example` with standard defaults:
```env
PORT=3000
NODE_ENV=development
API_KEY=test-api-key-12345

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=gpstracker

TRACCAR_URL=http://localhost:8082
TRACCAR_USERNAME=admin
TRACCAR_PASSWORD=admin

INGESTION_INTERVAL_MS=5000
```
Copy `.env.example` to `.env`.

- [x] **Step 3: Create `docker-compose.yml` for local dev**
Services:
- `db`: `timescale/timescaledb:latest-pg16` with healthcheck
- `traccar`: `traccar/traccar:latest` exposing `8082` (Web/API) and `5055` (OsmAnd protocol listener)

- [x] **Step 4: Verify Docker services boot**
Run: `docker compose up -d db traccar` and verify with `docker compose ps`.

---

### Task 2: Domain Layer & Contract Definition (`contract-first`)

**Files:**
- Create: `src/domain/normalized-position.ts`
- Create: `src/domain/gps-adapter.port.ts`
- Create: `test/domain/contract.spec.ts`

**Interfaces:**
- Consumes: None
- Produces: `NormalizedPosition`, `GpsAdapterPort`

- [x] **Step 1: Write unit test validating schema integrity**
Create `test/domain/contract.spec.ts`:
```typescript
import { NormalizedPosition } from '../../src/domain/normalized-position';

describe('NormalizedPosition Contract', () => {
  it('should enforce strict normalized fields', () => {
    const sample: NormalizedPosition = {
      device_id: 'test-device-1',
      provider: 'traccar',
      lat: 27.7172,
      lng: 85.324,
      speed: 45.5,
      heading: 180,
      ignition: true,
      timestamp: new Date('2026-09-18T10:00:00Z'),
      raw: { original: true },
    };
    expect(sample.device_id).toBe('test-device-1');
    expect(sample.provider).toBe('traccar');
  });
});
```

- [x] **Step 2: Run test to verify initial state**
Run: `npm test test/domain/contract.spec.ts` (Fails: file not found)

- [x] **Step 3: Implement `normalized-position.ts` & `gps-adapter.port.ts`**
Create `src/domain/normalized-position.ts`:
```typescript
export interface NormalizedPosition {
  device_id: string;
  provider: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  ignition: boolean | null;
  timestamp: Date;
  raw: Record<string, unknown>;
}
```

Create `src/domain/gps-adapter.port.ts`:
```typescript
import { NormalizedPosition } from './normalized-position';

export abstract class GpsAdapterPort {
  abstract getProviderName(): string;
  abstract fetchPositions(): Promise<NormalizedPosition[]>;
}
```

- [x] **Step 4: Run test to verify pass**
Run: `npm test test/domain/contract.spec.ts` (Expected: PASS)

---

### Task 3: Storage & Database Layer (TimescaleDB Hypertable)

**Files:**
- Create: `src/positions/position.entity.ts`
- Create: `src/positions/positions.service.ts`
- Create: `src/positions/positions.module.ts`
- Create: `test/positions/positions.service.spec.ts`

**Interfaces:**
- Consumes: `NormalizedPosition`
- Produces: `PositionsService.savePosition()`, `PositionsService.getLatestByDeviceId()`

- [x] **Step 1: Write unit test for `PositionsService`**
Create `test/positions/positions.service.spec.ts` mocking TypeORM repository.
Test that `savePosition` maps all fields correctly and `getLatestByDeviceId` queries with `timestamp DESC`.

- [x] **Step 2: Run test to verify it fails**
Run: `npm test test/positions/positions.service.spec.ts` (Fails: service not found)

- [x] **Step 3: Create `position.entity.ts` and `positions.service.ts`**
Define `PositionEntity` with composite primary key `(id, timestamp)` for TimescaleDB partitioning.
Add initialization logic to run `SELECT create_hypertable('positions', 'timestamp', if_not_exists => TRUE);` on startup.

- [x] **Step 4: Run test to verify it passes**
Run: `npm test test/positions/positions.service.spec.ts` (Expected: PASS)

---

### Task 4: Traccar Protocol Adapter (`TraccarAdapter`)

**Files:**
- Create: `src/adapters/traccar/traccar.mapper.ts`
- Create: `src/adapters/traccar/traccar.adapter.ts`
- Create: `src/adapters/traccar/traccar.module.ts`
- Create: `test/adapters/traccar.adapter.spec.ts`

**Interfaces:**
- Consumes: `GpsAdapterPort`, `NormalizedPosition`, Traccar API (`/api/positions`)
- Produces: `TraccarAdapter` extending `GpsAdapterPort`

- [x] **Step 1: Write unit test for Traccar position mapping & error isolation**
Create `test/adapters/traccar.adapter.spec.ts` to test:
- Correct mapping of Traccar fields (`deviceId`, `latitude`, `longitude`, `speed`, `course`, `attributes.ignition`, `fixTime`) into `NormalizedPosition`.
- Resilience: If Traccar API returns 500 or is unreachable, adapter logs error and returns `[]` without crashing.

- [x] **Step 2: Run test to verify fail**
Run: `npm test test/adapters/traccar.adapter.spec.ts`

- [x] **Step 3: Implement `traccar.mapper.ts` and `traccar.adapter.ts`**
Implement Axios polling with Basic Auth against Traccar REST API.

- [x] **Step 4: Run test to verify pass**
Run: `npm test test/adapters/traccar.adapter.spec.ts` (Expected: PASS)

---

### Task 5: Ingestion Orchestrator Service

**Files:**
- Create: `src/ingestion/ingestion.service.ts`
- Create: `src/ingestion/ingestion.module.ts`
- Create: `test/ingestion/ingestion.service.spec.ts`

**Interfaces:**
- Consumes: Injected array of `GpsAdapterPort`, `PositionsService`
- Produces: Ingestion loop that polls all registered adapters and stores new positions.

- [x] **Step 1: Write test for IngestionService**
Verify that `pollAll()` invokes all registered adapters and calls `PositionsService.saveMany()`.

- [x] **Step 2: Run test to verify fail**

- [x] **Step 3: Implement `IngestionService` with interval polling**

- [x] **Step 4: Run test to verify pass**

---

### Task 6: REST API & Health Check Endpoints

**Files:**
- Create: `src/devices/devices.controller.ts`
- Create: `src/devices/devices.module.ts`
- Create: `src/health/health.controller.ts`
- Create: `src/health/health.module.ts`
- Create: `src/auth/api-key.guard.ts`
- Create: `test/devices/devices.controller.spec.ts`
- Create: `test/health/health.controller.spec.ts`

**Interfaces:**
- Consumes: `PositionsService`, `ApiKeyGuard`
- Produces:
  - `GET /devices/:id/latest` (requires `X-API-Key`) -> 200 / 404 / 401
  - `GET /health` -> 200 / 503

- [x] **Step 1: Write tests for controller endpoints and guard**
- [x] **Step 2: Run tests to verify fail**
- [x] **Step 3: Implement controllers, guard, and register modules in `AppModule`**
- [x] **Step 4: Run tests to verify pass**

---

### Task 7: Live Map Page (Leaflet.js)

**Files:**
- Create: `public/index.html`
- Modify: `src/main.ts` (serve static assets from `public`)

**Interfaces:**
- Consumes: `GET /devices/:id/latest`
- Produces: Minimal visual map rendering device marker with real-time refresh.

- [x] **Step 1: Create `public/index.html` with Leaflet.js rendering position and tracking marker**
- [x] **Step 2: Enable static asset serving in NestJS**

---

### Task 8: End-to-End System Verification (Definition of Done)

- [ ] **Step 1: Start Docker Compose stack (`db`, `traccar`)**
- [ ] **Step 2: Simulate device position packet to Traccar via OsmAnd protocol:**
  `curl "http://localhost:5055/?id=sim-device-99&lat=27.7172&lon=85.3240&speed=42&bearing=90"`
- [ ] **Step 3: Run backend and observe IngestionService polling Traccar and writing to TimescaleDB**
- [ ] **Step 4: Query `GET /devices/sim-device-99/latest` with `X-API-Key` header and verify 200 response**
- [ ] **Step 5: Query `GET /health` and verify 200 response with DB and Traccar status**
- [ ] **Step 6: Open live map in browser and verify marker position**
- [x] **Step 7: Run full test suite (`npm test`) and verify all automated tests pass**
