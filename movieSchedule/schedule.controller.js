import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const listSchedule = async (req, res) => {
    try {
        const {movieId, theaterId, startDate, endDate, page = 1, limit = 10} = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        if (movieId) where.movieID = movieId;
        if (theaterId) where.theaterID = theaterId;
        if (startDate || endDate) {
            where.startTime = {}
            if (startDate) where.startTime.gte = new Date(startDate);
            if (endDate) where.startTime.lte = new Date(endDate);
        }

        // Jalankan transaksi Prisma untuk mengambil data & menghitung total
        const [schedules, total] = await prisma.$transaction([
            prisma.movieSchedules.findMany({
                where: where,
                skip,
                take: parseInt(limit),
                include: {
                    movie: {
                        select: {
                            title: true,
                            duration: true,
                            description: true
                        }
                    },
                    theater: {
                        select: {
                            name: true,
                            location: true,
                            capacity: true
                        }
                    },
                    tickets: {
                        select: {
                            status: true,
                            seat: {
                                select: {
                                    seatId: true,
                                    seatNumber: true,
                                    seatType: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    startTime: 'asc'
                }
            }),
            prisma.movieSchedules.count({
                where: where
            })
        ]);

        const schedulesResponse = schedules.map((schedule) => {
            const reservedSeats = schedule.tickets.filter(
                ticket => ["PENDING", "CONFIRMED"].includes(ticket.status)
            );

            return {
                scheduleId: schedule.scheduleId,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                movie: schedule.movie,
                theater: {
                    ...schedule.theater,
                    availableSeats: schedule.theater.capacity - reservedSeats.length
                },
                reservedSeats: reservedSeats.map(ticket => ticket.seat)
            };
        });

        res.status(200).json({
            message: "Schedule retrieved successfully",
            pagination: {
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
            schedules: schedulesResponse,
        })
    } catch (error) {
        console.error("Error during listing schedules:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {listSchedule};