import express from "express";
import { addTheaters } from "./theaters.controller.js";
import { adminValidation, hasRole } from "../middleware/adminValidation.js";
import { AdminRole } from "@prisma/client";

const theatersRouter = express.Router();

theatersRouter.post("/theaters", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]) , addTheaters);

export default theatersRouter;