# GeoJSON and spatial-query readiness

INFRAOS stores GeoJSON with the mandatory coordinate order:

```text
[longitude, latitude]
```

For Sri Lanka, a point near central Colombo is approximately
`[79.8612, 6.9271]`. Reversing those values describes a different point; schema
range checks cannot infer user intent when both numbers are individually valid.
Map adapters and request validators must preserve the order and spatial tests
must use known reference locations.

## Supported geometry

The initial geometry allowlist is `Point`, `LineString`, and `Polygon`.
`MultiPoint`, `MultiLineString`, `MultiPolygon`, and `GeometryCollection` are not
accepted without a new query and product requirement.

Validation enforces:

- every position is exactly two finite numeric values;
- longitude is between -180 and 180;
- latitude is between -90 and 90;
- a Point contains one position;
- a LineString contains at least two positions;
- a Polygon has one to 100 rings, each ring has at least four positions, and
  each ring's first and last positions are identical;
- a geometry contains no more than 10,000 positions.

This is bounded structural validation. It does not prove polygon topology,
prevent self-intersection, snap coordinates, or establish survey accuracy.
Those needs require an explicit GIS design and a justified geometry library.

## Spatially indexed fields

| Collection field | Reason |
|---|---|
| `projects.geometry` | InfraMap viewport, public/staff map, nearby projects |
| `workRequests.geometry` | RoadSync nearby/intersection candidate retrieval |
| `assets.geometry` | InfraMap asset layer and nearby asset lookup |
| `citizenIssues.geometry` | agency routing and issue map layer |

No other collection receives a `2dsphere` index. Descriptive `location` objects
are not coordinate sources. Work requests require geometry; the other three
fields may be absent.

## RoadSync candidate query

The database stage performs spatial retrieval plus coarse status/date filters.
For proposed interval `A`, candidate record `B` overlaps when:

```text
A.start <= B.end
AND
A.end >= B.start
```

Expressed against candidates, this becomes `plannedStart <= proposedEnd` and
`plannedEnd >= proposedStart`. The disposable spatial integration test creates a
Colombo road-resurfacing LineString for January 10–April 20 and retrieves it for
a nearby water-work query dated March 1–May 1. It excludes distant geometry and
nearby work outside the interval. A swapped-coordinate query is also shown not
to match the Colombo fixture.

The index only produces candidates. A future RoadSync service must evaluate
exact intersection/proximity, the full overlap rule, classification, severity,
authorization, and coordination state. Step 14 does not implement a conflict
engine.
