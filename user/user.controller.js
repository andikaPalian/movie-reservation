import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";

const prisma = new PrismaClient();

const registerUser = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email?.trim() || !password?.trim() || !name?.trim()) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }

        if (!validator.isEmail(email)) {
            return res.status(400).json({
                message: "Invalid email address",
            })
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character",
            })
        }

        if (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 20) {
            return res.status(400).json({
                message: "Name must be a string between 3 and 20 characters long",
            });
        }

        const userExists = await prisma.user.findUnique({
            where: {
                email: email.toLowerCase().trim(),
            }
        });
        if (userExists) {
            return res.status(400).json({
                message: "User already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                name: name.trim(),
            }
        });
        res.status(201).json({
            message: "User created successfully",
            user: user,
        })
    } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
};

const loginUser = async (req, res) => {
    try {
        const {email, password} = req.body;
        if (!email?.trim() || !password?.trim()) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                email: email.toLowerCase().trim(),
            }
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign({
                id: user.userId,
            }, process.env.JWT_SECRET, {expiresIn: "1d"});
            user.password = undefined;
            return res.status(200).json({
                message: "Login successful",
                data: {
                    token,
                    user: {
                        email: user.email,
                        name: user.name
                    },
                }
            });
        } else {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
    } catch (error) {
        console.error("Error logging in:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const changeUserEmail = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {newEmail, password} = req.body;

        if (!userId) {
            return res.status(400).json({
                message: "Invalid user id",
            });
        }

        if (!validator.isEmail(newEmail)) {
            return res.status(400).json({
                message: "Invalid email address",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                userId: userId
            }
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            })
        }

        if (newEmail === user.email) {
            return res.status(400).json({
                message: "New email address must be different from the current one",
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if(!passwordMatch) {
            return res.status(401).json({
                message: "Invalid password",
            });
        }

        user.email = newEmail;
        await prisma.user.update({
            where: {
                userId: userId
            },
            data: {
                email: newEmail,
            },
        });
        res.status(200).json({
            message: "Email address updated successfully",
            data: {
                user: {
                    name: user.name,
                    email: user.email,
                }
            }
        });
    } catch (error) {
        console.error("Error during email change:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const changeUserPassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const {currentPassword, newPassword} = req.body;

        if (!userId) {
            return res.status(400).json({
                message: "Invalid user id",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                userId: userId,
            }
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        const checkPassword = await bcrypt.compare(currentPassword, user.password);
        if (!checkPassword) {
            return res.status(401).json({
                message: "Invalid password",
            });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character",
            });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        user.password = hashedPassword;
        await prisma.user.update({
            where: {
                userId: userId
            },
            data: {
                password: hashedPassword,
            }
        });
        res.status(200).json({
            message: "Password updated successfully",
        });
    } catch (error) {
        console.error("Error updating password:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {registerUser, loginUser, changeUserEmail, changeUserPassword}