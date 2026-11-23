// import.js — CSV Import/Export for TVTime & DFWatch formats

const Importer = {
    // ---- TVTime Import ----
    async importTVTime(files, onProgress) {
        let showFile = null;
        let trackingFile = null;

        for (const f of files) {
            const name = f.name.toLowerCase();
            if (name.includes('user_tv_show_data')) showFile = f;
            else if (name.includes('tracking-prod-records')) {
                if (!trackingFile || name.includes('v2')) trackingFile = f;
            }
        }

        let totalImported = 0;

        // 1. Import shows (deduplicated against existing library)
        if (showFile) {
            onProgress('Importation des séries...');
            const showData = await this._parseCSV(showFile);
            const existingShows = await db.shows.toArray();
            const byTvtimeId = new Map();
            const byName = new Map();
            existingShows.forEach(s => {
                if (s.tvtime_id) byTvtimeId.set(String(s.tvtime_id), s);
                if (s.name) byName.set(s.name.toLowerCase().trim(), s);
            });

            const showBatch = [];
            const seenKeys = new Set();
            for (const row of showData) {
                if (!row.tv_show_id) continue;
                const tid = String(row.tv_show_id);
                const nameKey = (row.tv_show_name || '').toLowerCase().trim();
                if (seenKeys.has(tid)) continue;
                seenKeys.add(tid);

                const existing = byTvtimeId.get(tid) || (nameKey ? byName.get(nameKey) : null);
                if (existing) {
                    showBatch.push({
                        ...existing,
                        tvtime_id: tid,
                        is_followed: Math.max(existing.is_followed || 0, parseInt(row.is_followed, 10) || 0),
                        is_favorited: Math.max(existing.is_favorited || 0, parseInt(row.is_favorited, 10) || 0),
                        nb_episodes_seen: Math.max(existing.nb_episodes_seen || 0, parseInt(row.nb_episodes_seen, 10) || 0)
                    });
                } else {
                    showBatch.push({
                        tvtime_id: tid,
                        tmdb_id: null,
                        name: row.tv_show_name || 'Série inconnue',
                        poster_path: null,
                        backdrop_path: null,
                        status: 'imported',
                        is_followed: parseInt(row.is_followed, 10) || 0,
                        is_favorited: parseInt(row.is_favorited, 10) || 0,
                        type: 'tv',
                        nb_episodes_seen: parseInt(row.nb_episodes_seen, 10) || 0
                    });
                }
            }
            if (showBatch.length > 0) {
                await db.shows.bulkPut(showBatch);
            }
            totalImported += showBatch.length;
            onProgress(`${showBatch.length} séries importées.`);
        }

        // 2. Import episode tracking records (deduplicated)
        if (trackingFile) {
            onProgress('Importation de l\'historique de visionnage...');
            const trackingData = await this._parseCSV(trackingFile);
            const existingHistory = await db.watch_history.toArray();
            const existingEpKeys = new Set(
                existingHistory.map(h => `${(h.show_name || '').toLowerCase().trim()}::S${h.season_number}E${h.episode_number}`)
            );

            const episodeRecords = [];
            for (const row of trackingData) {
                if (!row.episode_id && !row.ep_id) continue;
                if (!row.series_name && !row.movie_name) continue;

                if (row.series_name) {
                    const seasonNum = parseInt(row.season_number, 10) || 0;
                    const epNum = parseInt(row.ep_no || row.episode_number, 10) || 0;
                    const epKey = `${row.series_name.toLowerCase().trim()}::S${seasonNum}E${epNum}`;
                    if (existingEpKeys.has(epKey)) continue;
                    existingEpKeys.add(epKey);

                    episodeRecords.push({
                        show_tvtime_id: row.s_id || '',
                        show_name: row.series_name,
                        season_number: seasonNum,
                        episode_number: epNum,
                        episode_id: row.episode_id || row.ep_id || '',
                        watched_at: row.created_at || new Date().toISOString(),
                        rewatch_count: parseInt(row.rewatch_count, 10) || 0,
                        runtime: parseInt(row.runtime, 10) || 0
                    });
                }
            }
            if (episodeRecords.length > 0) {
                await db.watch_history.bulkAdd(episodeRecords);
            }
            totalImported += episodeRecords.length;
            onProgress(`${episodeRecords.length} épisodes importés.`);
        }

        // 3. Import movies from the other tracking file
        for (const f of files) {
            const name = f.name.toLowerCase();
            if (name.includes('tracking-prod-records') && !name.includes('v2')) {
                onProgress('Importation des films...');
                const movieData = await this._parseCSV(f);
                const existingMovies = await db.movies.toArray();
                const existingByUuid = new Map();
                const existingByName = new Map();
                existingMovies.forEach(m => {
                    if (m.uuid) existingByUuid.set(m.uuid, m);
                    if (m.name) existingByName.set(m.name.toLowerCase().trim(), m);
                });

                const movieBatch = [];
                const movieByUuid = new Map();
                const watchBatch = [];

                for (const row of movieData) {
                    if (!row.movie_name && !row.uuid) continue;
                    if (row.type === 'follow' && row.movie_name) {
                        const uuid = row.uuid || '';
                        const existing = (uuid && existingByUuid.get(uuid)) || existingByName.get(row.movie_name.toLowerCase().trim());
                        const movieObj = existing ? {
                            ...existing,
                            uuid: existing.uuid || uuid,
                            release_date: existing.release_date || row.release_date || null,
                            runtime: existing.runtime || parseInt(row.runtime, 10) || 0
                        } : {
                            uuid,
                            tmdb_id: null,
                            name: row.movie_name,
                            poster_path: null,
                            backdrop_path: null,
                            status: 'watched',
                            release_date: row.release_date || null,
                            runtime: parseInt(row.runtime, 10) || 0
                        };
                        movieBatch.push(movieObj);
                        if (uuid) movieByUuid.set(uuid, movieObj);
                    }
                }

                if (movieBatch.length > 0) {
                    await db.movies.bulkPut(movieBatch);
                    totalImported += movieBatch.length;
                    onProgress(`${movieBatch.length} films importés.`);
                }

                const existingWatches = await db.movie_watches.toArray();
                const existingWatchUuids = new Set(existingWatches.map(w => w.movie_uuid).filter(Boolean));
                const countRow = movieData.find(r => r.type === 'count-watch-movie' || (r.watch_count && parseInt(r.watch_count, 10) > 0));
                if (countRow && countRow.watches) {
                    const watchUuids = countRow.watches.split(' ').filter(Boolean);
                    for (const uuid of watchUuids) {
                        if (existingWatchUuids.has(uuid)) continue;
                        existingWatchUuids.add(uuid);
                        const matchedMovie = movieByUuid.get(uuid) || existingByUuid.get(uuid);
                        watchBatch.push({
                            movie_uuid: uuid,
                            movie_name: matchedMovie ? matchedMovie.name : '',
                            runtime: matchedMovie ? (matchedMovie.runtime || 0) : 0,
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

        if (totalImported > 0) {
            try { localStorage.setItem('dfwatch_has_imported', '1'); } catch (e) {}
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
                            await Promise.all([
                                db.shows.clear(),
                                db.watch_history.clear(),
                                db.movies.clear(),
                                db.movie_watches.clear(),
                                db.recommendation_feedback.clear()
                            ]);
                            if (backup.data) {
                                if (backup.data.shows?.length) { await db.shows.bulkPut(backup.data.shows); importedCount += backup.data.shows.length; }
                                if (backup.data.history?.length) { await db.watch_history.bulkPut(backup.data.history); importedCount += backup.data.history.length; }
                                if (backup.data.movies?.length) { await db.movies.bulkPut(backup.data.movies); importedCount += backup.data.movies.length; }
                                if (backup.data.movieWatches?.length) { await db.movie_watches.bulkPut(backup.data.movieWatches); importedCount += backup.data.movieWatches.length; }
                                if (backup.data.recommendation_feedback?.length) { await db.recommendation_feedback.bulkPut(backup.data.recommendation_feedback); }
                            }
                        } else if (backup.data) {
                            // Merge safely by stripping auto-increment IDs and deduplicating
                            if (backup.data.shows?.length) {
                                const curShows = await db.shows.toArray();
                                const showKeys = new Set(curShows.map(s => String(s.tmdb_id || s.tvtime_id || s.name || '').toLowerCase()));
                                const toAdd = backup.data.shows
                                    .filter(s => !showKeys.has(String(s.tmdb_id || s.tvtime_id || s.name || '').toLowerCase()))
                                    .map(({ id, ...rest }) => rest);
                                if (toAdd.length) { await db.shows.bulkAdd(toAdd); importedCount += toAdd.length; }
                            }
                            if (backup.data.history?.length) {
                                const curHist = await db.watch_history.toArray();
                                const epKeys = new Set(curHist.map(h => `${(h.show_name || '').toLowerCase()}::S${h.season_number}E${h.episode_number}`));
                                const toAdd = backup.data.history
                                    .filter(h => !epKeys.has(`${(h.show_name || '').toLowerCase()}::S${h.season_number}E${h.episode_number}`))
                                    .map(({ id, ...rest }) => rest);
                                if (toAdd.length) { await db.watch_history.bulkAdd(toAdd); importedCount += toAdd.length; }
                            }
                            if (backup.data.movies?.length) {
                                const curMovies = await db.movies.toArray();
                                const movKeys = new Set(curMovies.map(m => String(m.tmdb_id || m.uuid || m.name || '').toLowerCase()));
                                const toAdd = backup.data.movies
                                    .filter(m => !movKeys.has(String(m.tmdb_id || m.uuid || m.name || '').toLowerCase()))
                                    .map(({ id, ...rest }) => rest);
                                if (toAdd.length) { await db.movies.bulkAdd(toAdd); importedCount += toAdd.length; }
                            }
                            if (backup.data.movieWatches?.length) {
                                const curWatches = await db.movie_watches.toArray();
                                const mwKeys = new Set(curWatches.map(w => `${w.movie_uuid || ''}::${(w.movie_name || '').toLowerCase()}`));
                                const toAdd = backup.data.movieWatches
                                    .filter(w => !mwKeys.has(`${w.movie_uuid || ''}::${(w.movie_name || '').toLowerCase()}`))
                                    .map(({ id, ...rest }) => rest);
                                if (toAdd.length) { await db.movie_watches.bulkAdd(toAdd); importedCount += toAdd.length; }
                            }
                            if (backup.data.recommendation_feedback?.length) {
                                await db.recommendation_feedback.bulkPut(backup.data.recommendation_feedback);
                            }
                        }

                        if (backup.settings && backup.settings.dfwatch_genres) {
                            localStorage.setItem('dfwatch_genres', backup.settings.dfwatch_genres);
                        }
                        if (importedCount > 0) {
                            try { localStorage.setItem('dfwatch_has_imported', '1'); } catch (e) {}
                        }

                        onProgress('Importation de l\'algorithme terminée !');
                        resolve(importedCount);
                        return;
                    }
                    
                    // 1. Paramètres
                    if (options.settings && backup.settings) {
                        onProgress('Restauration des paramètres...');
                        for (const [key, value] of Object.entries(backup.settings)) {
                            if (value !== null && value !== undefined) localStorage.setItem(key, value);
                        }
                    }
                    
                    // 2. Données (restaurées en premier pour ne pas écraser le cache ensuite)
                    if (options.data && backup.data) {
                        onProgress('Restauration des données...');
                        if (backup.data.shows) { await db.shows.clear(); await db.shows.bulkPut(backup.data.shows); importedCount += backup.data.shows.length; }
                        if (backup.data.history) { await db.watch_history.clear(); await db.watch_history.bulkPut(backup.data.history); importedCount += backup.data.history.length; }
                        if (backup.data.movies) { await db.movies.clear(); await db.movies.bulkPut(backup.data.movies); importedCount += backup.data.movies.length; }
                        if (backup.data.movieWatches) { await db.movie_watches.clear(); await db.movie_watches.bulkPut(backup.data.movieWatches); importedCount += backup.data.movieWatches.length; }
                        if (backup.data.achievements) { await db.achievements.clear(); await db.achievements.bulkPut(backup.data.achievements); }
                        if (backup.data.recommendation_feedback) { await db.recommendation_feedback.clear(); await db.recommendation_feedback.bulkPut(backup.data.recommendation_feedback); }
                        if (backup.data.customLists) { await db.custom_lists.clear(); await db.custom_lists.bulkPut(backup.data.customLists); }
                        if (backup.data.listItems) { await db.list_items.clear(); await db.list_items.bulkPut(backup.data.listItems); }
                        if (backup.data.episodeNotes) { await db.episode_notes.clear(); await db.episode_notes.bulkPut(backup.data.episodeNotes); }
                        if (backup.data.bigbrotherCandidates) { await db.bigbrother_candidates.clear(); await db.bigbrother_candidates.bulkPut(backup.data.bigbrotherCandidates); }
                    }
                    
                    // 3. Cache (appliqué sur les données fraîches)
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

                    if (importedCount > 0) {
                        try { localStorage.setItem('dfwatch_has_imported', '1'); } catch (e) {}
                    }
                    
                    onProgress('Importation terminée !');
                    resolve(importedCount);
                } catch (err) {
                    onProgress('Erreur lors de la lecture du fichier de sauvegarde.');
                    resolve(0);
                }
            };
            reader.onerror = () => {
                onProgress('Erreur lors de la lecture du fichier.');
                resolve(0);
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
