import express from 'express';
import "dotenv/config";
import userRouter from './user/user.routes.js';
import adminRouter from './admin/admin.routes.js';
import moviesRouter from './movies/movies.routes.js';
import theatersRouter from './theaters/theaters.routes.js';
import seatsRouter from './seats/seats.routes.js';
import scheduleRouter from './movieSchedule/schedule.routes.js';
import ticketsRouter from './tickets/tickets.routes.js';
import stripeRouter from './payment/stripe.routes.js';

const app = express();
const port = process.env.PORT;

app.use(express.json());

app.use("/api/user", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/movies", moviesRouter);
app.use("/api/theaters", theatersRouter);
app.use("/api/seats", seatsRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/stripe", stripeRouter);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});