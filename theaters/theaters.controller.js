import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const addTheaters = async (req, res) => {
    try {
        const {name, location, movies, seats, capacity} = req.body;

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

        if (typeof capacity !== "number" || capacity <= 0) {
            return res.status(400).json({
                message: "Capacity is required and must be a positive number",
            })
        }

        // Settingan default untuk konfigurasi kursi jika tidak diberikan
        const defaultSeatsConfig = {
            rows: 10,
            seatsPerRow: 8,
            types: {
                regular: {
                    rows: [1, 2, 3, 4, 5, 6],
                    price: 50000,
                },
                vip: {
                    rows: [7, 8],
                    price: 75000,
                },
                premium: {
                    rows: [9, 10],
                    price: 100000,
                }
            }
        };

        const finalSeatsConfig = seats || defaultSeatsConfig;

        // Validasi total seats dengan capacity
        const totalSeats = finalSeatsConfig.rows * finalSeatsConfig.seatsPerRow;
        if (totalSeats !== capacity) {
            return res.status(400).json({
                message: "Total seats configuration does not match theater capacity",
            })
        }

        const seatsData = [];
        for (let row = 1; row <= finalSeatsConfig.rows; row++) {
            for (let seat = 1; seat <= finalSeatsConfig.seatsPerRow; seat++) {
                // Tentukan jenis kursi berdasarkan baris
                let seatType = "regular";
                if (finalSeatsConfig.types.premium.rows.includes(row)) {
                    seatType = "premium";
                } else if (finalSeatsConfig.types.vip.rows.includes(row)) {
                    seatType = "vip";
                }

                // Hasilkan nomor kursi (contoh: A1, A2, dst.)
                // Mengubah row menjadi huruf (A, B, C, dst.)
                const rowLetter = String.fromCharCode(64 + row);
                const seatNumber = `${rowLetter}${seat}`;

                seatsData.push({
                    seatNumber,
                    seatType
                });
            }
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
                capacity,
                movies: {
                    connect: movieConnections,
                },
                seats: {
                    create: seatsData,
                }
            },
            include: {
                seats: true,
                movies: true,
            }
        });
        res.status(201).json({
            message: "Theater added successfully",
            theater: {
                ...theater,
                seatCount: theater.seats.length,
                seatTypes: {
                    regular: theater.seats.filter(seat => seat.seatType === "regular").length,
                    vip: theater.seats.filter(seat => seat.seatType === "vip").length,
                    premium: theater.seats.filter(seat => seat.seatType === "premium").length,
                }
            },
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
        const {name, location, movies, capacity} = req.body;

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
                seats: true,
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

        if (capacity !== undefined) {
            if (typeof capacity !== "number" || capacity <= 0) {
                return res.status(400).json({
                    messaga: "Capacity must be a positive number",
                });
            }

            // Cek apakah capacity baru sesuai dengan jumlah seats saat ini
            if (existingTheaters.seats.length !== capacity) {
                return res.status(400).json({
                    message: "Cannot update capacity as it would conflict with existing seats configuration"
                })
            }
            updateData.capacity = capacity;
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
                seats: {
                    select: {
                        seatId: true,
                        seatNumber: true,
                        seatType: true,
                    }
                }
            }
        });
        res.status(200).json({
            message: "Theater updated succssfully",
            theater: {
                ...updatedTheater,
                seatCount: updatedTheater.seats.length,
                seatTypes: {
                    regular: updatedTheater.seats.filter(seat => seat.seatType === "regular").length,
                    vip: updatedTheater.seats.filter(seat => seat.seatType === "vip").length,
                    premium: updatedTheater.seats.filter(seat => seat.seatType === "premium").length,
                }
            },
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

const updateTheatersSeats = async (req, res) => {
    try {
        const theatersId = req.params.id;
        const {seats} = req.body;

        // Mencari theater berdasarkan ID dan tickets yang memiliki status "PENDING" atau "CONFIRMED"/aktif
        const existingTheaters = await prisma.theaters.findUnique({
            where: {
                theatherId: theatersId,
            },
            include: {
                seats: {
                    include: {
                        tickets: {
                            where: {
                                status: {
                                    in: ["PENDING", "CONFIRMED"],
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!existingTheaters) {
            return res.status(404).json({
                message: "Theater not found",
            });
        }

        // Cek untuk aktif tickets
        const hasActiveTickets = existingTheaters.seats.some(seat => seat.tickets.length > 0);
        if (hasActiveTickets) {
            return res.status(400).json({
                message: "Cannot update seats configuration while there are active tickets",
            });
        }

        // Validasi konfigurasi kursi
        if (!seats || !seats.rows || !seats.seatsPerRow || !seats.types) {
            return res.status(400).json({
                message: "Invalid seats configuration provided",
            });
        }

        const totalSeats = seats.rows * seats.seatsPerRow;
        if (totalSeats !== existingTheaters.seats.length) {
            return res.status(400).json({
                message: "Total seats much match theaters capacity",
            });
        }

        // Generate new seats data
        const newSeatsData = [];
        for (let row = 1; row <= seats.rows; row++) {
            for (let seat = 1; seat <= seats.seatsPerRow; seat++) {
                let seatType = "regular";
                if (seats.types.premium?.rows?.include(row)) {
                    seatType = "premium";
                } else if (seats.types.vip?.rows?.include(row)) {
                    seatType = "vip";
                }

                const rowLetter = String.fromCharCode(64 + row);
                const seatNumber = `${rowLetter}${seat}`;

                newSeatsData.push({
                    seatNumber,
                    seatType
                });
            }
        }

        // Melakukan pembaruan dalam transaksi
        const result = await prisma.$transaction(async (prisma) => {
            // Menghapus kursi yang ada
            await prisma.seats.deleteMany({
                where: {
                    theaterID: theatersId,
                }
            });

            // Membuat kursi baru
            const updatedTheater = await prisma.theaters.update({
                where: {
                    theatherId: theatersId,
                },
                data: {
                    seats: {
                        create: newSeatsData,
                    }
                },
                include: {
                    seats: {
                        select: {
                            seatId: true,
                            seatNumber: true,
                            seatType: true,
                        }
                    }
                }
            });
            return updatedTheater;
        });

        // Prepare response 
        const seatsByType = result.seats.reduce((acc, seat) => {
            if (!acc[seat.seatType]) {
                acc[seat.seatType] = 0;
            }
            acc[seat.seatType]++;
            return acc;
        }, {});

        res.status(200).json({
            message: "Theater seats updated successfully",
            theater: {
                theatersId: result.theatherId,
                name: result.name,
                seatsInfo: {
                    totalSeats: result.seats.length,
                    seatsByType,
                    seats: result.seats.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)),
                }
            }
        });
    } catch (error) {
        console.error("Error during update theater seats:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.messaga || "An unexpected error occurred",
        });
    }
}

const listTheaters = async (req, res) => {
    try {
        const {search, page = 1, limit = 10, sortBy = "name", sortOrder = "asc"} = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        if (isNaN(parseInt(page)) || parseInt(page) < 1) {
            return res.status(400).json({
                message: "Invalid page number",
            });
        }

        if (isNaN(parseInt(limit)) || parseInt(limit) < 1) {
            return res.status(400).json({
                message: "Invalid limit",
            });
        }

        const totalCount = await prisma.theaters.count({
            where: {
                name: {
                    contains: search || "",
                    mode: "insensitive",
                }
            }
        });

        const orderBy = {};
        orderBy[sortBy] = sortOrder.toLowerCase();
        
        const theaters = await prisma.theaters.findMany({
            where: {
                name: {
                    contains: search || "",
                    mode: "insensitive",
                }
            },
            include: {
                movies: {
                    select: {
                        title: true,
                        duration: true,
                        releaseDate: true,
                    }
                },
                seats: {
                    select: {
                        seatNumber: true,
                        seatType: true,
                    }
                },
                _count: {
                    select: {
                        seats: true,
                        movies: true,
                    }
                }
            },
            orderBy,
            skip,
            take: parseInt(limit),
        });

        const processedTheaters = theaters.map(theater => {
            const seatsByType = theater.seats.reduce((acc, seat) => {
                if (!acc[seat.seatType]) {
                    acc[seat.seatType] = 0;
                }
                acc[seat.seatType]++;
                return acc;
            }, {});

            return {
                theatersId: theater.theatherId,
                name: theater.name,
                location: theater.location,
                moviesCount: theater._count.movies,
                movies: theater.movies,
                seatsInfo: {
                    totalSeats: theater._count.seats,
                    seatsByType,
                    seats: theater.seats.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)),
                }
            }
        })
        res.status(200).json({
            message: "Theaters listed successfully",
            pagination: {
                total: totalCount,
                pages: Math.ceil(totalCount / parseInt(limit)),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
            theaters: processedTheaters,
        });
    } catch (error) {
        console.error("Error during listing theaters:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message || "An unexpected error occurred",
        });
    }
}

export {addTheaters, updateTheaters, deleteTheaters, updateTheatersSeats, listTheaters};