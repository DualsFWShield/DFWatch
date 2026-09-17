// bigbrother_nlp.js — Big Brother Cinematic NLP Engine
// ══════════════════════════════════════════════════════════════════════════════════
// Combines global profile description and item-specific explanations.
// ══════════════════════════════════════════════════════════════════════════════════

(function (root) {
    'use strict';

    const BBNLP = {
        dict: {},
        currentLang: null,
        _recent: {},

        init: async function(lang) {
            lang = lang || 'fr';
            if (this.currentLang === lang && Object.keys(this.dict).length > 0) return;
            try {
                const response = await fetch(`nlp_${lang}.json`);
                if (!response.ok) throw new Error('Network response was not ok');
                this.dict = await response.json();
                this.currentLang = lang;
                this._recent = {};
            } catch (error) {
                console.error("Could not load NLP dictionary for lang:", lang, error);
                this.currentLang = lang;
            }
        },

        getRandom: function(array) {
            return array && array.length > 0 ? array[Math.floor(Math.random() * array.length)] : "";
        },

        pickFresh: function(array, key, memory = 2) {
            if (!array || array.length === 0) return "";
            if (array.length === 1) return array[0];
            const recent = this._recent[key] || (this._recent[key] = []);
            const pool = array.filter(s => recent.indexOf(s) === -1);
            const finalPool = pool.length > 0 ? pool : array;
            const pick = finalPool[Math.floor(Math.random() * finalPool.length)];
            recent.push(pick);
            if (recent.length > memory) recent.shift();
            return pick;
        },

        formatNumber: function (value, lang, decimals) {
            const n = Number(value);
            if (isNaN(n)) return String(value || '');
            let dec = decimals !== undefined ? decimals : (Number.isInteger(n) ? 0 : 1);
            const fixed = n.toFixed(dec);
            return lang === 'fr' ? fixed.replace('.', ',') : fixed;
        },

        formatList: function(items, lang) {
            if (!items || items.length === 0) return "";
            const parts = items.slice(0, 3);
            if (parts.length === 1) return parts[0];
            const joiner = lang === 'fr' ? ' et ' : (parts.length === 2 ? ' and ' : ', and ');
            if (parts.length === 2) return parts[0] + joiner + parts[1];
            return parts.slice(0, -1).join(', ') + joiner + parts[parts.length - 1];
        },

        fmtTimes: function(n, lang) {
            n = parseInt(n, 10);
            if (isNaN(n) || n < 1) n = 1;
            if (lang === 'fr') return n === 1 ? 'une fois' : (n === 2 ? 'deux fois' : `${n} fois`);
            return n === 1 ? 'once' : (n === 2 ? 'twice' : `${n} times`);
        },

        sentimentTier: function (percentage) {
            if (percentage >= 85) return 'excellent';
            if (percentage >= 65) return 'positive';
            if (percentage >= 40) return 'mixed';
            return 'negative';
        },

        getArticleForms: function (type, lang) {
            const t = String(type || '').trim();
            const tLower = t.toLowerCase();
            if (lang === 'fr') {
                if (tLower === 'ce genre') {
                    return { type: t, le_type: 'ce genre', un_type: 'ce genre', du_type: 'de ce genre', de_type: 'de ce genre', ce_type: 'ce genre' };
                }
                const isMasc = ['film', 'documentaire', 'court-métrage', 'animé', 'thriller', 'drame', 'blockbuster', 'genre'].some(m => tLower.includes(m));
                return {
                    type: t,
                    le_type: isMasc ? 'le ' + t : 'la ' + t,
                    un_type: isMasc ? 'un ' + t : 'une ' + t,
                    du_type: isMasc ? 'du ' + t : 'de la ' + t,
                    de_type: 'de ' + t,
                    ce_type: isMasc ? 'ce ' + t : 'cette ' + t
                };
            }
            if (tLower === 'this genre') {
                return { type: t, le_type: 'this genre', un_type: 'this genre', du_type: 'of this genre', de_type: 'of this genre', ce_type: 'this genre' };
            }
            return {
                type: t,
                le_type: 'the ' + t,
                un_type: 'a ' + t,
                du_type: 'of the ' + t,
                de_type: 'of ' + t,
                ce_type: 'this ' + t
            };
        },

        buildGlobalCtx: function (item, match, lang) {
            item = item || {};
            match = match || {};
            const num = (v, dec) => (typeof v === 'number' && !isNaN(v)) ? this.formatNumber(v, lang, dec) : '';
            
            const genreList = Array.isArray(item.genres) ? item.genres.map(g => g.name) : [];
            const favType = genreList.length > 0 ? genreList[0] : (lang === 'fr' ? 'ce genre' : 'this genre');

            const creatorStr = item.creator || item.director || '';
            const byCreatorFr = creatorStr ? `(par ${creatorStr})` : '';
            const byCreatorEn = creatorStr ? `(by ${creatorStr})` : '';

            const ctx = {
                title: item.title || item.name || (lang === 'fr' ? 'cette œuvre' : 'this work'),
                creator: creatorStr || (lang === 'fr' ? 'ce réalisateur' : 'the creator'),
                by_creator: lang === 'fr' ? byCreatorFr : byCreatorEn,
                type: favType,
                score: item.vote_average ? num(item.vote_average, 1) : '',
                total_watches: match.total_watches || 0,
                match_pct: match.percentage || 50,
                community_rating: item.vote_average ? num(item.vote_average, 1) : '',
                community_count: item.vote_count || 0,
                genres: this.formatList(genreList, lang),
                count: 1
            };
            return ctx;
        },

        buildReasonCtx: function (reason, lang) {
            const d = (reason && reason.detail) || {};
            const ctx = {};
            const num = (v, dec) => (typeof v === 'number' && !isNaN(v)) ? this.formatNumber(v, lang, dec) : '';

            if (d.type) {
                ctx.type = d.type;
                ctx.type_watches = d.watchCount > 0 ? String(d.watchCount) : (lang === 'fr' ? 'plusieurs' : 'several');
                ctx.type_avg = num(d.avgRating, 1);
            }
            if (d.creator) {
                ctx.creator = d.creator;
                ctx.creator_watches = d.watchCount || 0;
            }
            if (Array.isArray(d.keywords) && d.keywords.length) {
                ctx.keywords = this.formatList(d.keywords, lang);
            }
            if (typeof d.rating === 'number') {
                ctx.community_rating = num(d.rating, 1);
                ctx.community_count = d.count || 0;
            }
            return ctx;
        },

        pickReasonTemplate: function (reason, toneGroup) {
            const pools = (toneGroup.reasons && toneGroup.reasons[reason.code]) || null;
            if (!pools) return "";
            const tier = reason.strength >= 0.65 ? 'strong' : 'standard';
            const hasCount = reason.detail && typeof reason.detail.watchCount === 'number' && reason.detail.watchCount >= 2;

            if (hasCount && Array.isArray(pools[tier + '_count']) && pools[tier + '_count'].length) {
                return this.getRandom(pools[tier + '_count']);
            }
            if (Array.isArray(pools[tier]) && pools[tier].length) {
                return this.getRandom(pools[tier]);
            }
            const keys = Object.keys(pools);
            for (let i = 0; i < keys.length; i++) {
                if (Array.isArray(pools[keys[i]]) && pools[keys[i]].length) return this.getRandom(pools[keys[i]]);
            }
            return "";
        },

        buildReasonClause: function(t, match, item, lang, tier) {
            if (!t || !t.reason_clauses) return "";
            const c = t.reason_clauses;
            const reasons = (match && match.reasons) || [];
            const rCodes = reasons.map(r => r.code);
            const neg = tier === 'negative';
            const mixed = tier === 'mixed';
            const pool = [];

            if (c.type && rCodes.includes('genre_match')) pool.push(...c.type);
            if (c.creator && rCodes.includes('creator_match')) pool.push(...c.creator);
            if (c.keyword && rCodes.includes('keyword_match')) pool.push(...c.keyword);
            if (c.community && (rCodes.includes('community') || (item && item.vote_average >= 7.5))) pool.push(...c.community);

            if (pool.length === 0) {
                if (c.community && item && item.vote_average) pool.push(...c.community);
                else if (c.type) pool.push(...c.type);
            }
            if (pool.length === 0) return "";
            return this.pickFresh(pool, `clause_${lang}_${tier}`, 3);
        },

        formatSlots: function(template, item, prestigeDesc, outro, lang, ctx) {
            ctx = ctx || {};
            const itemObj = item || {};
            let res = template || "";
            
            if (res.includes('{prestige_desc}')) res = res.replace(/\{prestige_desc\}/g, prestigeDesc || '');
            if (res.includes('{outro}')) res = res.replace(/\{outro\}/g, outro || '');
            if (res.includes('{reason_clause}')) res = res.replace(/\{reason_clause\}/g, ctx.reasonClause || '');

            const genreList = Array.isArray(itemObj.genres) ? itemObj.genres.map(g => g.name) : [];
            const typeStr = (ctx.reason && ctx.reason.type) ? ctx.reason.type : (genreList.length > 0 ? genreList[0] : ((ctx.global && ctx.global.type) || ''));
            const forms = this.getArticleForms(typeStr, lang);
            
            const merged = Object.assign({}, ctx.global, ctx.reason);

            let prev = "";
            let passes = 0;
            while (res !== prev && passes < 3) {
                prev = res;
                passes++;
                Object.keys(forms).forEach(k => {
                    const rx = new RegExp('\\{' + k + '\\}', 'g');
                    res = res.replace(rx, forms[k]);
                });
                Object.keys(merged).forEach(k => {
                    const v = merged[k];
                    if (v !== undefined) {
                        const rx = new RegExp('\\{' + k + '\\}', 'g');
                        res = res.replace(rx, v == null ? '' : String(v));
                    }
                });
            }
            res = res.replace(/\{[a-z0-9_]+\}/gi, '');
            return res;
        },

        surfaceRealize: function (text, lang) {
            if (!text) return "";
            let res = text;
            if (lang === 'fr') {
                res = res.replace(/(^|[^\p{L}\p{N}_])de\s+le\b/gui, '$1du');
                res = res.replace(/(^|[^\p{L}\p{N}_])de\s+les\b/gui, '$1des');
                res = res.replace(/(^|[^\p{L}\p{N}_])à\s+le\b/gui, '$1au');
                res = res.replace(/(^|[^\p{L}\p{N}_])à\s+les\b/gui, '$1aux');

                res = res.replace(/(^|[^\p{L}\p{N}_-])(de|du|le|la|ce|que|se|ne|me|te)\s+([aeiouyéèêëàâäîïôöûü][\p{L}\p{N}-]*)/gui, (match, before, prefix, word) => {
                    const p = prefix.toLowerCase();
                    let elided = prefix;
                    if (p === 'de' || p === 'du') elided = "d'";
                    else if (p === 'le' || p === 'la') elided = "l'";
                    else if (p === 'ce') elided = 'cet ';
                    else if (p === 'que') elided = "qu'";
                    else if (p === 'se') elided = "s'";
                    else if (p === 'ne') elided = "n'";
                    else if (p === 'me') elided = "m'";
                    else if (p === 'te') elided = "t'";
                    if (prefix.charAt(0) === prefix.charAt(0).toUpperCase() && elided.includes("'")) {
                        elided = elided.charAt(0).toUpperCase() + elided.slice(1);
                    }
                    return before + elided + word;
                });
                res = res.replace(/(^|[^\p{L}\p{N}_])si\s+(ils?)\b/gui, "$1s'$2");
            } else {
                const AN_EXCEPTIONS = /^(uni|use|usu|euro|one|once|ubiq)/i;
                const AN_EXTRA = /^(hour|honest|honor|heir)/i;
                res = res.replace(/\b([Aa])\s+([\w-]+)/g, (m, a, word) => {
                    const w = word.toLowerCase();
                    if ((/^[aeiou]/.test(w) && !AN_EXCEPTIONS.test(w)) || AN_EXTRA.test(w)) return (a === 'A' ? 'An' : 'an') + ' ' + word;
                    return m;
                });
            }
            res = res.replace(/\s+/g, ' ');
            res = res.replace(/\(\s*\)/g, '');
            res = res.replace(/,\s*,+/g, ',');
            res = res.replace(/([.,;:])(\s*[.,;:])+/g, '$1');
            res = res.replace(/\s+([.,])/g, '$1');
            if (lang === 'fr') {
                res = res.replace(/ ([!?;:])/g, '\u00A0$1'); 
            } else {
                res = res.replace(/\s+([!?;:])/g, '$1');
            }
            res = res.replace(/([.!?])\s*([\p{Ll}])/gu, (m, p, l) => p + ' ' + l.toUpperCase());
            res = res.trim();
            if (res.length > 0) res = res.charAt(0).toUpperCase() + res.slice(1);
            return res;
        },

        generateExplanation: async function (item, match, tone = 'bigbrother', lang = 'fr', isAlreadyWatched = false) {
            await this.init(lang);
            let toneGroup = this.dict[tone] || this.dict['bigbrother'] || Object.values(this.dict)[0];
            if (!toneGroup) return "";

            match = match || {};
            const pct = match.percentage != null ? match.percentage : 50;
            const tier = this.sentimentTier(pct);
            const sentiment = (tier === 'excellent' || tier === 'positive') ? 'positive' : (tier === 'negative' ? 'negative' : 'mixed');

            const t = toneGroup[tier] || toneGroup['positive'] || toneGroup['mixed'] || toneGroup['negative'];
            if (!t) return "";

            const globalCtx = this.buildGlobalCtx(item, match, lang);
            const parts = [];

            // 1. Opener (statistical vs standard)
            const openerPools = (toneGroup.openers && toneGroup.openers[tier]) || null;
            let openerPool = [];
            if (Array.isArray(openerPools)) {
                openerPool = openerPools;
            } else if (openerPools) {
                const useStats = match.total_watches >= 5 && Array.isArray(openerPools.withStats) && openerPools.withStats.length > 0;
                openerPool = useStats ? openerPools.withStats : (openerPools.standard || []);
            }
            const opener = this.getRandom(openerPool);
            if (opener) parts.push(this.formatSlots(opener, item, "", "", lang, { global: globalCtx }));

            // 2. Prestige (skipped for movies unless we add a prestige logic, but we handle the slot gracefully)
            const prestigeDesc = "";

            // 3. Outro
            const outroPool = t.outros || [];
            const outro = Array.isArray(outroPool) ? this.pickFresh(outroPool, `outro_${tone}_${lang}_${tier}`) : "";

            // 4. Data-driven embedded Reason Clause
            const reasonClause = this.buildReasonClause(t, match, item, lang, tier);

            // 5. Narrative Scenario
            const scenario = this.pickFresh(t.scenarios, `scen_${tone}_${lang}_${tier}`);

            // 6. Reasons Sentences (Budgeted)
            const reasons = Array.isArray(match.reasons) ? match.reasons : [];
            const budgets = { excellent: { pos: 3, neg: 1 }, positive: { pos: 3, neg: 1 }, mixed: { pos: 2, neg: 2 }, negative: { pos: 1, neg: 3 } };
            const budget = budgets[tier] || { pos: 2, neg: 1 };
            
            const reasonSentences = [];
            let posUsed = 0, negUsed = 0;
            reasons.forEach(r => {
                const isNeg = r.code && r.code.includes('_mismatch');
                if (isNeg ? negUsed >= budget.neg : posUsed >= budget.pos) return;
                const rTpl = this.pickReasonTemplate(r, toneGroup);
                if (!rTpl) return;
                const rCtx = this.buildReasonCtx(r, lang);
                reasonSentences.push(this.formatSlots(rTpl, item, "", "", lang, { global: globalCtx, reason: rCtx }));
                if (isNeg) negUsed++; else posUsed++;
            });

            // 7. Assembly
            const fullCtx = { global: globalCtx, match, reasonClause };
            let rawText = scenario ? this.formatSlots(scenario, item, prestigeDesc, outro, lang, fullCtx) : (opener || "");
            if (reasonSentences.length > 0) rawText += " " + reasonSentences.join(" ");

            // 8. Tasted Note Append (if not already handled in outro)
            if (isAlreadyWatched && toneGroup.alreadyWatched) {
                const watchedCount = Math.max(1, typeof isAlreadyWatched === 'number' ? Math.floor(isAlreadyWatched) : 1);
                const at = toneGroup.alreadyWatched || {};
                let pool = (watchedCount >= 2 && Array.isArray(at.multiple) && at.multiple.length) ? at.multiple : (at.once || (Array.isArray(at) ? at : []));
                if (!Array.isArray(pool)) pool = [];
                const note = this.getRandom(pool);
                if (note && !rawText.includes(note)) {
                    rawText += " " + this.formatSlots(note, item, "", "", lang, { global: Object.assign({}, globalCtx, { count: watchedCount }) });
                }
            }

            return this.surfaceRealize(rawText, lang);
        },

        generateProfileDescription: function (affinities, totalWatches, topGenres, topDecades, topDirectors, topKeywords) {
            if (!this.dict || !this.dict.profile_insights) return "Profil BigBrother en cours d'analyse...";
            
            const insights = this.dict.profile_insights;
            const lang = this.currentLang || 'fr';
            
            let tier = 'beginner';
            if (totalWatches > 200) tier = 'hardcore';
            else if (totalWatches > 50) tier = 'established';

            const pool = insights.scenarios || ["{opener} {genre_analysis} {decade_focus} {outro}"];
            const template = this.pickFresh(pool, 'profile_scenario_' + tier, 3);
            
            const topGenreStr = topGenres && topGenres.length > 0 ? topGenres[0].name : (lang === 'fr' ? 'un genre précis' : 'a specific genre');
            const topGenreScore = topGenres && topGenres.length > 0 ? this.formatNumber(topGenres[0].score, lang, 1) : '';
            const topDecadeStr = topDecades && topDecades.length > 0 ? topDecades[0].name : (lang === 'fr' ? 'votre époque' : 'your era');
            
            const directorFallback = lang === 'fr' ? 'vos cinéastes favoris' : 'your favorite filmmakers';
            const keywordFallback = lang === 'fr' ? 'vos thématiques favorites' : 'your favorite themes';

            const hasSpecificDirector = topDirectors && topDirectors.length > 0 && topDirectors[0].name;
            const hasSpecificKeyword = topKeywords && topKeywords.length > 0 && topKeywords[0].name;

            const topDirectorStr = hasSpecificDirector ? topDirectors[0].name : directorFallback;
            const topKeywordStr = hasSpecificKeyword ? topKeywords[0].name : keywordFallback;

            const vars = {
                total_watches: totalWatches,
                top_genre: topGenreStr,
                top_genre_score: topGenreScore,
                top_decade: topDecadeStr,
                top_director: topDirectorStr,
                top_keyword: topKeywordStr,
                opener: this.pickFresh(insights.openers?.[tier], 'opener_' + tier, 2) || "",
                genre_analysis: this.pickFresh(insights.genre_analysis?.dominant, 'genre_analysis', 3) || "",
                director_focus: hasSpecificDirector ? (this.pickFresh(insights.director_focus?.specific, 'director_specific', 2) || "") : (this.pickFresh(insights.director_focus?.generic, 'director_generic', 2) || ""),
                decade_focus: this.pickFresh(insights.decade_focus?.strong, 'decade_focus', 3) || "",
                keyword_focus: hasSpecificKeyword ? (this.pickFresh(insights.keyword_focus?.specific, 'keyword_specific', 2) || "") : (this.pickFresh(insights.keyword_focus?.generic, 'keyword_generic', 2) || ""),
                outro: this.pickFresh(insights.outros?.[tier], 'outro_' + tier, 2) || ""
            };

            let res = template;
            let prev = "";
            let passes = 0;
            while (res !== prev && passes < 3) {
                prev = res;
                passes++;
                Object.keys(vars).forEach(k => {
                    const rx = new RegExp('\\{' + k + '\\}', 'g');
                    res = res.replace(rx, vars[k] == null ? '' : String(vars[k]));
                });
            }
            res = res.replace(/\{[a-z0-9_]+\}/gi, '');
            return this.surfaceRealize(res, lang);
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = BBNLP;
    else root.BBNLP = BBNLP;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
