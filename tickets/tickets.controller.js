import { PrismaClient } from "@prisma/client";
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const calculateTicketPrice = (seatType) => {
    const prices = {
        regular: 50000,
        vip: 75000,
        premium: 100000,
    };

    // Default ke regular jika seatType tidak ditemukan
    return prices[seatType] || prices.regular;
}

const createTicket = async (req, res) => {
    try {
        const {scheduleId, seatId, paymentMethodId} = req.body;
        const userId = req.user.userId;

        if (!scheduleId || !seatId || !paymentMethodId) {
            return res.status(400).json({
                message: "Schedule ID, Seat ID, and Payment Method ID are required",
            });
        }

        // Cek ketersediaan schedule dan seat
        const schedule = await prisma.movieSchedules.findUnique({
            where: {
                scheduleId: scheduleId,
            },
            include: {
                tickets: {
                    where: {
                        seatID: seatId,
                        status: {
                            in: ["PENDING", "CONFIRMED"],
                        }
                    }
                },
                movie: true,
                theater: true,
            }
        });

        // Get seat information including its type
        const seat = await prisma.seats.findUnique({
            where: {
                seatId: seatId
            }
        });

        if (!schedule) {
            return res.status(404).json({
                message: "Schedule not found",
            });
        }

        if (schedule.tickets.length > 0) {
            return res.status(400).json({
                message: "Seat is already booked",
            });
        }

        if (!seat) {
            return res.status(404).json({
                message: "Seat not found",
            });
        }

        let stripeCustomer = await prisma.stripe.findFirst({
            where: {
                tickets: {
                    some: {
                        userID: userId,
                    }
                }
            }
        });
        if (!stripeCustomer) {
            const user = await prisma.user.findUnique({
                where: {
                    userId: userId,
                }
            });

            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
                payment_method: paymentMethodId,
                invoice_settings: {
                    default_payment_method: paymentMethodId
                }
            });

            stripeCustomer = await prisma.stripe.create({
                data: {
                    stripeId: customer.id,
                    customerID: customer.id,
                    paymentMethodID: paymentMethodId
                }
            });
        }

        // Calculate price (implementasi logika harga sesuai kebutuhan)
        // Rp 100.000
        const amount = calculateTicketPrice(seat.seatType);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "idr",
            customer: stripeCustomer.customerID,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            description: `Ticket for ${schedule.movie.title} at ${schedule.theater.name} (${seat.seatType})`
        });

        const ticketNumber = `TIX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const [ticket] = await prisma.$transaction([
            prisma.tickets.create({
                data: {
                    ticketNumber,
                    price: amount,
                    status: "CONFIRMED",
                    scheduleID: scheduleId,
                    userID: userId,
                    seatID: seatId,
                    stripeID: stripeCustomer.stripeId,
                    seatType: seat.seatType,
                },
                include: {
                    schedule: {
                        include: {
                            movie: true,
                            theater: true,
                        }
                    },
                    seat: true,
                }
            })
        ]);

        res.status(201).json({
            message: "Ticket created successfully",
            ticket: ticket,
            paymentStatus: paymentIntent.status,
        })
    } catch (error) {
        console.error("Error during creating ticket:", error);
        
        if (error.type === "StripeCardError") {
            return res.status(400).json({
                message: "Payment failed",
                error: error.message,
            });
        }

        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const getUserTIckets = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {status, page = 1, limit = 10} = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {userID: userId};

        if (status) where.status = status;

        const [tickets, total] = await prisma.$transaction([
            prisma.tickets.findMany({
                where: where,
                skip,
                take: parseInt(limit),
                include: {
                    schedule: {
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
                                }
                            }
                        }
                    },
                    seat: true,
                    stripe: {
                        select: {
                            customerID: true,
                            paymentMethodID: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            }),
            prisma.tickets.count({
                where: where,
            })
        ]);

        res.status(200).json({
            message: "Tickets retrieved successfully",
            pagination: {
                total,
                totalPage: Math.ceil(total / parseInt(limit)),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
            tickets: tickets
        })
    } catch (error) {
        console.error("Error during getting user tickets:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const cancelTickets = async (req, res) => {
    try {
        const ticketId = req.params;
        const userId = req.user.userId;

        const ticket = await prisma.tickets.findFirst({
            where: {
                ticketId: ticketId,
                userID: userId,
            },
            include: {
                stripe: true,
            }
        });
        if (!ticket) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        if (!["PENDING", "CONFIRMED"].includes(ticket.status)) {
            return res.status(400).json({
                message: "Ticket cannot be canceled",
            })
        }

        // Jika status masih PENDING, cukup update jadi CANCELED
        if (ticket.status === "PENDING") {
            const updatedTicket = await prisma.tickets.update({
                where: {
                    ticketId: ticketId
                },
                data: {
                    status: "CANCELED"
                },
                include: {
                    schedule: {
                        include: {
                            movie: true,
                            theater: true
                        }
                    },
                    seat: true,
                }
            });

            return res.status(200).json({
                message: "Ticket canceled dan refunded successfully",
                ticket: updatedTicket
            });
        }

        // Jika status sudah confirmed lakukan refund
        if (ticket.status === "CONFIRMED") {
            if (!ticket.stripe.paymentMethodID || !ticket.stripe) {
                return res.status(400).json({
                    message: "Paymennt method not found for refund"
                });
            }

            try {
                // Ambil paymentIntent dari Stripe untuk memastikan validitasnya
                const paymentIntent = await stripe.paymentIntents.retrieve(ticket.stripe.paymentMethodID);

                // Buat refund
                const refund = await stripe.refunds.create({
                    // Payment Intent ID dari Stripe
                    payment_intent: paymentIntent.id,
                    // Refund semua harga ticket
                    amount: ticket.price
                });

                // Jika refund sukses, update status tiket ke CANCELED
                const updatedTicket = await prisma.tickets.update({
                    where: {
                        ticketId: ticketId
                    },
                    data: {
                        status: "CANCELED"
                    },
                    include: {
                        schedule: {
                            include: {
                                movie: true,
                                theater: true
                            }
                        },
                        seat: true,
                    }
                });

                return res.status(200).json({
                    message: "Ticket canceled and refunded successfully",
                    refundId: refund.id,
                    ticket: updatedTicket,
                })
            } catch (refundError) {
                console.error("Refund failed:", refundError);
                return res.status(500).json({
                    message: "Refund failed",
                    error: refundError.message,
                });
            }
        }
    } catch (error) {
        console.error("Error during canceling tickets:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const validateTickets = async (req, res) => {
    try {
        const ticketNumber = req.params;

        const ticket = await prisma.tickets.findUnique({
            where: {
                ticketNumber: ticketNumber,
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                },
                schedule: {
                    include: {
                        movie: true,
                        theater: true
                    }
                },
                seat: true
            }
        });
        if (!ticket) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        if (ticket.status === "USED") {
            return res.status(400).json({
                message: "Ticket already used"
            });
        }

        if (ticket.status === "CANCELED") {
            return res.status(400).json({
                message: "Ticket already canceled"
            });
        }

        const updatedTickets = await prisma.tickets.update({
            where: {
                ticketNumber: ticketNumber,
            },
            data: {
                status: "USED",
            }
        });

        res.status(200).json({
            message: "Ticket validated successfully",
            ticket: updatedTickets,
        })
    } catch (error) {
        console.error("Error during validating tickets:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const listTickets = async (req, res) => {
    try {
        const {status, page = 1, limit = 10} = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};

        if (status) where.status = status;

        const [tickets, total] = await prisma.$transaction([
            prisma.tickets.findMany({
                where: where,
                skip,
                take: parseInt(limit),
                include: {
                    user: {
                        select: {
                            name: true,
                            email: true,
                        }
                    },
                    schedule: {
                        include: {
                            movie: true,
                            theater: true,
                        }
                    },
                    seat: true,
                },
                orderBy: {
                    createdAt: "desc",
                }
            }),
            prisma.tickets.count({
                where: where
            })
        ]);

        res.status(200).json({
            message: "Tickets retrieved successfully",
            pagination: {
                total,
                totalPage: Math.ceil(total / parseInt(limit)),
                cuurentPage: parseInt(page),
                limit: parseInt(limit)
            },
            tickets: tickets
        })
    } catch (error) {
        console.error("Error during listing tickets:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {createTicket, getUserTIckets, cancelTickets, validateTickets, listTickets};