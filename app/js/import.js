// import.js — CSV Import/Export for TVTime & DFWatch formats

const Importer = {
    // ---- TVTime Import ----
    async importTVTime(files, onProgress) {
        let showFile = null;
        let trackingFile = null;
        let movieFile = null;

        for (const f of files) {
            const name = f.name.toLowerCase();
            if (name.includes('user_tv_show_data')) showFile = f;
            else if (name.includes('tracking-prod-records')) {
                // prefer v2 if both
                if (!trackingFile || name.includes('v2')) trackingFile = f;
            } else {
                // The other file (tracking-prod-records.csv) contains movie data
                movieFile = f;
            }
        }

        let totalImported = 0;

        // 1. Import shows
        if (showFile) {
            onProgress('Importation des séries...');
            const showData = await this._parseCSV(showFile);
            const showBatch = [];
            for (const row of showData) {
                if (!row.tv_show_id) continue;
                showBatch.push({
                    tvtime_id: row.tv_show_id,
                    tmdb_id: null,
                    name: row.tv_show_name || 'Série inconnue',
                    poster_path: null,
                    backdrop_path: null,
                    status: 'imported',
                    is_followed: parseInt(row.is_followed) || 0,
                    is_favorited: parseInt(row.is_favorited) || 0,
                    type: 'tv',
                    nb_episodes_seen: parseInt(row.nb_episodes_seen) || 0
                });
            }
            await db.shows.bulkPut(showBatch);
            totalImported += showBatch.length;
            onProgress(`${showBatch.length} séries importées.`);
        }

        // 2. Import episode tracking records (the big v2 file)
        if (trackingFile) {
            onProgress('Importation de l\'historique de visionnage...');
            const trackingData = await this._parseCSV(trackingFile);

            // Filter only episode-watch records (gsi starts with 'watch-episode')
            const episodeRecords = [];
            for (const row of trackingData) {
                if (!row.episode_id && !row.ep_id) continue;
                // Skip non-episode rows (movie follow rows, count rows, etc.)
                if (!row.series_name && !row.movie_name) continue;

                // Episode record
                if (row.series_name) {
                    episodeRecords.push({
                        show_tvtime_id: row.s_id || '',
                        show_name: row.series_name,
                        season_number: parseInt(row.season_number) || 0,
                        episode_number: parseInt(row.ep_no || row.episode_number) || 0,
                        episode_id: row.episode_id || row.ep_id || '',
                        watched_at: row.created_at || new Date().toISOString(),
                        rewatch_count: parseInt(row.rewatch_count) || 0,
                        runtime: parseInt(row.runtime) || 0
                    });
                }
            }
            await db.watch_history.bulkAdd(episodeRecords);
            totalImported += episodeRecords.length;
            onProgress(`${episodeRecords.length} épisodes importés.`);
        }

        // 3. Import movies from the other tracking file
        for (const f of files) {
            const name = f.name.toLowerCase();
            if (name.includes('tracking-prod-records') && !name.includes('v2')) {
                onProgress('Importation des films...');
                const movieData = await this._parseCSV(f);
                const movieBatch = [];
                const watchBatch = [];

                for (const row of movieData) {
                    if (!row.movie_name && !row.uuid) continue;
                    // "follow" type rows = movie entries
                    if (row.type === 'follow' && row.movie_name) {
                        movieBatch.push({
                            uuid: row.uuid || '',
                            tmdb_id: null,
                            name: row.movie_name,
                            poster_path: null,
                            backdrop_path: null,
                            status: 'watched',
                            release_date: row.release_date || null,
                            runtime: parseInt(row.runtime) || 0
                        });
                    }
                }

                if (movieBatch.length > 0) {
                    await db.movies.bulkPut(movieBatch);
                    totalImported += movieBatch.length;
                    onProgress(`${movieBatch.length} films importés.`);
                }

                // The count row tells us total watches
                const countRow = movieData.find(r => r.type === 'count-watch-movie' || (r.watch_count && parseInt(r.watch_count) > 0));
                if (countRow && countRow.watches) {
                    // watches is a space-separated list of UUIDs
                    const watchUuids = countRow.watches.split(' ').filter(Boolean);
                    for (const uuid of watchUuids) {
                        watchBatch.push({
                            movie_uuid: uuid,
                            movie_name: '',
                            watched_at: new Date().toISOString(),
                            rewatch_count: 0
                        });
                    }
                    if (watchBatch.length > 0) {
                        await db.movie_watches.bulkAdd(watchBatch);
                    }
                }
                break;
            }
        }

        return totalImported;
    },

    // ---- DFWatch Import ----
    async importDFWatch(files, onProgress) {
        // TODO: implement DFWatch-specific backup format
        onProgress('Import DFWatch pas encore implémenté.');
        return 0;
    },

    // ---- Export ----
    async exportDFWatch() {
        const shows = await db.shows.toArray();
        const history = await db.watch_history.toArray();
        const movies = await db.movies.toArray();
        const movieWatches = await db.movie_watches.toArray();

        const data = { shows, history, movies, movieWatches, exportedAt: new Date().toISOString(), version: '1.0' };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfwatch-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ---- Helpers ----
    _parseCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
            });
        });
    }
};
