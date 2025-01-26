import express from 'express';
import { loginAdmin, registerAdmin } from './admin.controller.js';
import { adminValidation, hasRole } from '../middleware/adminValidation.js';
import { AdminRole } from '@prisma/client';

const adminRouter = express.Router();

adminRouter.use(adminValidation)

adminRouter.post("/register", hasRole(AdminRole.SUPER_ADMIN) , registerAdmin);
adminRouter.post("/login", loginAdmin);

export default adminRouter;