# Universal GPS Tracking Backend — Design Spec

## Problem

We need a backend that ingests live GPS position data from **any** tracker or provider.
Providers deliver data via different mechanisms (REST API, webhook push, raw hardware
protocols). The system must treat "how a provider delivers data" as a pluggable detail.
Vendor-specific logic must never leak past the ingestion layer.

The first real provider is Trackon, but its delivery method is **unknown** — we do not
assume it. Instead, we prove the architecture with the protocol-based path (via Traccar)
and add Trackon's adapter later once its integration method is confirmed.

## Architecture: Hexagonal (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────────┐
│                        INGESTION LAYER                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ REST/Polling  │  │  Webhook     │  │  Protocol (Traccar)    │ │
│  │  Adapter      │  │  Adapter     │  │  Adapter               │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘ │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │           GpsAdapterPort (abstract class)                    ││
│  │   fetchPositions(): Promise<NormalizedPosition[]>            ││
│  │   getProviderName(): string                                  ││
│  └──────────────────────────┬───────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼  NormalizedPosition (THE contract)
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN / SERVICES                          │
│  PositionsService — validates, writes to DB, emits via WS       │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         STORAGE                                 │
│  Postgres + TimescaleDB                                         │
│  • positions (hypertable, partitioned by timestamp)             │
│  • devices (plain table)                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
│  REST: GET /devices/:id/latest, GET /health                     │
│  WebSocket: live position push (future, scaffolded only)        │
│  Minimal Leaflet.js map page (proves end-to-end)                │
└─────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer             | Technology                                          |
|-------------------|-----------------------------------------------------|
| Runtime           | Node.js 20+ (LTS)                                  |
| Language          | TypeScript 6, strict mode                           |
| Framework         | NestJS 12                                           |
| ORM               | TypeORM (decorator entities, migration support)     |
| Database          | PostgreSQL 16 + TimescaleDB 2.x extension           |
| Protocol decoder  | Traccar (self-hosted, Docker, NOT hand-written)     |
| Validation        | class-validator + class-transformer                 |
| Config            | @nestjs/config (env-only, .env.example provided)    |
| Testing           | Jest 30 + Supertest (already present)               |
| Logging           | NestJS built-in Logger (JSON format in production)  |
| Containerization  | Docker Compose (backend + Postgres + Traccar)       |
| Auth (MVP)        | API key via X-API-Key header (guard)                |
| Map (MVP)         | Static HTML + Leaflet.js served by NestJS            |

## Contract: NormalizedPosition

This is the **single shared schema** between ingestion and everything downstream.
Changing this is a deliberate, reviewed step.

```typescript
interface NormalizedPosition {
  device_id: string;      // unique device identifier (from provider)
  provider: string;       // e.g. "traccar", "trackon", "custom-rest"
  lat: number;            // latitude, WGS84 decimal degrees
  lng: number;            // longitude, WGS84 decimal degrees
  speed: number | null;   // km/h, null if unavailable
  heading: number | null;  // degrees 0-360, null if unavailable
  ignition: boolean | null; // engine ignition state, null if unavailable
  timestamp: Date;        // position fix time (from device, NOT server receipt)
  raw: Record<string, unknown>; // original payload for debugging, never used downstream
}
```

## Port: GpsAdapterPort

```typescript
abstract class GpsAdapterPort {
  /** Human-readable provider identifier */
  abstract getProviderName(): string;

  /**
   * Fetch latest positions from this provider.
   * For polling adapters: queries the provider API.
   * For webhook adapters: returns buffered positions since last call.
   * For protocol adapters: queries Traccar API for latest positions.
   *
   * MUST return NormalizedPosition[] — no raw/vendor types escape this boundary.
   * MUST NOT throw on transient failures — return [] and log the error.
   */
  abstract fetchPositions(): Promise<NormalizedPosition[]>;
}
```

### Adapter Categories

All implement `GpsAdapterPort`. Only (c) is built for MVP:

| Category          | Trigger           | Example providers      | MVP? |
|-------------------|-------------------|------------------------|------|
| REST/polling      | Cron/interval     | Trackon (if REST API)  | No   |
| Webhook           | HTTP POST inbound | Trackon (if webhook)   | No   |
| Protocol/Traccar  | Poll Traccar API  | GT06, TK103, Teltonika | Yes  |

**Adding a new adapter** = implement `GpsAdapterPort` in a new NestJS module +
register it. Zero changes to schema, DB, API, or frontend.

## Module Structure

```
src/
├── domain/                          ← Ports + contract types
│   ├── normalized-position.ts       ← NormalizedPosition interface
│   ├── gps-adapter.port.ts          ← GpsAdapterPort abstract class
│   └── domain.module.ts
│
├── adapters/                        ← Adapter implementations
│   └── traccar/
│       ├── traccar.adapter.ts       ← Implements GpsAdapterPort
│       ├── traccar.config.ts        ← Traccar connection config
│       ├── traccar.mapper.ts        ← Traccar API response → NormalizedPosition
│       ├── traccar.module.ts
│       └── __tests__/
│           ├── traccar.adapter.spec.ts
│           └── traccar.mapper.spec.ts
│
├── ingestion/                       ← Orchestrates all adapters
│   ├── ingestion.service.ts         ← Iterates registered adapters, writes to DB
│   ├── ingestion.scheduler.ts       ← @Cron or @Interval trigger
│   └── ingestion.module.ts
│
├── positions/                       ← Position persistence
│   ├── position.entity.ts           ← TypeORM entity (TimescaleDB hypertable)
│   ├── positions.service.ts         ← Write + query positions
│   ├── positions.module.ts
│   └── __tests__/
│       └── positions.service.spec.ts
│
├── devices/                         ← REST API
│   ├── devices.controller.ts        ← GET /devices/:id/latest
│   ├── devices.module.ts
│   └── __tests__/
│       └── devices.controller.spec.ts
│
├── health/                          ← GET /health
│   ├── health.controller.ts
│   └── health.module.ts
│
├── auth/                            ← API key guard
│   ├── api-key.guard.ts
│   └── auth.module.ts
│
├── config/                          ← @nestjs/config setup
│   └── app.config.ts
│
├── public/                          ← Static files (map page)
│   └── map.html                     ← Leaflet.js minimal map
│
├── app.module.ts                    ← Root module
└── main.ts                          ← Bootstrap
```

## Database Design

### `positions` table (TimescaleDB hypertable)

```sql
CREATE TABLE positions (
  id            BIGSERIAL       NOT NULL,
  device_id     VARCHAR(128)    NOT NULL,
  provider      VARCHAR(64)     NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  speed         DOUBLE PRECISION,
  heading       DOUBLE PRECISION,
  ignition      BOOLEAN,
  timestamp     TIMESTAMPTZ     NOT NULL,
  raw           JSONB           NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)   -- required for TimescaleDB partitioning
);

-- Convert to hypertable (partitioned by timestamp)
SELECT create_hypertable('positions', 'timestamp');

-- Index for "latest position for device" queries
CREATE INDEX idx_positions_device_timestamp
  ON positions (device_id, timestamp DESC);
```

### `devices` table (plain Postgres)

```sql
CREATE TABLE devices (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     VARCHAR(128)    UNIQUE NOT NULL,  -- matches positions.device_id
  provider      VARCHAR(64)     NOT NULL,
  name          VARCHAR(256),
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
```

## API Design

### `GET /health`
- **200** `{ status: "ok", db: "connected", traccar: "connected" }`
- **503** `{ status: "degraded", db: "connected"|"disconnected", traccar: "connected"|"disconnected" }`
- No auth required.

### `GET /devices/:id/latest`
- **200** `{ device_id, provider, lat, lng, speed, heading, ignition, timestamp }`
- **404** `{ statusCode: 404, message: "Device not found" }`
- **401** if missing/invalid API key.
- Auth: `X-API-Key` header required.

### Future endpoints (not built now, but interface supports them)
- `GET /devices` — list all devices, paginated
- `GET /devices/:id/history?from=&to=` — position history, paginated
- WebSocket `/ws/positions` — live position stream

## Docker Compose

Three services:

| Service    | Image                              | Ports         | Notes                          |
|------------|-------------------------------------|---------------|--------------------------------|
| `db`       | `timescale/timescaledb:latest-pg16` | 5432          | Postgres + TimescaleDB         |
| `traccar`  | `traccar/traccar:latest`            | 8082, 5055+   | Protocol server + REST API     |
| `backend`  | Built from Dockerfile               | 3000          | NestJS app, depends on db+traccar |

Traccar listens on multiple ports for different protocols (5055 for OsmAnd/HTTP,
5023 for GT06, 5027 for Teltonika, etc.). For MVP we expose 5055 (OsmAnd protocol)
which is the easiest to simulate with a simple HTTP request.

## Traccar Integration Details

The Traccar adapter does NOT decode binary protocols — Traccar does that. Our adapter:

1. Polls `GET http://traccar:8082/api/positions` (Traccar's REST API) on an interval
2. Authenticates with Traccar's admin credentials (from env vars)
3. Maps each Traccar position object to `NormalizedPosition`
4. Passes the array to `PositionsService.writeMany()`

**Simulating a device for testing:** Send an HTTP GET to Traccar's OsmAnd listener:
```
GET http://localhost:5055/?id=test123&lat=27.7172&lon=85.3240&speed=45&heading=180
```
This registers a device in Traccar and creates a position — no real hardware needed.

## Auth (MVP)

- `ApiKeyGuard` reads `X-API-Key` header, compares against `API_KEY` env var.
- Applied to all `/devices/*` endpoints.
- `/health` and the static map page are public.
- Traccar adapter auth is internal (backend→Traccar, using Traccar admin creds from env).

## Error Handling

- Adapters **never throw** on transient provider failures — they log structured errors
  and return `[]`. The ingestion loop continues to other adapters.
- Database write failures are logged with full context and re-thrown to the caller
  (the ingestion scheduler catches and logs, does not crash the process).
- API endpoints return appropriate status codes (400/401/404/500) with typed error
  response bodies.

## Logging

All log output is structured JSON in production mode:
```json
{"level":"log","context":"TraccarAdapter","message":"Fetched 3 positions","timestamp":"..."}
{"level":"error","context":"TraccarAdapter","message":"Traccar API unreachable","error":"..."}
```

## Environment Variables

All config via env vars, documented in `.env.example`:

```env
# App
PORT=3000
NODE_ENV=development
API_KEY=change-me-in-production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=gpstracker

# Traccar
TRACCAR_URL=http://localhost:8082
TRACCAR_USERNAME=admin
TRACCAR_PASSWORD=admin

# Ingestion
INGESTION_INTERVAL_MS=10000
```

## Out of Scope

- Message queue / event streaming
- Kubernetes / multi-region deployment
- Alerting, geofencing, trip detection
- Hand-written protocol decoders
- Trackon-specific adapter (until delivery method confirmed)
- User management / registration
- Device provisioning UI
