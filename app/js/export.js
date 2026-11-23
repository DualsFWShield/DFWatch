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
                achievements: await db.achievements.toArray(),
                recommendation_feedback: await db.recommendation_feedback.toArray(),
                customLists: await db.custom_lists.toArray(),
                listItems: await db.list_items.toArray(),
                episodeNotes: await db.episode_notes.toArray(),
                bigbrotherCandidates: await db.bigbrother_candidates.toArray()
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
                dfwatch_country: localStorage.getItem('dfwatch_country'),
                dfwatch_no_spoil: localStorage.getItem('dfwatch_no_spoil'),
                dfwatch_auto_mood: localStorage.getItem('dfwatch_auto_mood'),
                dfwatch_genres: localStorage.getItem('dfwatch_genres'),
                dfwatch_top10: localStorage.getItem('dfwatch_top10'),
                dfwatch_custom_ring: localStorage.getItem('dfwatch_custom_ring'),
                dfwatch_custom_badge: localStorage.getItem('dfwatch_custom_badge')
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

        // Calculate total watch time from unified DB engine
        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const totalMinutes = seriesStats.totalMinutes + movieStats.totalMinutes;

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
                shows_followed: shows.filter(s => s.is_followed).length,
                movies_watched: movies.filter(m => m.status === 'watched').length
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
    },

    // ---- Universal CSV Exports (Letterboxd & Trakt) ----
    _escapeCSV(str) {
        if (!str && str !== 0) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
    },

    _downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    async exportLetterboxdCSV() {
        const movies = await db.movies.toArray();
        const watches = await db.movie_watches.toArray();
        const watchMap = new Map();
        watches.forEach(w => {
            if (w.movie_uuid && !watchMap.has(w.movie_uuid)) {
                watchMap.set(w.movie_uuid, w.watched_at ? w.watched_at.split('T')[0] : '');
            }
        });

        const watchedMovies = movies.filter(m => m.status === 'watched');
        const rows = [['Title', 'Year', 'Rating10', 'WatchedDate']];

        watchedMovies.forEach(m => {
            const year = (m.release_date || '').split('-')[0] || '';
            const rating10 = m.user_rating ? (m.user_rating * 2) : '';
            const watchedDate = watchMap.get(m.uuid) || '';
            rows.push([
                this._escapeCSV(m.name),
                this._escapeCSV(year),
                rating10 ? String(rating10) : '',
                this._escapeCSV(watchedDate)
            ]);
        });

        const csvContent = "\uFEFF" + rows.map(r => r.join(',')).join('\n');
        this._downloadFile(csvContent, `dfwatch-letterboxd-${new Date().toISOString().split('T')[0]}.csv`);
    },

    async exportTraktMoviesCSV() {
        const movies = await db.movies.toArray();
        const watches = await db.movie_watches.toArray();
        const watchMap = new Map();
        watches.forEach(w => {
            if (w.movie_uuid && !watchMap.has(w.movie_uuid)) {
                watchMap.set(w.movie_uuid, w.watched_at || '');
            }
        });

        const watchedMovies = movies.filter(m => m.status === 'watched');
        const rows = [['Title', 'Year', 'tmdb_id', 'watched_at']];

        watchedMovies.forEach(m => {
            const year = (m.release_date || '').split('-')[0] || '';
            const watchedAt = watchMap.get(m.uuid) || new Date().toISOString();
            rows.push([
                this._escapeCSV(m.name),
                this._escapeCSV(year),
                m.tmdb_id || '',
                this._escapeCSV(watchedAt)
            ]);
        });

        const csvContent = "\uFEFF" + rows.map(r => r.join(',')).join('\n');
        this._downloadFile(csvContent, `dfwatch-trakt-movies-${new Date().toISOString().split('T')[0]}.csv`);
    },

    async exportTraktShowsCSV() {
        const history = await db.watch_history.toArray();
        const rows = [['ShowTitle', 'Season', 'Episode', 'watched_at']];

        history.forEach(h => {
            rows.push([
                this._escapeCSV(h.show_name),
                h.season_number || 1,
                h.episode_number || 1,
                this._escapeCSV(h.watched_at || new Date().toISOString())
            ]);
        });

        const csvContent = "\uFEFF" + rows.map(r => r.join(',')).join('\n');
        this._downloadFile(csvContent, `dfwatch-trakt-shows-${new Date().toISOString().split('T')[0]}.csv`);
    },

    exportCalendarICS(events = []) {
        const escapeICS = (str) => String(str || '')
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\r?\n/g, '\\n');

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//DFWatch//Release Calendar//FR',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        events.forEach((ev, idx) => {
            const dateCompact = String(ev.date || '').replace(/-/g, '');
            if (!/^\d{8}$/.test(dateCompact)) return;
            const y = parseInt(dateCompact.slice(0, 4), 10);
            const m = parseInt(dateCompact.slice(4, 6), 10) - 1;
            const d = parseInt(dateCompact.slice(6, 8), 10);
            const nextDay = new Date(Date.UTC(y, m, d + 1));
            const dtEnd = nextDay.toISOString().split('T')[0].replace(/-/g, '');

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:dfwatch-${dateCompact}-${ev.id || idx}@dfwatch.app`);
            lines.push(`DTSTAMP:${stamp}`);
            lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
            lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
            lines.push(`SUMMARY:${escapeICS(ev.title)}`);
            if (ev.subtitle) lines.push(`DESCRIPTION:${escapeICS(ev.subtitle)}`);
            lines.push('END:VEVENT');
        });

        lines.push('END:VCALENDAR');
        this._downloadFile(lines.join('\r\n'), `dfwatch-calendar-${new Date().toISOString().split('T')[0]}.ics`, 'text/calendar;charset=utf-8;');
    }
};

window.Exporter = Exporter;
