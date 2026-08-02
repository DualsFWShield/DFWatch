// bigbrother.js — Standalone Big Brother Recommendation Engine
// ═══════════════════════════════════════════════════════════════
// A configurable, data-source-agnostic recommendation engine.
// Designed to be reusable across projects — just provide your
// own data adapters and tweak the config numbers.
//
// Usage:
//   const engine = new BigBrother({ ...config });
//   const results = await engine.recommend(dataAdapter);
// ═══════════════════════════════════════════════════════════════

(function (root) {
    'use strict';

    // ── Default Configuration ──────────────────────────────────
    const DEFAULTS = {
        mood: 'normal',
        quality: {
            greatThreshold:    8.0,
            goodThreshold:     7.0,
            badThreshold:      5.0,
            greatMultiplier:   1.3,
            goodMultiplier:    1.1,
            badMultiplier:     0.5,
            popularityThreshold: 1000,
            popularityMultiplier: 1.2,
        },
        genre: {
            likeWeight:        1.0,
            dislikeWeight:    -1.0,
            ratedWeight:       0.5,
            topPickWeight:     2.0,
            influence:         0.15,
            maxMultiplier:     2.0,
            minMultiplier:     0.2,
        },
        output: { maxResults: 20 },
    };

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

    function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

    function BigBrother(config) {
        this.config = deepMerge(DEFAULTS, config || {});
    }

    BigBrother.prototype.buildProfile = async function(adapter) {
        const cfg = this.config;
        const genreAffinity = {};
        const keywordAffinity = {};
        const peopleAffinity = {};
        const decadeAffinity = {};

        const processItem = (item, weight, decay = 1.0) => {
            const finalWeight = weight * decay;
            if (item.genre_ids) item.genre_ids.forEach(id => { genreAffinity[id] = (genreAffinity[id] || 0) + finalWeight; });
            if (item.keywords) item.keywords.forEach(id => { keywordAffinity[id] = (keywordAffinity[id] || 0) + finalWeight; });
            if (item.directors) item.directors.forEach(id => { peopleAffinity[id] = (peopleAffinity[id] || 0) + finalWeight; });
            if (item.actors) item.actors.forEach(id => { peopleAffinity[id] = (peopleAffinity[id] || 0) + finalWeight; });
            
            const yearStr = item.release_date || item.first_air_date;
            if (yearStr) {
                const year = parseInt(yearStr.split('-')[0], 10);
                if (!isNaN(year)) {
                    const decade = Math.floor(year / 10) * 10;
                    decadeAffinity[decade] = (decadeAffinity[decade] || 0) + finalWeight;
                }
            }
        };

        const allFeedback = await adapter.getAllFeedback();
        const now = Date.now();
        const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

        allFeedback.forEach(f => {
            const weight = f.feedback_value === 1 ? cfg.genre.likeWeight : (f.feedback_value === -1 ? cfg.genre.dislikeWeight : 0);
            if (weight === 0) return;
            
            let decay = 1.0;
            if (f.timestamp) {
                const age = now - f.timestamp;
                if (age > 0) {
                    decay = Math.max(0.5, 1.0 - (age / ONE_YEAR) * 0.5);
                }
            }
            processItem(f, weight, decay);
        });

        const ratedItems = await adapter.getHighlyRatedItems();
        ratedItems.forEach(item => processItem(item, cfg.genre.ratedWeight));

        const topPicks = await adapter.getTopPicks();
        topPicks.forEach(item => processItem(item, cfg.genre.topPickWeight));

        this.lastAffinities = { genre: genreAffinity, keyword: keywordAffinity, people: peopleAffinity, decade: decadeAffinity };
        return this.lastAffinities;
    };

    BigBrother.prototype.recommend = async function (adapter) {
        const cfg = this.config;
        const debug = { candidateCount: 0, affinities: {} };

        // ── Phase 1: Build Big Brother Profile 
        const affinities = await this.buildProfile(adapter);
        const { genre: genreAffinity, keyword: keywordAffinity, people: peopleAffinity, decade: decadeAffinity } = affinities;
        debug.affinities = affinities;

        // ── Phase 2: Fetch Local Candidates ────────────────────
        let candidates = await adapter.getCandidates();
        
        // Add Rewatch candidates if available
        if (typeof adapter.getRewatchCandidates === 'function') {
            const rewatch = await adapter.getRewatchCandidates();
            candidates = candidates.concat(rewatch);
        }

        const ownedItems = await adapter.getOwnedItems();
        const ownedIds = ownedItems.ids;
        const ownedNames = ownedItems.names;
        const dislikedIds = await adapter.getDislikedIds();

        let currentYear = new Date().getFullYear();
        let dobStr = localStorage.getItem('dfwatch_dob');
        let birthYear = currentYear - 30;
        let userAge = 30;
        
        if (dobStr) {
            const dob = new Date(dobStr);
            if (!isNaN(dob.getTime())) { birthYear = dob.getFullYear(); userAge = currentYear - birthYear; }
        }

        const filteredCandidates = candidates.filter(c => {
            if (!c || !c.item_data || !c.item_data.id) return false;
            
            // Bypass exclusion for special rewatch candidates
            if (!c.is_rewatch) {
                const title = (c.item_data.name || c.item_data.title || '').toLowerCase();
                if (ownedIds.has(c.item_data.id) || dislikedIds.has(c.item_data.id) || (title && ownedNames.has(title))) return false;
            }
            if (userAge < 18 && c.item_data.adult) return false;
            return true;
        });

        debug.candidateCount = filteredCandidates.length;

        // ── Phase 3: Apply Multipliers & Moods ─────────────────
        const scoredCandidates = filteredCandidates.map(c => {
            let score = c.score_base || 1;
            const item = c.item_data;

            if (c.is_rewatch) score *= 0.1; // Heavy penalty so they only surface if nothing else is good

            // 3a. Quality
            const isMasterpiece = item.vote_average >= cfg.quality.greatThreshold && item.vote_count >= cfg.quality.popularityThreshold;
            if (item.vote_average) {
                if (item.vote_average >= cfg.quality.greatThreshold) score *= cfg.quality.greatMultiplier;
                else if (item.vote_average >= cfg.quality.goodThreshold) score *= cfg.quality.goodMultiplier;
                else if (item.vote_average < cfg.quality.badThreshold) score *= cfg.quality.badMultiplier;
            }
            if (item.vote_count && item.vote_count > cfg.quality.popularityThreshold) score *= cfg.quality.popularityMultiplier;

            // 3b. Genre / Keyword / People Affinity
            if (item.genre_ids && Object.keys(genreAffinity).length > 0) {
                let affinitySum = 0;
                item.genre_ids.forEach(gid => { affinitySum += (genreAffinity[gid] || 0); });
                score *= clamp(1.0 + (affinitySum / item.genre_ids.length) * cfg.genre.influence, cfg.genre.minMultiplier, cfg.genre.maxMultiplier);
            }
            
            // Keyword Affinity
            if (item.keywords) {
                const itemKws = item.keywords.results ? item.keywords.results : (item.keywords.keywords ? item.keywords.keywords : []);
                itemKws.forEach(k => {
                    if (keywordAffinity[k.id]) score *= (1.0 + (keywordAffinity[k.id] * 0.1));
                });
            }

            // People Affinity (Directors / Actors)
            if (item.credits) {
                let hasPeopleBonus = false;
                if (item.credits.crew) {
                    item.credits.crew.forEach(p => { if (p.job === 'Director' && peopleAffinity[p.id]) hasPeopleBonus = true; });
                }
                if (item.credits.cast) {
                    item.credits.cast.slice(0, 5).forEach(p => { if (peopleAffinity[p.id]) hasPeopleBonus = true; });
                }
                if (hasPeopleBonus) score *= 1.20; // +20% bonus
            }

            // 3c. Passe-droit Chef-d'œuvre & Old content penalty & Decade Affinity
            let itemYearStr = item.release_date || item.first_air_date || '';
            if (itemYearStr) {
                let itemYear = parseInt(itemYearStr.split('-')[0], 10);
                if (!isNaN(itemYear)) {
                    const decade = Math.floor(itemYear / 10) * 10;
                    if (decadeAffinity[decade]) {
                        const decadeScore = decadeAffinity[decade];
                        score *= clamp(1.0 + decadeScore * 0.05, 0.8, 1.3);
                    }
                    if (itemYear < (birthYear - 5)) {
                        if (isMasterpiece) {
                            score *= 0.8; // Light penalty for true classics
                        } else {
                            score *= 0.2; // Heavy penalty for average old movies
                        }
                    }
                }
            }

            // 3d. MOOD MODIFIERS
            const mood = cfg.mood || 'normal';
            const runtime = item.runtime || (item.episode_run_time ? item.episode_run_time[0] : 0) || 0;
            
            switch (mood) {
                case 'weeknight':
                    if (runtime > 0 && runtime < 100) score *= 1.5;
                    else if (runtime >= 100) score *= 0.5;
                    break;
                case 'weekend':
                    if (runtime >= 100) score *= 1.3;
                    if (isMasterpiece) score *= 1.5;
                    break;
                case 'feelgood':
                    if (item.genre_ids?.includes(35) || item.genre_ids?.includes(10751)) score *= 1.5;
                    if (item.genre_ids?.includes(27) || item.genre_ids?.includes(53)) score *= 0.2;
                    break;
                case 'dark':
                    if (item.genre_ids?.includes(53) || item.genre_ids?.includes(80) || item.genre_ids?.includes(27)) score *= 1.5;
                    if (item.genre_ids?.includes(35)) score *= 0.2;
                    break;
                case 'action':
                    if (item.genre_ids?.includes(28) || item.genre_ids?.includes(12)) score *= 1.5;
                    break;
                case 'family':
                    if (item.genre_ids?.includes(10751) || item.genre_ids?.includes(16)) score *= 1.5;
                    break;
                case 'scifi':
                    if (item.genre_ids?.includes(878)) score *= 1.8;
                    break;
                case 'romance':
                    if (item.genre_ids?.includes(10749)) score *= 1.8;
                    break;
                case 'mystery':
                    if (item.genre_ids?.includes(9648)) score *= 1.8;
                    break;
                case 'comedy':
                    if (item.genre_ids?.includes(35)) score *= 1.8;
                    break;
                case 'horror':
                    if (item.genre_ids?.includes(27)) score *= 1.8;
                    break;
                case 'classic':
                    if (itemYearStr && parseInt(itemYearStr.split('-')[0]) < 2000 && isMasterpiece) score *= 2.0;
                    break;
                case 'documentary':
                    if (item.genre_ids?.includes(99)) score *= 1.8;
                    break;
                case 'animation':
                    if (item.genre_ids?.includes(16)) score *= 1.8;
                    break;
                case 'epic':
                    if (item.genre_ids?.includes(14) || item.genre_ids?.includes(12)) score *= 1.5;
                    if (runtime >= 120) score *= 1.2;
                    break;
                case 'indie':
                    if (item.vote_count > 0 && item.vote_count < 500 && item.vote_average >= 6.5) score *= 1.8;
                    break;
                case 'nostalgia':
                    if (itemYearStr && parseInt(itemYearStr.split('-')[0]) < 2005) score *= 1.8;
                    break;
                case 'mindfuck':
                    if (item.genre_ids?.includes(878) || item.genre_ids?.includes(9648)) score *= 1.3;
                    break;
                case 'tearjerker':
                    if (item.genre_ids?.includes(18)) score *= 1.5;
                    break;
            }

            score *= (0.85 + Math.random() * 0.30);
            c.finalScore = score;
            return c;
        });

        scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
        const results = scoredCandidates.slice(0, cfg.output.maxResults).map(c => {
            const data = c.item_data;
            if (c.is_rewatch) data._badge = 'Rewatch';
            return data;
        });

        return { results, debug };
    };

    BigBrother.prototype.getGenreAffinity = function() {
        return this.lastAffinities || null;
    };

    BigBrother.DEFAULTS = DEFAULTS;
    if (typeof module !== 'undefined' && module.exports) module.exports = BigBrother;
    else {
        root.BigBrother = BigBrother;
        root.Recommender = BigBrother; // Fallback for cached scripts
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
