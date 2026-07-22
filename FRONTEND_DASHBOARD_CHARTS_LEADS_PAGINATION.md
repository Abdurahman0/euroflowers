# Frontend Update: Dashboard Charts + Leads Pagination

## Dashboard

Endpoint:

`GET /api/dashboard/`

Default period:

If `from` / `to` are not sent, backend returns stats for the last 30 days.

Optional filters:

`GET /api/dashboard/?from=2026-07-01&to=2026-07-22`

New field:

```json
{
  "daily_stats": [
    {
      "date": "2026-07-01",
      "leads": 4,
      "conversations": 9
    }
  ]
}
```

Use `daily_stats` for dashboard chart:

- `date`: chart x-axis
- `leads`: how many leads were created that day
- `conversations`: how many chats/conversations were created that day

The array includes every day in the selected period, including days with `0` values.

## Leads Pagination

Endpoint:

`GET /api/leads/`

Pagination is enabled.

Query params:

`GET /api/leads/?page=1&page_size=30`

Max `page_size`:

`100`

Response format:

```json
{
  "count": 125,
  "next": "https://euroflowers.api.cognilabs.org/api/leads/?page=2&page_size=30",
  "previous": null,
  "results": []
}
```

Frontend should read leads from `results`, not from root array.
