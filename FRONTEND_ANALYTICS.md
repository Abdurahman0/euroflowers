# Frontend Update: Analytics Page

## New Endpoint

`GET /api/analytics/`

Default period:

Last 30 days.

Optional filters:

`GET /api/analytics/?from=2026-07-01&to=2026-07-22`

Permission:

Same as dashboard view permission.

## Response Shape

```json
{
  "period": {
    "from": "2026-06-23T00:00:00+05:00",
    "to": "2026-07-22T23:59:59.999999+05:00"
  },
  "summary": {
    "leads": 12,
    "customers": 8,
    "conversations": 30,
    "orders": 6,
    "revenue": "4800000.00",
    "florist_revenue": "300000.00",
    "flowers_sold_stems": 180,
    "conversion_rate": 20.0
  },
  "daily_stats": [],
  "top_selling_flowers": [],
  "top_catalog_items": [],
  "lead_statuses": [],
  "arrangement_types": [],
  "conversation_sources": [],
  "revenue_by_source": []
}
```

## Charts

### Daily Chart

Use `daily_stats`.

Each row:

```json
{
  "date": "2026-07-22",
  "leads": 3,
  "conversations": 9,
  "orders": 2,
  "revenue": "1600000.00"
}
```

Recommended chart:

Line or bar chart with `date` on x-axis and series:

- `leads`
- `conversations`
- `orders`
- `revenue`

### Top Selling Flowers

Use `top_selling_flowers`.

Each row:

```json
{
  "flower_id": 1,
  "name_uz": "Atirgul",
  "name_ru": "Роза",
  "color_uz": "Qizil",
  "color_ru": "Красный",
  "stems": 80,
  "bunches": "4.00"
}
```

Recommended chart:

Horizontal bar chart sorted by `stems`.

### Top Catalog Items

Use `top_catalog_items`.

Each row:

```json
{
  "catalog_item_id": 12,
  "catalog_item__name_uz": "Qizil atirgul buket",
  "catalog_item__name_ru": "Букет красных роз",
  "catalog_item__arrangement_type": "bouquet",
  "quantity": 4,
  "revenue": "1600000.00"
}
```

### Lead Statuses

Use `lead_statuses`.

Each row:

```json
{
  "status": "won",
  "count": 6
}
```

### Arrangement Types

Use `arrangement_types`.

Each row:

```json
{
  "arrangement_type": "catalog",
  "count": 5
}
```

### Conversation Sources

Use `conversation_sources`.

Each row:

```json
{
  "source": "telegram",
  "count": 7
}
```

Possible sources:

- `instagram`
- `telegram`
- `mini_app`

### Revenue By Source

Use `revenue_by_source`.

Each row:

```json
{
  "source": "instagram",
  "orders": 4,
  "revenue": "3200000.00"
}
```

## Dashboard Change

`GET /api/dashboard/` also includes:

```json
{
  "top_selling_flowers": []
}
```

Dashboard should show the first 5 top selling flowers. Full analytics page gets up to 20 rows.
