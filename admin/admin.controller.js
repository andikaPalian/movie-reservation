import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const registerAdmin = async (req, res) => {
    try {
        const {username, password, role} = req.body;
        if (!username?.trim() || !password?.trim() || !role?.trim()) {
            return res.status(400).json({
                message: "Username, password, and role are required",
            });
        }

        if (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 20) {
            return res.status(400).json({
                message: "Usernae must be a string between 3 and 20 characters long",
            });
        }

        if (!validator.isAlphanumeric(username)) {
            return res.status(400).json({
                message: "Username must contain only letters and numbers",
            });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character",
            });
        }

        const validRole = ["SUPER_ADMIN", "THEATHER_ADMIN" , "ADMIN"];
        if (!validRole.includes(role)) {
            return res.status(400).json({
                message: "Invalid role. Valid roles are SUPER_ADMIN, THEATHER_ADMIN, and ADMIN",
            });
        }

        const adminExists = await prisma.admin.findUnique({
            where: {
                username: username.toLowerCase().trim(),
            }
        });
        if (adminExists) {
            return res.status(400).json({
                message: "Admin already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const admin = await prisma.admin.create({
            data: {
                username: username.toLowerCase().trim(),
                password: hashedPassword,
                role: role.toUpperCase().trim(),
            }
        });

        res.status(201).json({
            message: "Admin created successfully",
            admin: admin,
        })
    } catch (error) {
        console.error("Error creating admin:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const loginAdmin = async (req, res) => {
    try {
        const {username, password} = req.body;
        if (!username?.trim() || !password?.trim()) {
            return res.status(400).json({
                message: "Username and password are required",
            });
        }

        const admin = await prisma.admin.findUnique({
            where: {
                username: username.toLowerCase().trim(),
            }
        });
        if (!admin) {
            return res.status(404).json({
                message: "Admin not found",
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (isMatch) {
            const token = jwt.sign({
                id: admin.adminId,
            }, process.env.JWT_SECRET, {expiresIn: "1d"});
            admin.password = undefined;
            res.status(200).json({
                message: "Admin logged in successfully",
                data: {
                    token,
                    admin: {
                        username: admin.username,
                        role: admin.role,
                    }
                }
            });
        } else {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
    } catch (error) {
        console.error("Error during admin login:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {registerAdmin, loginAdmin}