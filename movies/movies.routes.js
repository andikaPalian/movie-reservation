import express from "express";
import { adminValidation, hasRole } from "../middleware/adminValidation.js";
import { AdminRole } from "@prisma/client";
import { addMovies } from "./movies,controller.js";

const moviesRouter = express.Router();

moviesRouter.post("/movies", adminValidation, hasRole(AdminRole.THEATHER_ADMIN || AdminRole.SUPER_ADMIN), addMovies);

export default moviesRouter;