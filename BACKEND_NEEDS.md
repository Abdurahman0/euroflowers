# BACKEND NEEDS — what the frontend requires from the API

> **STATUS UPDATE (2026-07-13, second pass):** backend shipped fixes for everything below and the
> frontend now consumes all of them. Verified live: `/api/users/` (+deactivate), `/api/instagram/status/`
> (GET/PATCH toggles), `/api/settings/` (GET/PATCH), `/api/uploads/` (multipart → URL),
> `/api/notifications/read_all/`, `/api/auth/token/blacklist/` (used on logout),
> `created_at_after/before` filters (leads, movements, conversations, audit — wired to the date chips),
> dashboard `revenue_today / orders_today / revenue_7d / conversion_rate`, social post
> `reply_count / lead_count`, customer `purchases_count / total_spent`, movement empty-body → 400,
> protected batch delete → clean 400 + auto-archive. **Only remaining nit:** CORS still allows only
> `localhost:3000` / `127.0.0.1:3000` — add LAN/production origins before deploying.

---

*Original request list below (kept for history).*

Frontend (`euroflowers-next`) is now fully wired to the backend at `http://192.168.1.5:8000`
(configurable via `NEXT_PUBLIC_API_URL` in `.env.local`).
Everything below is what is **missing, broken, or needed** on the backend side.
Items are ordered by priority.

---

## 🔴 Bugs (fix required)

### 1. `DELETE /api/stock-batches/{id}/` returns **500 Internal Server Error**
Reproduced with a freshly created batch that had stock movements attached.
Most likely an unhandled `ProtectedError` (movements FK-protect the batch).
**Expected:** return `409` / `400` with a clear message like
`{"detail": "Batch has movements and cannot be deleted. Deactivate it instead."}` — or cascade/soft-delete.
Frontend currently works around this by using `PATCH {is_active: false}`.

### 2. CORS only allows `localhost:3000` / `127.0.0.1:3000`
Verified via preflight: `Origin: http://localhost:3000` → allowed,
`Origin: http://192.168.1.5:3000` and any other host → **no `Access-Control-Allow-Origin` header** (browser blocks every request).
**Needed:** add LAN / production origins to `CORS_ALLOWED_ORIGINS`, e.g.
`http://192.168.1.5:3000`, and the future production domain. Until then the frontend must be opened strictly as `http://localhost:3000`.

---

## 🟠 Missing endpoints the UI already has slots for

### 3. Users / team list — `GET /api/users/`
The Settings page ("Jamoa") should list staff with names and roles (admin / operator / florist / warehouse / content).
Today only `GET /api/me/` exists, so the page can show just the logged-in user.
**Needed:** admin-only list + create/deactivate users, fields: `id, username, first_name, last_name, email, profile.role, profile.branches, is_active`.

### 4. Instagram connection status — `GET /api/instagram/status/`
Settings page shows a hardcoded "connected" card. The webhook endpoint exists
(`/api/instagram/webhook/`) but there is no way to query: connected account username,
token validity/expiry, auto-reply toggles (DM / post reply / story reply).
**Needed:** status object + PATCH for the toggles.

### 5. Business settings — `GET/PATCH /api/settings/`
No API for: default florist fee, AI behaviour rules (min-sale reminder, "approximate price" wording, handoff rules), working hours.
The "AI qoidalari" and price-settings cards are static until this exists.

### 6. File/image upload
Every model only accepts `image_url` (string). There is no multipart upload endpoint,
so the frontend can't offer real drag-and-drop photos for stock batches / catalog items —
users must paste URLs.
**Needed:** `POST /api/uploads/` (multipart, returns URL) or `ImageField`s on the serializers.

---

## 🟡 API improvements (frontend works, but degraded)

### 7. Date-range filters on list endpoints
`/api/leads/`, `/api/stock-movements/`, `/api/conversations/`, `/api/audit/` have no
`created_at_after` / `created_at_before` filters. The UI's "Bugun / 7 kun / 30 kun" chips
currently filter **client-side over the first 200 rows** — wrong once data outgrows one page.
**Needed:** `django_filters.DateFromToRangeFilter` on `created_at` for these viewsets.

### 8. Dashboard: revenue metrics
`GET /api/dashboard/` has counts but no money. The dashboard design has a
"Bugungi savdo" (today's sales) card that had to be repurposed.
**Needed fields:** `revenue_today`, `orders_today`, `revenue_7d`, and ideally
`conversion_rate` (conversations → leads → won).

### 9. Social post performance counters
`SocialPost` has no `reply_count` / `lead_count`, and `/api/leads/` cannot filter by
`social_post`. The Postlar page therefore can't show "X replies · Y leads" per post.
**Needed:** either annotated counters on the social-posts serializer or a
`social_post` filter on leads (both is best).

### 10. Bulk "mark all read" for notifications
Only `POST /api/notifications/{id}/read/` exists. Header bell UX wants
`POST /api/notifications/read_all/`.

### 11. Customer totals
`Customer` has `leads_count` but no `purchases_count` / `total_spent`.
The client card currently derives "total" by summing **estimated** prices of won leads,
which is an approximation. Real aggregates on the serializer would be correct.

### 12. OpenAPI schema accuracy for custom actions
`sell`, `deduct_stock`, `send`, `simulate`, `handoff`, `resume_ai`, `movement` are all
documented in the schema as taking/returning the full parent serializer, but actually:
- `send` expects `{"text": "..."}` → returns `{"id", "text"}` (empty text → `{"detail":"Xabar bo'sh"}`)
- `simulate` expects `{"text": "..."}` → returns `{"reply": "..."}`
- `movement` accepts `{movement_type, quantity_stems, quantity_bunches, reason}`;
  **empty body silently creates an `out/0` movement — should be validated (400)**.
**Needed:** `@extend_schema` annotations + input validation on `movement`.

### 13. JWT logout / token blacklist
No logout endpoint; frontend just drops tokens from localStorage. If refresh tokens are
long-lived, add `POST /api/auth/token/blacklist/` (simplejwt blacklist app).

---

## ✅ Verified working end-to-end (no action needed)

| Flow | Result |
|---|---|
| `POST /api/auth/token/` + refresh | OK, wired with auto-refresh on 401 |
| `GET /api/me/`, `/api/dashboard/` | OK |
| Leads list / PATCH status (kanban drag) | OK |
| Customers list | OK |
| Stock batches list / create (Kirim modal) | OK |
| Stock movements journal / `POST movement` (`in` adds, `out` subtracts) | OK |
| Catalog create **with inline `composition`** | OK (201) |
| `sell` → `deduct_stock` (stock 240 → 235 verified) | OK |
| Conversations list/detail, `send`, `simulate` (live AI reply), `handoff`, `resume_ai` | OK |
| Social posts, notifications + `read`, packaging, branches | OK |

*Test artifacts left in DB: stock batch `E2E-TEST-1` (id 13) — deactivated with 0 stems; one `in +5 (E2E test restore)` movement on batch 1 offsetting the test deduction; a few test messages in conversation 1.*
