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

export {addTheaters};