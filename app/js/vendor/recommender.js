// recommender.js — Standalone Big Brother Recommendation Engine
// ═══════════════════════════════════════════════════════════════
// A configurable, data-source-agnostic recommendation engine.
// Designed to be reusable across projects — just provide your
// own data adapters and tweak the config numbers.
//
// Usage:
//   const engine = new Recommender({ ...config });
//   const results = await engine.recommend(dataAdapter);
// ═══════════════════════════════════════════════════════════════

(function (root) {
    'use strict';

    // ── Default Configuration ──────────────────────────────────
    const DEFAULTS = {
        // Quality multipliers (based on TMDB community ratings)
        quality: {
            greatThreshold:    8.0,   // vote_average >= this → great
            goodThreshold:     7.0,   // vote_average >= this → good
            badThreshold:      5.0,   // vote_average < this → penalty
            greatMultiplier:   1.3,
            goodMultiplier:    1.1,
            badMultiplier:     0.5,   // penalty for low-quality
            popularityThreshold: 1000, // vote_count above this → bonus
            popularityMultiplier: 1.2,
        },

        // Genre affinity system
        genre: {
            likeWeight:        1.0,   // Affinity added per genre from a liked item
            dislikeWeight:    -1.0,   // Affinity added per genre from a disliked item
            ratedWeight:       0.5,   // Affinity added per genre from highly-rated content
            topPickWeight:     2.0,   // Affinity added per genre from Top 10 items
            influence:         0.15,  // How much total affinity affects the multiplier
            maxMultiplier:     2.0,   // Cap on genre bonus
            minMultiplier:     0.2,   // Floor on genre penalty
        },

        // Output
        output: {
            maxResults:        20,    // Final number of recommendations returned
        },
    };

    // ── Utility ────────────────────────────────────────────────

    /** Deep merge two objects (b overrides a). */
    function deepMerge(a, b) {
        const result = { ...a };
        for (const key of Object.keys(b)) {
            if (b[key] && typeof b[key] === 'object' && !Array.isArray(b[key]) && a[key]) {
                result[key] = deepMerge(a[key], b[key]);
            } else {
                result[key] = b[key];
            }
        }
        return result;
    }

    /** Clamp a value between min and max. */
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }


    // ── Recommender Class ──────────────────────────────────────

    /**
     * @class Recommender
     * 
     * A configurable recommendation engine that:
     * 1. Evaluates Big Brother profile (genre affinities, top picks)
     * 2. Pulls candidates from a pre-fetched local pool
     * 3. Scores candidates using weighted formulas and Big Brother profile
     * 4. Returns a ranked list of recommendations instantly
     *
     * @param {Object} config — Partial config to override DEFAULTS
     */
    function Recommender(config) {
        this.config = deepMerge(DEFAULTS, config || {});
    }

    /**
     * Main entry point. Generates recommendations.
     *
     * @param {Object} adapter — Data adapter with the following async methods:
     *   - getCandidates()        → [{ tmdb_id, type, score_base, item_data }]
     *   - getTopPicks()          → [{ id, type, genre_ids? }]
     *   - getHighlyRatedItems() → [{ tmdb_id, type, genre_ids? }]
     *   - getAllFeedback()       → [{ tmdb_id, type, feedback_value, genre_ids? }]
     *   - getOwnedIds()         → Set<number>    (IDs to exclude — already in library)
     *   - getDislikedIds()      → Set<number>    (IDs to exclude — user disliked)
     *
     * @returns {Promise<{ results: Array, debug: Object }>}
     */
    Recommender.prototype.recommend = async function (adapter) {
        const cfg = this.config;
        const debug = { candidateCount: 0, genreAffinity: {} };

        // ── Phase 1: Build Big Brother Profile (Genre Affinity) 
        const genreAffinity = {};

        const allFeedback = await adapter.getAllFeedback();
        allFeedback.forEach(f => {
            if (!f.genre_ids || !f.genre_ids.length) return;
            const weight = f.feedback_value === 1 ? cfg.genre.likeWeight : cfg.genre.dislikeWeight;
            f.genre_ids.forEach(gid => {
                genreAffinity[gid] = (genreAffinity[gid] || 0) + weight;
            });
        });

        const ratedItems = await adapter.getHighlyRatedItems();
        ratedItems.forEach(item => {
            if (!item.genre_ids || !item.genre_ids.length) return;
            item.genre_ids.forEach(gid => {
                genreAffinity[gid] = (genreAffinity[gid] || 0) + cfg.genre.ratedWeight;
            });
        });

        const topPicks = await adapter.getTopPicks();
        topPicks.forEach(item => {
            if (!item.genre_ids || !item.genre_ids.length) return;
            item.genre_ids.forEach(gid => {
                genreAffinity[gid] = (genreAffinity[gid] || 0) + cfg.genre.topPickWeight;
            });
        });

        debug.genreAffinity = { ...genreAffinity };

        // ── Phase 2: Fetch Local Candidates ────────────────────
        const candidates = await adapter.getCandidates();
        const ownedIds = await adapter.getOwnedIds();
        const dislikedIds = await adapter.getDislikedIds();

        let currentYear = new Date().getFullYear();
        let dobStr = localStorage.getItem('dfwatch_dob');
        let birthYear = currentYear - 30;
        let userAge = 30;
        
        if (dobStr) {
            const dob = new Date(dobStr);
            if (!isNaN(dob.getTime())) {
                birthYear = dob.getFullYear();
                userAge = currentYear - birthYear;
            }
        } else {
            let ageStr = localStorage.getItem('dfwatch_age') || '';
            if (ageStr) {
                let parsed = parseInt(ageStr, 10);
                if (!isNaN(parsed)) {
                    if (parsed > 1000) { birthYear = parsed; userAge = currentYear - birthYear; }
                    else { userAge = parsed; birthYear = currentYear - userAge; }
                }
            }
        }
        let oldThreshold = birthYear - 5; // e.g. born 2007 -> threshold 2002

        // Filter out items the user already owns or disliked
        const filteredCandidates = candidates.filter(c => {
            if (!c || !c.item_data || !c.item_data.id) return false;
            if (ownedIds.has(c.item_data.id) || dislikedIds.has(c.item_data.id)) return false;
            
            // Adult content filter if under 18
            if (userAge < 18 && c.item_data.adult) return false;

            return true;
        });

        debug.candidateCount = filteredCandidates.length;

        // ── Phase 3: Apply Multipliers ─────────────────────────
        const scoredCandidates = filteredCandidates.map(c => {
            let score = c.score_base || 1;
            const item = c.item_data;

            // 3a. Quality bonus
            if (item.vote_average) {
                if (item.vote_average >= cfg.quality.greatThreshold) {
                    score *= cfg.quality.greatMultiplier;
                } else if (item.vote_average >= cfg.quality.goodThreshold) {
                    score *= cfg.quality.goodMultiplier;
                } else if (item.vote_average < cfg.quality.badThreshold) {
                    score *= cfg.quality.badMultiplier;
                }
            }
            if (item.vote_count && item.vote_count > cfg.quality.popularityThreshold) {
                score *= cfg.quality.popularityMultiplier;
            }

            // 3b. Genre affinity multiplier
            if (item.genre_ids && item.genre_ids.length > 0 && Object.keys(genreAffinity).length > 0) {
                let affinitySum = 0;
                item.genre_ids.forEach(gid => {
                    affinitySum += (genreAffinity[gid] || 0);
                });
                const avgAffinity = affinitySum / item.genre_ids.length;
                const genreMult = clamp(
                    1.0 + avgAffinity * cfg.genre.influence,
                    cfg.genre.minMultiplier,
                    cfg.genre.maxMultiplier
                );
                score *= genreMult;
                c.genreMultiplier = genreMult;
            }

            // 3c. Old content penalty
            let itemYearStr = item.release_date || item.first_air_date || '';
            if (itemYearStr) {
                let itemYear = parseInt(itemYearStr.split('-')[0], 10);
                // Si le film est trop vieux par rapport à l'âge de l'utilisateur, on applique un malus
                if (!isNaN(itemYear) && itemYear < oldThreshold) {
                    score *= 0.2; // Heavy penalty: only survives if it has huge affinity/quality
                }
            }

            // 3d. Randomization factor (Renewal)
            // Ajoute ±15% de variation aléatoire pour renouveler les recommandations à chaque ouverture
            score *= (0.85 + Math.random() * 0.30);

            c.finalScore = score;
            return c;
        });

        // ── Phase 4: Rank & Output ─────────────────────────────
        scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
        const results = scoredCandidates.slice(0, cfg.output.maxResults).map(c => c.item_data);

        return { results, debug };
    };

    /**
     * Compute the genre affinity map without running the full algorithm.
     * Useful for displaying the user's taste profile.
     *
     * @param {Object} adapter — Same adapter as recommend()
     * @returns {Promise<Object>} — { genreId: affinityScore }
     */
    Recommender.prototype.getGenreAffinity = async function (adapter) {
        const cfg = this.config;
        const affinity = {};

        const allFeedback = await adapter.getAllFeedback();
        allFeedback.forEach(f => {
            if (!f.genre_ids || !f.genre_ids.length) return;
            const weight = f.feedback_value === 1 ? cfg.genre.likeWeight : cfg.genre.dislikeWeight;
            f.genre_ids.forEach(gid => {
                affinity[gid] = (affinity[gid] || 0) + weight;
            });
        });

        const ratedItems = await adapter.getHighlyRatedItems();
        ratedItems.forEach(item => {
            if (!item.genre_ids || !item.genre_ids.length) return;
            item.genre_ids.forEach(gid => {
                affinity[gid] = (affinity[gid] || 0) + cfg.genre.ratedWeight;
            });
        });

        const topPicks = await adapter.getTopPicks();
        topPicks.forEach(item => {
            if (!item.genre_ids || !item.genre_ids.length) return;
            item.genre_ids.forEach(gid => {
                affinity[gid] = (affinity[gid] || 0) + cfg.genre.topPickWeight;
            });
        });

        return affinity;
    };

    /**
     * Expose the default config for inspection/documentation.
     */
    Recommender.DEFAULTS = DEFAULTS;

    // ── Export ──────────────────────────────────────────────────
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Recommender;
    } else {
        root.Recommender = Recommender;
    }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
