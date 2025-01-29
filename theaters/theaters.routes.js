import express from "express";
import { addTheaters, addUserToTheaters, deleteTheaters, listTheaters, updateTheaters } from "./theaters.controller.js";
import { adminValidation, hasRole } from "../middleware/adminValidation.js";
import { AdminRole } from "@prisma/client";

const theatersRouter = express.Router();

// Admin only
theatersRouter.post("/theaters", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]) , addTheaters);
theatersRouter.patch("/theaters/:theatersId", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), updateTheaters);
theatersRouter.delete("/theaters/:theatersId", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), deleteTheaters);
theatersRouter.put("/theaters/:theatersId/users", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), addUserToTheaters);

// Public
theatersRouter.get("/theaters", listTheaters);

export default theatersRouter;