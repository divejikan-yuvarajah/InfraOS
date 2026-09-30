# ADR-009 — MapLibre GIS

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

InfraMap and RoadSync visualization need interactive GeoJSON (points, lines, polygons), conflict overlays, and viewport loading. A GitHub marketing README mentioned Mapbox/Leaflet.

## Decision

Use **MapLibre GL JS** with **OpenStreetMap-compatible** raster or vector tiles.

Keep a thin **tile-style configuration** so a Mapbox style URL could be swapped later without changing Mongoose geometry.

All spatial **queries** remain MongoDB `2dsphere` on Express, not “whatever is on the map client.”

## Reasons

- GeoJSON-first, open, low cost for a prototype
- Sufficient for demo corridors in Sri Lanka
- Avoids Mapbox billing as a P0 dependency

## Alternatives considered

| Alternative | Why not V1 default |
|-------------|-------------------|
| Mapbox GL | Proprietary cost; allowed later via style swap |
| Leaflet | Weaker vector styling for many layers; not the prompt lock |
| Google Maps | ToS and key cost |
| Deck.gl as default | Extra complexity; add later if heatmaps (P2) need it |

## Trade-offs

- OSM tiles are less “satellite-pretty” than Google
- Tile outage must not block list workflows (NFR-MAP)

## Consequences

- Viewport + filter APIs are mandatory
- Attribution must remain on the map

## Future revisit conditions

- Sponsor provides Mapbox tokens
- Heatmaps/clustering at scale (P2)
