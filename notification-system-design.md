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

# Stage 3

## Slow Query Analysis

The original query fetching unread notifications for a student:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

---

## Is This Query Accurate?

**Partially.** The query works only if `notifications` stores per-user state (`studentID`, `isRead`) directly in the same table. Based on the Stage 2 schema, per-user state lives in `user_notifications` (junction table), so this query would not exist in that form. However, for this stage we treat it as a flat single-table design and analyse it as given.

---

## Why Is It Slow?

At 50,000 students and 5,000,000 notifications, a full table scan runs on every request. Without indexes on `studentID`, `isRead`, and `createdAt`, PostgreSQL reads every row before filtering — **O(n) per query**, which degrades linearly with data growth.

---

## What Would You Change?

```sql
-- Composite index covering all three filter/sort columns
CREATE INDEX idx_notif_student_unread
  ON notifications (studentID, isRead, createdAt ASC)
  WHERE isRead = false;
```

This partial composite index ensures the DB only scans unread rows for a given student — reducing the query from a full table scan to an **index range scan**.

**Optimised query:**
```sql
SELECT id, title, message, type, priority, createdAt
FROM   notifications
WHERE  studentID = $1 AND isRead = false
ORDER  BY createdAt ASC;
```

Avoid `SELECT *` — fetching only required columns reduces I/O and network payload.

---

## Should Indexes Be Added on Every Column?

**No — this advice is not effective.**

Adding indexes on every column is harmful at scale:

| Side Effect | Impact |
|-------------|--------|
| Write amplification | Every `INSERT`, `UPDATE`, `DELETE` must update all indexes |
| Storage bloat | Each index is a separate B-Tree structure on disk |
| Query planner confusion | Too many indexes cause suboptimal plan selection |

**Correct approach:** Index only columns that appear in `WHERE`, `JOIN ON`, or `ORDER BY` clauses of frequent queries. Use partial indexes (`WHERE isRead = false`) to keep index size minimal.

---

## Query — Students With Placement Notification in Last 7 Days

The `notifications` table has a `notificationType` column with enum values `"Event"`, `"Result"`, and `"Placement"`.

```sql
SELECT DISTINCT studentID
FROM   notifications
WHERE  notificationType = 'Placement'
  AND  createdAt >= NOW() - INTERVAL '7 days';
```

**With supporting index:**
```sql
CREATE INDEX idx_notif_type_created
  ON notifications (notificationType, createdAt DESC)
  WHERE notificationType = 'Placement';
```

This index makes the 7-day placement filter an index-only scan — no heap access required for large datasets.

---

## Design Decisions

| Decision | Reason |
|----------|--------|
| Partial composite index on `(studentID, isRead, createdAt)` | Covers the exact filter + sort pattern of the core fetch query |
| Avoid `SELECT *` | Reduces I/O; prevents accidental exposure of internal fields |
| Reject blanket column indexing | Write overhead outweighs read gains at 5M+ rows |
| Partial index on `notificationType = 'Placement'` | Placement queries are a known frequent pattern; partial index stays lean |
EOF
wc -l /mnt/user-data/outputs/stage3-query-optimization.md
---

## Query Performance Summary

```
Before Optimization
───────────────────
Query Plan: Seq Scan on notifications
Rows scanned: ~5,000,000
Filter: studentID = 1042 AND isRead = false
Cost: High — grows linearly with table size

After Optimization
──────────────────
Query Plan: Index Scan using idx_notif_student_unread
Rows scanned: Only unread rows for studentID = 1042
Cost: Low — bounded by result set size, not table size
```

At 5,000,000 rows, the difference between a sequential scan and an index scan can be the difference between a 3–5 second response and a sub-10ms one. Partial indexes specifically exclude already-read notifications (the majority of rows over time), keeping the index compact and fast as the platform scales to more students and events.

> **Note:** All indexes above should be created during a low-traffic maintenance window on a production system. For zero-downtime index creation on large tables, use `CREATE INDEX CONCURRENTLY` in PostgreSQL — it builds the index without locking the table for writes.

```sql
-- Zero-downtime index creation for production
CREATE INDEX CONCURRENTLY idx_notif_student_unread
  ON notifications (studentID, isRead, createdAt ASC)
  WHERE isRead = false;
```

---
---

# Stage 4

## Problem Statement

Notifications are fetched from the database on every page load for every student. At 50,000 students with concurrent sessions, this creates a thundering herd of `SELECT` queries — the DB gets overwhelmed, response times spike, and the user experience degrades.

---

## Proposed Solution — Multi-Layer Caching Strategy

Rather than hitting PostgreSQL on every request, introduce a caching layer between the API and the database. The solution uses **Redis** as the primary cache, combined with **pagination** and **HTTP response caching** to reduce load at every layer.

---

## Strategy 1 — Redis Cache (Primary)

Cache the notification feed per user in Redis with a short TTL.

```
Request → Express API → Redis?
                         ├── HIT  → return cached response (< 1ms)
                         └── MISS → query PostgreSQL → store in Redis → return
```

**Implementation:**
```js
const cacheKey = `notifications:${userId}:unread`;

const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const rows = await db.query(
  `SELECT * FROM user_notifications
   WHERE user_id = $1 AND is_read = FALSE AND is_deleted = FALSE
   ORDER BY created_at DESC`, [userId]
);

await redis.setex(cacheKey, 60, JSON.stringify(rows)); // TTL: 60s
return rows;
```

**Cache Invalidation:** On `PATCH /read`, `PATCH /read-all`, or new notification delivery — delete the user's cache key so the next request pulls fresh data.

```js
await redis.del(`notifications:${userId}:unread`);
```

**Tradeoff:** Up to 60s of stale data between a notification arriving and the user seeing it — acceptable for non-critical updates; reduce TTL for high-priority types.

---

## Strategy 2 — Pagination (DB Load Reduction)

Fetching all notifications for a user in one query is wasteful. Paginate at the API layer:

```sql
SELECT * FROM user_notifications
WHERE  user_id = $1 AND is_deleted = FALSE
ORDER  BY created_at DESC
LIMIT  $2 OFFSET $3;
```

- Default page size: **20 rows**
- Client requests `?page=1&limit=20`
- Reduces per-query row transfer from potentially thousands to a fixed ceiling

**Tradeoff:** Client must implement pagination UI. Deep pages (`OFFSET 10000`) are still slow — use **cursor-based pagination** (`WHERE created_at < $lastSeen`) for very large feeds.

---

## Strategy 3 — Unread Count Cache (Separate Key)

The notification bell counter (unread count) is fetched on every page load but doesn't need the full payload.

```js
const countKey = `notifications:${userId}:count`;
const count = await redis.get(countKey);
if (count) return { unreadCount: parseInt(count) };

const result = await db.query(
  `SELECT COUNT(*) FROM user_notifications
   WHERE user_id = $1 AND is_read = FALSE AND is_deleted = FALSE`, [userId]
);
await redis.setex(countKey, 120, result.rows[0].count);
```

Separating count from payload means the bell icon never triggers a heavy query.

---

## Strategy Tradeoffs Summary

| Strategy | Benefit | Tradeoff |
|----------|---------|----------|
| Redis cache (TTL 60s) | Eliminates DB hits on repeat loads | Up to 60s stale data window |
| Pagination (limit 20) | Caps per-query cost regardless of dataset size | Requires client-side pagination logic |
| Cursor-based pagination | Constant-time deep paging | More complex query and client state |
| Unread count cache | Decouples bell counter from feed query | Count can lag by up to 120s |
| Cache invalidation on write | Keeps data fresh after user actions | Adds a Redis `DEL` call on every state-change |

---

## Database Architecture With Caching

```
Student Browser
      │
      ▼
Express API
      │
      ├──► Redis (TTL cache)
      │         └── HIT: return immediately
      │
      └──► PostgreSQL (on cache miss)
                │
                └── Partial index scan
                    (idx_un_user_unread)
```

---
---

# Stage 5

## Problem Statement

It is placement season. HR clicks "Notify All" and 50,000 students should receive an email and an in-app notification simultaneously. The original pseudocode implements this synchronously in a single loop:

```
function notify_all(student_ids: array, message: string):
  for student_id in student_ids:
    send_email(student_id, message)   # calls Email API
    save_to_db(student_id, message)   # DB insert
    push_to_app(student_id, message)  # real-time push
```

---

## Observed Shortcomings

**1. No atomicity — partial failure corrupts state.**
`send_email` failed for 200 students midway through the loop. The students after failure index received no notification at all. Students before it got an email but may have missed the DB insert if the error propagated. There is no way to identify and retry only the failed subset.

**2. Synchronous loop blocks the API thread.**
50,000 iterations of network calls (email API + DB write + push) run serially. The API is locked for the entire duration — other requests time out.

**3. No retry mechanism.**
A transient email API failure permanently skips those 200 students. The system has no record of what failed or why.

**4. Coupled operations — all-or-nothing failure surface.**
Email, DB save, and push are chained in the same transaction. A push failure can prevent the DB write from completing, even if email succeeded.

---

## Should DB Save and Email Happen Together?

**No.** They should be decoupled:

- **DB save** must happen first and independently — it is the source of truth for in-app notifications.
- **Email** is a side-effect delivery channel — failure should not roll back the DB write.
- Coupling them means a flaky email API can silently corrupt the notification record.

---

## Redesigned Approach — Async Queue with Retry

Replace the synchronous loop with a **message queue** (e.g., BullMQ / RabbitMQ). Each student gets an individual job enqueued. Workers process jobs independently with automatic retry on failure.

```
HR clicks "Notify All"
        │
        ▼
API enqueues 50,000 jobs → Message Queue (BullMQ)
        │                          │
        │                    Worker Pool (N workers)
        │                    ├── save_to_db(student_id, message)
        │                    ├── send_email(student_id, message) ← retried on failure
        │                    └── push_to_app(student_id, message)
        ▼
API returns 202 Accepted immediately
```

**Key properties:**
- DB write happens first; email and push are independent follow-ups.
- Failed jobs (e.g., 200 email failures) are retried automatically up to N times.
- Dead-letter queue captures permanently failed jobs for manual inspection.
- API returns `202 Accepted` instantly — HR is not blocked waiting for 50k operations.

---

## Revised Pseudocode

```ts
async function notify_all(student_ids: string[], message: string): Promise<void> {
  const jobs = student_ids.map(student_id => ({
    name: 'notify-student',
    data: { student_id, message }
  }));

  await notificationQueue.addBulk(jobs);
  // Returns immediately — workers handle the rest
}

// Worker (runs in separate process, N parallel instances)
notificationQueue.process('notify-student', async (job) => {
  const { student_id, message } = job.data;

  // Step 1: DB write first (source of truth)
  await save_to_db(student_id, message);

  // Step 2: Email — retried independently on failure
  await send_email(student_id, message);

  // Step 3: Real-time push — failure does not affect steps 1 & 2
  await push_to_app(student_id, message);
});

// Queue config: retry up to 3 times with exponential backoff
const notificationQueue = new Queue('notifications', {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
});
```

---

## Design Decisions

| Decision | Reason |
|----------|--------|
| Decouple DB save from email | DB is source of truth; email failure must not corrupt notification record |
| Message queue over sync loop | Non-blocking; each job retried independently |
| `202 Accepted` response | API does not wait for 50k operations to complete |
| Per-job retry with backoff | Handles transient email API failures without manual intervention |
| Dead-letter queue | Captures permanently failed jobs for audit and replay |
| Parallel workers | Multiple worker instances process the queue concurrently, reducing total time |
EOF
wc -l /mnt/user-data/outputs/stage5-notify-all-redesign.md
---

## Failure Recovery — The 200 Student Problem

When `send_email` fails midway for 200 students, the redesigned system handles it as follows:

```
Job for student_id=X fails at send_email step
        │
        ▼
BullMQ retries job (attempt 2 of 3, after 1s backoff)
        │
        ├── Retry succeeds → email delivered, job marked complete
        │
        └── All 3 attempts fail → job moved to Dead Letter Queue
                    │
                    ▼
              Admin dashboard shows 200 failed jobs
              → HR can trigger manual replay once email API recovers
```

The DB write (step 1) already succeeded before the email step — so the student's in-app notification is always preserved regardless of email delivery outcome.