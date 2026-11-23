(function (root) {
    'use strict';

    function PanopticEngine(options = {}) {
        this.options = {
            maxResults: 10,
            tmdb: options.tmdb || window.TMDB,
            db: options.db || window.db
        };
    }

    PanopticEngine.prototype.interrogate = async function (criteria) {
        let allCandidates = [];
        const mType = criteria.mediaType || 'movie';

        let queryGenres = [];
        if (criteria.mode === 'group' && criteria.groupParticipants) {
            const allSelectedGenres = [];
            criteria.groupParticipants.forEach(p => allSelectedGenres.push(...p.genres));
            queryGenres = [...new Set(allSelectedGenres)];
        } else {
            queryGenres = criteria.genres || [];
        }

        const discoverOpts = {
            genre: queryGenres.length > 0 ? queryGenres.join('|') : null,
            runtimeMax: criteria.runtimeMax
        };
        if (criteria.providers && criteria.providers.length > 0) {
            discoverOpts.watchProviders = criteria.providers.join('|');
            discoverOpts.watchRegion = criteria.region;
            discoverOpts.watchMonetizationTypes = 'flatrate';
        }

        const startP = criteria.startPage || 1;
        let discoverHasMore = false;
        for (let p = startP; p <= startP + 2; p++) {
            discoverOpts.page = p;
            const discoverResults = await this.options.tmdb.discover(mType, discoverOpts);
            if (discoverResults && discoverResults.length > 0) {
                allCandidates = allCandidates.concat(discoverResults);
                discoverHasMore = true;
            } else {
                discoverHasMore = false;
                break;
            }
        }

        // 2. Fetch recommendations from Pistes (only on initial page so Encore doesn't loop forever)
        const pisteIds = new Set((criteria.pistes || []).map(p => Number(p.id)).filter(n => !isNaN(n)));
        if (startP === 1 && criteria.pistes && criteria.pistes.length > 0) {
            for (const piste of criteria.pistes) {
                const recs = await this.options.tmdb.getRecommendations(piste.id, mType);
                if (recs && recs.length > 0) {
                    allCandidates = allCandidates.concat(recs);
                }
            }
        }

        // Deduplicate candidates
        const uniqueMap = new Map();
        allCandidates.forEach(c => {
            if (c && c.id && !uniqueMap.has(Number(c.id))) {
                uniqueMap.set(Number(c.id), c);
            }
        });
        allCandidates = Array.from(uniqueMap.values());

        // 3. Filter out Bannis IDs, Pistes IDs, previously shown IDs, and already seen
        const bannedIds = new Set((criteria.bannis || []).map(b => Number(b.id)).filter(n => !isNaN(n)));
        const excludeIds = new Set((criteria.excludeIds || []).map(Number).filter(n => !isNaN(n)));
        let movies = [];
        let shows = [];
        if (this.options.db) {
            if (mType === 'movie') {
                movies = (await this.options.db.movies.toArray()).filter(m => criteria.excludeWatchlist ? true : m.status === 'watched');
            } else {
                shows = await this.options.db.shows.toArray();
            }
        }
        const seenIds = new Set((mType === 'movie' ? movies.map(m => Number(m.tmdb_id)) : shows.map(s => Number(s.tmdb_id))).filter(n => !isNaN(n) && n > 0));
        
        let filtered = allCandidates.filter(c => {
            const cid = Number(c.id);
            return !seenIds.has(cid) && !bannedIds.has(cid) && !pisteIds.has(cid) && !excludeIds.has(cid);
        });

        // Limit to top 40 for detail fetching and batch by 8 to avoid TMDB rate limits
        filtered = filtered.slice(0, 40);
        const resolvedCandidates = [];
        const BATCH_SIZE = 8;
        for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
            const chunk = filtered.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(chunk.map(async (item) => {
                if (!item || !item.id) return null;
                try {
                    const details = mType === 'tv'
                        ? await this.options.tmdb.getShowDetails(item.id)
                        : await this.options.tmdb.getMovieDetails(item.id);
                    return details ? { ...item, ...details } : item;
                } catch (e) {
                    return item;
                }
            }));
            resolvedCandidates.push(...batchResults);
        }
        let fullCandidates = resolvedCandidates.filter(Boolean);

        // 4. Score them
        let genreAffinity = {};
        if (criteria.useBB && criteria.mode === 'solo') {
            if (criteria.bbProfile && criteria.bbProfile.genre) {
                Object.entries(criteria.bbProfile.genre).forEach(([gid, val]) => {
                    genreAffinity[Number(gid)] = val;
                });
            } else if (this.options.db) {
                const feedback = await this.options.db.recommendation_feedback.toArray();
                feedback.forEach(f => {
                    if (!f.genre_ids) return;
                    const weight = f.feedback_value > 0 ? 1 : (f.feedback_value < 0 ? -1 : 0);
                    if (weight === 0) return;
                    f.genre_ids.forEach(gid => {
                        genreAffinity[gid] = (genreAffinity[gid] || 0) + weight;
                    });
                });
            }
        }

        // Penalty for banned genres
        let bannedGenres = new Set();
        if (criteria.bannis && criteria.bannis.length > 0) {
            for (const b of criteria.bannis) {
                if (b.genre_ids && Array.isArray(b.genre_ids)) {
                    b.genre_ids.forEach(gid => bannedGenres.add(Number(gid)));
                }
            }
        }
        const requestedGenreSet = new Set((queryGenres || []).map(String));

        fullCandidates.forEach(c => {
            c._panScore = 1.0;
            
            // Runtime penalty (handles both movie runtime and TV episode_run_time)
            const itemRuntime = c.runtime || (Array.isArray(c.episode_run_time) && c.episode_run_time[0]) || 0;
            if (itemRuntime && criteria.runtimeMax) {
                if (itemRuntime > criteria.runtimeMax) {
                    c._panScore *= 0.5;
                }
            }

            // Big Brother & Bannis Affinity (safely extract numeric IDs)
            const gids = Array.isArray(c.genres)
                ? c.genres.map(g => g && g.id).filter(id => id !== undefined && id !== null)
                : (Array.isArray(c.genre_ids) ? c.genre_ids.filter(id => id !== undefined && id !== null) : []);

            if (gids.length > 0) {
                let affinitySum = 0;
                gids.forEach(gid => {
                    affinitySum += (genreAffinity[gid] || 0);
                    if (bannedGenres.has(Number(gid)) && !requestedGenreSet.has(String(gid))) {
                        affinitySum -= 3;
                    }
                });
                const mult = Math.max(0.3, Math.min(2.0, 1.0 + (affinitySum / gids.length) * 0.15));
                c._panScore *= mult;
            }

            c._panScore *= (c.vote_average ? Math.max(0.2, c.vote_average / 10) : 0.5);

            if (criteria.mode === 'group') {
                if (criteria.groupParticipants) {
                    let matchedParticipants = 0;
                    const cGids = gids.map(String);
                    criteria.groupParticipants.forEach(p => {
                        const hasOverlap = p.genres.some(g => cGids.includes(String(g)));
                        if (hasOverlap) matchedParticipants++;
                    });
                    const matchRatio = criteria.groupParticipants.length > 0 ? matchedParticipants / criteria.groupParticipants.length : 0;
                    c._panScore *= (0.5 + matchRatio);
                    c.groupMatchRatio = matchRatio;
                    c.matchedParticipants = matchedParticipants;
                    c.totalParticipants = criteria.groupParticipants.length;
                } else {
                    c._panScore *= (0.8 + Math.random() * 0.4);
                }
            }
            
            // Provider filter check for Pistes and double check discover
            if (criteria.providers && criteria.providers.length > 0) {
                const wp = c['watch/providers'];
                if (!wp || !wp.results || !wp.results[criteria.region]) {
                    c._panScore = -100;
                } else {
                    const regionalData = wp.results[criteria.region];
                    const flatrate = regionalData.flatrate || [];
                    const availableIds = flatrate.map(p => String(p.provider_id));
                    const hasProvider = criteria.providers.some(p => availableIds.includes(String(p)));
                    if (!hasProvider) {
                        c._panScore = -100;
                    }
                }
            }

            // Reject unreleased titles (movies & tv)
            const relDate = c.release_date || c.first_air_date;
            if (relDate && new Date(relDate) > new Date()) {
                c._panScore = -100;
            }

            if (c._panScore < 0) c._panScore = -100;
            else if (c._panScore === 0) c._panScore = 0.01;
        });

        fullCandidates = fullCandidates.filter(c => c._panScore > 0);
        fullCandidates.sort((a, b) => b._panScore - a._panScore);

        const limit = criteria.maxResults || this.options.maxResults || 10;
        const limitedResults = fullCandidates.slice(0, limit);

        // Calculate confidence score (normalized 0-100%)
        limitedResults.forEach(c => {
            c.confidence = Math.min(100, Math.max(10, Math.round((c._panScore / 1.4) * 100)));
        });

        return {
            results: limitedResults,
            totalFound: fullCandidates.length,
            hasMore: discoverHasMore && (fullCandidates.length > limit || allCandidates.length >= 20)
        };
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = PanopticEngine;
    else root.PanopticEngine = PanopticEngine;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
