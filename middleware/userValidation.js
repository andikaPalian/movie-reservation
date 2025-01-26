import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const userValidation = (req, res, next) => {
    try {
        let token;
        const authHeader = req.headers.Authorization || req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer")) {
            token = authHeader.split(" ")[1];
            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    return res.status(403).json({
                        message: "User is not authorized",
                    });
                }
                    const user = await prisma.user.findUnique({
                        where: {
                            userId: decoded.id
                        }
                    });
                    if (!user) {
                        return res.status(404).json({
                            message: "User not found",
                        });
                    }
                    req.user = user;
                    next();
            });
        } else {
            return res.status(403).json({
                message: "Token is missing or not provided",
            });
        }
    } catch (error) {
        console.error("Error validating user:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export default userValidation;