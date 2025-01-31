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

        // Validasi Theater 
        let theatersConnections = [];
        if (theaters) {
            const existingTheaters = await prisma.theaters.findMany({
                where: {
                    name: {
                        in: theaters.map(theater => theater.name),
                    },
                }
            });

            // Menyambungkan theater yang sudah ada
            theatersConnections = existingTheaters.map(theater => ({
                theatherId: theater.theatherId,
            }));

            // Menambahkan theater baru yang belum ada di database
            const newTheaters = theaters.filter(theater => !existingTheaters.some(existing => existing.name === theater.name));

            // Menambahkan theater baru ke database
            // const createTheaters = await prisma.theaters.createMany({
            //     data: newTheaters,
            // });

            if (newTheaters.length > 0) {
                // Membuat theater baru satu persatu untuk mendapatkan ID-nya
                const createdTheaters = await Promise.all(
                    newTheaters.map(theater => prisma.theaters.create({
                        data: theater
                    }))
                )

                theatersConnections = [
                    ...theatersConnections,
                    ...createdTheaters.map(theater => ({
                        theatherId: theater.theatherId
                    }))
                ]
            }

            // Menyambungkan theater baru yang baru saja ditambahkan
            
            // if (validTheaters.length !== theaters.length) {
            //     return res.status(400).json({
            //         message: "Some theater IDs are invalid",
            //     });
            // }
        }

        // Validasi Jadwal
        if (schedules) {
            for (const schedule of schedules) {
                const startTime = new Date(schedule.startTime);
                const endTime = new Date(schedule.endTime);

                if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                    return res.status(400).json({
                        message: "Invalid date format in schedules",
                    });
                }

                if (startTime >= endTime) {
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
                        theater: {
                            connect: theatersConnections[0]
                        }
                    })) || [],
                },
                theaters: {
                    connect: theatersConnections,  
                }
            },
            include: {
                theaters: true,
                schedules: true,
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

const updateMovies = async (req, res) => {
    try {
        const moviesId = req.params;
        const {title, description, duration, releaseDate, schedules, theaters} = req.body;

        if (!moviesId) {
            return res.status(400).json({
                message: "Movies ID is required",
            });
        }

        const existingMovies = await prisma.movies.findUnique({
            where: {
                movieId: moviesId,
            },
            include: {
                theaters: true,
                schedules: true,
            }
        });

        if (!existingMovies) {
            return res.status(404).json({
                message: "Movies not found",
            });
        }
        // Prepare data for update - only update fields that are provided in the request body (PATCH behavior)
        const updateData = {};

        if (title !== undefined) {
            if (typeof title !== "string" || title.trim().length === 0) {
                return res.status(400).json({
                    message: "Title must be a non-empty string",
                });
            }
            updateData.title = title;
        }

        if (description !== undefined) {
            if (typeof description !== "string" || description.trim().length === 0) {
                return res.status(400).json({
                    message: "Description must be a non-empty string",
                });
            }
            updateData.description = description;
        }

        if (duration !== undefined) {
            if (typeof duration !== "number" || duration <= 0) {
                return res.status(400).json({
                    message: "Duration must be a positive number",
                });
            }
            updateData.duration = duration;
        }

        if (releaseDate !== undefined) {
            const parsedData = new Date(releaseDate);
            if (isNaN(parsedData.getTime())) {
                return res.status(400).json({
                    message: "Invalid date format for release date",
                });
            }
            updateData.releaseDate = parsedData;
        }

        if (theaters) {
            let theatersConnections = [];
            const existingTheaters = await prisma.theaters.findMany({
                where: {
                    name: {
                        in: theaters.map(theater => theater.name),
                    },
                }
            });

            // Menyambungkan theater yang sudah ada
            theatersConnections = existingTheaters.map(theater => ({
                theatherId: theater.theatherId,
            }));

            // Menambahkan theater baru yang belum ada di database
            const newTheaters = theaters.filter(theater => !existingTheaters.some(existing => existing.name === theater.name));

            if (newTheaters.length > 0) {
                // Membuat theater baru satu persatu untuk mendapatkan ID-nya
                const createdTheaters = await Promise.all(
                    newTheaters.map(theater => prisma.theaters.create({
                        data: {
                            name: theater.name,
                            location: theater.location || "Default Location",
                        }
                    }))
                )

                theatersConnections = [
                    ...theatersConnections,
                    ...createdTheaters.map(theater => ({
                        theatherId: theater.theatherId
                    }))
                ]
            }

            updateData.theaters = {
                disconnect: existingMovies.theaters.map(theater => ({
                    theatherId: theater.theatherId,
                })),
                connect: theatersConnections
            }
        } 

        if (schedules) {
            for (const schedule of schedules) {
                const startTime = new Date(schedule.startTime);
                const endTime = new Date(schedule.endTime);

                if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                    return res.status(400).json({
                        message: "Invalid date format in schedule",
                    });
                }

                if (startTime >= endTime) {
                    return res.status(400).json({
                        message: "Start time must be before end time",
                    });
                }
            }
            updateData.schedules = {
                deleteMany: {},
                create: schedules.map(schedule => ({
                    startTime: new Date(schedule.startTime),
                    endTime: new Date(schedule.endTime),
                }))
            }
        }

        const updatedMovies = await prisma.movies.update({
            where: {
                movieId: moviesId,
            },
            data: updateData,
            include: {
                theaters: true,
                schedules: true,
            }
        });
        res.status(200).json({
            message: "Movie updated successfully",
            movie: updatedMovies,
        });
    } catch (error) {
        console.error("Error during updating movie:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const deleteMovies = async (req, res) => {
    try {
        const moviesId = req.params;
        if (!moviesId) {
            return res.status(400).json({
                message: "Movies ID is required",
            });
        }

        await prisma.movies.delete({
            where: {
                movieId: moviesId,
            }
        });
        res.status(200).json({
            message: "Movies deleted successfully",
        });
    } catch (error) {
        console.error("Error during deleting movies:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {addMovies, listMovies, updateMovies, deleteMovies};