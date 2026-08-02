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
        for (let p = startP; p <= startP + 2; p++) {
            discoverOpts.page = p;
            const discoverResults = await this.options.tmdb.discover(mType, discoverOpts);
            if (discoverResults && discoverResults.length > 0) {
                allCandidates = allCandidates.concat(discoverResults);
            } else {
                break;
            }
        }

        // 2. Fetch recommendations from Pistes
        if (criteria.pistes && criteria.pistes.length > 0) {
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
            if (c && c.id && !uniqueMap.has(c.id)) {
                uniqueMap.set(c.id, c);
            }
        });
        allCandidates = Array.from(uniqueMap.values());

        // 3. Filter out Bannis IDs and already seen
        const bannedIds = new Set(criteria.bannis ? criteria.bannis.map(b => parseInt(b.id, 10)) : []);
        let movies = [];
        let shows = [];
        if (this.options.db) {
            if (mType === 'movie') {
                movies = await this.options.db.movies.toArray();
            } else {
                shows = await this.options.db.shows.toArray();
            }
        }
        const seenIds = new Set(mType === 'movie' ? movies.map(m => m.tmdb_id) : shows.map(s => s.tmdb_id));
        
        let filtered = allCandidates.filter(c => !seenIds.has(c.id) && !bannedIds.has(c.id));

        // Limit to top 60 for detail fetching to not overload TMDB
        filtered = filtered.slice(0, 60);

        // Fetch details
        let fullCandidates = [];
        for (const item of filtered) {
            if (!item || !item.id) continue;
            try {
                const details = await this.options.tmdb.getMovieDetails(item.id, mType);
                fullCandidates.push(details ? { ...item, ...details } : item);
            } catch (e) {
                fullCandidates.push(item);
            }
        }

        // 4. Score them
        let genreAffinity = {};
        if (criteria.useBB && criteria.mode === 'solo' && this.options.db) {
            const feedback = await this.options.db.recommendation_feedback.toArray();
            feedback.forEach(f => {
                if (!f.genre_ids) return;
                const weight = f.feedback_value === 1 ? 1 : -1;
                f.genre_ids.forEach(gid => {
                    genreAffinity[gid] = (genreAffinity[gid] || 0) + weight;
                });
            });
        }

        // Penalty for banned genres
        let bannedGenres = new Set();
        if (criteria.bannis && criteria.bannis.length > 0) {
            for (const b of criteria.bannis) {
                if (b.genre_ids && Array.isArray(b.genre_ids)) {
                    b.genre_ids.forEach(gid => bannedGenres.add(gid));
                }
            }
        }

        fullCandidates.forEach(c => {
            c._panScore = 1.0;
            
            // Runtime penalty
            if (c.runtime && criteria.runtimeMax) {
                if (c.runtime > criteria.runtimeMax) {
                    c._panScore *= 0.5;
                }
            }

            // Big Brother & Bannis Affinity
            if (c.genres || c.genre_ids) {
                const gids = c.genres ? c.genres.map(g => g.id) : c.genre_ids;
                let affinitySum = 0;
                gids.forEach(gid => { 
                    affinitySum += (genreAffinity[gid] || 0); 
                    
                    if (bannedGenres.has(gid)) {
                        const requested = criteria.genres && criteria.genres.includes(gid.toString());
                        if (!requested) {
                            affinitySum -= 5;
                        }
                    }
                });
                if (gids.length > 0) {
                    c._panScore *= (1.0 + (affinitySum / gids.length) * 0.2);
                }
            }

            c._panScore *= (c.vote_average ? (c.vote_average / 10) : 0.5);

            if (criteria.mode === 'group') {
                if (criteria.groupParticipants) {
                    let matchedParticipants = 0;
                    const cGids = c.genres ? c.genres.map(g => g.id.toString()) : (c.genre_ids ? c.genre_ids.map(String) : []);
                    criteria.groupParticipants.forEach(p => {
                        const hasOverlap = p.genres.some(g => cGids.includes(g.toString()));
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
                    const availableIds = flatrate.map(p => p.provider_id.toString());
                    const hasProvider = criteria.providers.some(p => availableIds.includes(p.toString()));
                    if (!hasProvider) {
                        c._panScore = -100;
                    }
                }
            }

            // Reject unreleased movies
            if (c.release_date && new Date(c.release_date) > new Date()) {
                c._panScore = -100;
            }

            if (c._panScore < 0) c._panScore = -100;
            else if (c._panScore === 0) c._panScore = 0.01;
        });

        fullCandidates = fullCandidates.filter(c => c._panScore > 0);
        fullCandidates.sort((a, b) => b._panScore - a._panScore);

        // Calculate confidence score (normalized 0-100%)
        // Assuming a really good score is ~1.5
        fullCandidates.forEach(c => {
            c.confidence = Math.min(100, Math.round((c._panScore / 1.5) * 100));
        });

        return {
            results: fullCandidates,
            hasMore: allCandidates.length > 0
        };
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = PanopticEngine;
    else root.PanopticEngine = PanopticEngine;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
