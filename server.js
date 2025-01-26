import express from 'express';
import "dotenv/config";
import userRouter from './user/user.routes.js';
import adminRouter from './admin/admin.routes.js';

const app = express();
const port = process.env.PORT;

app.use(express.json());

app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});