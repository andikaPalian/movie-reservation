import express from "express";
import { createSchedule, deleteSchedule, getScheduleById, listSchedule, updateSchedule } from "./schedule.controller.js";
import { adminValidation, hasRole } from "../middleware/adminValidation.js";
import { AdminRole } from "@prisma/client";

const scheduleRouter = express.Router();

// Public
scheduleRouter.get("/schedule", listSchedule);
scheduleRouter.get("/schedule/:scheduleId", getScheduleById);

// Admin only
scheduleRouter.post("/schedule", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), createSchedule);
scheduleRouter.put("/schedule/:scheduleId/update", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), updateSchedule);
scheduleRouter.delete("/schedule/:scheduleId", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), deleteSchedule);

export default scheduleRouter;