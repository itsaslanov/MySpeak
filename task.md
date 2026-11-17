Your Challenges (Write 3 Functions):
Your Challenges (Write 3 Functions):

```js
function getTrendingMovies(moviesArray) {
	return moviesArray.filter(movie => movie.isTrending === true);
}

function getMoviesByGenre(moviesArray, genreName) {
	return moviesArray.filter(movie => movie.genres.includes(genreName));
}

function getTopRatedMovie(moviesArray) {
	return moviesArray.reduce((topMovie, movie) =>
		topMovie === null || movie.rating > topMovie.rating ? movie : topMovie,
		null
	);
}
}
```