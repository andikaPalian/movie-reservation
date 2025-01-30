import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const listSeats = async (req, res) => {
    try {
        const theatersId = req.params;
        const {showTime} = req.query;

        const theater = await prisma.theaters.findUnique({
            where: {
                theatherId: theatersId,
            }
        });
        if (!theater) {
            return res.status(404).json({
                message: "Theater not found",
            });
        }

        const seats = await prisma.seats.findMany({
            where: {
                theaterID: theatersId,
            },
            include: {
                tickets: {
                    where: showTime ? {
                        AND: [
                            {
                                status: {
                                    in: ['PENDING', 'CONFIRMED']
                                }
                            },
                            {
                                schedule: {
                                    startTime: new Date(showTime)
                                }
                            }
                        ]
                    } : {
                        status: {
                            in: ['PENDING', 'CONFIRMED']
                        }
                    },
                    include: {
                        schedule: true,
                        user: {
                            select: {
                                userId: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        // Proses seats data
        const seatsResponse = seats.map((seat) => {
            const activeTickets = seat.tickets.find(ticket => ["PENDING", "CONFIRMED"].includes(ticket.status));

            return {
                seatId: seat.seatId,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                theaterId: seat.theaterID,
                isReserved: seat.tickets.length > 0,
                status: activeTickets ? activeTickets.status : null,
                reservation: activeTickets ? {
                    ticketId: activeTickets.ticketId,
                    ticketNumber: activeTickets.ticketNumber,
                    userId: activeTickets.user.userId,
                    username: activeTickets.user.name,
                    showTime: activeTickets.schedule.startTime,
                    endTime: activeTickets.schedule.endTime,
                } : null
            };
        });

        // Kelompokkan seat berdasarkan jenis untuk ringkasan
        const seatSummary = seatsResponse.reduce((acc, seat) => {
            if (!acc[seat.seatType]) {
                acc[seat.seatType] = {
                    total: 0,
                    reserved: 0,
                    available: 0
                };
            }
                acc[seat.seatType].total++;
                if (seat.isReserved) {
                    acc[seat.seatType].reserved++;
                } else {
                    acc[seat.seatType].available++;
                }
                return acc;
        }, {});

        res.status(200).json({
            message: "Seats retrieved successfully",
            summary: {
                totalSeats: seatsResponse.length,
                seatType: seatSummary
            },
            seats: seatsResponse.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)),
        });
    } catch (error) {
        console.error("Error during listing seats:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const getSeatsById = async (req, res) => {
    try {
        const seatId = req.params;

        const seat = await prisma.seats.findUnique({
            where: {
                seatId: seatId,
            },
            include: {
                tickets: {
                    where: {
                        status: {
                            in: ["PENDING", "CONFIRMED"],
                        }
                    },
                    include: {
                        schedule: true,
                        user: {
                            select: {
                                userId: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        if (!seat) {
            return res.status(404).json({
                message: "Seat not found",
            });
        }

        const activeTickets = seat.tickets.find(ticket => ["PENDING", "CONFIRMED"].includes(ticket.status));

        res.status(200).json({
            message: "Seat retrieved successfully",
            seat: {
                seatId: seat.seatId,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                theaterId: seat.theaterID,
                isReserved: seat.tickets.length > 0,
                status: activeTickets ? activeTickets.status : null,
                reservation: activeTickets ? {
                    ticketId: activeTickets.ticketId,
                    ticketNumber: activeTickets.ticketNumber,
                    userId: activeTickets.user.userId,
                    username: activeTickets.user.name,
                    showTime: activeTickets.schedule.startTime,
                    endTime: activeTickets.schedule.endTime,
                } : null,
            }
        });
    } catch (error) {
        console.error("Error during listing seats:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const checkSeatAvailability = async (req, res) => {
    try {
        const seatId = req.params;
        const {scheduleId} = req.query;

        if (!scheduleId) {
            return res.status(400).json({
                message: "Schedule ID is required",
            });
        }

        const seat = await prisma.seats.findUnique({
            where: {
                seatId: seatId,
            },
            include: {
                tickets: {
                    where: {
                        AND: [
                            {
                                scheduleID: scheduleId
                            },
                            {
                                status: {
                                    in: ['PENDING', 'CONFIRMED'],
                                }
                            }
                        ]
                    }
                }
            }
        });
        if (!seat) {
            return res.status(404).json({
                message: "Seat not found",
            });
        }

        res.status(200).json({
            message: "Seat availability retrieved successfully",
            seat: {
                seatId: seat.seatId,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                isAvailable: seat.tickets.length === 0,
            }
        })
    } catch (error) {
        console.error("Error during checking seat availability:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const getTheaterSeatsLayout = async (req, res) => {
    try {
        const theatersId = req.params;
        const scheduleId = req.query;

        const seats = await prisma.seats.findMany({
            where: {
                theaterID: theatersId,
            },
            include: {
                tickets: scheduleId ? {
                    where: {
                        AND: [
                            {
                                scheduleID: scheduleId
                            },
                            {
                                status: {
                                    in: ["PENDING", "CONFIRMED"]
                                }
                            }
                        ]
                    }
                } : false
            },
            orderBy: {
                seatNumber: "asc"
            }
        });

        // Atur seats menjadi beberapa baris
        const seatsLayout = seats.reduce((acc, seat) => {
            const row = seat.seatNumber.charAt(0);
            if (!acc[row]) {
                acc[row] = [];
            }
            acc[row].push({
                seatId: seat.seatId,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                isReserved: scheduleId ? seat.tickets.length > 0 : false,
            });
            return acc;
        }, {});

        res.status(200).json({
            message: "Theater seats layout retrieved successfully",
            layout: seatsLayout,
        })
    } catch (error) {
        console.error("Error during getting theater seats layout:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {listSeats, getSeatsById, checkSeatAvailability, getTheaterSeatsLayout};