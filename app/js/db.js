// db.js — DFWatch Database (Dexie / IndexedDB)
// Using a fresh DB name to avoid schema migration conflicts

const db = new Dexie("DFWatch_v2");

db.version(1).stores({
    shows: '++id, tvtime_id, tmdb_id, name, is_followed, type',
    movies: '++id, uuid, tmdb_id, name, status, release_date',
    watch_history: '++id, show_tvtime_id, show_name, season_number, episode_number',
    movie_watches: '++id, movie_uuid, movie_name',
    achievements: 'id'
});

db.version(2).stores({
    shows: '++id, tvtime_id, tmdb_id, name, is_followed, type, is_favorited, user_rating',
    movies: '++id, uuid, tmdb_id, name, status, release_date, is_favorited, user_rating'
});

// Delete legacy DB if it exists
Dexie.exists("DFWatchDB").then(exists => {
    if (exists) {
        const oldDb = new Dexie("DFWatchDB");
        oldDb.delete().then(() => console.log("Legacy DFWatchDB deleted."));
    }
});

const DB = {
    async clearAll() {
        await Promise.all([
            db.shows.clear(),
            db.movies.clear(),
            db.watch_history.clear(),
            db.movie_watches.clear(),
            db.achievements.clear()
        ]);
    },

    // ---- Stats ----
    async getSeriesStats() {
        const records = await db.watch_history.toArray();
        let totalMinutes = 0;
        records.forEach(r => {
            totalMinutes += r.runtime ? Math.round(r.runtime / 60) : 40;
        });
        return { count: records.length, totalMinutes };
    },

    async getMovieStats() {
        const records = await db.movie_watches.toArray();
        let totalMinutes = 0;
        records.forEach(r => {
            totalMinutes += r.runtime ? Math.round(r.runtime / 60) : 120;
        });
        return { count: records.length, totalMinutes };
    },

    minutesToParts(totalMinutes) {
        const totalHours = Math.floor(totalMinutes / 60);
        const months = Math.floor(totalHours / (24 * 30));
        const days = Math.floor((totalHours % (24 * 30)) / 24);
        const hours = totalHours % 24;
        return { months, days, hours, totalHours };
    },

    // ---- Shows ----
    async getFollowedShows() {
        return db.shows.where('is_followed').equals(1).toArray();
    },

    async getShowByTvtimeId(tvtimeId) {
        return db.shows.where('tvtime_id').equals(tvtimeId).first();
    },

    async getShowWatchHistory(showName) {
        return db.watch_history.where('show_name').equals(showName).toArray();
    },

    // ---- Movies ----
    async getAllMovies() {
        return db.movies.toArray();
    }
};
