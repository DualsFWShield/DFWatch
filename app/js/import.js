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
    async importDFWatch(files, options, onProgress) {
        if (!files || files.length === 0) return 0;
        const file = files[0];
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    if (backup.format === "id_broker_v1") {
                        onProgress('Erreur: Fichier d\'export ID détecté. Impossible d\'importer des données partielles.');
                        resolve(0);
                        return;
                    }
                    
                    let importedCount = 0;

                    if (backup.format === "algo_complete_v1") {
                        const mode = options.algoMode || 'merge';
                        onProgress(`Importation des données algorithmiques (Mode: ${mode === 'replace' ? 'Remplacer' : 'Fusionner'})...`);

                        if (mode === 'replace') {
                            await db.shows.clear();
                            await db.watch_history.clear();
                            await db.movies.clear();
                            await db.movie_watches.clear();
                            await db.recommendation_feedback.clear();
                        }

                        if (backup.data) {
                            if (backup.data.shows) { await db.shows.bulkPut(backup.data.shows); importedCount += backup.data.shows.length; }
                            if (backup.data.history) { await db.watch_history.bulkPut(backup.data.history); importedCount += backup.data.history.length; }
                            if (backup.data.movies) { await db.movies.bulkPut(backup.data.movies); importedCount += backup.data.movies.length; }
                            if (backup.data.movieWatches) { await db.movie_watches.bulkPut(backup.data.movieWatches); importedCount += backup.data.movieWatches.length; }
                            if (backup.data.recommendation_feedback) { await db.recommendation_feedback.bulkPut(backup.data.recommendation_feedback); }
                        }

                        if (backup.settings && backup.settings.dfwatch_genres) {
                            localStorage.setItem('dfwatch_genres', backup.settings.dfwatch_genres);
                        }

                        onProgress('Importation de l\'algorithme terminée !');
                        resolve(importedCount);
                        return;
                    }
                    
                    // 1. Paramètres
                    if (options.settings && backup.settings) {
                        onProgress('Restauration des paramètres...');
                        for (const [key, value] of Object.entries(backup.settings)) {
                            if (value !== null) localStorage.setItem(key, value);
                        }
                    }
                    
                    // 2. Cache
                    if (options.cache && backup.cache) {
                        onProgress('Restauration du cache...');
                        if (backup.cache.shows) {
                            for (const s of backup.cache.shows) {
                                if (!s.tmdb_id) continue;
                                const existing = await db.shows.where('name').equals(s.name).first();
                                if (existing && !existing.tmdb_id) {
                                    await db.shows.update(existing.id, {
                                        tmdb_id: s.tmdb_id,
                                        poster_path: s.poster_path,
                                        backdrop_path: s.backdrop_path
                                    });
                                }
                            }
                        }
                        if (backup.cache.movies) {
                            for (const m of backup.cache.movies) {
                                if (!m.tmdb_id) continue;
                                const existing = await db.movies.where('uuid').equals(m.uuid).first();
                                if (existing && !existing.tmdb_id) {
                                    await db.movies.update(existing.id, {
                                        tmdb_id: m.tmdb_id,
                                        poster_path: m.poster_path,
                                        backdrop_path: m.backdrop_path
                                    });
                                }
                            }
                        }
                    }
                    
                    // 3. Données
                    if (options.data && backup.data) {
                        onProgress('Restauration des données...');
                        if (backup.data.shows) { await db.shows.clear(); await db.shows.bulkAdd(backup.data.shows); importedCount += backup.data.shows.length; }
                        if (backup.data.history) { await db.watch_history.clear(); await db.watch_history.bulkAdd(backup.data.history); importedCount += backup.data.history.length; }
                        if (backup.data.movies) { await db.movies.clear(); await db.movies.bulkAdd(backup.data.movies); importedCount += backup.data.movies.length; }
                        if (backup.data.movieWatches) { await db.movie_watches.clear(); await db.movie_watches.bulkAdd(backup.data.movieWatches); importedCount += backup.data.movieWatches.length; }
                        if (backup.data.recommendation_feedback) { await db.recommendation_feedback.clear(); await db.recommendation_feedback.bulkAdd(backup.data.recommendation_feedback); }
                        if (backup.data.customLists) { await db.custom_lists.clear(); await db.custom_lists.bulkAdd(backup.data.customLists); }
                        if (backup.data.listItems) { await db.list_items.clear(); await db.list_items.bulkAdd(backup.data.listItems); }
                        if (backup.data.episodeNotes) { await db.episode_notes.clear(); await db.episode_notes.bulkAdd(backup.data.episodeNotes); }
                    }
                    
                    onProgress('Importation terminée !');
                    resolve(importedCount);
                } catch (err) {
                    onProgress('Erreur lors de la lecture du fichier de sauvegarde.');
                    resolve(0);
                }
            };
            reader.readAsText(file);
        });
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
