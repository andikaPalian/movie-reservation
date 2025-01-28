import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const addTheaters = async (req, res) => {
    try {
        const {name, location, movies} = req.body;

        if (typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({
                message: "Name is required and must be a string",
            });
        }

        if (typeof location !== "string" || location.trim().length === 0) {
            return res.status(400).json({
                message: "Location is required and must be a string",
            });
        }

        let movieConnections = [];
        if (movies) {
            const existingMovies = await prisma.movies.findMany({
                where: {
                    title: {
                        in: movies.map(movie => movie.title)
                    }
                }
            });

            movieConnections = existingMovies.map(movie => ({
                movieId: movie.movieId,
            }));

            const newMovies = movies.filter(movie => !existingMovies.some(existing => existing.title === movie.title));
            
            if (newMovies.length > 0) {
                const createdMovies = await Promise.all(
                    newMovies.map(movie => prisma.movies.create({
                        data: movie,
                    }))
                )
                movieConnections = [
                    ...movieConnections,
                    ...createdMovies.map(movie => ({
                        movieId: movie.movieId
                    }))
                ]
            }

        }

        const theater = await prisma.theaters.create({
            data: {
                name,
                location,
                movies: {
                    connect: movieConnections,
                }
            }
        });
        res.status(201).json({
            message: "Theater added successfully",
            theater: theater,
        });
    } catch (error) {
        console.error("Error during adding theater:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const updateTheaters = async (req, res) => {
    try {
        const theatersId = req.params.id;
        const {name, location, movies} = req.body;

        if (!theatersId) {
            return res.status(400).json({
                message: "Theaters ID is required",
            });
        }
        
        const existingTheaters = await prisma.theaters.findUnique({
            where: {
                theatherId: theatersId,
            },
            include: {
                movies: true,
            }
        });
        if (!existingTheaters) {
            return res.status(404).json({
                message: "Theaters not found",
            });
        }

        const updateData = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length === 0) {
                return res.status(400).json({
                    message: "Name must be a non-empty string",
                });
            }
            updateData.name = name;
        }

        if (location !== undefined) {
            if (typeof location !== "string" || location.trim().length === 0) {
                return res.status(400).json({
                    message: "Location must be a non-empty string",
                });
            }
        }

        if (movies) {
            let movieConnections = [];
            const existingMovies = await prisma.movies.findMany({
                where: {
                    title: {
                        in: movies.map(movie => movie.title),
                    }
                }
            });

            movieConnections = existingMovies.map(movie => ({
                movieId: movie.movieId,
            }));

            const newMovies = movies.filter(movie => !existingMovies.some(existing => existing.title === movie.title));

            if (newMovies.length > 0) {
                const createdMovies = await Promise.all(
                    newMovies.map(movie => prisma.movies.create({
                        data: {
                            title: movie.title,
                            description: movie.description,
                            duration: movie.duration,
                            releaseDate: movie.releaseDate,
                        }
                    }))
                )

                movieConnections = [
                    ...movieConnections,
                    ...createdMovies.map(movie => ({
                        movieId: movie.movieId,
                    }))
                ];
            }

            updateData.movies = {
                disconnect: existingMovies.movies.map(movie => ({
                    movieId: movie.movieId,
                })),
                connect: movieConnections,
            };
        }

        const updatedTheater = await prisma.theaters.update({
            where: {
                theatherId: theatersId,
            },
            data: updateData,
            include: {
                movies: true,
            }
        });
        res.status(200).json({
            message: "Theater updated succssfully",
            theater: updatedTheater,
        })
    } catch (error) {
        console.error("Error during updating theater:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

const deleteTheaters = async (req, res) => {
    try {
        const theatersId = req.params.id;
        if (!theatersId) {
            return res.status(400).json({
                message: "Theaters ID is required",
            });
        }

        await prisma.theaters.delete({
            where: {
                theatherId: theatersId,
            }
        });
        res.status(200).json({
            message: "Theaters deleted successfully",
        });
    } catch (error) {
        console.error("Error during deleting theaters:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {addTheaters, updateTheaters, deleteTheaters};