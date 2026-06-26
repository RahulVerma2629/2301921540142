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