# Contract examples

These values are synthetic.

Project list item:

```json
{
  "id": "507f1f77bcf86cd799439011",
  "projectCode": "INF-ROAD-001",
  "title": "Central Corridor Road Resurfacing (Demo)",
  "projectType": "ROAD",
  "status": "ACTIVE",
  "agencyId": "507f1f77bcf86cd799439012",
  "physicalProgress": 35,
  "financialProgress": 28,
  "plannedEndDate": "2026-06-30T00:00:00.000Z",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Work geometry:

```json
{
  "type": "LineString",
  "coordinates": [[79.8612, 6.9271], [79.862, 6.928]]
}
```

Money:

```json
{ "amountMinor": 85000000000, "currency": "LKR" }
```

Create project requests must not include `status`, `createdBy`, `agencyId`, `riskScore`, or `financialProgress`.
