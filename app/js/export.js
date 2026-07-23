// export.js — Export logic for DFWatch

const Exporter = {
    async exportComplete(options = { data: true, settings: true, cache: true }) {
        const backup = {
            version: '2.1',
            exportedAt: new Date().toISOString()
        };

        if (options.data) {
            backup.data = {
                shows: await db.shows.toArray(),
                history: await db.watch_history.toArray(),
                movies: await db.movies.toArray(),
                movieWatches: await db.movie_watches.toArray(),
                recommendation_feedback: await db.recommendation_feedback.toArray(),
                customLists: await db.custom_lists.toArray(),
                listItems: await db.list_items.toArray(),
                episodeNotes: await db.episode_notes.toArray()
            };
        }

        if (options.settings) {
            backup.settings = {
                dfwatch_theme: localStorage.getItem('dfwatch_theme'),
                dfwatch_lang: localStorage.getItem('dfwatch_lang'),
                dfwatch_firstname: localStorage.getItem('dfwatch_firstname'),
                dfwatch_lastname: localStorage.getItem('dfwatch_lastname'),
                dfwatch_dob: localStorage.getItem('dfwatch_dob'),
                dfwatch_age_format: localStorage.getItem('dfwatch_age_format'),
                dfwatch_genres: localStorage.getItem('dfwatch_genres'),
                dfwatch_top10: localStorage.getItem('dfwatch_top10')
            };
        }

        if (options.cache) {
            const cachedShows = await db.shows.filter(s => !!s.tmdb_id).toArray();
            const cachedMovies = await db.movies.filter(m => !!m.tmdb_id).toArray();
            backup.cache = {
                shows: cachedShows.map(s => ({ name: s.name, tvtime_id: s.tvtime_id, tmdb_id: s.tmdb_id, poster_path: s.poster_path, backdrop_path: s.backdrop_path })),
                movies: cachedMovies.map(m => ({ name: m.name, uuid: m.uuid, tmdb_id: m.tmdb_id, poster_path: m.poster_path, backdrop_path: m.backdrop_path }))
            };
        }

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfwatch-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async exportID() {
        const movieWatches = await db.movie_watches.toArray();
        const history = await db.watch_history.toArray();
        const feedback = await db.recommendation_feedback.toArray();
        const shows = await db.shows.toArray();
        const movies = await db.movies.toArray();

        // Calculate total watch time
        let totalMinutes = 0;
        shows.forEach(s => {
            const records = history.filter(h => h.show_name === s.name);
            totalMinutes += records.length * (s.runtime || 0);
        });
        movies.forEach(m => {
            const records = movieWatches.filter(w => w.movie_uuid === m.uuid);
            let watches = records.reduce((sum, r) => sum + (r.rewatch_count || 0) + 1, 0);
            totalMinutes += watches * (m.runtime || 0);
        });

        // Get highly rated or followed content as likes implicitly
        const likedShows = shows.filter(s => s.user_rating >= 4 || s.is_favorited).map(s => parseInt(s.tmdb_id)).filter(id => !isNaN(id));
        const likedMovies = movies.filter(m => m.user_rating >= 4 || m.is_favorited).map(m => parseInt(m.tmdb_id)).filter(id => !isNaN(id));
        
        // Add explicit feedback
        const explicitLikes = feedback.filter(f => f.feedback_value > 0).map(f => parseInt(f.tmdb_id)).filter(id => !isNaN(id));
        const explicitDislikes = feedback.filter(f => f.feedback_value < 0).map(f => parseInt(f.tmdb_id)).filter(id => !isNaN(id));

        const likedTmdbIds = [...new Set([...likedShows, ...likedMovies, ...explicitLikes])];
        const dislikedTmdbIds = [...new Set(explicitDislikes)];

        const genresRaw = localStorage.getItem('dfwatch_genres');
        let favoriteGenres = [];
        if (genresRaw) {
            try { favoriteGenres = JSON.parse(genresRaw); } catch(e) {}
        }

        const exportData = {
            format: "id_broker_v1",
            exportedAt: new Date().toISOString(),
            user: {
                firstname: localStorage.getItem('dfwatch_firstname') || "",
                lastname: localStorage.getItem('dfwatch_lastname') || "",
                dob: localStorage.getItem('dfwatch_dob') || "",
                favorite_genres: favoriteGenres
            },
            algorithm_preferences: {
                liked_tmdb_ids: likedTmdbIds,
                disliked_tmdb_ids: dislikedTmdbIds
            },
            stats: {
                total_watch_time_minutes: totalMinutes,
                shows_followed: shows.length,
                movies_watched: movies.length
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfwatch-id-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    async exportAlgoComplete() {
        const backup = {
            format: 'algo_complete_v1',
            exportedAt: new Date().toISOString(),
            data: {
                shows: await db.shows.toArray(),
                history: await db.watch_history.toArray(),
                movies: await db.movies.toArray(),
                movieWatches: await db.movie_watches.toArray(),
                recommendation_feedback: await db.recommendation_feedback.toArray()
            },
            settings: {
                dfwatch_genres: localStorage.getItem('dfwatch_genres')
            }
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfwatch-algo-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

window.Exporter = Exporter;
