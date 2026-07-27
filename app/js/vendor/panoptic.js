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
        // criteria: { genres: [], pistes: [], bannis: [], region: 'BE', providers: [], runtimeMax: 120, mode: 'solo'|'group', useBB: true }
        
        let allCandidates = [];

        // 1. Fetch from Discover (up to 3 pages for more candidates)
        const discoverOpts = {
            genre: criteria.genres && criteria.genres.length > 0 ? criteria.genres.join('|') : null,
            runtimeMax: criteria.runtimeMax
        };
        if (criteria.providers && criteria.providers.length > 0) {
            discoverOpts.watchProviders = criteria.providers.join('|');
            discoverOpts.watchRegion = criteria.region;
            discoverOpts.watchMonetizationTypes = 'flatrate';
        }

        for (let p = 1; p <= 3; p++) {
            discoverOpts.page = p;
            const discoverResults = await this.options.tmdb.discover('movie', discoverOpts);
            if (discoverResults && discoverResults.length > 0) {
                allCandidates = allCandidates.concat(discoverResults);
            } else {
                break;
            }
        }

        // 2. Fetch recommendations from Pistes
        if (criteria.pistes && criteria.pistes.length > 0) {
            for (const piste of criteria.pistes) {
                const recs = await this.options.tmdb.getRecommendations(piste.id, 'movie');
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
        if (this.options.db) {
            movies = await this.options.db.movies.toArray();
        }
        const seenIds = new Set(movies.map(m => m.tmdb_id));
        
        let filtered = allCandidates.filter(c => !seenIds.has(c.id) && !bannedIds.has(c.id));

        // Limit to top 60 for detail fetching to not overload TMDB
        filtered = filtered.slice(0, 60);

        // Fetch details
        let fullCandidates = [];
        for (const item of filtered) {
            if (!item || !item.id) continue;
            try {
                const details = await this.options.tmdb.getMovieDetails(item.id);
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
                try {
                    const details = await this.options.tmdb.getMovieDetails(b.id);
                    if (details && details.genres) {
                        details.genres.forEach(g => bannedGenres.add(g.id));
                    }
                } catch(e) {}
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
                c._panScore *= (0.8 + Math.random() * 0.4);
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

        return fullCandidates; 
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = PanopticEngine;
    else root.PanopticEngine = PanopticEngine;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
