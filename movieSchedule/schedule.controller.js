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

const getScheduleById = async (req, res) => {
    try {
        const scheduleId = req.params;

        const schedule = await prisma.movieSchedules.findUnique({
            where: {
                scheduleId: scheduleId
            },
            include: {
                movie: true,
                theater: {
                    include: {
                        seats: true,
                    }
                },
                tickets: {
                    include: {
                        seat: true,
                        user: {
                            select: {
                                name: true,
                                email: true,
                            }
                        }
                    }
                }
            }
        });
        if (!schedule) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        const reservedSeats = schedule.tickets.filter(ticket = ["PENDING", "CONFIRMED"].includes(ticket.status)).map(ticket => ticket.seat);
        const availableSeats = schedule.theater.seats.filter(seat => !reservedSeats.find(rs => rs?.seatId === seat.seatId))

        res.status(200).json({
            message: "Schedule retrieved successfully",
            schedule: {
                scheduleId: schedule.scheduleId,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                movie: schedule.movie,
                theater: {
                    ...schedule.theater,
                    availableSeats,
                    reservedSeats,
                }
            }
        })
    } catch (error) {
        console.error("Error during getting schedule:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const createSchedule = async (req, res) => {
    try {
        const {movieId, theaterId, startTime, endTime} = req.body;

        if (!movieId || !theaterId || !startTime || !endTime) {
            return res.status(400).json({
                message: "Movie ID, Theater ID, Start Time, and End Time are required"
            });
        }

        const movie = await prisma.movies.findUnique({
            where: {
                movieId: movieId
            }
        });

        if (!movie) {
            return res.status(404).json({
                message: "Movie not found"
            });
        }

        const theater = await prisma.theaters.findUnique({
            where: {
                theatherId: theaterId
            }
        });

        if (!theater) {
            return res.status(404).json({
                message: "Theater not found"
            });
        }

        const startDateTime = new Date(startTime)
        const endDateTime = new Date(endTime);
        if (startDateTime >= endDateTime) {
            return res.status(400).json({
                message: "End time must be greater than start time"
            });
        }

        // Check conflict schedule
        const conflictingSchedule = await prisma.movieSchedules.findFirst({
            where: {
                theaterID: theaterId,
                OR: [
                    {
                        AND: [
                            {
                                // Start time lebih kecil atau sama dengan startDateTime 
                                startTime: {lte: startDateTime},
                                // End time lebih besar dari startDateTIme 
                                endTime: {gt: startDateTime},
                            }
                        ]
                    },
                    {
                        AND: [
                            {
                                // Start time lebih kecil dari endDateTime
                                startTime: {lt: endDateTime},
                                // End time lebih besar atau sama dengan endDateTime
                                endTime: {gte: endDateTime}
                            }
                        ]
                    }
                ]
            }
        });

        if (conflictingSchedule) {
            return res.status(400).json({
                message: "Schedule conflict with existing showing"
            });
        }

        const newSchedule = await prisma.movieSchedules.create({
            dara: {
                startTime: startDateTime,
                endTime: endDateTime,
                movieId: movieId,
                theaterId: theaterId,
            },
            include: {
                movie: true,
                theater: true
            }
        });

        res.status(201).json({
            message: "Schedule created successfully",
            schedule: newSchedule,
        });
    } catch (error) {
        console.error("Error during creating schedule:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const updateSchedule = async (req, res) => {
    try {
        const scheduleId = req.params;
        const {startTime, endTime} = req.body;

        const startDateTime = new Date(startTime);
        const endDateTime = new Date(endTime);
        if (startDateTime >= endDateTime) {
            return res.status(400).json({
                message: "End time must be greater than start time",
            });
        }

        const existingSchedule = await prisma.movieSchedules.findUnique({
            where: {
                scheduleId: scheduleId,
            },
            include: {
                tickets: true
            }
        });
        if (!existingSchedule) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        const hasActiveTickets = existingSchedule.tickets.some(ticket => ticket.status === "PENDING" || ticket.status === "CONFIRMED");
        if (hasActiveTickets) {
            return res.status(400).json({
                message: "Cannot update schedule with active tickets"
            });
        }

        const conflictingSchedule = await prisma.movieSchedules.findFirst({
            where: {
                theaterID: existingSchedule.theaterID,
                scheduleId: {
                    not: scheduleId
                },
                OR: [
                    {
                        AND: [
                            {
                                startTime: {lte: startDateTime},
                                endTime: {gt: startDateTime},
                            },
                            {
                                startTime: {lt: endDateTime},
                                endTime: {gte: endDateTime}
                            }
                        ]
                    }
                ]
            }
        });
        if (conflictingSchedule) {
            return res.status(400).json({
                message: "Schedule conflict with existing showing"
            });
        }

        const updatedSchedule = await prisma.movieSchedules.update({
            where: {
                scheduleId: scheduleId,
            },
            data: {
                startTime: startDateTime,
                endTime: endDateTime,
            },
            include: {
                movie: true,
                theater: true,
            }
        });

        res.status(200).json({
            message: "Schedule updated successfully",
            schedule: updatedSchedule
        })
    } catch (error) {
        console.error("Error during updating schedule:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const deleteSchedule = async (req, res) => {
    try {
        const scheduleId = req.params;

        const existingSchedule = await prisma.movieSchedules.findUnique({
            where: {
                scheduleId: scheduleId
            },
            include: {
                tickets: true
            }
        });
        if (!existingSchedule) {
            return res.status(404).json({
                message: "Schedule not found"
            });
        }

        const hasActiveTickets = existingSchedule.tickets.some(ticket => ticket.status === "PENDING" || ticket.status === "CONFIRMED");
        if (hasActiveTickets) {
            return res.status(400).json({
                message: "Cannot delete schedule with active tickets"
            });
        }

        // Menghapus semua ticket yang terkait dengan schedule dan menghapus schedule
        await prisma.$transaction([
            prisma.tickets.deleteMany({
                where: {
                    scheduleID: scheduleId
                }
            }),
            prisma.movieSchedules.delete({
                where: {
                    scheduleId: scheduleId,
                }
            })
        ]);

        res.status(200).json({
            message: "Schedule deleted successfully"
        });
    } catch (error) {
        console.error("Error during deleting schedule:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {listSchedule, getScheduleById, createSchedule, updateSchedule, deleteSchedule};