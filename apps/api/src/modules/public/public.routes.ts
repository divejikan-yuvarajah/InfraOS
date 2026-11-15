import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { failure, success } from "../../shared/http/envelope.js";
import { parseListQuery } from "../../shared/http/list-query.js";
import { ISSUE_CATEGORIES, ISSUE_PRIORITIES } from "../issues/issue.constants.js";
import { MAX_ISSUE_PHOTOS } from "../issues/issue-photo.js";
import {
  createPublicIssue,
  getPublicMapFeatures,
  getPublicProjectBySlug,
  getPublicSummary,
  listPublicProjects,
  openPublicIssuePhoto,
  trackPublicIssue,
} from "./public.service.js";

export const publicRouter = Router();

const submitIssueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(failure("RATE_LIMITED", "Too many submissions, please try again later", req.requestId));
  },
});

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(failure("RATE_LIMITED", "Too many lookup attempts", req.requestId));
  },
});

const publicIssueBodySchema = z.object({
  category: z.enum(ISSUE_CATEGORIES),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(10).max(5000),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  website: z.string().max(100).optional(), // Honeypot field (must be empty)
  location: z.object({
    addressLine: z.string().trim().max(300).optional(),
    district: z.string().trim().min(2).max(80),
    province: z.string().trim().min(2).max(80),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
  contact: z.object({
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().max(160).optional(),
  }).optional(),
  photos: z.array(z.object({
    base64: z.string().min(16).max(7_500_000),
    fileName: z.string().max(120).optional(),
  })).max(MAX_ISSUE_PHOTOS).optional(),
});

const trackBodySchema = z.object({
  referenceNo: z.string().trim().min(4).max(40),
  trackingSecret: z.string().trim().min(6).max(80),
});

publicRouter.get("/summary", async (req, res) => {
  const data = await getPublicSummary();
  res.status(200).json(success(data, req.requestId));
});

publicRouter.get("/projects", async (req, res) => {
  const parsed = parseListQuery(req.query as Record<string, unknown>);
  if (!parsed) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid query parameters", req.requestId));
    return;
  }
  const data = await listPublicProjects(parsed);
  res.status(200).json(success(data, req.requestId));
});

publicRouter.get("/projects/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    res.status(404).json(failure("NOT_FOUND", "Project not found", req.requestId));
    return;
  }
  const project = await getPublicProjectBySlug(slug);
  if (!project) {
    res.status(404).json(failure("NOT_FOUND", "Project not found", req.requestId));
    return;
  }
  res.status(200).json(success(project, req.requestId));
});

publicRouter.get("/map/features", async (req, res) => {
  const bbox = typeof req.query.bbox === "string" ? req.query.bbox : undefined;
  const data = await getPublicMapFeatures(bbox);
  res.status(200).json(success(data, req.requestId));
});

publicRouter.post("/issues", submitIssueLimiter, async (req, res) => {
  const parsed = publicIssueBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid issue submission", req.requestId));
    return;
  }
  // Honeypot trap
  if (parsed.data.website && parsed.data.website.trim().length > 0) {
    res.status(400).json(failure("VALIDATION_ERROR", "Invalid issue submission", req.requestId));
    return;
  }
  const result = await createPublicIssue(parsed.data);
  if (!result.ok) {
    const status = result.code === "STORAGE_UNAVAILABLE" ? 503 : 400;
    res.status(status).json(failure(result.code, result.message, req.requestId));
    return;
  }
  res.status(201).json(success(result, req.requestId));
});

publicRouter.post("/issues/track", trackLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = trackBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(404).json(failure("NOT_FOUND", "Report not found or invalid tracking code", req.requestId));
    return;
  }
  const data = await trackPublicIssue(parsed.data.referenceNo, parsed.data.trackingSecret);
  if (!data) {
    res.status(404).json(failure("NOT_FOUND", "Report not found or invalid tracking code", req.requestId));
    return;
  }
  res.status(200).json(success(data, req.requestId));
});

publicRouter.get("/issues/track/photos/:index", trackLimiter, async (req, res) => {
  const ref = typeof req.query.referenceNo === "string" ? req.query.referenceNo : "";
  const secret = typeof req.query.trackingSecret === "string" ? req.query.trackingSecret : "";
  const idx = Number(req.params.index);
  if (!ref || !secret || !Number.isInteger(idx) || idx < 0 || idx >= MAX_ISSUE_PHOTOS) {
    res.status(404).json(failure("NOT_FOUND", "Photo not found", req.requestId));
    return;
  }
  const opened = await openPublicIssuePhoto(ref, secret, idx);
  if (!opened) {
    res.status(404).json(failure("NOT_FOUND", "Photo not found", req.requestId));
    return;
  }
  res.setHeader("Content-Type", opened.mimeType);
  res.setHeader("Cache-Control", "no-store");
  opened.stream.on("error", () => {
    if (!res.headersSent) res.status(404).end();
  });
  opened.stream.pipe(res);
});
