import express from "express";
import { listSchedule } from "./schedule.controller.js";

const scheduleRouter = express.Router();

scheduleRouter.get("/schedule", listSchedule);

export default scheduleRouter;