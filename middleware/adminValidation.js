import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const adminValidation = async (req, res, next) => {
    try {
        let token;
        const authHeader = req.headers.Authorization || req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer")) {
            token = authHeader.split(" ")[1];
            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    return res.status(401).json({
                        message: "Admin is not authorized",
                    });
                }
                const admin = await prisma.admin.findUnique({
                    where: {
                        adminId: decoded.id
                    }
                });
                if (!admin) {
                    return res.status(404).json({
                        message: "Admin not found",
                    });
                }
                
                req.admin = {
                    adminId: admin.adminId,
                    username: admin.username,
                    role: admin.role,
                };
                next();
            });
        } else {
            return res.status(403).json({
                message: "Token is missing or not provided",
            })
        }
    } catch (error) {
        console.error("Error validating admin:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const hasRole = (role) => {
    return (req, res, next) => {
        // Validasi apakah req.admin atau req.admin.role ada
        if (!req.admin || !req.admin.role) {
            return res.status(401).json({
                message: "Unauthorized: Admin information is missing",
            });
        }

        // Validasi apakah req.admin.role sama dengan role yang diperlukan
        if (req.admin.role !== role) {
            return res.status(403).json({
                message: "Forbidden: Admin does not have the required role",
            });
        }

        // Jika validasi berhasil
        next();
    }
}

export {adminValidation, hasRole};