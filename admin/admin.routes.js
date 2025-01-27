import express from 'express';
import { loginAdmin, registerAdmin, updateRole } from './admin.controller.js';
import { adminValidation, hasRole } from '../middleware/adminValidation.js';
import { AdminRole } from '@prisma/client';

const adminRouter = express.Router();

adminRouter.post("/register", adminValidation , hasRole([AdminRole.SUPER_ADMIN]) , registerAdmin);
adminRouter.post("/login", loginAdmin);
adminRouter.put("/update-role", adminValidation, hasRole([AdminRole.SUPER_ADMIN]), updateRole);

export default adminRouter;