import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const addMovies = async (req, res) => {
    try {
        const {title, description, duration, releaseDate, schedules, theaters} = req.body;

        if (typeof title !== "string" || title.trim().length === 0) {
            return res.status(400).json({
                message: "Title is required and must be a string",
            });
        }

        if (typeof description !== "string" || description.trim().length === 0) {
            return res.status(400).json({
                message: "Description is required and must be a string",
            });
        }

        if (typeof duration !== "number" || duration <= 0) {
            return res.status(400).json({
                message: "Duration is required and must be a positive number",
            });
        }

        if (!releaseDate || isNaN(new Date(releaseDate).getTime())) {
            return res.status(400).json({
                message: "Release date is required and must be a valid date",
            });
        }

        // Validasi ID Theater
        if (theaters) {
            const validTheaters = await prisma.theaters.findMany({
                where: {
                    theatherId: {
                        in: theaters,
                    },
                }
            });
            
            if (validTheaters.length !== theaters.length) {
                return res.status(400).json({
                    message: "Some theater IDs are invalid",
                });
            }
        }

        // Validasi Jadwal
        if (schedules) {
            for (const schedule of schedules) {
                if (new Date(schedule.startTime) > new Date(schedule.endTime)) {
                    return res.status(400).json({
                        message: "Start time must be before end time",
                    });
                }
            }
        }
        
        const movie = await prisma.movies.create({
            data: {
                title,
                description,
                duration,
                releaseDate: new Date(releaseDate),
                schedules: {
                    create: schedules?.map(schedule => ({
                        startTime: new Date(schedule.startTime),
                        endTime: new Date(schedule.endTime),
                    })) || [],
                },
                theaters: {
                    connect: theaters?.map(id => ({
                        theatherId: id,
                    })) || [],  
                }
            }
        });
        res.status(201).json({
            message: "Mopvie created successfully",
            movie: movie,
        });
    } catch (error) {
        console.error("Error during adding movie:", error);
        if (error.code === "P2002") {
            return res.status(400).json({
                message: "Movie already exists",
            });
        }   
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const listMovies = async (req, res) => {
    try {
        const {search} = req.query;

        const movies = await prisma.movies.findMany({
            where: {
                title: {
                    contains: search || "",
                    mode: "insensitive",
                },
            },
            include: {
                schedules: true,
                theaters: true,
            }
        });
        res.status(200).json({
            message: "Movies retrieved successfully",
            movies: movies,
        })
    } catch (error) {
        console.error("Error during listing movies:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {addMovies, listMovies};