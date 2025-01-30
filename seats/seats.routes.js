import express from "express";
import { checkSeatAvailability, getSeatsById, getTheaterSeatsLayout, listSeats } from "./seats.controller.js";

const seatsRouter = express.Router();

seatsRouter.get("/seats/:theatersId", listSeats);
seatsRouter.get("/seats/:seatId", getSeatsById);
seatsRouter.get("/seats/:seatId/availability", checkSeatAvailability);
seatsRouter.get("/seats/:theatersId/seat-layout", getTheaterSeatsLayout);

export default seatsRouter;