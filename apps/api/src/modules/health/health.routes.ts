import { Router } from "express";

import { getHealth, getReady } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/", getHealth);

export const readyRouter = Router();

readyRouter.get("/", getReady);
