import { PrismaClient } from "@prisma/client";
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createSetupIntent = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await prisma.user.findUnique({
            where: {
                userId: userId,
            }
        });
        if (!user) {
            return res.status(404).json({
                message: "USER NOT FOUND",
            });
        }

        // Cek apakah user sudah punya customer di stripe
        const stripeCustomer = await prisma.stripe.findFirst({
            where: {
                tickets: {
                    some: {
                        userID: userId
                    }
                }
            }
        });
        // Jika tidak ada, buat customer baru di stripe
        if (!stripeCustomer) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.name,
            });

            stripeCustomer = await prisma.stripe.create({
                data: {
                    stripeId: customer.id,
                    customerID: customer.id,
                    // Akan diperbarui ketika user melakukan pembayaran / ketika metode pembayaran dilampirkan
                    paymentMethodID: "",
                }
            });
        }

        const setupIntent = await stripe.setupIntents.create({
            customer: stripeCustomer.customerID,
            payment_method_types: ["card"],
        })

        res.status(200).json({
            message: "Setup Intent Created Successfully",
            clientSecret: setupIntent.client_secret,
        });
    } catch (error) {
        console.error("Error during creating setup intent:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const listPaymentMethod = async (req, res) => {
    try {
        const userId = req.user.userId;

        const stripeCustomer = await prisma.stripe.findFirst({
            where: {
                tickets: {
                    some: {
                        userID: userId,
                    }
                }
            }
        });

        if (!stripeCustomer) {
            return res.status(404).json({
                message: "No payment method found for this user",
            });
        }

        const paymentMethods = await stripe.paymentMethods.list({
            custome: stripeCustomer.customerID,
            type: "card",
        })
        res.status(200).json({
            message: "Payment Methods Retrieved Successfully",
            paymentMethods: paymentMethods.data,
        })
    } catch (error) {
        console.error("Error during listing payment methods:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const deletePaymentMethod = async (req, res) => {
    try {
        const paymentMethodId = req.params;
        const userId = req.user.userId;

        const stripeCustomer = await prisma.stripe.findFirst({
            where: {
                tickets: {
                    some: {
                        userID: userId,
                    }
                }
            }
        });

        if (!stripeCustomer) {
            return res.status(404).json({
                message: "No payment method found for this user",
            });
        }

        await stripe.paymentMethods.detach(paymentMethodId);

        res.status(200).json({
            message: "Payment Method Removed Successfully",
        });
    } catch (error) {
        console.error("Error during deleting payment method:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const handleWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.error("Webhook signature verification failed:", error);
        return res.status(400).json({
            message: error.message
        })
    }

    try {
        switch(event.type) {
            case "payment_intent.succeeded":
                const paymentIntent = event.data.object;
                const ticket = await prisma.tickets.findUnique({
                    where: {
                        stripeID: paymentIntent.id
                    }
                });
                if (!ticket) {
                    console.warn("Ticket not found for payment intent:", paymentIntent.id);
                    return res.status(404).json({
                        message: "Ticket not found for payment intent",
                    });
                }

                await prisma.tickets.update({
                    where: {
                        ticketId: ticket.ticketId
                    },
                    data: {
                        status: "CONFIRMED",
                    }
                });
                break;

            case "payment_intent.payment_failed":
                const failedPayment = event.data.object;
                const tickets = await prisma.tickets.findUnique({
                    where: {
                        stripeID: failedPayment.id
                    }
                });

                if (!tickets) {
                    console.warn("Ticket not found for failed payment:", failedPayment.id);
                    return res.status(404).json({
                        message: "Ticket not found"
                    });
                }

                await prisma.tickets.update({
                    where: {
                        ticketId: tickets.ticketId
                    },
                    data: {
                        status: "CANCELED"
                    }
                });
                break;

            case "setup_intent.succeeded":
                const setupIntent = event.data.object;

                if (setupIntent.payment_method) {
                    // Update stripe data di database
                    await prisma.stripe.upsert({
                        where: {
                            customerID: setupIntent.customer,
                        },
                        update: {
                            paymentMethodID: setupIntent.payment_method,
                        },
                        create: {
                            stripeId: setupIntent.id,
                            customerID: setupIntent.customer,
                            paymentMethodID: setupIntent.payment_method
                        }
                    });
                }
                break;
        }
        res.status(200).json({
            message: "Webhook handled successfully",
            received: true,
        });
    } catch (error) {
        console.error("Error during webhook handling:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {createSetupIntent, listPaymentMethod, deletePaymentMethod, handleWebhook};