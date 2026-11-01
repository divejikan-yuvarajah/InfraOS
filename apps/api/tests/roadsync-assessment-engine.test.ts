import { describe, expect, it } from "vitest";

import { assessPair, corridorProfile, redactFactors, riskIndexOf, type AssessSide } from "../src/modules/roadsync/assessment.engine.js";
import { bandOf } from "../src/modules/roadsync/assessment.rules.js";
import { analyzeSchedules, type WorkingHours } from "../src/modules/roadsync/schedule.analysis.js";
import { analyzeSpatial, lineLengthMeters, type AnyGeometry } from "../src/modules/roadsync/spatial.analysis.js";

const EW: AnyGeometry = { type: "LineString", coordinates: [[79.860, 6.930], [79.864, 6.930]] };
const NS: AnyGeometry = { type: "LineString", coordinates: [[79.862, 6.928], [79.862, 6.932]] };
const day = (iso: string) => new Date(`${iso}T06:00:00.000Z`);

function side(workType: string | null, infrastructureType: string, start: string, end: string, extra: Partial<AssessSide> = {}): AssessSide {
  return { sourceType: "work_request", workType, infrastructureType, traffic: null, priority: "NORMAL", isEmergency: false, workingHours: "day", start: day(start), end: day(end), ...extra };
}
const sched = (s: AssessSide, flex = 0) => ({ start: s.start!, end: s.end!, workingHours: s.workingHours as WorkingHours, flexibleDays: flex, isEmergency: s.isEmergency });

/** Runs the pair in both orientations with facts re-derived for each, as the real pipeline would. */
function both(a: AssessSide, ga: AnyGeometry, b: AssessSide, gb: AnyGeometry, buffer = 0) {
  const ab = assessPair(a, b, analyzeSpatial({ geometry: ga, bufferMeters: buffer }, { geometry: gb, bufferMeters: buffer }), analyzeSchedules(sched(a), sched(b)));
  const ba = assessPair(b, a, analyzeSpatial({ geometry: gb, bufferMeters: buffer }, { geometry: ga, bufferMeters: buffer }), analyzeSchedules(sched(b), sched(a)));
  return { ab, ba };
}
const points = (r: ReturnType<typeof assessPair>, key: string) => r.factors.find((f) => f.key === key)?.points;

describe("assessment engine", () => {
  it("(a) electricity cable vs water pipe, crossing with identical dates, hits floor F1 and is critical", () => {
    const { ab, ba } = both(side("ELECTRIC_CABLE_WORK", "ELECTRICITY", "2027-02-01", "2027-02-14"), EW, side("PIPELINE_INSTALLATION", "WATER", "2027-02-01", "2027-02-14"), NS);
    expect(ab.floorApplied?.code).toBe("F1");
    expect(ab.score).toBeGreaterThanOrEqual(80);
    expect(ab.band).toBe("critical");
    expect(ab.classes).toEqual(expect.arrayContaining(["utility_strike_risk", "direct_physical_overlap"]));
    expect(ab.primaryClass).toBe("utility_strike_risk");
    expect(points(ab, "floor")).toBe(ab.score - (ab.factors.filter((f) => f.key !== "floor").reduce((n, f) => n + f.points, 0) + ab.mitigations.reduce((n, m) => n + m.points, 0)));
    // hazard: both invasive (2) + different infra (1) + electricity (1) = 4 -> 20
    expect(points(ab, "hazard")).toBe(20);
    expect([ba.score, ba.band, ba.floorApplied?.code]).toEqual([ab.score, ab.band, ab.floorApplied?.code]);
  });

  it("(b) resurfacing partly overlapping excavation, intersecting: components sum to the score", () => {
    // A days 1-10, B days 6-15: overlap 5 of 10 days each -> temporal = round(10 + 15 * 0.5) = 18. spatial 30. hazard invasive+surface = 2 -> 10.
    const { ab, ba } = both(side("ROAD_RESURFACING", "ROAD", "2027-03-01", "2027-03-10"), EW, side("ROAD_EXCAVATION", "ROAD", "2027-03-06", "2027-03-15"), NS);
    expect(points(ab, "spatial")).toBe(30);
    expect(points(ab, "temporal")).toBe(18);
    expect(points(ab, "hazard")).toBe(10);
    expect(points(ab, "trafficCompounding")).toBe(0);
    expect(ab.floorApplied).toBeNull(); // F2 needs both invasive
    expect(ab.score).toBe(ab.factors.reduce((n, f) => n + f.points, 0));
    expect(ab.band).toBe(bandOf(ab.score));
    expect(ab.incompleteInputs).toContain("trafficImpact");
    expect([ba.score, ba.band, [...ba.classes].sort()]).toEqual([ab.score, ab.band, [...ab.classes].sort()]);
  });

  it("(c) parallel works 30 m apart with 15 m buffers are a footprint encroachment", () => {
    const parallel: AnyGeometry = { type: "LineString", coordinates: [[79.860, 6.93026], [79.864, 6.93026]] }; // about 29 m north: inside the combined 30 m buffers
    const { ab, ba } = both(side("ROAD_EXCAVATION", "ROAD", "2027-04-01", "2027-04-10"), EW, side("DRAINAGE_WORK", "DRAINAGE", "2027-04-03", "2027-04-12"), parallel, 15);
    expect(ab.classes).toContain("footprint_encroachment");
    expect(points(ab, "spatial")).toBe(22);
    expect(ba.classes).toContain("footprint_encroachment");
    expect(ba.score).toBe(ab.score);
  });

  it("(d) light works 400 m apart are an advisory below the conflict threshold", () => {
    const far: AnyGeometry = { type: "LineString", coordinates: [[79.860, 6.9336], [79.864, 6.9336]] };
    // One shared day out of ten: spatial 2 + temporal round(10 + 15 * 0.1) = 14, and no class applies.
    const { ab } = both(side("OTHER", "OTHER", "2027-05-01", "2027-05-10"), EW, side("OTHER", "OTHER", "2027-05-10", "2027-05-19"), far);
    expect(points(ab, "spatial")).toBe(2);
    expect(ab.score).toBeLessThan(20);
    expect(ab.classes).toEqual([]);
    expect(ab.kind).toBe("advisory");
  });

  it("(e) different shifts mitigate by 8 only when both traffic levels are at most moderate", () => {
    const mk = (level: "low" | "high") => both(
      side("ROAD_EXCAVATION", "ROAD", "2027-06-01", "2027-06-10", { traffic: { level: "low" } }),
      EW,
      side("DRAINAGE_WORK", "DRAINAGE", "2027-06-01", "2027-06-10", { workingHours: "night", traffic: { level } }),
      NS,
    ).ab;
    expect(mk("low").mitigations.map((m) => m.points)).toEqual([-8]);
    expect(mk("high").mitigations).toEqual([]);
  });

  it("maps score boundaries to bands", () => {
    expect([19, 20, 39, 40, 59, 60, 79, 80].map(bandOf)).toEqual(["info", "low", "low", "medium", "medium", "high", "high", "critical"]);
  });

  it("detects surface-then-invasive sequence inside 180 days and ignores it beyond", () => {
    const resurf = side("ROAD_RESURFACING", "ROAD", "2027-01-01", "2027-01-10");
    const near = both(resurf, EW, side("ROAD_EXCAVATION", "ROAD", "2027-03-11", "2027-03-20"), NS).ab; // gap 60 d
    expect(near.classes).toContain("sequential_disruption");
    expect(near.sequence).toEqual({ direction: "a_then_b", gapDays: 60 });
    expect(points(near, "temporal")).toBe(Math.round(6 + 14 * (1 - 60 / 180)));
    const far = both(resurf, EW, side("ROAD_EXCAVATION", "ROAD", "2027-07-30", "2027-08-05"), NS).ab; // gap > 180 d
    expect(far.classes).not.toContain("sequential_disruption");
    expect(far.sequence).toBeNull();
    const reverse = both(side("ROAD_EXCAVATION", "ROAD", "2027-01-01", "2027-01-10"), EW, side("ROAD_RESURFACING", "ROAD", "2027-03-11", "2027-03-20"), NS).ab;
    expect(reverse.classes).not.toContain("sequential_disruption"); // digging first, surfacing after, is the right order
  });

  it("flags same-family overlapping invasive works as an opportunity, but never water against electricity", () => {
    const same = both(side("PIPELINE_INSTALLATION", "WATER", "2027-08-01", "2027-08-20"), EW, side("PIPELINE_INSTALLATION", "WATER", "2027-08-05", "2027-08-25"), EW).ab;
    expect(same.kind).toBe("opportunity");
    expect(same.primaryClass).toBe("joint_works_opportunity");
    expect(same.estimatedSharedTrenchMeters).toBeGreaterThan(0);
    const mixed = both(side("PIPELINE_INSTALLATION", "WATER", "2027-08-01", "2027-08-20"), EW, side("ELECTRIC_CABLE_WORK", "ELECTRICITY", "2027-08-05", "2027-08-25"), EW).ab;
    expect(mixed.kind).not.toBe("opportunity");
    expect(mixed.classes).not.toContain("joint_works_opportunity");
  });

  it("applies the emergency floor F3 when emergency work interferes with planned works", () => {
    const { ab } = both(side("ROAD_EXCAVATION", "ROAD", "2027-09-01", "2027-09-05", { isEmergency: true }), EW, side("ROAD_RESURFACING", "ROAD", "2027-09-03", "2027-09-09"), NS);
    expect(ab.classes).toContain("emergency_interference");
    expect(ab.score).toBeGreaterThanOrEqual(60);
    expect(ab.kind).toBe("conflict");
    expect(ab.factors.find((f) => f.key === "priorityEmergency")?.points).toBe(5);
  });

  it("treats an existing electricity asset as a strike risk for invasive work", () => {
    const asset: AssessSide = { sourceType: "asset", workType: null, infrastructureType: "ELECTRICITY", traffic: null, priority: null, isEmergency: false, workingHours: "day", start: null, end: null };
    const work = side("ROAD_EXCAVATION", "ROAD", "2027-10-01", "2027-10-10");
    const r = assessPair(work, asset, analyzeSpatial({ geometry: EW, bufferMeters: 0 }, { geometry: NS, bufferMeters: 0 }), analyzeSchedules(sched(work), sched(work)) && { applicable: false, relation: "permanent", containedBy: null, overlapDays: 0, overlapStart: null, overlapEnd: null, gapDays: 0, overlapPctOfA: null, overlapPctOfB: null, hoursCompatibility: null, shift: null });
    expect(r.classes).toContain("utility_strike_risk");
    expect(points(r, "hazard")).toBe(20);
    expect(points(r, "temporal")).toBe(12);
  });

  it("builds a gap-free corridor profile and a noisy-OR Risk Index", () => {
    const length = Math.round(lineLengthMeters(EW));
    const bins = corridorProfile(EW, [{ id: "x", score: 70, geometry: NS, reachMeters: 25 }])!;
    expect(bins.length).toBeLessThanOrEqual(60);
    expect(bins[0]!.fromM).toBe(0);
    expect(bins[bins.length - 1]!.toM).toBe(length);
    bins.slice(1).forEach((bin, i) => expect(bin.fromM).toBe(bins[i]!.toM));
    expect(Math.max(...bins.map((b) => b.score))).toBe(70);
    expect(bins.filter((b) => b.score === 0).length).toBeGreaterThan(0);
    expect(corridorProfile({ type: "Point", coordinates: [79.86, 6.93] }, [])).toBeNull();
    expect(riskIndexOf([60, 40])).toBe(76);
    expect(riskIndexOf([])).toBe(0);
  });

  it("redacts factors that depend on the other agency's private fields", () => {
    const { ab } = both(side("ROAD_EXCAVATION", "ROAD", "2027-11-01", "2027-11-05", { priority: "CRITICAL" }), EW, side("DRAINAGE_WORK", "DRAINAGE", "2027-11-01", "2027-11-05"), NS);
    const redacted = redactFactors(ab.factors).find((f) => f.key === "priorityEmergency")!;
    expect(redacted.code).toBe("other_agency");
    expect(redacted.params).toEqual({ involvesOtherAgency: true });
    expect(redacted.points).toBe(5);
  });
});
