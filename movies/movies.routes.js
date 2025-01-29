import express from "express";
import { adminValidation, hasRole } from "../middleware/adminValidation.js";
import { AdminRole } from "@prisma/client";
import { addMovies, deleteMovies, listMovies, updateMovies } from "./movies,controller.js";

const moviesRouter = express.Router();

// Admin only
moviesRouter.post("/movies", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), addMovies);
moviesRouter.patch("/movies/:moviesId", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), updateMovies);
moviesRouter.delete("/movies/:moviesId", adminValidation, hasRole([AdminRole.THEATHER_ADMIN, AdminRole.SUPER_ADMIN]), deleteMovies);

// Public
moviesRouter.get("/movies", listMovies);

export default moviesRouter;