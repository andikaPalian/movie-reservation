import express from "express";
import { addTheaters, deleteTheaters, listTheaters, updateTheaters, updateTheatersSeats } from "./theaters.controller.js";
import { adminValidation, hasRole } from "../middleware/adminValidation.js";
import { AdminRole } from "@prisma/client";

const theatersRouter = express.Router();

// Admin only
theatersRouter.post("/theaters", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]) , addTheaters);
theatersRouter.patch("/theaters/:theatersId", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), updateTheaters);
theatersRouter.delete("/theaters/:theatersId", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), deleteTheaters);
theatersRouter.put("/theaters/:theatersId/seats", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), updateTheatersSeats);

// Public
theatersRouter.get("/theaters", listTheaters);

export default theatersRouter;