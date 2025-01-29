import express from "express";
import { listSeats } from "./seats.controller.js";

const seatsRouter = express.Router();

seatsRouter.get("/seats/:theatersId", listSeats);

export default seatsRouter;