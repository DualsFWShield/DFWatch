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

db.version(3).stores({
    recommendation_feedback: 'tmdb_id, type, feedback_value'
});

db.version(4).stores({
    custom_lists: '++id, name, description, created_at',
    list_items: '++id, list_id, tmdb_id, media_type, added_at',
    episode_notes: 'id, show_id, season_num, ep_num, rating, note, updated_at'
});

db.version(5).stores({
    list_items: '++id, list_id, tmdb_id, [list_id+tmdb_id], media_type, added_at'
});

db.version(6).stores({
    shows: '++id, tvtime_id, tmdb_id, name, is_followed, type, is_favorited, user_rating',
    movies: '++id, uuid, tmdb_id, name, status, release_date, is_favorited, user_rating',
    watch_history: '++id, show_tvtime_id, show_name, season_number, episode_number',
    movie_watches: '++id, movie_uuid, movie_name',
    achievements: 'id',
    recommendation_feedback: 'tmdb_id, type, feedback_value',
    custom_lists: '++id, name, description, created_at',
    list_items: '++id, list_id, tmdb_id, [list_id+tmdb_id], media_type, added_at',
    episode_notes: 'id, show_id, season_num, ep_num, rating, note, updated_at'
});

db.version(7).stores({
    shows: '++id, tvtime_id, tmdb_id, name, is_followed, type, is_favorited, user_rating',
    movies: '++id, uuid, tmdb_id, name, status, release_date, is_favorited, user_rating',
    watch_history: '++id, show_tvtime_id, show_name, season_number, episode_number',
    movie_watches: '++id, movie_uuid, movie_name',
    achievements: 'id',
    recommendation_feedback: 'tmdb_id, type, feedback_value',
    custom_lists: '++id, name, description, created_at',
    list_items: '++id, list_id, tmdb_id, [list_id+tmdb_id], media_type, added_at',
    episode_notes: 'id, show_id, season_num, ep_num, rating, note, updated_at',
    recommender_candidates: 'tmdb_id, type, score_base, last_updated'
});

db.version(8).stores({
    shows: '++id, tvtime_id, tmdb_id, name, is_followed, type, is_favorited, user_rating',
    movies: '++id, uuid, tmdb_id, name, status, release_date, is_favorited, user_rating',
    watch_history: '++id, show_tvtime_id, show_name, season_number, episode_number',
    movie_watches: '++id, movie_uuid, movie_name',
    achievements: 'id',
    recommendation_feedback: 'tmdb_id, type, feedback_value',
    custom_lists: '++id, name, description, created_at',
    list_items: '++id, list_id, tmdb_id, [list_id+tmdb_id], media_type, added_at',
    episode_notes: 'id, show_id, season_num, ep_num, rating, note, updated_at',
    bigbrother_candidates: 'tmdb_id, type, score_base, last_updated'
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
            db.achievements.clear(),
            db.recommendation_feedback.clear(),
            db.custom_lists.clear(),
            db.list_items.clear(),
            db.episode_notes.clear(),
            db.bigbrother_candidates.clear()
        ]);
    },

    // ---- Helpers ----
    normalizeRuntimeMinutes(runtime, defaultMin = 40, secondsThreshold = 300) {
        const val = parseInt(runtime, 10);
        if (!val || isNaN(val) || val <= 0) return defaultMin;
        if (val > secondsThreshold) return Math.round(val / 60);
        return val;
    },

    getLocalDateKey(dateInput) {
        if (!dateInput) return '';
        let d;
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
        }
        d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    // ---- Stats ----
    async getSeriesStats() {
        const records = await db.watch_history.toArray();
        let totalMinutes = 0;
        records.forEach(r => {
            totalMinutes += this.normalizeRuntimeMinutes(r.runtime, 40, 300);
        });
        return { count: records.length, totalMinutes };
    },

    async getMovieStats() {
        const records = await db.movie_watches.toArray();
        let totalMinutes = 0;
        records.forEach(r => {
            totalMinutes += this.normalizeRuntimeMinutes(r.runtime, 120, 500);
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

window.db = db;
window.DB = DB;
