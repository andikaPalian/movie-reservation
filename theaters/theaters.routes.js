import express from "express";
import { addTheaters, deleteTheaters, updateTheaters } from "./theaters.controller.js";
import { adminValidation, hasRole } from "../middleware/adminValidation.js";
import { AdminRole } from "@prisma/client";

const theatersRouter = express.Router();

theatersRouter.post("/theaters", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]) , addTheaters);
theatersRouter.patch("/theaters", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), updateTheaters);
theatersRouter.delete("/theaters", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), deleteTheaters);

export default theatersRouter;