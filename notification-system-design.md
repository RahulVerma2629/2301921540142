# Notification System Design

# Stage 1

## System Requirements & Design Goals

- **Stateless Operations:** All core endpoints follow strict REST conventions with predictable resource-oriented URLs.
- **Granular State Tracking:** Strict auditing of read, unread, and soft-delete notification states per user.
- **Real-Time Delivery:** Native support for zero-polling, event-driven state updates via persistent connections.
- **Extensible Boundary:** Modular foundation allowing future lifecycle stages to drop in without breaking client-side models.

---

## Authentication Headers

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
Accept: application/json
```

---

## Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/v1/notifications` | Fetch paginated/filtered notifications for the authed user |
| `GET` | `/api/v1/notifications/{id}` | Retrieve a specific notification by ID |
| `PATCH` | `/api/v1/notifications/{id}/read` | Mark an individual notification as read |
| `PATCH` | `/api/v1/notifications/read-all` | Batch mark all unread notifications as read |
| `DELETE` | `/api/v1/notifications/{id}` | Soft-delete a specific notification |

---

## Core Schema

```json
{
  "id": "8f3b20d1-9c65-4f4e-a10d-83bc9c6a1b24",
  "title": "Microsoft Placement Drive",
  "message": "SWE applications are closing tomorrow at 23:59 UTC.",
  "type": "Placement",
  "priority": "High",
  "isRead": false,
  "createdAt": "2026-06-26T09:30:00Z",
  "updatedAt": "2026-06-26T09:30:00Z"
}
```

**Field Constraints:**

| Field | Rule |
|-------|------|
| `id` | UUIDv4, fully immutable |
| `title` | Plaintext, 3–150 characters |
| `type` | Enum: `"Placement"` · `"Event"` · `"Exam"` · `"General"` |
| `priority` | Enum: `"Low"` · `"Medium"` · `"High"` |
| `isRead` | Boolean — drives notification counter state |

---

## API Contracts

### `GET /api/v1/notifications` — Fetch All
Supported query filters: `type={enum}`, `isRead={boolean}`

```json
{
  "success": true,
  "meta": { "totalCount": 1 },
  "data": [{
    "id": "8f3b20d1-9c65-4f4e-a10d-83bc9c6a1b24",
    "title": "Microsoft Placement Drive",
    "type": "Placement",
    "priority": "High",
    "isRead": false,
    "createdAt": "2026-06-26T09:30:00Z"
  }]
}
```

### `GET /api/v1/notifications/{id}` — Fetch One

```json
{
  "success": true,
  "data": {
    "id": "8f3b20d1-9c65-4f4e-a10d-83bc9c6a1b24",
    "title": "Microsoft Placement Drive",
    "message": "SWE applications are closing tomorrow at 23:59 UTC.",
    "type": "Placement",
    "priority": "High",
    "isRead": false,
    "createdAt": "2026-06-26T09:30:00Z"
  }
}
```

### `PATCH /api/v1/notifications/{id}/read` — Mark as Read
Payload: `{ "isRead": true }`
Response: `{ "success": true, "message": "Notification state marked as read." }`

### `PATCH /api/v1/notifications/read-all` — Mark All Read
Response: `{ "success": true, "message": "All notifications marked as read." }`

### `DELETE /api/v1/notifications/{id}` — Delete
Response: `{ "success": true, "message": "Notification deleted successfully." }`

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success — payload returned |
| `400` | Malformed payload or invalid enum value |
| `401` | JWT missing, invalid, or expired |
| `403` | Valid token but insufficient resource permissions |
| `404` | UUID does not resolve to an active entity |
| `500` | Internal server or persistence error |

---

## Real-Time WebSocket Infrastructure

```
+──────────────────────+
|   React Web Client   |
+──────────┬───────────+
           │ (1) HTTP REST Handshakes
           │ (2) Upgraded Persistent WebSocket Pipe
           ▼
+──────────────────────+
| Notification Service | ◄── [ Event Broker / DB Trigger ]
|    (Express API)     |
+──────────────────────+
```

- **Connection:** Client opens a persistent WebSocket on app initialization.
- **Push Delivery:** A DB commit hook serializes and pipes new events to open clients instantly — no polling.
- **Reconnection:** On network drop, client retries the connection and syncs missed state via `GET /api/v1/notifications?isRead=false`.

---
---

# Stage 2

## Database Design Overview

**Chosen Database: PostgreSQL**

- Native UUID and ENUM support matches the Stage 1 schema constraints directly.
- ACID compliance ensures `isRead` state transitions and soft-deletes are always consistent.
- Partial indexes handle the read-heavy, filter-heavy query patterns of a notification feed efficiently.
- Scales well with junction-table design for per-user state isolation across broadcast notifications.

---

## Database Schema

```sql
CREATE TYPE notification_type     AS ENUM ('Placement', 'Event', 'Exam', 'General');
CREATE TYPE notification_priority AS ENUM ('Low', 'Medium', 'High');

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR(150) NOT NULL CHECK (char_length(title) >= 3),
  message    TEXT NOT NULL,
  type       notification_type NOT NULL,
  priority   notification_priority NOT NULL DEFAULT 'Low',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notification_id)
);
```

---

## Entity Relationship

```
users ──< user_notifications >── notifications
           (is_read, is_deleted,
            read_at, created_at)
```

`users` and `notifications` share a **many-to-many** relationship via `user_notifications`, which holds all per-user state independently.

---

## Indexing Strategy

```sql
-- Core feed query: unread, non-deleted rows per user
CREATE INDEX idx_un_user_unread ON user_notifications (user_id, is_read, is_deleted)
  WHERE is_read = FALSE AND is_deleted = FALSE;

-- Filter by type (query param: type={enum})
CREATE INDEX idx_notif_type ON notifications (type);

-- Sort support for notification feed
CREATE INDEX idx_notif_created ON notifications (created_at DESC);
```

---

## Scalability Considerations

| Problem | Solution |
|---------|----------|
| Table bloat at 50k students × N notifications | Partial indexes on `is_read = FALSE` — only actionable rows indexed |
| Broadcast fan-out (50k inserts per event) | Async message queue (BullMQ) — background worker batch-inserts rows |
| DB overwhelmed on every page load | Redis cache per user (TTL 60s) — invalidated on read/write events |

---

## Database Architecture Diagram

```
Client → Express API → Redis Cache (hit)
                     ↓ (miss)
               PostgreSQL
         (users / notifications / user_notifications)
                     ↓ (broadcast writes)
              Message Queue (BullMQ)
                     ↓
           Background Worker → Batch DB Insert
```

---

## REST Queries — Stage 1 APIs Mapped to SQL

```sql
-- GET /api/v1/notifications?isRead=false&type=Placement
SELECT n.id, n.title, n.type, n.priority, un.is_read, n.created_at
FROM   notifications n JOIN user_notifications un ON un.notification_id = n.id
WHERE  un.user_id = $1 AND un.is_read = FALSE AND un.is_deleted = FALSE AND n.type = 'Placement'
ORDER  BY n.created_at DESC;

-- PATCH /api/v1/notifications/{id}/read
UPDATE user_notifications SET is_read = TRUE, read_at = NOW()
WHERE  notification_id = $1 AND user_id = $2;

-- PATCH /api/v1/notifications/read-all
UPDATE user_notifications SET is_read = TRUE, read_at = NOW()
WHERE  user_id = $1 AND is_read = FALSE AND is_deleted = FALSE;

-- DELETE /api/v1/notifications/{id}  (soft delete)
UPDATE user_notifications SET is_deleted = TRUE
WHERE  notification_id = $1 AND user_id = $2;
```

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | PostgreSQL | ENUM, UUID, ACID, partial indexes |
| Soft Delete | `is_deleted` flag | Preserves audit trail; no hard deletes |
| State isolation | Junction table | Each user's read/delete state is independent |
| Broadcast | Async queue | Decouples 50k inserts from API response time |
| Caching | Redis (TTL 60s) | Absorbs read load; invalidated on state change |

---
---

