# Serialization boundaries

| Concern | Database | JSON contract |
|---|---|---|
| Identifier | ObjectId | `EntityId` string |
| Time | BSON Date | `IsoDateTimeString` |
| Money | `amountMinor` + `LKR` | `MoneyDto` |
| Progress / risk / health | number 0–100 | `PercentageScore` |
| Geometry | GeoJSON | `InfraGeometry` |
| Password / token hash | `select: false` | omitted |

`JSON.stringify` of a Mongoose document is not a DTO. Mappers in later steps must copy allowlisted fields.

`undefined` is omitted from JSON. Responses should use `null` for known-empty nullable fields such as `managerId` before assignment.
