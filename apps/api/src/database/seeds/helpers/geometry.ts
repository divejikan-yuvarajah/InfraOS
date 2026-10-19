import type { Geometry } from "../../../shared/database/geometry.js";

/** Colombo central corridor — RoadSync primary pair (overlap + schedule overlap). */
export const GEO_ROAD_CORRIDOR: Geometry = {
  type: "LineString",
  coordinates: [
    [79.8612, 6.9271],
    [79.862, 6.928],
  ],
};

export const GEO_WATER_CORRIDOR_OVERLAP: Geometry = {
  type: "LineString",
  coordinates: [
    [79.8613, 6.9272],
    [79.8621, 6.9281],
  ],
};

/** Kandy area — far non-conflict control. */
export const GEO_FAR_CONTROL: Geometry = {
  type: "LineString",
  coordinates: [
    [80.6337, 7.2906],
    [80.634, 7.291],
  ],
};

/** Same corridor window, non-overlapping schedule (seeded separately). */
export const GEO_ROAD_CORRIDOR_B: Geometry = {
  type: "LineString",
  coordinates: [
    [79.86125, 6.92715],
    [79.86205, 6.92805],
  ],
};

/** Parallel offset ~150m east — nearby but non-intersecting for future NEARBY_WORK. */
export const GEO_NEARBY_PARALLEL: Geometry = {
  type: "LineString",
  coordinates: [
    [79.8635, 6.9271],
    [79.8643, 6.928],
  ],
};

export const GEO_BRIDGE_POINT: Geometry = {
  type: "Point",
  coordinates: [79.85, 6.91],
};

export const GEO_ISSUE_POTHOLE: Geometry = {
  type: "Point",
  coordinates: [79.861, 6.9265],
};
