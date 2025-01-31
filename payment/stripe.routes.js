import express, { application } from 'express';
import userValidation from '../middleware/userValidation.js';
import { createSetupIntent, deletePaymentMethod, handleWebhook, listPaymentMethod } from './stripe.controllers.js';

const stripeRouter = express.Router();

stripeRouter.post("/stripe/setup", userValidation, createSetupIntent);
stripeRouter.get("/stripe/payment-methods", userValidation, listPaymentMethod);
stripeRouter.delete("/stipe/payment-methods/:paymentMethodId", userValidation, deletePaymentMethod);
stripeRouter.post("/stripe/webhook", express.raw({type: "application/json"}), handleWebhook);


export default stripeRouter;