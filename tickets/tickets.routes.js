import express from 'express';
import userValidation from '../middleware/userValidation.js';
import { cancelTickets, createTicket, getUserTIckets, listTickets, validateTickets } from './tickets.controller.js';
import { adminValidation } from '../middleware/adminValidation.js';

const ticketsRouter = express.Router();

// User only
ticketsRouter.post("/tickets", userValidation, createTicket);
ticketsRouter.get("/tickets/my-ticket", userValidation, getUserTIckets);
ticketsRouter.put("/tickets/:ticketId/cancel", userValidation, cancelTickets);
ticketsRouter.put("/tickets/validate/:ticketNumber", userValidation, validateTickets);

// Admin only
ticketsRouter.get("/tickets", adminValidation, listTickets);

export default ticketsRouter;