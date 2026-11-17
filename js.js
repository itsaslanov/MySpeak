// All the movies data is stored in this array of objects // 
const movies = [
    {
        id: 1,
        title: "The Shawshank Redemption",
        releaseYear: 2000,
        genres: ["Drama", "Crime"],
        isTreanding: false, 
        seasons: [
            {
                seasonNumber: 1,
                episodes: [
                    {
                        episodeNumber: 1,
                        title: "Episode 1",
                        duration: "45 min"
                    }
                ]
            }
        ]
    },
    {
        id: 2,
        title: "The Godfather",
        releaseYear: 1972,
        genres: ["Drama", "Crime"],
        isTreanding: true,
        seasons: [
            {
                seasonNumber: 1,
                episodes: [
                    {
                        episodeNumber: 1,
                        title: "Episode 1",
                        duration: "45 min"
                    }
                ]
            }
        ]
    }
]