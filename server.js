import express from 'express';
import "dotenv/config";
import userRouter from './user/user.routes.js';

const app = express();
const port = process.env.PORT;

app.use(express.json());

app.use("/api/user", userRouter);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});