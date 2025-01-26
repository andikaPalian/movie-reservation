import express from 'express';
import { changeUserEmail, changeUserPassword, loginUser, registerUser } from './user.controller.js';
import userValidation from '../middleware/userValidation.js';

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.put("/email", userValidation, changeUserEmail);
userRouter.put("/password", userValidation, changeUserPassword);

export default userRouter;