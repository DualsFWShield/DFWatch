// app.js — DFWatch Main Application Logic

(function () {
    'use strict';

    // ---- Shared Utilities ----
    function debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
    window.appDebounce = debounce;

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function safeJsonParse(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    function parseLocalDate(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
        const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }

    function sanitizeFilename(str) {
        return String(str || 'DFWatch').replace(/[\\/:*?"<>|]/g, '_').trim() || 'DFWatch';
    }

    function isValidYoutubeId(id) {
        return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
    }

    function randomUuid(prefix = 'dfw') {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    // ---- i18n Init ----
    if (window.I18n) window.I18n.init();

    // ---- Offline Status Management ----
    function updateOnlineStatus() {
        const indicator = document.getElementById('offline-indicator');
        if (!navigator.onLine) {
            document.body.classList.add('is-offline');
            if (indicator) indicator.classList.remove('hidden');
            if (window.showToast && window.I18n) {
                window.showToast(window.I18n.get('toast.offline'), 4000);
            }
        } else {
            const wasOffline = document.body.classList.contains('is-offline');
            document.body.classList.remove('is-offline');
            if (indicator) indicator.classList.add('hidden');
            if (wasOffline && window.showToast && window.I18n) {
                window.showToast(window.I18n.get('toast.online'), 3000);
            }
        }
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    if (!navigator.onLine) {
        setTimeout(updateOnlineStatus, 500);
    }

    // ---- Navigation (syncs sidebar + bottom nav) ----
    const pages = document.querySelectorAll('.page');
    let currentActivePage = 'series';
    let lastFocusedBeforeModal = null;

    function forceCloseAllOverlays() {
        if (Array.isArray(window.modalStack) && window.modalStack.length > 0) {
            [...window.modalStack].reverse().forEach(id => window.closeOverlay(id, true));
        }
    }

    function navigateTo(target, fromPopState = false) {
        if (target === 'lists') {
            if (!fromPopState) {
                history.replaceState({ page: 'calendar' }, '');
            }
            target = 'calendar';
        }

        forceCloseAllOverlays();

        // Pause avatar particle animation when leaving profile
        if (target !== 'profile' && window._avatarParticleRaf) {
            cancelAnimationFrame(window._avatarParticleRaf);
            window._avatarParticleRaf = null;
        }

        currentActivePage = target;

        document.querySelectorAll('.nav-btn, .sidebar-btn').forEach(b => {
            b.classList.remove('active');
            b.removeAttribute('aria-current');
        });
        document.querySelectorAll(`.nav-btn[data-page="${target}"], .sidebar-btn[data-page="${target}"]`).forEach(b => {
            b.classList.add('active');
            b.setAttribute('aria-current', 'page');
        });
        pages.forEach(p => {
            p.classList.remove('active');
            if (p.id === `page-${target}`) p.classList.add('active');
        });

        if (!fromPopState) {
            history.pushState({ page: target }, "");
        }

        if (target === 'profile') refreshProfile();
        if (target === 'stats') refreshStats();
        if (target === 'series') refreshSeriesList();
        if (target === 'films') refreshFilmsList();
        if (target === 'search') initSearch();
        if (target === 'calendar') {
            refreshCalendar();
            renderCustomLists();
        }
    }

    window.appNavigateTo = navigateTo;

    // ---- Navigation & Overlay Logic ----
    window.modalStack = [];
    window.openOverlay = function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        if (window.modalStack.length === 0) {
            lastFocusedBeforeModal = document.activeElement;
        }
        el.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (!window.modalStack.includes(id)) {
            window.modalStack.push(id);
            history.pushState({ overlay: id }, "");
        }
        setTimeout(() => {
            const focusable = el.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
            if (focusable) focusable.focus({ preventScroll: true });
        }, 50);
    };

    window.closeOverlay = function(id, fromPopState = false) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('hidden');
        if (id === 'show-detail-overlay') {
            el.querySelectorAll('.trailer-container iframe').forEach(ifr => ifr.remove());
        }
        const wasTop = window.modalStack[window.modalStack.length - 1] === id;
        if (!fromPopState) {
            if (wasTop) {
                window.modalStack.pop();
                if (history.state && history.state.overlay === id) {
                    history.back();
                }
            } else {
                window.modalStack = window.modalStack.filter(m => m !== id);
            }
        } else {
            window.modalStack = window.modalStack.filter(m => m !== id);
        }
        if (window.modalStack.length === 0) {
            document.body.style.overflow = '';
            if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function' && document.contains(lastFocusedBeforeModal)) {
                lastFocusedBeforeModal.focus({ preventScroll: true });
            }
            lastFocusedBeforeModal = null;
        }
        document.dispatchEvent(new CustomEvent('modal_closed_' + id));
    };

    window.addEventListener('popstate', (e) => {
        if (window.modalStack.length > 0) {
            const top = window.modalStack[window.modalStack.length - 1];
            window.closeOverlay(top, true);
        } else if (e.state && e.state.page === 'list-detail' && e.state.listId !== undefined) {
            openCustomList(e.state.listId, true);
        } else if (e.state && e.state.page) {
            navigateTo(e.state.page, true);
        } else {
            navigateTo('series', true);
        }
    });

    // Global Escape key support to close top overlay
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.modalStack && window.modalStack.length > 0) {
            const top = window.modalStack[window.modalStack.length - 1];
            window.closeOverlay(top);
        }
    });

    // ---- Theme Init ----
    function updateMetaThemeColor(theme) {
        const meta = document.getElementById('meta-theme-color');
        if (!meta) return;
        const isLight = theme === 'light' || (theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
        meta.setAttribute('content', isLight ? '#f8fafc' : '#08080f');
    }

    const savedTheme = localStorage.getItem('dfwatch_theme') || 'default';
    document.body.setAttribute('data-theme', savedTheme);
    updateMetaThemeColor(savedTheme);
    const themeOptions = document.querySelectorAll('.theme-option');
    if (themeOptions.length > 0) {
        themeOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === savedTheme);
            opt.addEventListener('click', () => {
                themeOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                const newTheme = opt.dataset.theme;
                document.body.setAttribute('data-theme', newTheme);
                localStorage.setItem('dfwatch_theme', newTheme);
                updateMetaThemeColor(newTheme);
            });
        });
    }

    const langSelect = document.getElementById('app-language');
    if (langSelect && window.I18n) {
        langSelect.value = window.I18n.lang;
        langSelect.addEventListener('change', (e) => {
            window.I18n.setLang(e.target.value);
            if (currentActivePage === 'series') refreshSeriesList();
            else if (currentActivePage === 'films') refreshFilmsList();
            else if (currentActivePage === 'calendar') { refreshCalendar(); renderCustomLists(); }
            else if (currentActivePage === 'search') initSearch();
            else if (currentActivePage === 'stats') refreshStats();
            else if (currentActivePage === 'profile') refreshProfile();
            else if (currentActivePage === 'list-detail' && currentListId) renderListDetailItems(currentListId);
        });
    }

    // Anti-Spoil Init
    const isNoSpoil = localStorage.getItem('dfwatch_no_spoil') === 'true';
    document.body.classList.toggle('no-spoil', isNoSpoil);

    const noSpoilCheckbox = document.getElementById('dfwatch-no-spoil');
    if (noSpoilCheckbox) {
        noSpoilCheckbox.checked = isNoSpoil;
        noSpoilCheckbox.addEventListener('change', (e) => {
            const checked = e.target.checked;
            localStorage.setItem('dfwatch_no_spoil', String(checked));
            document.body.classList.toggle('no-spoil', checked);
        });
    }

    // Tap-to-reveal for Anti-Spoil on touch devices
    document.addEventListener('click', (e) => {
        if (!document.body.classList.contains('no-spoil')) return;
        const spoiled = e.target.closest('.ep-overview, .detail-overview');
        if (spoiled) spoiled.classList.toggle('revealed');
    });

    // Auto-Mood Persistence
    const autoMoodCheckbox = document.getElementById('dfwatch-auto-mood');
    const savedAutoMood = localStorage.getItem('dfwatch_auto_mood');
    const isAutoMood = savedAutoMood === null ? true : savedAutoMood === 'true';
    let manualMoodOverride = false;
    if (autoMoodCheckbox) {
        autoMoodCheckbox.checked = isAutoMood;
        autoMoodCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('dfwatch_auto_mood', String(e.target.checked));
            manualMoodOverride = false;
            if (currentActivePage === 'search' && currentSearchType === 'foryou') {
                loadRecommendations();
            }
        });
    }

    document.querySelectorAll('.nav-btn, .sidebar-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // ---- Tab switching ----
    document.querySelectorAll('.tab-bar').forEach(bar => {
        bar.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                bar.querySelectorAll('.tab').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                const parent = bar.parentElement;
                parent.querySelectorAll('.tab-content').forEach(tc => {
                    tc.classList.toggle('active', tc.id === `tab-${tabId}`);
                });
            });
        });
    });

    // ---- Search tabs & Clear button ----
    let currentSearchType = 'foryou';
    let _searchReqId = 0;

    document.querySelectorAll('.search-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSearchType = tab.dataset.searchType;

            const moodContainer = document.getElementById('bb-mood-container');
            if (moodContainer) {
                moodContainer.style.display = currentSearchType === 'foryou' ? 'block' : 'none';
            }

            const sInput = document.getElementById('search-input');
            const q = sInput ? sInput.value.trim() : '';
            if (currentSearchType === 'foryou') {
                if (sInput) sInput.value = '';
                document.getElementById('btn-clear-search')?.classList.add('hidden');
                loadRecommendations();
            } else {
                if (q.length >= 2) doSearch(q);
                else loadTrending();
            }
        });
    });

    const moodSelect = document.getElementById('bb-mood-select');
    if (moodSelect) {
        moodSelect.addEventListener('change', () => {
            manualMoodOverride = true;
            if (currentSearchType === 'foryou') {
                loadRecommendations();
            }
        });
    }

    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const filtersPanel = document.getElementById('search-filters-panel');
    const btnToggleFilters = document.getElementById('btn-toggle-filters');
    const btnApplyFilters = document.getElementById('btn-apply-filters');
    const btnClearSearch = document.getElementById('btn-clear-search');

    btnToggleFilters?.addEventListener('click', () => {
        filtersPanel?.classList.toggle('hidden');
    });

    btnApplyFilters?.addEventListener('click', () => {
        doSearch('', true);
    });

    btnClearSearch?.addEventListener('click', () => {
        if (!searchInput) return;
        searchInput.value = '';
        btnClearSearch.classList.add('hidden');
        if (currentSearchType === 'foryou') loadRecommendations();
        else loadTrending();
        searchInput.focus();
    });

    const handleSearchInput = debounce(() => {
        if (!searchInput) return;
        const q = searchInput.value.trim();
        if (btnClearSearch) btnClearSearch.classList.toggle('hidden', q.length === 0);

        if (currentSearchType === 'foryou' && q.length > 0) {
            const moodContainer = document.getElementById('bb-mood-container');
            if (moodContainer) moodContainer.style.display = 'none';
            document.querySelector('.search-tab[data-search-type="multi"]')?.click();
            return;
        }

        if (q.length < 2) {
            if (currentSearchType === 'foryou') loadRecommendations();
            else loadTrending();
            return;
        }
        doSearch(q);
    }, 300);

    searchInput?.addEventListener('input', handleSearchInput);
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' && searchResults) {
            const firstCard = searchResults.querySelector('.poster-card');
            if (firstCard) {
                e.preventDefault();
                firstCard.focus();
            }
        }
    });

    async function initSearch() {
        if (!searchInput || searchInput.value.trim().length < 2) {
            if (currentSearchType === 'foryou') loadRecommendations();
            else loadTrending();
        }
    }

    async function loadTrending() {
        if (!searchResults) return;
        const reqId = ++_searchReqId;
        searchResults.innerHTML = Array(6).fill('<div class="skeleton-grid-item skeleton"></div>').join('');
        const type = currentSearchType === 'multi' ? 'all' : currentSearchType;
        const results = await TMDB.getTrending(type);
        if (reqId !== _searchReqId) return;
        if (!results.length) {
            searchResults.innerHTML = `<div class="empty-state"><p>${escapeHtml(window.I18n ? window.I18n.get('search.no_trends') : 'Aucune tendance trouvée.')}</p></div>`;
            return;
        }
        searchResults.innerHTML = '';
        const header = document.createElement('h3');
        header.style.gridColumn = '1 / -1';
        header.style.marginBottom = '1rem';
        header.textContent = window.I18n ? window.I18n.get('search.popular_now') : 'Populaire en ce moment';
        searchResults.appendChild(header);

        results.forEach(item => {
            searchResults.appendChild(createPosterCard(item));
        });
    }

    // ---- BigBrother Engine (vendor) ----
    const _bigBrotherEngine = new BigBrother();
    window._bigBrotherEngine = _bigBrotherEngine;

    async function feedBigBrother(tmdbId, type, weight = 1.0) {
        if (!tmdbId) return;
        try {
            const recs = await TMDB.getRecommendations(tmdbId, type);
            if (!recs || !recs.length) return;

            const [shows, movies, feedback] = await Promise.all([
                db.shows.toArray(),
                db.movies.toArray(),
                db.recommendation_feedback.toArray()
            ]);
            const ownedIds = new Set([...shows.map(s => s.tmdb_id), ...movies.map(m => m.tmdb_id)].filter(Boolean));
            const ownedNames = new Set([...shows.map(s => s.name?.toLowerCase()), ...movies.map(m => m.name?.toLowerCase())].filter(Boolean));
            const dislikedIds = new Set(feedback.filter(f => f.feedback_value === -1).map(f => f.tmdb_id));

            for (const item of recs.slice(0, 10)) {
                const itemName = (item.name || item.title || '').toLowerCase();
                if (!item || !item.id || ownedIds.has(item.id) || dislikedIds.has(item.id) || (itemName && ownedNames.has(itemName))) continue;

                const existing = await db.bigbrother_candidates.where('tmdb_id').equals(item.id).first();
                if (existing) {
                    await db.bigbrother_candidates.update(existing.tmdb_id, {
                        score_base: existing.score_base + weight,
                        last_updated: Date.now()
                    });
                } else {
                    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                    let fullItem = item;
                    try {
                        const details = mediaType === 'tv' ? await TMDB.getShowDetails(item.id) : await TMDB.getMovieDetails(item.id);
                        if (details) fullItem = { ...item, ...details };
                    } catch (err) {}

                    await db.bigbrother_candidates.put({
                        tmdb_id: item.id,
                        type: mediaType,
                        score_base: weight,
                        last_updated: Date.now(),
                        item_data: fullItem
                    });
                }
            }

            // Purge strategy: Keep only top 500 candidates using primary key tmdb_id
            const count = await db.bigbrother_candidates.count();
            if (count > 500) {
                const all = await db.bigbrother_candidates.toArray();
                all.sort((a, b) => b.score_base - a.score_base);
                const toDelete = all.slice(500).map(c => c.tmdb_id).filter(id => id !== undefined && id !== null);
                if (toDelete.length > 0) await db.bigbrother_candidates.bulkDelete(toDelete);
            }
        } catch (e) {
            console.error("Big Brother feed error:", e);
        }
    }

    /** Data adapter that bridges the BigBrother engine with DFWatch's DB. */
    const _bigBrotherAdapter = {
        async getTopPicks() {
            const top10 = safeJsonParse(localStorage.getItem('dfwatch_top10'), []);
            if (!top10.length) return [];
            const [shows, movies] = await Promise.all([db.shows.toArray(), db.movies.toArray()]);
            const showMap = new Map(shows.filter(s => s.tmdb_id).map(s => [Number(s.tmdb_id), s]));
            const movieMap = new Map(movies.filter(m => m.tmdb_id).map(m => [Number(m.tmdb_id), m]));
            return top10.map(item => {
                const type = item.type || 'tv';
                const dbItem = type === 'movie' ? movieMap.get(Number(item.tmdb_id)) : showMap.get(Number(item.tmdb_id));
                const gIds = dbItem && Array.isArray(dbItem.genre_ids) ? dbItem.genre_ids.filter(id => typeof id === 'number' && id !== -1) : [];
                return {
                    id: item.tmdb_id,
                    type,
                    genre_ids: gIds,
                    release_date: dbItem ? (dbItem.release_date || dbItem.first_air_date) : null,
                    directors: dbItem ? (dbItem.directors || []) : [],
                    actors: dbItem ? (dbItem.actors || []) : [],
                    keywords: dbItem ? (dbItem.keywords || []) : []
                };
            });
        },
        async getAllFeedback() {
            return db.recommendation_feedback.toArray();
        },
        async getLikedFeedback() {
            const all = await this.getAllFeedback();
            return all.filter(f => f.feedback_value === 1);
        },
        async getTotalWatches() {
            const [epCount, mvCount] = await Promise.all([
                db.watch_history.count(),
                db.movie_watches.count()
            ]);
            return epCount + mvCount;
        },
        getUserDob() {
            return localStorage.getItem('dfwatch_dob');
        },
        async getHighlyRatedItems() {
            let topShows = await db.shows.where('user_rating').above(3).toArray();
            let topMovies = await db.movies.where('user_rating').above(3).toArray();
            
            // If they haven't rated anything, fallback to watched items
            if (topShows.length === 0) {
                topShows = await db.shows.filter(s => s.is_followed === 1 || s.is_favorited === 1).toArray();
            }
            if (topMovies.length === 0) {
                topMovies = await db.movies.filter(m => m.status === 'watched').toArray();
            }
            
            // Limit to 20 to avoid spamming TMDB on load
            topShows = topShows.slice(0, 20);
            topMovies = topMovies.slice(0, 20);
            const TMDB_GENRES = { "Action":10759, "Adventure":10759, "Animation":16, "Comedy":35, "Crime":80, "Documentary":99, "Drama":18, "Family":10751, "Kids":10762, "Mystery":9648, "News":10763, "Reality":10764, "Sci-Fi":10765, "Fantasy":10765, "Soap":10766, "Talk":10767, "War":10768, "Politics":10768, "Western":37 };

            const results = [];
            for (const s of topShows) {
                if (!s.tmdb_id) continue;
                if (!s.genre_ids || s.genre_ids.length === 0 || s.genre_ids.some(id => typeof id !== 'number') || !s.directors || !s.keywords) {
                    try {
                        const details = await window.TMDB.getShowDetails(s.tmdb_id);
                        if (details) {
                            s.genre_ids = details.genres ? details.genres.map(g => g.id || TMDB_GENRES[g.name] || g.name).filter(id => typeof id === 'number') : [];
                            if (s.genre_ids.length === 0) s.genre_ids = [-1];
                            s.first_air_date = details.first_air_date;
                            s.origin_country = details.origin_country || s.origin_country || [];
                            s.directors = details.created_by ? details.created_by.map(c => ({ id: c.id, name: c.name })) : [];
                            s.keywords = [];
                            if (details.keywords && details.keywords.results) s.keywords = details.keywords.results.map(k => ({ id: k.id, name: k.name }));
                            else if (details.keywords && details.keywords.keywords) s.keywords = details.keywords.keywords.map(k => ({ id: k.id, name: k.name }));

                            await db.shows.update(s.id, {
                                genre_ids: s.genre_ids,
                                first_air_date: s.first_air_date,
                                origin_country: s.origin_country,
                                directors: s.directors,
                                keywords: s.keywords
                            });
                        }
                    } catch (e) {}
                }
                const gIds = (s.genre_ids || []).filter(id => typeof id === 'number' && id !== -1);
                results.push({ tmdb_id: s.tmdb_id, type: 'tv', genre_ids: gIds, release_date: s.first_air_date || s.release_date, directors: s.directors || [], keywords: s.keywords || [] });
            }

            for (const m of topMovies) {
                if (!m.tmdb_id) continue;
                if (!m.genre_ids || m.genre_ids.length === 0 || m.genre_ids.some(id => typeof id !== 'number') || !m.directors || !m.keywords) {
                    try {
                        const details = await window.TMDB.getMovieDetails(m.tmdb_id);
                        if (details) {
                            m.genre_ids = details.genres ? details.genres.map(g => g.id || TMDB_GENRES[g.name] || g.name).filter(id => typeof id === 'number') : [];
                            if (m.genre_ids.length === 0) m.genre_ids = [-1];
                            m.release_date = details.release_date;
                            m.production_countries = details.production_countries || m.production_countries || [];
                            m.directors = [];
                            if (details.credits && details.credits.crew) {
                                m.directors = details.credits.crew.filter(c => c.job === 'Director').map(c => ({ id: c.id, name: c.name }));
                            }
                            m.keywords = [];
                            if (details.keywords && details.keywords.keywords) {
                                m.keywords = details.keywords.keywords.map(k => ({ id: k.id, name: k.name }));
                            }

                            await db.movies.update(m.id, {
                                genre_ids: m.genre_ids,
                                release_date: m.release_date,
                                production_countries: m.production_countries,
                                directors: m.directors,
                                keywords: m.keywords
                            });
                        }
                    } catch (e) {}
                }
                const gIds = (m.genre_ids || []).filter(id => typeof id === 'number' && id !== -1);
                results.push({ tmdb_id: m.tmdb_id, type: 'movie', genre_ids: gIds, release_date: m.release_date, directors: m.directors || [], keywords: m.keywords || [] });
            }
            return results;
        },
        async getCandidates() {
            return db.bigbrother_candidates.toArray();
        },
        async getOwnedItems() {
            const shows = await db.shows.toArray();
            const movies = await db.movies.toArray();
            return {
                ids: new Set([...shows.map(s => s.tmdb_id), ...movies.map(m => m.tmdb_id)].filter(Boolean)),
                names: new Set([...shows.map(s => s.name?.toLowerCase()), ...movies.map(m => m.name?.toLowerCase())].filter(Boolean))
            };
        },
        async getRewatchCandidates() {
            const [movies, watches] = await Promise.all([db.movies.toArray(), db.movie_watches.toArray()]);
            const cutoff = Date.now() - 180 * 86400000;
            const lastWatchByUuid = new Map();
            watches.forEach(w => {
                if (!w.movie_uuid || !w.watched_at) return;
                const ts = new Date(w.watched_at).getTime();
                if (!isNaN(ts) && ts > (lastWatchByUuid.get(w.movie_uuid) || 0)) {
                    lastWatchByUuid.set(w.movie_uuid, ts);
                }
            });
            const eligible = movies.filter(m => {
                if (m.status !== 'watched' || (m.user_rating || 0) < 3) return false;
                const lastTs = m.uuid ? lastWatchByUuid.get(m.uuid) : null;
                return !lastTs || lastTs < cutoff;
            });
            // Fisher-Yates shuffle
            for (let i = eligible.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
            }
            return eligible.slice(0, 20).map(m => ({
                tmdb_id: m.tmdb_id,
                type: 'movie',
                score_base: 0.5,
                is_rewatch: true,
                item_data: {
                    id: m.tmdb_id,
                    name: m.name, title: m.name,
                    poster_path: m.poster_path, backdrop_path: m.backdrop_path,
                    release_date: m.release_date,
                    genre_ids: (m.genre_ids || []).filter(id => id !== -1),
                    vote_average: m.user_rating ? m.user_rating * 2 : 7.0,
                    media_type: 'movie'
                }
            }));
        },
        async getDislikedIds() {
            const feedback = await db.recommendation_feedback.toArray();
            return new Set(feedback.filter(f => f.feedback_value === -1).map(f => f.tmdb_id));
        }
    };

    async function loadRecommendations() {
        if (!searchResults) return;
        const reqId = ++_searchReqId;
        searchResults.innerHTML = Array(6).fill('<div class="skeleton-grid-item skeleton"></div>').join('');

        try {
            const candidates = await db.bigbrother_candidates.toArray();
            if (candidates.length === 0) {
                searchResults.innerHTML = `<div class="empty-state"><div class="bb-eye-pulse" style="font-size:32px; margin-bottom:16px;">👁️</div><p>${escapeHtml(window.I18n ? window.I18n.get('search.searching') : "Big Brother s'éveille...")}</p></div>`;
                const [movies, shows] = await Promise.all([
                    TMDB.discover('movie'),
                    TMDB.discover('tv')
                ]);
                const mix = [...(movies || []), ...(shows || [])];
                for (let i = 0; i < mix.length; i += 6) {
                    const chunk = mix.slice(i, i + 6);
                    await Promise.all(chunk.map(async item => {
                        if (!item || !item.id) return;
                        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                        let fullItem = item;
                        try {
                            const details = mediaType === 'tv' ? await TMDB.getShowDetails(item.id) : await TMDB.getMovieDetails(item.id);
                            if (details) fullItem = { ...item, ...details };
                        } catch (err) {}
                        await db.bigbrother_candidates.put({
                            tmdb_id: item.id,
                            type: mediaType,
                            score_base: 1,
                            last_updated: Date.now(),
                            item_data: fullItem
                        });
                    }));
                }
            }

            if (reqId !== _searchReqId) return;

            const moodSelectEl = document.getElementById('bb-mood-select');
            let currentMood = moodSelectEl ? moodSelectEl.value : 'normal';
            const autoMoodToggle = document.getElementById('dfwatch-auto-mood');
            const autoMoodEnabled = autoMoodToggle ? autoMoodToggle.checked : true;
            if (autoMoodEnabled && !manualMoodOverride) {
                const now = new Date();
                const day = now.getDay();
                const hour = now.getHours();
                const isWeekend = day === 0 || day === 6 || (day === 5 && hour >= 18);
                const isEvening = hour >= 18;
                if (isWeekend) currentMood = 'weekend';
                else if (isEvening) currentMood = 'weeknight';
                else currentMood = 'normal';
                if (moodSelectEl) moodSelectEl.value = currentMood;
            }

            _bigBrotherEngine.config.mood = currentMood;
            const { results: finalResults } = await _bigBrotherEngine.recommend(_bigBrotherAdapter);
            if (reqId !== _searchReqId) return;

            if (finalResults.length === 0) {
                searchResults.innerHTML = `<div class='empty-state'><div class='empty-icon bb-eye-pulse'>👁️</div><h3>${escapeHtml(window.I18n ? window.I18n.get('search.not_enough_data') : 'Big Brother observe...')}</h3><p>${escapeHtml(window.I18n ? window.I18n.get('search.not_enough_data_desc') : "Nourrissez-le en notant ou ajoutant quelques films/séries pour débloquer ses recommandations.")}</p></div>`;
                return;
            }

            searchResults.innerHTML = '';
            const headerContainer = document.createElement('div');
            headerContainer.style.cssText = 'grid-column:1 / -1; display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:12px;';

            const header = document.createElement('h3');
            header.style.margin = '0';
            header.textContent = window.I18n ? window.I18n.get('search.for_you_title') : 'Sélectionné spécialement pour vous';

            const btnNourrir = document.createElement('button');
            btnNourrir.className = 'action-btn secondary';
            btnNourrir.textContent = window.I18n ? window.I18n.get('search.feed_big_brother') : '👁️ Nourrir Big Brother';
            btnNourrir.style.cssText = 'font-size:12px; padding:6px 12px; width:auto;';
            btnNourrir.title = "Analyser toute votre bibliothèque";

            let nourrirAbort = false;
            let isNourrishing = false;
            btnNourrir.addEventListener('click', async () => {
                if (isNourrishing) {
                    nourrirAbort = true;
                    return;
                }
                isNourrishing = true;
                nourrirAbort = false;
                const allShows = await db.shows.toArray();
                const allMovies = await db.movies.toArray();
                const queue = [
                    ...allShows.filter(s => s.tmdb_id).map(s => ({ id: s.tmdb_id, type: 'tv' })),
                    ...allMovies.filter(m => m.tmdb_id).map(m => ({ id: m.tmdb_id, type: 'movie' }))
                ];
                const total = queue.length;
                let current = 0;

                if (total === 0) {
                    btnNourrir.textContent = window.I18n ? window.I18n.get('search.bb_nothing') : 'Rien à analyser 😅';
                    isNourrishing = false;
                    setTimeout(() => { btnNourrir.textContent = window.I18n ? window.I18n.get('search.feed_big_brother') : '👁️ Nourrir Big Brother'; }, 2000);
                    return;
                }

                btnNourrir.textContent = window.I18n ? window.I18n.get('search.bb_digesting', { current: 0, total }) : `Big Brother digère... 0/${total}`;
                for (let i = 0; i < queue.length && !nourrirAbort; i += 3) {
                    const chunk = queue.slice(i, i + 3);
                    await Promise.all(chunk.map(async entry => {
                        await feedBigBrother(entry.id, entry.type, 1.0);
                        current++;
                    }));
                    btnNourrir.textContent = window.I18n ? window.I18n.get('search.bb_digesting', { current, total }) : `Big Brother digère... ${current}/${total}`;
                    await new Promise(r => setTimeout(r, 250));
                }

                isNourrishing = false;
                btnNourrir.textContent = nourrirAbort
                    ? (window.I18n ? window.I18n.get('search.feed_big_brother') : '👁️ Nourrir Big Brother')
                    : (window.I18n ? window.I18n.get('search.bb_full') : '✨ Big Brother est rassasié !');
                setTimeout(() => {
                    btnNourrir.textContent = window.I18n ? window.I18n.get('search.feed_big_brother') : '👁️ Nourrir Big Brother';
                    loadRecommendations();
                }, 1500);
            });

            headerContainer.appendChild(header);
            headerContainer.appendChild(btnNourrir);
            searchResults.appendChild(headerContainer);

            finalResults.forEach(item => {
                searchResults.appendChild(createPosterCard(item, true));
            });
        } catch (e) {
            console.error('Recommendation engine error:', e);
            searchResults.innerHTML = `<div class='empty-state'><div class='empty-icon'>⭐</div><h3>${escapeHtml(window.I18n ? window.I18n.get('search.not_enough_data') : 'Pas encore assez de données')}</h3><p>${escapeHtml(window.I18n ? window.I18n.get('search.not_enough_data_desc') : "Notez ou ajoutez quelques films/séries pour débloquer l'algorithme de recommandation !")}</p></div>`;
        }
    }

    async function doSearch(query, useFilters = false) {
        if (!searchResults) return;
        const reqId = ++_searchReqId;
        searchResults.innerHTML = Array(6).fill('<div class="skeleton-grid-item skeleton"></div>').join('');

        let results = [];
        if (useFilters) {
            const genre = document.getElementById('filter-genre')?.value || '';
            const year = document.getElementById('filter-year')?.value || '';
            const sort = document.getElementById('filter-sort')?.value || 'popularity.desc';

            let type = currentSearchType === 'tv' ? 'tv' : 'movie';
            if (currentSearchType === 'multi' || currentSearchType === 'foryou') {
                document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.searchType === 'movie'));
                currentSearchType = 'movie';
                const moodContainer = document.getElementById('bb-mood-container');
                if (moodContainer) moodContainer.style.display = 'none';
                type = 'movie';
            }
            results = await TMDB.discover(type, { genre, year, sort });
        } else {
            results = await TMDB.search(query, currentSearchType);
        }

        if (reqId !== _searchReqId) return;
        if (!results.length) {
            searchResults.innerHTML = `<div class="empty-state"><p>${escapeHtml(window.I18n && window.I18n.lang === 'en' ? 'No results.' : 'Aucun résultat.')}</p></div>`;
            return;
        }
        searchResults.innerHTML = '';
        results.forEach(item => {
            searchResults.appendChild(createPosterCard(item));
        });
    }

    function createPosterCard(item, isRecommendation = false) {
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        const title = item.name || item.title || 'Sans titre';
        const safeTitle = escapeHtml(title);
        const year = escapeHtml((item.first_air_date || item.release_date || '').split('-')[0]);
        const posterUrl = TMDB.imgUrl(item.poster_path, 'w342');

        const div = document.createElement('div');
        div.className = 'poster-card';
        div.tabIndex = 0;
        div.setAttribute('role', 'button');
        div.setAttribute('aria-label', `${title}${year ? ' (' + year + ')' : ''}`);
        div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                div.click();
            }
        });
        div.innerHTML = posterUrl
            ? `<img src="${posterUrl}" alt="${safeTitle}" loading="lazy"><div class="poster-overlay"><div>${safeTitle}</div><div class="poster-year">${year}</div></div>`
            : `<div class="poster-placeholder">${safeTitle}</div>`;

        if (isRecommendation) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'recommendation-actions';
            actionsDiv.innerHTML = `
                <button class="thumb-btn thumb-down" title="${escapeHtml(window.I18n ? window.I18n.get('search.thumb_down') : 'Ne plus me recommander')}" aria-label="Ne plus recommander">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                </button>
                <button class="thumb-btn quick-add-btn" title="${escapeHtml(window.I18n ? window.I18n.get('search.quick_add') : 'Ajout rapide')}" aria-label="Ajout rapide">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <button class="thumb-btn thumb-up" title="${escapeHtml(window.I18n ? window.I18n.get('search.thumb_up') : "J'aime ce genre")}" aria-label="Aimer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4.33A2.31 2.31 0 0 1 2 20V13a2.31 2.31 0 0 1 2.33-2H7"></path></svg>
                </button>
            `;

            const extractMeta = async () => {
                let keywords = []; let directors = []; let actors = [];
                try {
                    const details = mediaType === 'tv' ? await TMDB.getShowDetails(item.id) : await TMDB.getMovieDetails(item.id);
                    if (details) {
                        const kwSrc = details.keywords?.results || details.keywords?.keywords || [];
                        keywords = kwSrc.map(k => ({ id: k.id, name: k.name }));
                        if (details.created_by) {
                            directors.push(...details.created_by.map(c => ({ id: c.id, name: c.name })));
                        }
                        if (details.credits) {
                            if (details.credits.crew) {
                                directors.push(...details.credits.crew.filter(c => c.job === 'Director').map(c => ({ id: c.id, name: c.name })));
                            }
                            if (details.credits.cast) {
                                actors = details.credits.cast.slice(0, 3).map(c => ({ id: c.id, name: c.name }));
                            }
                        }
                    }
                } catch (err) {}
                return { keywords, directors, actors };
            };

            actionsDiv.querySelector('.thumb-down').addEventListener('click', async (e) => {
                e.stopPropagation();
                (async () => {
                    const { keywords, directors, actors } = await extractMeta();
                    await db.recommendation_feedback.put({
                        tmdb_id: item.id, type: mediaType, feedback_value: -1,
                        title, genre_ids: item.genre_ids || [],
                        keywords, directors, actors, timestamp: Date.now()
                    });
                })();
                div.style.transition = 'opacity 0.3s, transform 0.3s';
                div.style.opacity = '0';
                div.style.transform = 'scale(0.8)';
                setTimeout(() => div.remove(), 300);
            });

            actionsDiv.querySelector('.quick-add-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                const btn = e.currentTarget;
                try {
                    if (mediaType === 'tv') {
                        const existing = await db.shows.where('tmdb_id').equals(item.id).first();
                        if (!existing) {
                            await db.shows.add({
                                tvtime_id: '', tmdb_id: item.id, name: title,
                                poster_path: item.poster_path || '', backdrop_path: item.backdrop_path || '',
                                status: 'following', is_followed: 1, is_favorited: 0, user_rating: 0, type: 'tv',
                                genre_ids: item.genre_ids || [], origin_country: item.origin_country || []
                            });
                            showToast(window.I18n ? window.I18n.get('search.added_to_series') : `${safeTitle} ajouté à vos séries`);
                        } else {
                            showToast(window.I18n ? window.I18n.get('search.already_in_library') : 'Déjà dans votre bibliothèque');
                        }
                    } else {
                        const existing = await db.movies.where('tmdb_id').equals(item.id).first();
                        if (!existing) {
                            await db.movies.add({
                                uuid: randomUuid('tmdb_' + item.id), tmdb_id: item.id, name: title,
                                poster_path: item.poster_path || '', backdrop_path: item.backdrop_path || '',
                                status: 'watchlist', release_date: item.release_date || null,
                                runtime: item.runtime || 0, is_favorited: 0, user_rating: 0,
                                genre_ids: item.genre_ids || []
                            });
                            showToast(window.I18n ? window.I18n.get('search.added_to_list') : `${safeTitle} ajouté à votre liste`);
                        } else {
                            showToast(window.I18n ? window.I18n.get('search.already_in_library') : 'Déjà dans votre bibliothèque');
                        }
                    }
                    btn.classList.add('added');
                    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    if (typeof feedBigBrother === 'function') feedBigBrother(item.id, mediaType, 2.0);
                } catch (err) {
                    console.error('Quick add error:', err);
                }
            });

            actionsDiv.querySelector('.thumb-up').addEventListener('click', async (e) => {
                e.stopPropagation();
                const btn = e.currentTarget;
                btn.classList.add('liked');
                (async () => {
                    const { keywords, directors, actors } = await extractMeta();
                    await db.recommendation_feedback.put({
                        tmdb_id: item.id, type: mediaType, feedback_value: 1,
                        title, genre_ids: item.genre_ids || [],
                        keywords, directors, actors, timestamp: Date.now()
                    });
                })();
                if (typeof feedBigBrother === 'function') feedBigBrother(item.id, mediaType, 3.0);
            });

            div.appendChild(actionsDiv);
        }

        div.addEventListener('click', () => openDetail(item, mediaType));
        return div;
    }

    // ---- TMDB Fix Modal ----
    const tmdbFixInput = document.getElementById('tmdb-fix-input');
    const tmdbFixResults = document.getElementById('tmdb-fix-results');
    const btnTmdbFixSearch = document.getElementById('btn-tmdb-fix-search');
    const btnTmdbFixCancel = document.getElementById('btn-tmdb-fix-cancel');

    let tmdbFixResolve = null;
    let tmdbFixMediaType = 'tv';

    document.addEventListener('modal_closed_tmdb-fix-modal', () => {
        if (tmdbFixResolve) {
            const res = tmdbFixResolve;
            tmdbFixResolve = null;
            res(null);
        }
    });

    if (btnTmdbFixCancel) {
        btnTmdbFixCancel.addEventListener('click', () => {
            window.closeOverlay('tmdb-fix-modal');
        });
    }

    if (btnTmdbFixSearch) {
        btnTmdbFixSearch.addEventListener('click', async () => {
            const q = tmdbFixInput ? tmdbFixInput.value.trim() : '';
            if (q.length < 2 || !tmdbFixResults) return;

            tmdbFixResults.innerHTML = `<div style="padding:12px; color:var(--text-muted);">${escapeHtml(window.I18n ? window.I18n.get('search.searching') : 'Recherche en cours...')}</div>`;
            const results = await TMDB.search(q, tmdbFixMediaType);

            if (!results || results.length === 0) {
                tmdbFixResults.innerHTML = `<div style="padding:12px; color:var(--text-muted);">${escapeHtml(window.I18n && window.I18n.lang === 'en' ? 'No results found.' : 'Aucun résultat trouvé.')}</div>`;
                return;
            }

            tmdbFixResults.innerHTML = '';
            results.forEach(item => {
                const title = item.name || item.title || 'Sans titre';
                const year = (item.first_air_date || item.release_date || '').split('-')[0];
                const posterUrl = TMDB.imgUrl(item.poster_path, 'w92');

                const div = document.createElement('div');
                div.className = 'modal-result-item';
                div.tabIndex = 0;
                div.setAttribute('role', 'button');
                div.innerHTML = `
                    ${posterUrl ? `<img src="${posterUrl}" class="modal-result-img" alt="">` : `<div class="modal-result-img" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;">?</div>`}
                    <div class="modal-result-info">
                        <div class="modal-result-title">${escapeHtml(title)}</div>
                        <div class="modal-result-meta">${escapeHtml(year)}</div>
                    </div>
                `;
                const selectItem = () => {
                    const res = tmdbFixResolve;
                    tmdbFixResolve = null;
                    window.closeOverlay('tmdb-fix-modal');
                    if (res) res(item);
                };
                div.addEventListener('click', selectItem);
                div.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        selectItem();
                    }
                });
                tmdbFixResults.appendChild(div);
            });
        });

        tmdbFixInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnTmdbFixSearch.click();
        });
    }

    function openTmdbFixModal(initialName, mediaType) {
        return new Promise(resolve => {
            tmdbFixResolve = resolve;
            tmdbFixMediaType = mediaType;
            if (tmdbFixInput) tmdbFixInput.value = initialName || '';
            if (tmdbFixResults) tmdbFixResults.innerHTML = '';
            window.openOverlay('tmdb-fix-modal');
            tmdbFixInput?.focus();
            if (initialName && btnTmdbFixSearch) {
                btnTmdbFixSearch.click();
            }
        });
    }

    // ---- Detail Overlay ----
    const detailOverlay = document.getElementById('show-detail-overlay');
    const detailBackdrop = document.getElementById('detail-backdrop');
    const detailBody = document.getElementById('detail-body');
    document.getElementById('detail-back')?.addEventListener('click', closeDetail);

    let _detailReqId = 0;

    function closeDetail() {
        window.closeOverlay('show-detail-overlay');
    }

    async function openDetail(item, mediaType, opts = {}) {
        const reqId = ++_detailReqId;
        window.openOverlay('show-detail-overlay');
        if (detailOverlay) {
            detailOverlay.classList.add('slide-in');
            detailOverlay.scrollTop = 0;
        }

        const tmdbId = item.id;
        if (!opts.isTutorial && typeof feedBigBrother === 'function') {
            feedBigBrother(tmdbId, mediaType, 0.5);
        }

        const bdUrl = TMDB.backdropUrl(item.backdrop_path || item.poster_path);
        if (detailBackdrop) {
            detailBackdrop.style.backgroundImage = bdUrl ? `url("${bdUrl.replace(/"/g, '%22')}")` : 'linear-gradient(135deg, #1a1a2e, #16213e)';
        }
        if (detailBody) {
            detailBody.innerHTML = `
                <div class="detail-loading-skeleton">
                    <div class="skeleton" style="width:160px; height:240px; border-radius:12px;"></div>
                    <div style="flex:1; display:flex; flex-direction:column; gap:12px;">
                        <div class="skeleton" style="width:60%; height:32px; border-radius:8px;"></div>
                        <div class="skeleton" style="width:40%; height:18px; border-radius:6px;"></div>
                        <div class="skeleton" style="width:90%; height:80px; border-radius:8px;"></div>
                    </div>
                </div>`;
        }

        const details = mediaType === 'tv'
            ? await TMDB.getShowDetails(tmdbId)
            : await TMDB.getMovieDetails(tmdbId);

        if (reqId !== _detailReqId) return;
        const resolved = details || item;
        if (resolved.backdrop_path && detailBackdrop) {
            const fullBd = TMDB.backdropUrl(resolved.backdrop_path);
            if (fullBd) detailBackdrop.style.backgroundImage = `url("${fullBd.replace(/"/g, '%22')}")`;
        }
        if (mediaType === 'tv') {
            renderShowDetail(resolved);
        } else {
            renderMovieDetail(resolved);
        }
    }

    function buildAgeRatingHTML(item, mediaType) {
        let cert = '';
        let descriptors = [];
        
        if (mediaType === 'tv' && item.content_ratings && item.content_ratings.results) {
            const results = item.content_ratings.results;
            const fr = results.find(r => r.iso_3166_1 === 'FR');
            const us = results.find(r => r.iso_3166_1 === 'US');
            const target = fr || us || results[0];
            if (target) {
                cert = target.rating;
                if (target.descriptors) descriptors = target.descriptors;
            }
        } else if (mediaType === 'movie' && item.release_dates && item.release_dates.results) {
            const results = item.release_dates.results;
            const fr = results.find(r => r.iso_3166_1 === 'FR');
            const us = results.find(r => r.iso_3166_1 === 'US');
            const target = fr || us || results[0];
            if (target && Array.isArray(target.release_dates)) {
                const rated = target.release_dates.find(rd => rd.certification && rd.certification.trim());
                if (rated) {
                    cert = rated.certification.trim();
                    if (rated.descriptors) descriptors = rated.descriptors;
                }
            }
        }
        
        if (!cert && !item.adult) return '';
        if (!cert && item.adult) cert = '18';

        // Map to PEGI
        let pegiNum = '3';
        const c = cert.toLowerCase();
        if (c.includes('18') || c === 'r' || c === 'nc-17' || c === 'tv-ma') pegiNum = '18';
        else if (c.includes('16') || c === '15') pegiNum = '16';
        else if (c.includes('12') || c.includes('13') || c === 'tv-14' || c === 'pg-13') pegiNum = '12';
        else if (c.includes('7') || c.includes('10') || c === 'tv-pg' || c === 'pg') pegiNum = '7';
        
        // Descriptor logic: try to find keywords in genres if empty
        if (descriptors.length === 0 && item.genres) {
            const gIds = item.genres.map(g => g.id);
            if (gIds.includes(27) || gIds.includes(53) || gIds.includes(9648)) descriptors.push('fear');
            if (gIds.includes(28) || gIds.includes(80) || gIds.includes(10752)) descriptors.push('violence');
            if (pegiNum === '18' || pegiNum === '16') {
                if (gIds.includes(10749)) descriptors.push('sexual-content');
            }
        }
        
        // Map string array to pegi icons
        const descIcons = [];
        const dstr = descriptors.join(' ').toLowerCase();
        if (dstr.includes('fear') || dstr.includes('fright') || dstr.includes('peur')) descIcons.push('fear.png');
        if (dstr.includes('violenc') || dstr.includes('blood') || dstr.includes('action')) descIcons.push('violence.png');
        if (dstr.includes('sex') || dstr.includes('nudity')) descIcons.push('sexual-content.png');
        if (dstr.includes('language') || dstr.includes('swear') || dstr.includes('grossièreté')) descIcons.push('bad-language.png');
        if (dstr.includes('drug') || dstr.includes('substance') || dstr.includes('drogue')) descIcons.push('drugs.png');
        if (dstr.includes('discrimin') || dstr.includes('hate')) descIcons.push('discrimination.png');
        
        // HTML building
        let html = `<div style="display:flex; align-items:flex-start; gap:12px; margin-top:8px; margin-bottom:8px;">`;
        html += `<div style="display:flex; flex-direction:column; align-items:center;">
                    <img src="PEGI/PEGI_${pegiNum}.png" alt="PEGI ${pegiNum}" style="height:32px; width:auto; border-radius:4px; box-shadow:0 2px 4px rgba(0,0,0,0.5);">
                    <span style="font-size:10px; color:var(--text-muted); margin-top:4px; font-weight:600;">${escapeHtml(cert)}</span>
                 </div>`;
        if (descIcons.length > 0) {
            html += `<div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:2px;">`;
            [...new Set(descIcons)].slice(0, 3).forEach(icon => {
                html += `<img src="PEGI/${icon}" alt="Descriptor" style="height:24px; width:auto; border-radius:3px; box-shadow:0 1px 3px rgba(0,0,0,0.5);">`;
            });
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }

    function buildProvidersHTML(item) {
        if (!item || !item['watch/providers'] || !item['watch/providers'].results) return '';
        const savedCountry = localStorage.getItem('dfwatch_country');
        const country = savedCountry || ((window.I18n && window.I18n.lang === 'en') ? 'US' : 'FR');
        let providers = item['watch/providers'].results[country] || item['watch/providers'].results['US'];
        if (!providers && Object.keys(item['watch/providers'].results).length > 0) {
            providers = Object.values(item['watch/providers'].results)[0];
        }
        if (!providers || (!providers.flatrate && !providers.rent && !providers.buy)) return '';
        
        let html = '<div class="detail-providers" style="margin-top:16px; margin-bottom:16px; display:flex; flex-direction:row; flex-wrap:wrap; gap:24px;">';
        
        const renderCategory = (list, titleKey, defaultTitle) => {
            if (!list || list.length === 0) return '';
            
            const uniqueProviders = [];
            const seen = new Set();
            list.forEach(p => {
                if (!seen.has(p.provider_id)) {
                    seen.add(p.provider_id);
                    uniqueProviders.push(p);
                }
            });

            let catHtml = '<div>';
            catHtml += `<div style="font-size:12px; font-weight:600; margin-bottom:8px; color:var(--text-secondary);">${escapeHtml(window.I18n ? window.I18n.get(titleKey) || defaultTitle : defaultTitle)}</div>`;
            catHtml += '<div style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-start;">';
            
            uniqueProviders.forEach(p => {
                const logo = p.logo_path ? TMDB.imgUrl(p.logo_path, 'w154') : '';
                const safePName = escapeHtml(p.provider_name || '');
                const safeLink = providers.link ? escapeHtml(providers.link) : '';
                const linkTag = safeLink ? `<a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; display:flex; flex-direction:column; align-items:center; gap:4px; text-align:center; color:inherit;">` : `<div style="display:flex; flex-direction:column; align-items:center; gap:4px; text-align:center;">`;
                const closeTag = safeLink ? `</a>` : `</div>`;
                
                catHtml += linkTag;
                if (logo) {
                    catHtml += `<img src="${logo}" alt="${safePName}" style="width:40px; height:40px; border-radius:10px; object-fit:cover; box-shadow:0 2px 8px rgba(0,0,0,0.3); border:1px solid var(--border-subtle);">`;
                } else {
                    catHtml += `<div style="width:40px; height:40px; border-radius:10px; background:var(--surface-2); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; border:1px solid var(--border-subtle);">${escapeHtml((p.provider_name || '').substring(0, 3))}</div>`;
                }
                catHtml += `<span style="font-size:10px; color:var(--text-secondary); max-width:60px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${safePName}">${safePName}</span>`;
                catHtml += closeTag;
            });
            catHtml += '</div></div>';
            return catHtml;
        };
        
        html += renderCategory(providers.flatrate, 'detail.available_on', 'En Streaming');
        html += renderCategory(providers.rent, 'detail.rent_on', 'En Location');
        html += renderCategory(providers.buy, 'detail.buy_on', "À l'Achat");

        html += '</div>';
        return html;
    }

    // ---- Shared Detail Helpers (Cast, Trailer, NLP, Person Filmography) ----
    function buildCastHTML(credits) {
        if (!credits || !Array.isArray(credits.cast) || credits.cast.length === 0) return '';
        const cast = credits.cast.slice(0, 12);
        const heading = (window.I18n && window.I18n.lang === 'en') ? 'Top Cast' : 'Têtes d\'affiche';
        let html = `<div class="detail-section"><h3>${heading}</h3><div class="horizontal-scroll cast-scroll">`;
        cast.forEach(c => {
            const img = c.profile_path ? TMDB.imgUrl(c.profile_path, 'w185') : '';
            const safeName = escapeHtml(c.name || '');
            const safeChar = escapeHtml(c.character || '');
            const dept = c.known_for_department && c.known_for_department !== 'Acting'
                ? `<div class="cast-dept">${escapeHtml(c.known_for_department)}</div>` : '';
            html += `
                <div class="cast-card" data-person-id="${c.id || ''}" role="button" tabindex="0" aria-label="${safeName}">
                    ${img ? `<img src="${img}" alt="${safeName}" loading="lazy">` : `<div class="cast-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`}
                    <div class="cast-name">${safeName}</div>
                    <div class="cast-char">${safeChar}${dept}</div>
                </div>`;
        });
        html += '</div></div>';
        return html;
    }

    function buildTrailerHTML(videos) {
        if (!videos || !Array.isArray(videos.results) || videos.results.length === 0) return '';
        const trailer = videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube' && isValidYoutubeId(v.key))
                     || videos.results.find(v => v.site === 'YouTube' && isValidYoutubeId(v.key));
        if (!trailer) return '';
        const trailerTitle = escapeHtml(window.I18n ? window.I18n.get('detail.trailer') : 'Bande-annonce');
        const playLabel = escapeHtml(window.I18n ? window.I18n.get('detail.play_trailer') : 'Lire la bande-annonce');
        const safeKey = encodeURIComponent(trailer.key);
        return `<div class="detail-section"><h3>${trailerTitle}</h3><div class="trailer-container trailer-lite" data-yt-id="${safeKey}"><img src="https://i.ytimg.com/vi/${safeKey}/hqdefault.jpg" alt="${trailerTitle}" loading="lazy"><button type="button" class="trailer-play-btn" aria-label="${playLabel}"><svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z" fill="#f00"></path><path d="M45 24L27 14v20" fill="#fff"></path></svg></button></div></div>`;
    }

    async function openPersonModal(personId) {
        if (!personId || !TMDB.getPersonDetails) return;
        let modal = document.getElementById('person-modal');
        if (!modal) return;
        const body = document.getElementById('person-modal-body');
        const titleEl = document.getElementById('person-modal-title');
        if (titleEl) titleEl.textContent = (window.I18n && window.I18n.get('detail.filmography')) || 'Filmographie';
        if (body) body.innerHTML = '<div style="text-align:center; padding:32px; color:var(--text-muted);">⏳ Chargement...</div>';
        window.openOverlay('person-modal');

        try {
            const person = await TMDB.getPersonDetails(personId);
            if (!person || !body) {
                if (body) body.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Impossible de charger ce profil.</p>';
                return;
            }
            if (titleEl) titleEl.textContent = person.name || 'Filmographie';
            const img = person.profile_path ? TMDB.imgUrl(person.profile_path, 'w185') : '';
            const rawCredits = [
                ...((person.combined_credits && person.combined_credits.cast) || []),
                ...((person.combined_credits && person.combined_credits.crew) || []).filter(c => c.job === 'Director' || c.job === 'Creator')
            ];
            const dedup = new Map();
            rawCredits.forEach(c => {
                if (!c || !c.id || (c.media_type !== 'movie' && c.media_type !== 'tv')) return;
                const k = `${c.media_type}_${c.id}`;
                if (!dedup.has(k)) dedup.set(k, c);
            });
            const credits = Array.from(dedup.values())
                .filter(c => c.poster_path)
                .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
                .slice(0, 16);

            const bio = person.biography ? `<p class="person-bio">${escapeHtml(person.biography.slice(0, 400))}${person.biography.length > 400 ? '…' : ''}</p>` : '';
            const creditsHtml = credits.map(c => {
                const cTitle = escapeHtml(c.title || c.name || '');
                const year = ((c.release_date || c.first_air_date || '') + '').split('-')[0];
                const role = escapeHtml(c.character || c.job || '');
                return `<div class="person-credit-card" data-tmdb-id="${c.id}" data-type="${c.media_type}" role="button" tabindex="0">
                    <img src="${TMDB.imgUrl(c.poster_path, 'w185')}" alt="${cTitle}" loading="lazy">
                    <div class="person-credit-title">${cTitle}${year ? ` (${escapeHtml(year)})` : ''}</div>
                    ${role ? `<div class="person-credit-role">${role}</div>` : ''}
                </div>`;
            }).join('');

            body.innerHTML = `
                <div class="person-header">
                    ${img ? `<img src="${img}" alt="${escapeHtml(person.name || '')}" class="person-avatar">` : ''}
                    <div>
                        <h3 style="margin:0 0 4px;">${escapeHtml(person.name || '')}</h3>
                        ${person.known_for_department ? `<div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${escapeHtml(person.known_for_department)}</div>` : ''}
                        ${bio}
                    </div>
                </div>
                <div class="person-credits-grid">${creditsHtml || '<p style="color:var(--text-muted);">Aucun crédit disponible.</p>'}</div>
            `;

            body.querySelectorAll('.person-credit-card').forEach(el => {
                const openCredit = async () => {
                    const id = parseInt(el.dataset.tmdbId, 10);
                    const type = el.dataset.type || 'movie';
                    const details = type === 'tv' ? await TMDB.getShowDetails(id) : await TMDB.getMovieDetails(id);
                    if (details) {
                        window.closeOverlay('person-modal');
                        openDetail(details, type);
                    }
                };
                el.addEventListener('click', openCredit);
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCredit(); }
                });
            });
        } catch (e) {
            if (body) body.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Erreur de chargement.</p>';
        }
    }

    function bindCastPersonHandlers(container) {
        if (!container) return;
        container.querySelectorAll('[data-person-id]').forEach(el => {
            const pid = parseInt(el.dataset.personId, 10);
            if (!pid) return;
            const handler = (e) => {
                e.stopPropagation();
                openPersonModal(pid);
            };
            el.addEventListener('click', handler);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(e); }
            });
        });
    }

    function runDetailNlpAnalysis(item, mediaType, isAlreadyWatched, creatorStr) {
        if (!window.BBNLP || typeof _bigBrotherEngine === 'undefined') return;
        const reqIdSnapshot = _detailReqId;
        setTimeout(async () => {
            if (_detailReqId !== reqIdSnapshot) return;
            try {
                const currentLang = (window.I18n && window.I18n.lang) || 'fr';
                const affinities = await _bigBrotherEngine.buildProfile(_bigBrotherAdapter);
                if (_detailReqId !== reqIdSnapshot) return;
                let matchPct = 50;
                const reasons = [];
                const evidence = { totalWatches: affinities.totalWatches || 0 };

                if (affinities.genre) {
                    let bestGenre = null;
                    let maxGenreScore = 0;
                    (item.genres || []).forEach(g => {
                        if ((affinities.genre[g.id] || 0) > maxGenreScore) {
                            maxGenreScore = affinities.genre[g.id];
                            bestGenre = g.name;
                        }
                    });
                    if (maxGenreScore > 2) {
                        matchPct = 88;
                        reasons.push({ code: 'genre_match', strength: 0.9, detail: { type: bestGenre, watchCount: maxGenreScore, avgRating: 4.5 } });
                    } else if (maxGenreScore > 0) {
                        matchPct = 70;
                        reasons.push({ code: 'genre_match', strength: 0.6, detail: { type: bestGenre, watchCount: maxGenreScore, avgRating: 3.5 } });
                    } else {
                        matchPct = 35;
                        const fallbackGenre = currentLang === 'en' ? 'this genre' : 'ce genre';
                        reasons.push({ code: 'genre_mismatch', strength: 0.9, detail: { type: (item.genres && item.genres[0]) ? item.genres[0].name : fallbackGenre } });
                    }
                }
                if ((item.vote_average || 0) > 8) {
                    reasons.push({ code: 'community', strength: 0.9, detail: { rating: item.vote_average, count: item.vote_count } });
                }

                const itemCopy = { ...item, creator: creatorStr || '' };
                const nlpText = await BBNLP.generateExplanation(
                    itemCopy,
                    { percentage: matchPct, total_watches: evidence.totalWatches, reasons, evidence },
                    'bigbrother',
                    currentLang,
                    Boolean(isAlreadyWatched)
                );
                if (_detailReqId !== reqIdSnapshot) return;
                const nlpContainer = document.getElementById('detail-nlp-analysis');
                const nlpEl = document.getElementById('detail-nlp-text');
                if (nlpContainer && nlpEl && nlpText) {
                    nlpEl.textContent = nlpText;
                    nlpContainer.style.display = 'block';
                }
            } catch (e) { console.error("NLP Error:", e); }
        }, 150);
    }

    async function renderShowDetail(show) {
        const currentLangCode = (window.I18n && window.I18n.lang) || 'fr';
        const localeCode = currentLangCode === 'en' ? 'en-US' : 'fr-FR';
        const title = show.name || 'Sans titre';
        const overview = show.overview || (window.I18n ? window.I18n.get('detail.no_overview') : 'Pas de description disponible.');
        const year = (show.first_air_date || '').split('-')[0];
        const genres = (show.genres || []).map(g => g.name).join(', ');
        const episodeCount = show.number_of_episodes || '?';
        const posterUrl = show.poster_path ? TMDB.imgUrl(show.poster_path, 'w500') : '';
        const rating = show.vote_average ? (show.vote_average * 10).toFixed(0) + '%' : '';
        const creator = (show.created_by && show.created_by.length > 0)
            ? new Intl.ListFormat(currentLangCode, { style: 'long', type: 'conjunction' }).format(show.created_by.map(c => c.name))
            : '';
        const creatorLinksHTML = (show.created_by && show.created_by.length > 0)
            ? show.created_by.map(c => `<button type="button" class="cast-person-link" data-person-id="${c.id || ''}">${escapeHtml(c.name || '')}</button>`).join(', ')
            : '';
        const ageRatingHTML = buildAgeRatingHTML(show, 'tv');
        const providersHTML = buildProvidersHTML(show);

        const castHTML = buildCastHTML(show.credits);
        const trailerHTML = buildTrailerHTML(show.videos);

        const existing = await db.shows.where('tmdb_id').equals(show.id).first();
        const isFollowed = existing ? existing.is_followed : 0;
        const isFavorited = existing && existing.is_favorited === 1;
        const isFinished = existing && existing.is_finished === 1;
        const userRating = existing ? existing.user_rating || 0 : 0;

        // Get watch history for this show
        let history = [];
        if (existing && existing.tvtime_id) {
            history = await db.watch_history.where('show_tvtime_id').equals(String(existing.tvtime_id)).toArray();
        }
        if (history.length === 0) {
            history = await db.watch_history.where('show_name').equals(title).toArray();
        }
        const watchedEpisodes = new Set(history.map(h => `S${h.season_number}E${h.episode_number}`));

        const seasons = show.seasons || [];
        const regularSeasons = seasons.filter(s => s.season_number > 0);
        const bonusSeasons = seasons.filter(s => s.season_number === 0);
        const sortedSeasons = [...regularSeasons, ...bonusSeasons];

        let seasonsHTML = '';
        const seasonDataMap = {};
        const noteMap = {};
        let hasPersonalNotes = false;

        // Fetch personal notes indexed or scoped cleanly
        const showNotes = await db.episode_notes.where('show_id').equals(String(show.id)).toArray().catch(() => []);
        const fallbackNotes = showNotes.length > 0 ? showNotes : (await db.episode_notes.toArray()).filter(n => String(n.show_id) === String(show.id));
        fallbackNotes.forEach(n => {
            noteMap[`S${n.season_num}E${n.ep_num}`] = { rating: n.rating || 0, note: n.note || '' };
            if (n.rating > 0) hasPersonalNotes = true;
        });

        // Fetch all season details in parallel
        const seasonsDataArray = await Promise.all(
            sortedSeasons.map(s => TMDB.getSeasonDetails(show.id, s.season_number))
        );

        sortedSeasons.forEach((season, sIdx) => {
            const isBonus = season.season_number === 0;
            const seasonTitle = isBonus ? (window.I18n ? window.I18n.get('detail.bonus_season') : 'Bonus (Specials)') : (window.I18n ? window.I18n.get('detail.season_title', {number: season.season_number}) : `Saison ${season.season_number}`);
            const seasonData = seasonsDataArray[sIdx];
            const episodes = seasonData ? seasonData.episodes || [] : [];
            seasonDataMap[season.season_number] = episodes;
            const watchedInSeason = episodes.filter(ep => watchedEpisodes.has(`S${season.season_number}E${ep.episode_number}`)).length;

            let epsHTML = '';
            episodes.forEach(ep => {
                const key = `S${season.season_number}E${ep.episode_number}`;
                const checked = watchedEpisodes.has(key);
                let rewatchCount = 0;
                if (checked) {
                    const h = history.find(r => r.season_number === season.season_number && r.episode_number === ep.episode_number);
                    rewatchCount = h ? (h.rewatch_count || 0) : 0;
                }
                const rewatchBadge = rewatchCount > 0 ? `<span class="rewatch-badge" style="background:var(--iris-600); color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; margin-left:6px;">x${rewatchCount + 1}</span>` : '';
                const parsedAirDate = ep.air_date ? parseLocalDate(ep.air_date) : null;
                const airDateStr = (parsedAirDate && !isNaN(parsedAirDate.getTime())) ? parsedAirDate.toLocaleDateString(localeCode, { day:'numeric', month:'short', year:'numeric' }) : '';
                const epOverview = ep.overview ? `<div class="ep-overview">${escapeHtml(ep.overview)}</div>` : '';
                const runtimeStr = ep.runtime ? `${ep.runtime} min` : '';
                const epMetaParts = [airDateStr, runtimeStr].filter(Boolean).join(' · ');
                const epTitleDefault = ep.name || (currentLangCode === 'en' ? `Episode ${ep.episode_number}` : `Épisode ${ep.episode_number}`);
                const hasNote = noteMap[key] && (noteMap[key].rating > 0 || (noteMap[key].note && noteMap[key].note.trim().length > 0));

                epsHTML += `
                    <div class="season-ep-row ${!checked ? 'unseen' : ''}">
                        <span class="ep-num">${ep.episode_number}</span>
                        <div class="ep-details-col">
                            <span class="ep-name">${escapeHtml(epTitleDefault)} ${rewatchBadge}</span>
                            ${epMetaParts ? `<span class="ep-air-date">${escapeHtml(epMetaParts)}</span>` : ''}
                            ${epOverview}
                        </div>
                        <div style="display:flex; gap:0.5rem; align-items:center; flex-shrink:0;">
                            ${checked ? `<div class="ep-rewatch-sm" data-show="${escapeHtml(title)}" data-tvtime="${escapeHtml(existing ? (existing.tvtime_id || '') : '')}" data-season="${season.season_number}" data-ep="${ep.episode_number}" data-runtime="${ep.runtime || 0}" style="cursor:pointer; color:var(--text-muted); font-size:16px;" title="Revoir" role="button" tabindex="0">↻</div>` : ''}
                            <div class="ep-note-sm ${hasNote ? 'has-note' : ''}" data-show-id="${show.id}" data-season="${season.season_number}" data-ep="${ep.episode_number}" data-ep-name="${escapeHtml(epTitleDefault)}" style="cursor:pointer; font-size:16px; opacity:${hasNote ? '1' : '0.6'};" title="Note & Avis" role="button" tabindex="0">📝</div>
                            <div class="ep-check-sm ${checked ? 'checked' : ''}" data-show="${escapeHtml(title)}" data-tvtime="${escapeHtml(existing ? (existing.tvtime_id || '') : '')}" data-season="${season.season_number}" data-ep="${ep.episode_number}" data-tmdb-id="${show.id}" data-runtime="${ep.runtime || 0}" role="checkbox" aria-checked="${checked ? 'true' : 'false'}" tabindex="0">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                        </div>
                    </div>`;
            });

            seasonsHTML += `
                <div class="season-block">
                    <div class="season-header" data-season-id="s${season.season_number}" aria-expanded="false" role="button" tabindex="0">
                        <h3>${escapeHtml(seasonTitle)}</h3>
                        <div style="display:flex; gap:1rem; align-items:center;">
                            <span class="season-progress">${watchedInSeason}/${episodes.length}</span>
                            <button type="button" class="season-action-btn season-check-all" data-season="${season.season_number}" title="${escapeHtml(window.I18n ? window.I18n.get('detail.mark_all_seen') : 'Tout marquer comme vu')}" style="background:none; border:none; color:var(--text-primary); cursor:pointer;">✓</button>
                            <button type="button" class="season-action-btn season-rewatch-all" data-season="${season.season_number}" title="${escapeHtml(window.I18n ? window.I18n.get('detail.rewatch_all') : 'Tout revoir')}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">↻</button>
                        </div>
                    </div>
                    <div class="season-episodes" id="season-eps-s${season.season_number}">${epsHTML}</div>
                </div>`;
        });

        // Build heatmaps
        function getHeatmapColorClass(val) {
            if (!val || val === 0) return 'bg-empty';
            if (val >= 9.0) return 'bg-awesome';
            if (val >= 8.0) return 'bg-great';
            if (val >= 7.0) return 'bg-good';
            if (val >= 6.0) return 'bg-regular';
            if (val >= 5.0) return 'bg-bad';
            return 'bg-garbage';
        }

        const heatmapSeasons = regularSeasons;
        let maxEpCount = 0;
        heatmapSeasons.forEach(s => {
            const eps = seasonDataMap[s.season_number] || [];
            if (eps.length > maxEpCount) maxEpCount = eps.length;
        });

        let tmdbHeatmapHtml = '';
        let personalHeatmapHtml = '';

        if (heatmapSeasons.length > 0 && maxEpCount > 0) {
            const headerRow = `<tr><th></th>` + heatmapSeasons.map(s => `<th>S${s.season_number}</th>`).join('') + `</tr>`;
            let tmdbRows = '';
            let persRows = '';

            for (let e = 1; e <= maxEpCount; e++) {
                let tmdbCells = `<th>E${e}</th>`;
                let persCells = `<th>E${e}</th>`;

                heatmapSeasons.forEach(s => {
                    const eps = seasonDataMap[s.season_number] || [];
                    const epObj = eps.find(ep => ep.episode_number === e);

                    if (epObj) {
                        const tmdbVal = epObj.vote_average ? epObj.vote_average.toFixed(1) : '';
                        const tmdbClass = tmdbVal ? getHeatmapColorClass(parseFloat(tmdbVal)) : 'bg-empty';
                        tmdbCells += `<td class="heatmap-cell ${tmdbClass}">${tmdbVal || '-'}</td>`;

                        const persVal = noteMap[`S${s.season_number}E${e}`]?.rating || 0;
                        const persScaled = persVal * 2;
                        const persClass = persVal > 0 ? getHeatmapColorClass(persScaled) : 'bg-empty';
                        persCells += `<td class="heatmap-cell ${persClass}">${persVal ? persVal : '-'}</td>`;
                    } else {
                        tmdbCells += `<td class="heatmap-cell bg-empty"></td>`;
                        persCells += `<td class="heatmap-cell bg-empty"></td>`;
                    }
                });
                tmdbRows += `<tr>${tmdbCells}</tr>`;
                persRows += `<tr>${persCells}</tr>`;
            }

            const legendHtml = `
                <div class="heatmap-legend">
                    <div class="heatmap-legend-item"><div class="heatmap-legend-color bg-awesome"></div> Awesome</div>
                    <div class="heatmap-legend-item"><div class="heatmap-legend-color bg-great"></div> Great</div>
                    <div class="heatmap-legend-item"><div class="heatmap-legend-color bg-good"></div> Good</div>
                    <div class="heatmap-legend-item"><div class="heatmap-legend-color bg-regular"></div> Regular</div>
                    <div class="heatmap-legend-item"><div class="heatmap-legend-color bg-bad"></div> Bad</div>
                    <div class="heatmap-legend-item"><div class="heatmap-legend-color bg-garbage"></div> Garbage</div>
                </div>
            `;

            tmdbHeatmapHtml = `
                <div class="heatmap-section">
                    <div class="heatmap-header-flex">
                        <h3 style="margin:0; font-size:16px;">Notes TMDB</h3>
                        ${legendHtml}
                    </div>
                    <div class="heatmap-container">
                        <table class="heatmap-table">
                            ${headerRow}
                            ${tmdbRows}
                        </table>
                    </div>
                </div>
            `;

            if (hasPersonalNotes) {
                personalHeatmapHtml = `
                    <div class="heatmap-section" style="margin-top:0;">
                        <div class="heatmap-header-flex">
                            <h3 style="margin:0; font-size:16px;">Vos notes</h3>
                        </div>
                        <div class="heatmap-container">
                            <table class="heatmap-table">
                                ${headerRow}
                                ${persRows}
                            </table>
                        </div>
                    </div>
                `;
            }
        }

        const safeTitle = escapeHtml(title);
        detailBody.innerHTML = `
            <div class="detail-header-flex">
                ${posterUrl ? `<img src="${posterUrl}" class="detail-main-poster" alt="${safeTitle}">` : ''}
                <div class="detail-header-info">
                    <h1>${safeTitle}</h1>
                    ${ageRatingHTML}
                    <div class="detail-meta">${escapeHtml(year)} · ${escapeHtml(genres)} · ${episodeCount} épisodes</div>
                    ${rating ? `<div class="detail-rating"><div class="rating-badge">${escapeHtml(rating)}</div> Score d'évaluation</div>` : ''}
                    <div class="detail-actions">
                        <button type="button" class="detail-action-btn follow ${isFollowed ? 'active' : ''}" id="btn-follow-show" data-tmdb-id="${show.id}" data-title="${safeTitle}" data-poster="${escapeHtml(show.poster_path || '')}" data-backdrop="${escapeHtml(show.backdrop_path || '')}">
                            ${isFollowed ? '✓ Suivi' : '+ Suivre'}
                        </button>
                        <button type="button" class="detail-action-btn fav-btn ${isFavorited ? 'active' : ''}" id="btn-fav-show">
                            ${isFavorited ? '❤️ Favori' : '🤍 Favori'}
                        </button>
                        <button type="button" class="detail-action-btn list-btn" id="btn-add-to-list" data-tmdb-id="${show.id}" data-type="show">
                            📋 Liste
                        </button>
                        <button type="button" class="detail-action-btn finish-btn ${isFinished ? 'active' : ''}" id="btn-finish-show" data-tmdb-id="${show.id}" data-title="${safeTitle}">
                            ${isFinished ? (window.I18n ? window.I18n.get('detail.finished') : '🏁 Terminée') : (window.I18n ? window.I18n.get('detail.finish') : '🏁 Terminer')}
                        </button>
                    </div>
                    <div class="user-rating-widget" id="show-rating-widget">
                        <span style="font-size:12px; color:var(--text-muted); margin-right:8px;">Ma note:</span>
                        <div class="stars">
                            ${[1,2,3,4,5].map(i => `<span class="star ${i <= userRating ? 'active' : ''}" data-val="${i}" role="button" tabindex="0">★</span>`).join('')}
                        </div>
                    </div>
                    <p class="detail-overview">${escapeHtml(overview)}</p>
                    ${providersHTML}
                    ${creatorLinksHTML ? `<div class="detail-creator"><strong>Créateur :</strong> ${creatorLinksHTML}</div>` : ''}
                </div>
            </div>
            ${castHTML}
            ${trailerHTML}

            <div id="detail-nlp-analysis" class="detail-nlp-card" style="display:none;">
                <h4 style="margin:0 0 8px 0; font-size:15px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                    <span>🧠</span> Analyse BigBrother
                </h4>
                <p id="detail-nlp-text" style="margin:0; font-size:14px; color:var(--text-secondary); line-height:1.5;"></p>
            </div>

            ${tmdbHeatmapHtml}
            ${personalHeatmapHtml}

            <div class="detail-section" id="detail-tv-tracker">
                <h3>${window.I18n ? window.I18n.get('detail.seasons') : 'Saisons'}</h3>
                ${seasonsHTML}
            </div>
            <div class="detail-section" id="detail-similar-shows"></div>
            <div class="detail-section detail-footer-actions" style="margin-top: 2rem; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="action-btn secondary" id="btn-sync-show" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);" title="${escapeHtml(window.I18n ? window.I18n.get('action.tmdb_refresh') : 'Forcer la synchronisation des données depuis TMDB')}">${window.I18n ? window.I18n.get('action.tmdb_refresh') : '🔄 Actualiser les données'}</button>
                <button type="button" class="action-btn secondary" id="btn-share-show" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">${window.I18n ? window.I18n.get('action.share') : '📤 Partager'}</button>
                <button type="button" class="action-btn secondary" id="btn-fix-tmdb-tv" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">${window.I18n ? window.I18n.get('action.tmdb_fix') : 'Mauvaise identification TMDB ?'}</button>
            </div>
        `;

        bindCastPersonHandlers(detailBody);
        runDetailNlpAnalysis(show, 'tv', isFinished, creator);

        // Season accordion (keyboard accessible + aria-expanded)
        detailBody.querySelectorAll('.season-header').forEach(header => {
            const toggleAccordion = () => {
                const id = header.dataset.seasonId;
                const eps = document.getElementById(`season-eps-${id}`);
                if (eps) {
                    const isOpen = eps.classList.toggle('open');
                    header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                }
            };
            header.addEventListener('click', toggleAccordion);
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAccordion();
                }
            });
        });

        async function checkAutoFinishShow() {
            const existingShow = await db.shows.where('tmdb_id').equals(show.id).first();
            if (!existingShow) return;

            let showHist = [];
            if (existingShow.tvtime_id) {
                showHist = await db.watch_history.where('show_tvtime_id').equals(String(existingShow.tvtime_id)).toArray();
            }
            if (showHist.length === 0) {
                showHist = await db.watch_history.where('show_name').equals(title).toArray();
            }
            const watchedSet = new Set(showHist.map(h => `S${h.season_number}E${h.episode_number}`));

            let totalEps = 0;
            let doneEps = 0;
            for (const season of regularSeasons) {
                const episodes = seasonDataMap[season.season_number] || [];
                totalEps += episodes.length;
                doneEps += episodes.filter(ep => watchedSet.has(`S${season.season_number}E${ep.episode_number}`)).length;
            }

            if (totalEps > 0) {
                const shouldBeFinished = doneEps >= totalEps;
                if ((existingShow.is_finished === 1) !== shouldBeFinished) {
                    await db.shows.update(existingShow.id, { is_finished: shouldBeFinished ? 1 : 0 });
                    const finBtn = document.getElementById('btn-finish-show');
                    if (finBtn) {
                        finBtn.classList.toggle('active', shouldBeFinished);
                        finBtn.textContent = shouldBeFinished
                            ? (window.I18n ? window.I18n.get('detail.finished') : '🏁 Terminée')
                            : (window.I18n ? window.I18n.get('detail.finish') : '🏁 Terminer');
                    }
                    if (shouldBeFinished) showToast(`"${escapeHtml(title)}" marquée comme terminée automatiquement !`);
                    refreshSeriesList();
                }
            }
        }

        // Follow button
        document.getElementById('btn-follow-show').addEventListener('click', async function () {
            const tmdbId = parseInt(this.dataset.tmdbId, 10);
            const t = this.dataset.title;
            const poster = this.dataset.poster;
            const backdrop = this.dataset.backdrop;
            const existingRow = await db.shows.where('tmdb_id').equals(tmdbId).first();
            let isAdding = false;
            if (existingRow) {
                const newVal = existingRow.is_followed ? 0 : 1;
                await db.shows.update(existingRow.id, { is_followed: newVal });
                this.classList.toggle('active', newVal === 1);
                this.textContent = newVal ? '✓ Suivi' : '+ Suivre';
                if (newVal === 1) isAdding = true;
            } else {
                await db.shows.add({
                    tvtime_id: '', tmdb_id: tmdbId, name: t,
                    poster_path: poster, backdrop_path: backdrop,
                    genres: (show.genres || []).map(g => g.name),
                    status: 'following', is_followed: 1, is_favorited: 0, user_rating: 0, type: 'tv'
                });
                this.classList.add('active');
                this.textContent = '✓ Suivi';
                isAdding = true;
            }
            if (isAdding && typeof feedBigBrother === 'function') feedBigBrother(tmdbId, 'tv', 2.0);
            showToast(this.classList.contains('active') ? `${escapeHtml(t)} ajouté à vos séries` : `${escapeHtml(t)} retiré`);
            refreshSeriesList();
        });

        // Favorite show
        document.getElementById('btn-fav-show').addEventListener('click', async function () {
            const tmdbId = show.id;
            const existingRow = await db.shows.where('tmdb_id').equals(tmdbId).first();
            let nextFav = 1;
            if (!existingRow) {
                await db.shows.add({
                    tvtime_id: '', tmdb_id: tmdbId, name: title,
                    poster_path: show.poster_path || '', backdrop_path: show.backdrop_path || '',
                    genres: (show.genres || []).map(g => g.name),
                    status: 'following', is_followed: 0, is_favorited: 1, user_rating: 0, type: 'tv'
                });
            } else {
                nextFav = existingRow.is_favorited ? 0 : 1;
                await db.shows.update(existingRow.id, { is_favorited: nextFav });
            }
            const isFav = nextFav === 1;
            this.classList.toggle('active', isFav);
            this.textContent = isFav ? '❤️ Favori' : '🤍 Favori';
            showToast(isFav ? `${escapeHtml(title)} ajouté aux favoris` : `${escapeHtml(title)} retiré des favoris`);
        });

        // Finish show
        document.getElementById('btn-finish-show').addEventListener('click', async function () {
            const tmdbId = show.id;
            const existingRow = await db.shows.where('tmdb_id').equals(tmdbId).first();
            let nextFin = 1;
            if (!existingRow) {
                await db.shows.add({
                    tvtime_id: '', tmdb_id: tmdbId, name: title,
                    poster_path: show.poster_path || '', backdrop_path: show.backdrop_path || '',
                    genres: (show.genres || []).map(g => g.name),
                    status: 'following', is_followed: 1, is_favorited: 0, is_finished: 1, user_rating: 0, type: 'tv'
                });
                const followBtn = document.getElementById('btn-follow-show');
                if (followBtn) {
                    followBtn.classList.add('active');
                    followBtn.textContent = '✓ Suivi';
                }
            } else {
                nextFin = existingRow.is_finished ? 0 : 1;
                await db.shows.update(existingRow.id, { is_finished: nextFin });
            }
            const isFin = nextFin === 1;
            this.classList.toggle('active', isFin);
            this.textContent = isFin ? (window.I18n ? window.I18n.get('detail.finished') : '🏁 Terminée') : (window.I18n ? window.I18n.get('detail.finish') : '🏁 Terminer');
            showToast(isFin ? (window.I18n ? window.I18n.get('toast.series_finished', {title}) : `${escapeHtml(title)} marquée comme terminée`) : (window.I18n ? window.I18n.get('toast.series_unfinished', {title}) : `${escapeHtml(title)} retirée des séries terminées`));
            refreshSeriesList();
        });

        // Rate show
        detailBody.querySelectorAll('#show-rating-widget .star').forEach(star => {
            const onRate = async () => {
                const val = parseInt(star.dataset.val, 10);
                const existingRow = await db.shows.where('tmdb_id').equals(show.id).first();
                const newVal = (!existingRow || existingRow.user_rating !== val) ? val : 0;
                if (!existingRow) {
                    await db.shows.add({
                        tvtime_id: '', tmdb_id: show.id, name: title,
                        poster_path: show.poster_path || '', backdrop_path: show.backdrop_path || '',
                        genres: (show.genres || []).map(g => g.name),
                        status: 'following', is_followed: 0, is_favorited: 0, user_rating: newVal, type: 'tv'
                    });
                } else {
                    await db.shows.update(existingRow.id, { user_rating: newVal });
                }
                detailBody.querySelectorAll('#show-rating-widget .star').forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.val, 10) <= newVal);
                });
                if (newVal > 0) showToast(`Vous avez noté ${escapeHtml(title)} ${newVal}/5`);
            };
            star.addEventListener('click', onRate);
            star.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRate(); }
            });
        });

        // Episode check buttons
        detailBody.querySelectorAll('.ep-check-sm').forEach(btn => {
            const toggleEp = async (e) => {
                e.stopPropagation();
                if (btn.dataset.busy === '1') return;
                btn.dataset.busy = '1';
                try {
                    const showName = btn.dataset.show;
                    const tvtimeId = btn.dataset.tvtime || '';
                    const season = parseInt(btn.dataset.season, 10);
                    const epNum = parseInt(btn.dataset.ep, 10);
                    const runtime = parseInt(btn.dataset.runtime, 10) || 0;

                    if (btn.classList.contains('checked')) {
                        let records = [];
                        if (tvtimeId) {
                            records = await db.watch_history.where('show_tvtime_id').equals(String(tvtimeId))
                                .filter(r => r.season_number === season && r.episode_number === epNum).toArray();
                        }
                        if (records.length === 0) {
                            records = await db.watch_history.where('show_name').equals(showName)
                                .filter(r => r.season_number === season && r.episode_number === epNum).toArray();
                        }
                        for (const r of records) await db.watch_history.delete(r.id);
                        btn.classList.remove('checked');
                        btn.setAttribute('aria-checked', 'false');
                        const row = btn.closest('.season-ep-row');
                        if (row) row.classList.add('unseen');
                    } else {
                        await db.watch_history.add({
                            show_tvtime_id: String(tvtimeId), show_name: showName,
                            season_number: season, episode_number: epNum,
                            episode_id: '', watched_at: new Date().toISOString(),
                            rewatch_count: 0, runtime: runtime * 60
                        });
                        btn.classList.add('checked');
                        btn.setAttribute('aria-checked', 'true');
                        const row = btn.closest('.season-ep-row');
                        if (row) row.classList.remove('unseen');
                    }

                    const seasonBlock = btn.closest('.season-block');
                    if (seasonBlock) {
                        const total = seasonBlock.querySelectorAll('.ep-check-sm').length;
                        const done = seasonBlock.querySelectorAll('.ep-check-sm.checked').length;
                        seasonBlock.querySelector('.season-progress').textContent = `${done}/${total}`;
                    }
                    await checkAutoFinishShow();
                } finally {
                    delete btn.dataset.busy;
                }
            };
            btn.addEventListener('click', toggleEp);
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEp(e); }
            });
        });

        // Episode rewatch buttons
        detailBody.querySelectorAll('.ep-rewatch-sm').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const showName = btn.dataset.show;
                const tvtimeId = btn.dataset.tvtime || '';
                const season = parseInt(btn.dataset.season, 10);
                const epNum = parseInt(btn.dataset.ep, 10);

                let records = [];
                if (tvtimeId) {
                    records = await db.watch_history.where('show_tvtime_id').equals(String(tvtimeId))
                        .filter(r => r.season_number === season && r.episode_number === epNum).toArray();
                }
                if (records.length === 0) {
                    records = await db.watch_history.where('show_name').equals(showName)
                        .filter(r => r.season_number === season && r.episode_number === epNum).toArray();
                }

                if (records.length > 0) {
                    const r = records[0];
                    const currentViews = (r.rewatch_count || 0) + 1;
                    showRewatchModal('episode', { historyId: r.id, showName, season, epNum }, currentViews, show);
                }
            });
        });

        // Season check all (bulk DB insert / decrement without DOM click race)
        detailBody.querySelectorAll('.season-check-all').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (btn.disabled) return;
                btn.disabled = true;
                try {
                    const season = parseInt(btn.dataset.season, 10);
                    const epsContainer = document.getElementById(`season-eps-s${season}`);
                    const uncheckedBtns = epsContainer ? Array.from(epsContainer.querySelectorAll('.ep-check-sm:not(.checked)')) : [];
                    const existingShow = await db.shows.where('tmdb_id').equals(show.id).first();
                    const tvtimeId = (existingShow && existingShow.tvtime_id) ? String(existingShow.tvtime_id) : '';

                    if (uncheckedBtns.length > 0) {
                        const nowIso = new Date().toISOString();
                        const newRecords = uncheckedBtns.map(epBtn => ({
                            show_tvtime_id: tvtimeId,
                            show_name: title,
                            season_number: season,
                            episode_number: parseInt(epBtn.dataset.ep, 10),
                            episode_id: '',
                            watched_at: nowIso,
                            rewatch_count: 0,
                            runtime: (parseInt(epBtn.dataset.runtime, 10) || 0) * 60
                        }));
                        await db.watch_history.bulkAdd(newRecords);
                        await checkAutoFinishShow();
                        showToast(window.I18n ? window.I18n.get('toast.season_seen', {season}) : `Saison ${season} marquée comme vue`);
                        await renderShowDetail(show);
                    } else {
                        let records = [];
                        if (tvtimeId && tvtimeId !== 'undefined') {
                            records = await db.watch_history.where('show_tvtime_id').equals(tvtimeId).filter(r => r.season_number === season).toArray();
                        }
                        if (records.length === 0) {
                            records = await db.watch_history.where('show_name').equals(title).filter(r => r.season_number === season).toArray();
                        }
                        for (const r of records) {
                            if (r.rewatch_count && r.rewatch_count > 0) {
                                await db.watch_history.update(r.id, { rewatch_count: r.rewatch_count - 1 });
                            } else {
                                await db.watch_history.delete(r.id);
                            }
                        }
                        await checkAutoFinishShow();
                        showToast(window.I18n ? window.I18n.get('toast.season_unseen', {season}) : `Saison ${season} : une vue retirée`);
                        await renderShowDetail(show);
                    }
                } finally {
                    btn.disabled = false;
                }
            });
        });

        // Season rewatch all (bulk DB insert + rewatch increment)
        detailBody.querySelectorAll('.season-rewatch-all').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (btn.disabled) return;
                btn.disabled = true;
                try {
                    const season = parseInt(btn.dataset.season, 10);
                    const epsContainer = document.getElementById(`season-eps-s${season}`);
                    const uncheckedBtns = epsContainer ? Array.from(epsContainer.querySelectorAll('.ep-check-sm:not(.checked)')) : [];
                    const existingShow = await db.shows.where('tmdb_id').equals(show.id).first();
                    const tvtimeId = (existingShow && existingShow.tvtime_id) ? String(existingShow.tvtime_id) : '';

                    if (uncheckedBtns.length > 0) {
                        const nowIso = new Date().toISOString();
                        await db.watch_history.bulkAdd(uncheckedBtns.map(epBtn => ({
                            show_tvtime_id: tvtimeId,
                            show_name: title,
                            season_number: season,
                            episode_number: parseInt(epBtn.dataset.ep, 10),
                            episode_id: '',
                            watched_at: nowIso,
                            rewatch_count: 0,
                            runtime: (parseInt(epBtn.dataset.runtime, 10) || 0) * 60
                        })));
                    }

                    let records = [];
                    if (tvtimeId) {
                        records = await db.watch_history.where('show_tvtime_id').equals(tvtimeId).filter(r => r.season_number === season).toArray();
                    }
                    if (records.length === 0) {
                        records = await db.watch_history.where('show_name').equals(title).filter(r => r.season_number === season).toArray();
                    }

                    let maxCount = 1;
                    for (const r of records) {
                        const newCount = Math.max((r.rewatch_count || 0), 1);
                        if (newCount > maxCount) maxCount = newCount;
                        await db.watch_history.update(r.id, { rewatch_count: newCount });
                    }
                    showRewatchModal('season', { showName: title, season, records }, maxCount + 1, show);
                } finally {
                    btn.disabled = false;
                }
            });
        });

        // Fix TMDB
        document.getElementById('btn-fix-tmdb-tv').addEventListener('click', async function() {
            const result = await openTmdbFixModal(show.name, 'tv');
            if (result) {
                const existingRow = await db.shows.where('tmdb_id').equals(show.id).first();
                if (existingRow) {
                    await db.shows.update(existingRow.id, {
                        tmdb_id: result.id,
                        poster_path: result.poster_path,
                        backdrop_path: result.backdrop_path,
                        nb_episodes_total: undefined
                    });
                }
                showToast(window.I18n ? window.I18n.get('toast.id_updated') : 'Identification mise à jour !');
                closeDetail();
                refreshSeriesList();
            }
        });

        // Manual sync button
        document.getElementById('btn-sync-show').addEventListener('click', async function() {
            const prevText = this.textContent;
            this.disabled = true;
            this.textContent = '⏳ Synchronisation...';
            try {
                const details = await TMDB.getShowDetails(show.id);
                if (details) {
                    const existingRow = await db.shows.where('tmdb_id').equals(show.id).first();
                    if (existingRow) {
                        const total = details.number_of_episodes || 0;
                        const nextAir = details.next_episode_to_air ? details.next_episode_to_air.air_date : null;
                        const genreNames = details.genres ? details.genres.map(g => g.name) : [];

                        let showHist = [];
                        if (existingRow.tvtime_id) showHist = await db.watch_history.where('show_tvtime_id').equals(String(existingRow.tvtime_id)).toArray();
                        if (showHist.length === 0) showHist = await db.watch_history.where('show_name').equals(existingRow.name).toArray();
                        const uniqueWatched = new Set();
                        showHist.forEach(h => { if (h.season_number > 0) uniqueWatched.add(`S${h.season_number}E${h.episode_number}`); });
                        const shouldBeFinished = uniqueWatched.size >= total && total > 0;

                        await db.shows.update(existingRow.id, {
                            nb_episodes_total: total,
                            next_air_date: nextAir,
                            poster_path: details.poster_path || existingRow.poster_path,
                            backdrop_path: details.backdrop_path || existingRow.backdrop_path,
                            is_finished: shouldBeFinished ? 1 : 0,
                            last_sync: Date.now(),
                            genres: genreNames
                        });
                    }
                    showToast(window.I18n ? window.I18n.get('toast.data_updated') : 'Données actualisées !');
                    refreshSeriesList();
                    renderShowDetail(details);
                } else {
                    showToast(window.I18n ? window.I18n.get('toast.data_error') : 'Impossible de récupérer les données.');
                }
            } catch (e) {
                showToast(window.I18n ? window.I18n.get('toast.sync_error') : 'Erreur lors de la synchronisation.');
            } finally {
                this.disabled = false;
                this.textContent = prevText;
            }
        });

        // Share button (fetches fresh rating)
        document.getElementById('btn-share-show').addEventListener('click', async function() {
            if (typeof showShareCardModal === 'function') {
                const fresh = await db.shows.where('tmdb_id').equals(show.id).first();
                const currentRating = fresh ? (fresh.user_rating || 0) : 0;
                showShareCardModal(show, 'tv', currentRating);
            }
        });

        // Episode Notes (single listener scoped to detailBody)
        detailBody.querySelectorAll('.ep-note-sm').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const showId = btn.dataset.showId;
                const season = parseInt(btn.dataset.season, 10);
                const ep = parseInt(btn.dataset.ep, 10);
                const epName = btn.dataset.epName;
                showEpisodeNoteModal(showId, season, ep, epName);
            });
        });

        // Add to list
        const btnAddToList = document.getElementById('btn-add-to-list');
        if (btnAddToList) {
            btnAddToList.addEventListener('click', () => {
                showAddToListModal(show.id, 'show');
            });
        }

        // Load similar shows asynchronously
        (async () => {
            try {
                const similar = await TMDB.getRecommendations(show.id, 'tv');
                const container = document.getElementById('detail-similar-shows');
                if (similar && similar.length > 0 && container) {
                    let html = '<h3>Vous aimerez aussi</h3><div class="horizontal-scroll">';
                    similar.slice(0, 10).forEach(item => {
                        const pUrl = TMDB.imgUrl(item.poster_path, 'w185');
                        const name = escapeHtml(item.name || item.title || '');
                        if (pUrl) {
                            html += `<div class="h-poster similar-poster" data-tmdb-id="${item.id}" data-type="${escapeHtml(item.media_type || 'tv')}"><img src="${pUrl}" alt="${name}" loading="lazy"><div class="similar-label">${name}</div></div>`;
                        }
                    });
                    html += '</div>';
                    container.innerHTML = html;

                    container.querySelectorAll('.similar-poster').forEach(el => {
                        el.addEventListener('click', async () => {
                            const tmdbId = parseInt(el.dataset.tmdbId, 10);
                            const type = el.dataset.type || 'tv';
                            const details = type === 'tv' ? await TMDB.getShowDetails(tmdbId) : await TMDB.getMovieDetails(tmdbId);
                            if (details) openDetail(details, type);
                        });
                    });
                }
            } catch(e) {}
        })();
    }

    async function renderMovieDetail(movie) {
        const currentLangCode = (window.I18n && window.I18n.lang) || 'fr';
        const title = movie.title || movie.name || 'Sans titre';
        const overview = movie.overview || (window.I18n ? window.I18n.get('detail.no_overview') : 'Pas de description disponible.');
        const year = (movie.release_date || '').split('-')[0];
        const genres = (movie.genres || []).map(g => g.name).join(', ');
        const runtime = movie.runtime || '?';
        const posterUrl = movie.poster_path ? TMDB.imgUrl(movie.poster_path, 'w500') : '';
        const rating = movie.vote_average ? (movie.vote_average * 10).toFixed(0) + '%' : '';

        let director = '';
        let directorLinksHTML = '';
        if (movie.credits && movie.credits.crew) {
            const directors = movie.credits.crew.filter(c => c.job === 'Director');
            if (directors.length > 0) {
                director = new Intl.ListFormat(currentLangCode, { style: 'long', type: 'conjunction' }).format(directors.map(d => d.name));
                directorLinksHTML = directors.map(d => `<button type="button" class="cast-person-link" data-person-id="${d.id || ''}">${escapeHtml(d.name || '')}</button>`).join(', ');
            }
        }

        const ageRatingHTML = buildAgeRatingHTML(movie, 'movie');
        const providersHTML = buildProvidersHTML(movie);
        const castHTML = buildCastHTML(movie.credits);
        const trailerHTML = buildTrailerHTML(movie.videos);

        const existingMovie = await db.movies.where('tmdb_id').equals(movie.id).first();
        const inWatchlist = existingMovie && existingMovie.status === 'watchlist';
        const isWatched = existingMovie && existingMovie.status === 'watched';
        const isFavorited = existingMovie && existingMovie.is_favorited === 1;
        const userRating = existingMovie ? existingMovie.user_rating || 0 : 0;
        const userNote = existingMovie ? (existingMovie.user_note || '') : '';

        const safeTitle = escapeHtml(title);
        const watchedBtnText = currentLangCode === 'en' ? (isWatched ? '✓ Watched' : 'Mark watched') : (isWatched ? '✓ Vu' : '👁 Marquer vu');
        const noteHeading = (window.I18n && window.I18n.get('detail.movie_note')) || 'Ma note & critique personnelle';
        const notePlaceholder = (window.I18n && window.I18n.get('detail.movie_note_placeholder')) || 'Écrivez votre avis ou mémo sur ce film...';
        const saveLabel = (window.I18n && window.I18n.get('common.save')) || 'Enregistrer';

        detailBody.innerHTML = `
            <div class="detail-header-flex">
                ${posterUrl ? `<img src="${posterUrl}" class="detail-main-poster" alt="${safeTitle}">` : ''}
                <div class="detail-header-info">
                    <h1>${safeTitle}</h1>
                    ${ageRatingHTML}
                    <div class="detail-meta">${escapeHtml(year)} · ${escapeHtml(genres)} · ${runtime} min</div>
                    ${rating ? `<div class="detail-rating"><div class="rating-badge">${escapeHtml(rating)}</div> Score d'évaluation</div>` : ''}
                    <div class="detail-actions">
                        <button type="button" class="detail-action-btn follow ${inWatchlist ? 'active' : ''}" id="btn-add-movie" data-tmdb-id="${movie.id}" data-title="${safeTitle}" data-poster="${escapeHtml(movie.poster_path || '')}" data-runtime="${movie.runtime || 0}">
                            ${inWatchlist ? '✓ Ajouté' : '+ Ajouter'}
                        </button>
                        <button type="button" class="detail-action-btn rewatch ${isWatched ? 'active' : ''}" id="btn-watched-movie" data-title="${safeTitle}" data-tmdb-id="${movie.id}" data-runtime="${movie.runtime || 0}">
                            ${watchedBtnText}
                        </button>
                        <button type="button" class="detail-action-btn rewatch" id="btn-re-watch-movie" data-title="${safeTitle}" data-tmdb-id="${movie.id}" data-runtime="${movie.runtime || 0}" style="display:${isWatched ? 'inline-flex' : 'none'};">↻ Revoir</button>
                        <button type="button" class="detail-action-btn fav-btn ${isFavorited ? 'active' : ''}" id="btn-fav-movie">
                            ${isFavorited ? '❤️ Favori' : '🤍 Favori'}
                        </button>
                        <button type="button" class="detail-action-btn list-btn" id="btn-add-to-list-movie" data-tmdb-id="${movie.id}" data-type="movie">
                            📋 Liste
                        </button>
                    </div>
                    <div class="user-rating-widget" id="movie-rating-widget">
                        <span style="font-size:12px; color:var(--text-muted); margin-right:8px;">Ma note:</span>
                        <div class="stars">
                            ${[1,2,3,4,5].map(i => `<span class="star ${i <= userRating ? 'active' : ''}" data-val="${i}" role="button" tabindex="0">★</span>`).join('')}
                        </div>
                    </div>
                    <div class="movie-personal-note-box" id="movie-note-section">
                        <label for="movie-personal-note" class="movie-note-label">${escapeHtml(noteHeading)}</label>
                        <textarea id="movie-personal-note" class="movie-note-textarea" rows="3" maxlength="2000" placeholder="${escapeHtml(notePlaceholder)}">${escapeHtml(userNote)}</textarea>
                        <div class="movie-note-footer">
                            <span id="movie-note-count" style="font-size:11px; color:var(--text-muted);">${userNote.length}/2000</span>
                            <button type="button" class="action-btn secondary" id="btn-save-movie-note" style="width:auto; padding:5px 12px; font-size:12px;">${escapeHtml(saveLabel)}</button>
                        </div>
                    </div>
                    <p class="detail-overview">${escapeHtml(overview)}</p>
                    ${providersHTML}
                    ${directorLinksHTML ? `<div class="detail-creator"><strong>Réalisateur :</strong> ${directorLinksHTML}</div>` : ''}
                </div>
            </div>
            ${castHTML}
            ${trailerHTML}

            <div id="detail-nlp-analysis" class="detail-nlp-card" style="display:none;">
                <h4 style="margin:0 0 8px 0; font-size:15px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                    <span>🧠</span> Analyse BigBrother
                </h4>
                <p id="detail-nlp-text" style="margin:0; font-size:14px; color:var(--text-secondary); line-height:1.5;"></p>
            </div>

            <div class="detail-section" id="detail-similar-movies"></div>
            <div class="detail-section detail-footer-actions" style="margin-top: 2rem; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="action-btn secondary" id="btn-share-movie" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">📤 Partager</button>
                <button type="button" class="action-btn secondary" id="btn-fix-tmdb-movie" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">${window.I18n ? window.I18n.get('action.tmdb_fix') : 'Mauvaise identification TMDB ?'}</button>
            </div>
        `;

        bindCastPersonHandlers(detailBody);
        runDetailNlpAnalysis(movie, 'movie', isWatched, director);

        // Personal movie review/note save
        const noteTextarea = document.getElementById('movie-personal-note');
        const noteCountEl = document.getElementById('movie-note-count');
        const btnSaveNote = document.getElementById('btn-save-movie-note');
        if (noteTextarea && noteCountEl) {
            noteTextarea.addEventListener('input', () => {
                noteCountEl.textContent = `${noteTextarea.value.length}/2000`;
            });
        }
        if (btnSaveNote && noteTextarea) {
            btnSaveNote.addEventListener('click', async () => {
                const text = noteTextarea.value.trim();
                const row = await db.movies.where('tmdb_id').equals(movie.id).first();
                if (!row) {
                    const rtSecs = (parseInt(movie.runtime, 10) || 0) * 60;
                    await db.movies.add({
                        uuid: randomUuid('mov'), tmdb_id: movie.id, name: title,
                        poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '',
                        genres: (movie.genres || []).map(g => g.name),
                        status: 'watchlist', release_date: movie.release_date || null,
                        is_favorited: 0, user_rating: 0, user_note: text, runtime: rtSecs
                    });
                } else {
                    await db.movies.update(row.id, { user_note: text });
                }
                showToast(currentLangCode === 'en' ? 'Note saved!' : 'Note enregistrée !');
            });
        }

        document.getElementById('btn-fix-tmdb-movie').addEventListener('click', async function() {
            const result = await openTmdbFixModal(title, 'movie');
            if (result) {
                const row = await db.movies.where('tmdb_id').equals(movie.id).first();
                if (row) {
                    await db.movies.update(row.id, {
                        tmdb_id: result.id,
                        poster_path: result.poster_path,
                        backdrop_path: result.backdrop_path
                    });
                }
                showToast(window.I18n ? window.I18n.get('toast.id_updated') : 'Identification mise à jour !');
                closeDetail();
                refreshFilmsList();
            }
        });

        // Share button (fetches fresh rating)
        document.getElementById('btn-share-movie').addEventListener('click', async function() {
            if (typeof showShareCardModal === 'function') {
                const fresh = await db.movies.where('tmdb_id').equals(movie.id).first();
                const currentRating = fresh ? (fresh.user_rating || 0) : 0;
                showShareCardModal(movie, 'movie', currentRating);
            }
        });

        // Add to list
        const btnAddToListMovie = document.getElementById('btn-add-to-list-movie');
        if (btnAddToListMovie) {
            btnAddToListMovie.addEventListener('click', () => {
                showAddToListModal(movie.id, 'movie');
            });
        }

        // Load similar movies asynchronously
        (async () => {
            try {
                const similar = await TMDB.getRecommendations(movie.id, 'movie');
                const container = document.getElementById('detail-similar-movies');
                if (similar && similar.length > 0 && container) {
                    let html = '<h3>Films similaires</h3><div class="horizontal-scroll">';
                    similar.slice(0, 10).forEach(item => {
                        const pUrl = TMDB.imgUrl(item.poster_path, 'w185');
                        const name = escapeHtml(item.title || item.name || '');
                        if (pUrl) {
                            html += `<div class="h-poster similar-poster" data-tmdb-id="${item.id}" data-type="movie"><img src="${pUrl}" alt="${name}" loading="lazy"><div class="similar-label">${name}</div></div>`;
                        }
                    });
                    html += '</div>';
                    container.innerHTML = html;
                    container.querySelectorAll('.similar-poster').forEach(el => {
                        el.addEventListener('click', async () => {
                            const details = await TMDB.getMovieDetails(parseInt(el.dataset.tmdbId, 10));
                            if (details) openDetail(details, 'movie');
                        });
                    });
                }
            } catch(e) {}
        })();

        document.getElementById('btn-add-movie').addEventListener('click', async function () {
            const tmdbId = parseInt(this.dataset.tmdbId, 10);
            const row = await db.movies.where('tmdb_id').equals(tmdbId).first();
            const rawRt = parseInt(this.dataset.runtime, 10) || 0;
            const rtSecs = rawRt > 500 ? rawRt : rawRt * 60;
            if (!row || !row.status) {
                if (!row) {
                    await db.movies.add({
                        uuid: randomUuid('mov'), tmdb_id: tmdbId, name: this.dataset.title,
                        poster_path: this.dataset.poster, backdrop_path: movie.backdrop_path || '',
                        genres: (movie.genres || []).map(g => g.name),
                        status: 'watchlist', release_date: movie.release_date || null,
                        runtime: rtSecs
                    });
                } else {
                    await db.movies.update(row.id, { status: 'watchlist' });
                }
                this.classList.add('active');
                this.textContent = '✓ Ajouté';
                if (typeof feedBigBrother === 'function') feedBigBrother(tmdbId, 'movie', 2.0);
                showToast(`${escapeHtml(this.dataset.title)} ajouté à votre liste`);
                refreshFilmsList();
            } else if (row.status === 'watchlist') {
                if (row.user_rating || row.is_favorited || row.user_note) {
                    await db.movies.update(row.id, { status: '' });
                } else {
                    await db.movies.delete(row.id);
                }
                this.classList.remove('active');
                this.textContent = '+ Ajouter';
                showToast(`${escapeHtml(this.dataset.title)} retiré de votre liste`);
                refreshFilmsList();
            } else {
                showToast('Déjà marqué comme vu');
            }
        });

        document.getElementById('btn-watched-movie').addEventListener('click', async function () {
            const tmdbId = parseInt(this.dataset.tmdbId, 10);
            let row = await db.movies.where('tmdb_id').equals(tmdbId).first();

            if (row && row.status === 'watched') {
                await db.movies.update(row.id, { status: 'watchlist' });
                let watchRecord = row.uuid
                    ? await db.movie_watches.where('movie_uuid').equals(row.uuid).first()
                    : null;
                if (!watchRecord && row.name) {
                    watchRecord = await db.movie_watches.filter(w => w.movie_name === row.name).first();
                }
                if (watchRecord) {
                    await db.movie_watches.delete(watchRecord.id);
                }
                this.classList.remove('active');
                this.textContent = currentLangCode === 'en' ? 'Mark watched' : '👁 Marquer vu';
                showToast(`${escapeHtml(this.dataset.title)} retiré de vos films vus`);
                const reBtn = document.getElementById('btn-re-watch-movie');
                if (reBtn) reBtn.style.display = 'none';
                refreshFilmsList();
            } else {
                const rawRuntime = parseInt(this.dataset.runtime, 10) || 0;
                const runtimeSecs = rawRuntime > 500 ? rawRuntime : (rawRuntime * 60);
                if (!row) {
                    const newId = await db.movies.add({
                        uuid: randomUuid('mov'), tmdb_id: tmdbId, name: this.dataset.title,
                        poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '',
                        genres: (movie.genres || []).map(g => g.name),
                        status: 'watched', release_date: movie.release_date || null,
                        is_favorited: 0, user_rating: 0, runtime: runtimeSecs
                    });
                    row = await db.movies.get(newId);
                } else {
                    const ensuredUuid = row.uuid || randomUuid('mov');
                    await db.movies.update(row.id, { status: 'watched', runtime: runtimeSecs, uuid: ensuredUuid });
                    row.uuid = ensuredUuid;
                }
                await db.movie_watches.add({
                    movie_uuid: row.uuid, movie_name: this.dataset.title,
                    watched_at: new Date().toISOString(), rewatch_count: 0, runtime: runtimeSecs
                });
                this.classList.add('active');
                this.textContent = currentLangCode === 'en' ? '✓ Watched' : '✓ Vu';
                if (typeof feedBigBrother === 'function') feedBigBrother(tmdbId, 'movie', 1.0);
                showToast(`${escapeHtml(this.dataset.title)} marqué comme vu ✓`);
                const reBtn = document.getElementById('btn-re-watch-movie');
                if (reBtn) reBtn.style.display = 'inline-flex';
                refreshFilmsList();
            }
        });

        const rewatchBtn = document.getElementById('btn-re-watch-movie');
        if (rewatchBtn) {
            rewatchBtn.addEventListener('click', async function () {
                const tmdbId = parseInt(this.dataset.tmdbId, 10);
                const row = await db.movies.where('tmdb_id').equals(tmdbId).first();
                if (row) {
                    const records = row.uuid
                        ? await db.movie_watches.where('movie_uuid').equals(row.uuid).toArray()
                        : await db.movie_watches.filter(w => w.movie_name === row.name).toArray();
                    const views = records.length > 0
                        ? records.reduce((sum, r) => sum + (r.rewatch_count || 0) + 1, 0)
                        : 1;
                    showRewatchModal('movie', { tmdbId, movieUuid: row.uuid, movieName: this.dataset.title, records }, views, movie);
                }
            });
        }

        // Favorite movie
        document.getElementById('btn-fav-movie').addEventListener('click', async function () {
            const tmdbId = movie.id;
            const row = await db.movies.where('tmdb_id').equals(tmdbId).first();
            let nextFav = 1;
            if (!row) {
                await db.movies.add({
                    uuid: randomUuid('mov'), tmdb_id: tmdbId, name: title,
                    poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '',
                    genres: (movie.genres || []).map(g => g.name),
                    status: 'watchlist', release_date: movie.release_date || null,
                    is_favorited: 1, user_rating: 0, runtime: (parseInt(movie.runtime, 10) || 0) * 60
                });
            } else {
                nextFav = row.is_favorited ? 0 : 1;
                await db.movies.update(row.id, { is_favorited: nextFav });
            }
            const isFav = nextFav === 1;
            this.classList.toggle('active', isFav);
            this.textContent = isFav ? '❤️ Favori' : '🤍 Favori';
            showToast(isFav ? `${escapeHtml(title)} ajouté aux favoris` : `${escapeHtml(title)} retiré des favoris`);
        });

        // Rate movie
        detailBody.querySelectorAll('#movie-rating-widget .star').forEach(star => {
            const onRate = async () => {
                const val = parseInt(star.dataset.val, 10);
                const row = await db.movies.where('tmdb_id').equals(movie.id).first();
                const newVal = (!row || row.user_rating !== val) ? val : 0;
                if (!row) {
                    await db.movies.add({
                        uuid: randomUuid('mov'), tmdb_id: movie.id, name: title,
                        poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '',
                        genres: (movie.genres || []).map(g => g.name),
                        status: 'watchlist', release_date: movie.release_date || null,
                        is_favorited: 0, user_rating: newVal, runtime: (parseInt(movie.runtime, 10) || 0) * 60
                    });
                } else {
                    await db.movies.update(row.id, { user_rating: newVal });
                }
                detailBody.querySelectorAll('#movie-rating-widget .star').forEach(s => {
                    s.classList.toggle('active', parseInt(s.dataset.val, 10) <= newVal);
                });
                if (newVal > 0) showToast(`Vous avez noté ${escapeHtml(title)} ${newVal}/5`);
            };
            star.addEventListener('click', onRate);
            star.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRate(); }
            });
        });
    }

    // ---- Series list ----
    const debouncedRefreshSeriesList = debounce(() => refreshSeriesList(), 600);
    let _seriesReqId = 0;
    let selectedSeriesGenre = '';

    function renderGenreFilterBar(containerId, items, activeGenre, onSelect) {
        const bar = document.getElementById(containerId);
        if (!bar) return;
        const counts = new Map();
        items.forEach(item => {
            (item.genres || []).forEach(g => {
                const name = typeof g === 'string' ? g : (g && g.name);
                if (name && name !== 'null') counts.set(name, (counts.get(name) || 0) + 1);
            });
        });
        const topGenres = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name]) => name);

        if (topGenres.length === 0) {
            bar.innerHTML = '';
            return;
        }
        const allLabel = window.I18n ? window.I18n.get('common.all') : 'Tous';
        bar.innerHTML = '';
        const makePill = (label, value) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `genre-filter-pill ${activeGenre === value ? 'active' : ''}`;
            btn.textContent = label;
            btn.addEventListener('click', () => onSelect(value));
            return btn;
        };
        bar.appendChild(makePill(allLabel, ''));
        topGenres.forEach(g => {
            const translated = window.ProfileCard ? window.ProfileCard.translateGenre(g) : g;
            bar.appendChild(makePill(translated, g));
        });
    }

    async function refreshSeriesList() {
        const reqId = ++_seriesReqId;
        const watchingList = document.getElementById('series-list');
        const finishedList = document.getElementById('series-finished-list');
        const upcomingList = document.getElementById('series-upcoming-list');
        if (!watchingList || !finishedList || !upcomingList) return;

        const sortVal = document.getElementById('series-sort')?.value || 'last_watched';
        const searchQuery = (document.getElementById('series-local-search')?.value || '').trim().toLowerCase();

        watchingList.innerHTML = Array(3).fill('<div class="skeleton-card skeleton"><div class="skeleton-poster skeleton"></div><div class="skeleton-lines"><div class="skeleton-line skeleton"></div><div class="skeleton-line skeleton"></div></div></div>').join('');
        finishedList.innerHTML = Array(3).fill('<div class="skeleton-grid-item skeleton"></div>').join('');
        upcomingList.innerHTML = Array(3).fill('<div class="skeleton-grid-item skeleton"></div>').join('');

        let shows = await db.shows.where('is_followed').equals(1).toArray();
        if (reqId !== _seriesReqId) return;

        renderGenreFilterBar('series-genre-filters', shows, selectedSeriesGenre, (g) => {
            selectedSeriesGenre = g;
            refreshSeriesList();
        });

        if (searchQuery) {
            shows = shows.filter(s => (s.name || '').toLowerCase().includes(searchQuery));
        }
        if (selectedSeriesGenre) {
            shows = shows.filter(s => (s.genres || []).some(g => (typeof g === 'string' ? g : g?.name) === selectedSeriesGenre));
        }

        const historyData = await db.watch_history.toArray();
        if (reqId !== _seriesReqId) return;

        const historyMap = {};
        const historyByTvtimeId = new Map();
        const historyByName = new Map();
        for (const h of historyData) {
            const key1 = h.show_tvtime_id ? String(h.show_tvtime_id) : null;
            const key2 = h.show_name;
            const time = h.watched_at ? new Date(h.watched_at).getTime() : 0;
            if (key1 && (!historyMap[key1] || time > historyMap[key1])) historyMap[key1] = time;
            if (key2 && (!historyMap[key2] || time > historyMap[key2])) historyMap[key2] = time;
            if (key1) {
                if (!historyByTvtimeId.has(key1)) historyByTvtimeId.set(key1, []);
                historyByTvtimeId.get(key1).push(h);
            }
            if (key2) {
                if (!historyByName.has(key2)) historyByName.set(key2, []);
                historyByName.get(key2).push(h);
            }
        }

        shows.sort((a, b) => {
            if (sortVal === 'name_asc') return (a.name || '').localeCompare(b.name || '');
            if (sortVal === 'name_desc') return (b.name || '').localeCompare(a.name || '');
            if (sortVal === 'added_asc') return a.id - b.id;
            if (sortVal === 'added_desc') return b.id - a.id;
            if (sortVal === 'rating_desc') return (b.user_rating || 0) - (a.user_rating || 0);

            const tA = Math.max(a.tvtime_id ? (historyMap[String(a.tvtime_id)] || 0) : 0, a.name ? (historyMap[a.name] || 0) : 0);
            const tB = Math.max(b.tvtime_id ? (historyMap[String(b.tvtime_id)] || 0) : 0, b.name ? (historyMap[b.name] || 0) : 0);
            if (tA !== tB) return tB - tA;
            return b.id - a.id;
        });

        const watchingFrag = document.createDocumentFragment();
        const finishedFrag = document.createDocumentFragment();
        const upcomingFrag = document.createDocumentFragment();
        let watchingCount = 0, finishedCount = 0, upcomingCount = 0;

        for (const show of shows) {
            let history = show.tvtime_id ? (historyByTvtimeId.get(String(show.tvtime_id)) || []) : [];
            if (history.length === 0) {
                history = historyByName.get(show.name) || [];
            }
            const posterUrl = show.poster_path ? TMDB.imgUrl(show.poster_path, 'w185') : null;

            let lastSeason = 0, lastEp = 0;
            const uniqueWatched = new Set();
            history.forEach(h => {
                if (h.season_number > 0) {
                    uniqueWatched.add(`S${h.season_number}E${h.episode_number}`);
                    if (h.season_number > lastSeason || (h.season_number === lastSeason && h.episode_number > lastEp)) {
                        lastSeason = h.season_number;
                        lastEp = h.episode_number;
                    }
                }
            });
            const doneEps = uniqueWatched.size;

            const nowMs = Date.now();
            const lastSync = show.last_sync || 0;
            const isAlreadyFinished = show.is_finished === 1;
            const needsSync = show.tmdb_id && (!show.nb_episodes_total || !show.seasons_data || (nowMs - lastSync) > 86400000);
            if (needsSync && !isAlreadyFinished) {
                if (!window._syncingShows) window._syncingShows = new Set();
                if (!window._syncingShows.has(show.id)) {
                    window._syncingShows.add(show.id);
                    setTimeout(async () => {
                        try {
                            const details = await TMDB.getShowDetails(show.tmdb_id);
                            if (details) {
                                const total = details.number_of_episodes || 0;
                                const nextAir = details.next_episode_to_air ? details.next_episode_to_air.air_date : null;
                                const shouldBeFinished = doneEps >= total && total > 0;
                                const isFirstSync = !show.nb_episodes_total;
                                const genres = details.genres ? details.genres.map(g => g.name) : [];
                                const genre_ids = details.genres ? details.genres.map(g => g.id).filter(Boolean) : [];
                                const seasons_data = details.seasons ? details.seasons.map(s => ({
                                    season_number: s.season_number,
                                    episode_count: s.episode_count
                                })) : [];
                                const updates = {
                                    nb_episodes_total: total,
                                    next_air_date: nextAir,
                                    last_sync: nowMs,
                                    genres,
                                    genre_ids,
                                    origin_country: details.origin_country || show.origin_country || [],
                                    seasons_data
                                };
                                if (isFirstSync) updates.is_finished = shouldBeFinished ? 1 : 0;
                                await db.shows.update(show.id, updates);
                                Object.assign(show, updates);
                                debouncedRefreshSeriesList();
                            }
                        } catch (e) {
                        } finally {
                            window._syncingShows.delete(show.id);
                        }
                    }, Math.random() * 4000 + 800);
                }
            }

            let nextEp = lastEp + 1;
            let nextSeason = lastSeason || 1;
            if (show.seasons_data) {
                const currentSeasonData = show.seasons_data.find(s => s.season_number === (lastSeason || 1));
                if (currentSeasonData && nextEp > currentSeasonData.episode_count && currentSeasonData.episode_count > 0) {
                    nextEp = 1;
                    nextSeason = (lastSeason || 1) + 1;
                }
            }

            const totalEps = show.nb_episodes_total || 0;
            const remainingCount = totalEps > 0 ? Math.max(0, totalEps - doneEps) : 0;
            const remainingLabel = totalEps > 0 ? (remainingCount > 0 ? `+${remainingCount}` : '') : (doneEps > 0 ? `${doneEps} vus` : '');
            const progressPct = totalEps > 0 ? Math.min(100, Math.round((doneEps / totalEps) * 100)) : 0;

            let category = 'watching';
            if (show.is_finished) category = 'finished';

            let releaseDateLabel = '';
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const nextAirDate = parseLocalDate(show.next_air_date);
            const firstAirDate = parseLocalDate(show.first_air_date);

            if (nextAirDate && nextAirDate >= todayStart && (doneEps === 0 || (totalEps > 0 && doneEps >= totalEps - 1))) {
                category = 'upcoming';
                releaseDateLabel = nextAirDate.toLocaleDateString();
            } else if (firstAirDate && firstAirDate >= todayStart && doneEps === 0) {
                category = 'upcoming';
                releaseDateLabel = firstAirDate.toLocaleDateString();
            }

            const displayName = show.name === 'Série inconnue' && show.tvtime_id ? `Inconnue (ID: ${show.tvtime_id})` : (show.name || 'Série');
            const safeName = escapeHtml(displayName);
            const card = document.createElement('div');

            const attachClickListener = (el) => {
                el.addEventListener('click', async () => {
                    if (show.tmdb_id) {
                        openDetail({ id: show.tmdb_id, name: show.name, poster_path: show.poster_path, backdrop_path: show.backdrop_path }, 'tv');
                        return;
                    }
                    const result = await TMDB.findShowByName(show.name);
                    let shouldAutoLink = true;
                    if (result) {
                        const details = await TMDB.getShowDetails(result.id);
                        if (details) {
                            const tEps = details.number_of_episodes || 0;
                            const tSeasons = details.number_of_seasons || 0;
                            if ((tSeasons > 0 && lastSeason > tSeasons) || (tEps > 0 && doneEps > tEps + 5)) {
                                shouldAutoLink = false;
                                const msg = `Nous avons trouvé "${details.name}" mais votre historique (${doneEps} eps vus jusqu'à la saison ${lastSeason}) ne correspond pas à cette série (${tSeasons} saisons, ${tEps} eps).\n\nLier quand même ?`;
                                shouldAutoLink = await window.customConfirm(msg, window.I18n ? window.I18n.get('action.inconsistency') : "Incohérence détectée", window.I18n ? window.I18n.get('action.link_anyway') : "Lier quand même", window.I18n ? window.I18n.get('action.search_correct') : "Rechercher la bonne");
                            }
                        }
                    }

                    if (result && shouldAutoLink) {
                        await db.shows.update(show.id, { tmdb_id: result.id, poster_path: result.poster_path, backdrop_path: result.backdrop_path });
                        openDetail(result, 'tv');
                    } else {
                        const manualResult = await openTmdbFixModal(displayName, 'tv');
                        if (manualResult) {
                            await db.shows.update(show.id, {
                                tmdb_id: manualResult.id,
                                poster_path: manualResult.poster_path,
                                backdrop_path: manualResult.backdrop_path,
                                name: manualResult.name || manualResult.title
                            });
                            refreshSeriesList();
                            openDetail(manualResult, 'tv');
                        }
                    }
                });
            };

            if (category === 'finished' || category === 'upcoming') {
                card.className = 'poster-card';
                const isUnknown = show.name === 'Série inconnue' || !show.tmdb_id;
                const badgeHtml = category === 'upcoming' && releaseDateLabel ? `<div class="poster-badge">${escapeHtml(releaseDateLabel)}</div>` : '';
                card.innerHTML = posterUrl
                    ? `<img src="${posterUrl}" alt="${safeName}" loading="lazy"><div class="poster-overlay"><div>${safeName}</div></div>${badgeHtml}`
                    : `<div class="poster-placeholder">${safeName}</div>${badgeHtml}`;

                if (isUnknown) {
                    card.innerHTML += `<div class="ep-delete" title="Supprimer" style="position:absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border-radius: 50%; display:flex; align-items:center; justify-content:center; width:36px; height:36px; color:white; cursor:pointer; z-index: 10;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </div>`;
                }

                attachClickListener(card);

                if (isUnknown) {
                    card.querySelector('.ep-delete')?.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (await window.customConfirm(window.I18n ? window.I18n.get('series.delete_confirm', { name: show.name }) : `Voulez-vous vraiment retirer "${show.name}" de votre liste ?`, window.I18n ? window.I18n.get('action.delete') : "Supprimer", window.I18n ? window.I18n.get('action.delete') : "Supprimer", window.I18n ? window.I18n.get('action.cancel') : "Annuler")) {
                            await db.shows.update(show.id, { is_followed: 0 });
                            refreshSeriesList();
                            showToast(window.I18n ? window.I18n.get('series.deleted', { name: safeName }) : `${safeName} retiré`);
                        }
                    });
                }

                if (category === 'finished') {
                    finishedFrag.appendChild(card);
                    finishedCount++;
                } else {
                    upcomingFrag.appendChild(card);
                    upcomingCount++;
                }
            } else {
                card.className = 'episode-card';
                const isUnknown = show.name === 'Série inconnue' || !show.tmdb_id;
                card.innerHTML = `
                    ${posterUrl ? `<img class="ep-poster" src="${posterUrl}" alt="${safeName}" loading="lazy">` : `<div class="ep-poster" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);text-align:center;word-break:break-all;">${escapeHtml(displayName.substring(0, 30))}</div>`}
                    <div class="ep-info" style="cursor:pointer; flex: 1; min-width: 0;">
                        <div class="ep-show-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeName} ›</div>
                        <div class="ep-episode">S${String(nextSeason).padStart(2, '0')} | E${String(nextEp).padStart(2, '0')} ${remainingLabel ? `<span class="ep-remaining">${escapeHtml(remainingLabel)}</span>` : ''}</div>
                        ${totalEps > 0 ? `<div class="ep-progress-track"><div class="ep-progress-fill" style="width:${progressPct}%"></div></div>` : ''}
                    </div>
                    ${isUnknown ? `<div class="ep-delete" title="Supprimer" style="display:flex; align-items:center; justify-content:center; width:36px; height:36px; color:var(--text-muted); cursor:pointer; margin-right:4px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </div>` : ''}
                    <button type="button" class="ep-check" data-show-id="${show.id}" aria-label="${safeName} S${nextSeason}E${nextEp}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                `;

                attachClickListener(card.querySelector('.ep-info'));

                if (isUnknown) {
                    card.querySelector('.ep-delete')?.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (await window.customConfirm(window.I18n ? window.I18n.get('series.delete_confirm', { name: show.name }) : `Voulez-vous vraiment retirer "${show.name}" de votre liste ?`, window.I18n ? window.I18n.get('action.delete') : "Supprimer", window.I18n ? window.I18n.get('action.delete') : "Supprimer", window.I18n ? window.I18n.get('action.cancel') : "Annuler")) {
                            await db.shows.update(show.id, { is_followed: 0 });
                            refreshSeriesList();
                            showToast(window.I18n ? window.I18n.get('series.deleted', { name: safeName }) : `${safeName} retiré`);
                        }
                    });
                }

                const checkBtn = card.querySelector('.ep-check');
                checkBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (checkBtn.dataset.busy === '1') return;
                    checkBtn.dataset.busy = '1';
                    checkBtn.classList.add('checked');
                    await db.watch_history.add({
                        show_tvtime_id: show.tvtime_id ? String(show.tvtime_id) : '',
                        show_name: show.name,
                        season_number: nextSeason,
                        episode_number: nextEp,
                        episode_id: '',
                        watched_at: new Date().toISOString(),
                        rewatch_count: 0,
                        runtime: 0
                    });
                    showToast(window.I18n ? window.I18n.get('toast.seen', { name: safeName }) : `${safeName} S${nextSeason}E${nextEp} vu ✓`);
                    const newDone = doneEps + 1;
                    if (show.nb_episodes_total > 0 && newDone >= show.nb_episodes_total) {
                        await db.shows.update(show.id, { is_finished: 1 });
                        show.is_finished = 1;
                        showToast(`"${safeName}" marquée comme terminée automatiquement !`);
                    }
                    setTimeout(() => refreshSeriesList(), 350);
                });

                watchingFrag.appendChild(card);
                watchingCount++;
            }
        }

        if (reqId !== _seriesReqId) return;
        watchingList.innerHTML = '';
        finishedList.innerHTML = '';
        upcomingList.innerHTML = '';

        watchingList.appendChild(watchingFrag);
        finishedList.appendChild(finishedFrag);
        upcomingList.appendChild(upcomingFrag);

        const exploreCta = `<button type="button" class="action-btn primary empty-cta-btn" onclick="window.appNavigateTo('search')">${escapeHtml(window.I18n ? window.I18n.get('nav.explore') : 'Explorer')}</button>`;
        if (watchingCount === 0) watchingList.innerHTML = `<div class="empty-state"><div class="empty-icon">📺</div><h3>${escapeHtml(window.I18n ? window.I18n.get('series.empty_watching') : 'Aucune série en cours')}</h3>${exploreCta}</div>`;
        if (finishedCount === 0) finishedList.innerHTML = `<div class="empty-state"><div class="empty-icon">🏁</div><h3>${escapeHtml(window.I18n ? window.I18n.get('series.empty_finished') : 'Aucune série terminée')}</h3></div>`;
        if (upcomingCount === 0) upcomingList.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div><h3>${escapeHtml(window.I18n ? window.I18n.get('series.empty_upcoming') : 'Rien à venir')}</h3></div>`;
    }

    document.getElementById('series-sort')?.addEventListener('change', refreshSeriesList);
    const btnSearchSeries = document.getElementById('btn-search-series');
    if (btnSearchSeries) {
        btnSearchSeries.addEventListener('click', () => {
            const container = document.getElementById('series-search-container');
            container?.classList.toggle('hidden');
            const input = document.getElementById('series-local-search');
            if (container && !container.classList.contains('hidden')) input?.focus();
            else if (input) { input.value = ''; refreshSeriesList(); }
        });
    }
    const seriesSearchInput = document.getElementById('series-local-search');
    seriesSearchInput?.addEventListener('input', debounce(() => refreshSeriesList(), 200));

    document.getElementById('btn-random-series')?.addEventListener('click', async () => {
        let shows = await db.shows.where('is_followed').equals(1).toArray();
        shows = shows.filter(s => !s.is_finished && s.tmdb_id);
        if (selectedSeriesGenre) {
            shows = shows.filter(s => (s.genres || []).some(g => (typeof g === 'string' ? g : g?.name) === selectedSeriesGenre));
        }
        if (shows.length === 0) {
            showToast(window.I18n && window.I18n.lang === 'en' ? 'No eligible shows found.' : 'Aucune série éligible trouvée.');
            return;
        }
        const pick = shows[Math.floor(Math.random() * shows.length)];
        showToast(`🎲 ${escapeHtml(pick.name)}`);
        openDetail({ id: pick.tmdb_id, name: pick.name, poster_path: pick.poster_path, backdrop_path: pick.backdrop_path }, 'tv');
    });

    // ---- Films list ----
    let _filmsReqId = 0;
    let selectedFilmsGenre = '';

    async function refreshFilmsList() {
        const reqId = ++_filmsReqId;
        const watchlistList = document.getElementById('films-watchlist-list');
        const watchedList = document.getElementById('films-list');
        const upcomingList = document.getElementById('films-upcoming-list');
        if (!watchlistList || !watchedList || !upcomingList) return;

        const sortVal = document.getElementById('films-sort')?.value || 'added_desc';
        const searchQuery = (document.getElementById('films-local-search')?.value || '').trim().toLowerCase();

        watchlistList.innerHTML = Array(3).fill('<div class="skeleton-grid-item skeleton"></div>').join('');
        watchedList.innerHTML = Array(3).fill('<div class="skeleton-grid-item skeleton"></div>').join('');
        upcomingList.innerHTML = Array(3).fill('<div class="skeleton-grid-item skeleton"></div>').join('');

        let movies = await db.movies.toArray();
        if (reqId !== _filmsReqId) return;

        renderGenreFilterBar('films-genre-filters', movies, selectedFilmsGenre, (g) => {
            selectedFilmsGenre = g;
            refreshFilmsList();
        });

        if (searchQuery) {
            movies = movies.filter(m => (m.name || '').toLowerCase().includes(searchQuery));
        }
        if (selectedFilmsGenre) {
            movies = movies.filter(m => (m.genres || []).some(g => (typeof g === 'string' ? g : g?.name) === selectedFilmsGenre));
        }

        movies.sort((a, b) => {
            if (sortVal === 'name_asc') return (a.name || '').localeCompare(b.name || '');
            if (sortVal === 'name_desc') return (b.name || '').localeCompare(a.name || '');
            if (sortVal === 'added_asc') return a.id - b.id;
            if (sortVal === 'rating_desc') return (b.user_rating || 0) - (a.user_rating || 0);
            if (sortVal === 'release_desc') return (parseLocalDate(b.release_date)?.getTime() || 0) - (parseLocalDate(a.release_date)?.getTime() || 0);
            return b.id - a.id;
        });

        watchlistList.innerHTML = '';
        watchedList.innerHTML = '';
        upcomingList.innerHTML = '';

        let wlCount = 0, wCount = 0, upCount = 0;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        for (const movie of movies) {
            if (movie.status === 'none') continue;
            const posterUrl = movie.poster_path ? TMDB.imgUrl(movie.poster_path, 'w342') : null;
            const year = escapeHtml((movie.release_date || '').split('-')[0]);
            const safeName = escapeHtml(movie.name || 'Film');

            let category = 'watchlist';
            const relDate = parseLocalDate(movie.release_date);
            if (movie.status === 'watched') category = 'watched';
            else if (relDate && relDate > todayStart) category = 'upcoming';

            const isUnknown = movie.name === 'Film inconnu' || !movie.tmdb_id;
            const div = document.createElement('div');
            div.className = 'poster-card';
            div.innerHTML = posterUrl
                ? `<img src="${posterUrl}" alt="${safeName}" loading="lazy"><div class="poster-overlay"><div>${safeName}</div><div class="poster-year">${year}</div></div>`
                : `<div class="poster-placeholder">${safeName}</div>`;

            if (isUnknown) {
                div.innerHTML += `<div class="ep-delete" title="Supprimer" style="position:absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); border-radius: 50%; display:flex; align-items:center; justify-content:center; width:36px; height:36px; color:white; cursor:pointer; z-index: 10;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </div>`;
            }

            div.addEventListener('click', async (e) => {
                if (e.target.closest('.ep-delete')) {
                    e.stopPropagation();
                    if (await window.customConfirm(window.I18n ? window.I18n.get('series.delete_confirm', { name: movie.name }) : `Voulez-vous vraiment retirer "${movie.name}" de votre liste ?`, window.I18n ? window.I18n.get('action.delete') : "Supprimer", window.I18n ? window.I18n.get('action.delete') : "Supprimer", window.I18n ? window.I18n.get('action.cancel') : "Annuler")) {
                        if (movie.uuid) await db.movie_watches.where('movie_uuid').equals(movie.uuid).delete();
                        if (movie.tmdb_id) await db.list_items.where('tmdb_id').equals(movie.tmdb_id).filter(li => li.media_type === 'movie').delete();
                        await db.movies.delete(movie.id);
                        refreshFilmsList();
                        showToast(window.I18n ? window.I18n.get('series.deleted', { name: safeName }) : `${safeName} retiré`);
                    }
                    return;
                }

                if (movie.tmdb_id) {
                    openDetail({ id: movie.tmdb_id, title: movie.name, poster_path: movie.poster_path, backdrop_path: movie.backdrop_path }, 'movie');
                    return;
                }
                const result = await TMDB.findMovieByName(movie.name);
                if (result) {
                    await db.movies.update(movie.id, { tmdb_id: result.id, poster_path: result.poster_path, backdrop_path: result.backdrop_path });
                    openDetail(result, 'movie');
                } else {
                    const manualResult = await openTmdbFixModal(movie.name, 'movie');
                    if (manualResult) {
                        await db.movies.update(movie.id, {
                            tmdb_id: manualResult.id,
                            poster_path: manualResult.poster_path,
                            backdrop_path: manualResult.backdrop_path,
                            name: manualResult.name || manualResult.title
                        });
                        refreshFilmsList();
                        openDetail(manualResult, 'movie');
                    }
                }
            });

            if (category === 'upcoming') { upcomingList.appendChild(div); upCount++; }
            else if (category === 'watched') { watchedList.appendChild(div); wCount++; }
            else { watchlistList.appendChild(div); wlCount++; }
        }

        const exploreCta = `<button type="button" class="action-btn primary empty-cta-btn" onclick="window.appNavigateTo('search')">${escapeHtml(window.I18n ? window.I18n.get('nav.explore') : 'Explorer')}</button>`;
        if (wlCount === 0) watchlistList.innerHTML = `<div class="empty-state"><div class="empty-icon">🎬</div><h3>${escapeHtml(window.I18n ? window.I18n.get('movies.empty_watchlist') : 'Rien à voir')}</h3>${exploreCta}</div>`;
        if (wCount === 0) watchedList.innerHTML = `<div class="empty-state"><div class="empty-icon">🍿</div><h3>${escapeHtml(window.I18n ? window.I18n.get('movies.empty_watched') : 'Aucun film vu')}</h3></div>`;
        if (upCount === 0) upcomingList.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div><h3>${escapeHtml(window.I18n ? window.I18n.get('movies.empty_upcoming') : 'Rien à venir')}</h3></div>`;
    }

    document.getElementById('films-sort')?.addEventListener('change', refreshFilmsList);
    const btnSearchFilms = document.getElementById('btn-search-films');
    if (btnSearchFilms) {
        btnSearchFilms.addEventListener('click', () => {
            const container = document.getElementById('films-search-container');
            container?.classList.toggle('hidden');
            const input = document.getElementById('films-local-search');
            if (container && !container.classList.contains('hidden')) input?.focus();
            else if (input) { input.value = ''; refreshFilmsList(); }
        });
    }
    const filmsSearchInput = document.getElementById('films-local-search');
    filmsSearchInput?.addEventListener('input', debounce(() => refreshFilmsList(), 200));

    document.getElementById('btn-random-movie')?.addEventListener('click', async () => {
        let movies = await db.movies.where('status').equals('watchlist').toArray();
        movies = movies.filter(m => m.tmdb_id);
        if (selectedFilmsGenre) {
            movies = movies.filter(m => (m.genres || []).some(g => (typeof g === 'string' ? g : g?.name) === selectedFilmsGenre));
        }
        if (movies.length === 0) {
            showToast(window.I18n && window.I18n.lang === 'en' ? 'No watchlist movies found.' : 'Aucun film dans votre liste à voir.');
            return;
        }
        const pick = movies[Math.floor(Math.random() * movies.length)];
        showToast(`🎲 ${escapeHtml(pick.name)}`);
        openDetail({ id: pick.tmdb_id, title: pick.name, poster_path: pick.poster_path, backdrop_path: pick.backdrop_path }, 'movie');
    });

    // ---- Profile ----
    async function refreshProfile() {
        const lang = (window.I18n && window.I18n.lang) || 'fr';
        const locale = lang === 'en' ? 'en-US' : 'fr-FR';
        const profileHero = document.getElementById('profile-display-name');
        if (!profileHero) return;

        // --- 1. Populate Hero ---
        const firstName = localStorage.getItem('dfwatch_firstname') || '';
        const lastName = localStorage.getItem('dfwatch_lastname') || '';
        let dobStr = localStorage.getItem('dfwatch_dob');
        if (!dobStr) {
            const oldAge = localStorage.getItem('dfwatch_age');
            if (oldAge) {
                const parsed = parseInt(oldAge, 10);
                if (!isNaN(parsed)) {
                    const currentYear = new Date().getFullYear();
                    const birthYear = parsed > 1000 ? parsed : (currentYear - parsed);
                    dobStr = `${birthYear}-01-01`;
                    localStorage.setItem('dfwatch_dob', dobStr);
                    localStorage.removeItem('dfwatch_age');
                }
            }
        }
        const ageFormat = localStorage.getItem('dfwatch_age_format') || 'simple';

        let displayName = window.I18n ? window.I18n.get('profile.user') : 'Utilisateur';
        let initials = '?';
        if (firstName || lastName) {
            displayName = `${firstName} ${lastName}`.trim();
            initials = (firstName ? firstName[0].toUpperCase() : '') + (lastName ? lastName[0].toUpperCase() : '');
        }

        profileHero.textContent = displayName;
        const initialsEl = document.getElementById('profile-avatar-initials');
        if (initialsEl) initialsEl.textContent = initials;

        // Avatar photo
        const avatarPhoto = document.getElementById('profile-avatar-photo');
        const customAvatar = localStorage.getItem('dfwatch_avatar_custom');
        if (avatarPhoto) {
            if (customAvatar) {
                avatarPhoto.src = customAvatar;
                avatarPhoto.classList.remove('hidden');
            } else {
                avatarPhoto.classList.add('hidden');
            }
        }

        function computeFormattedAge(dobRaw, format) {
            if (!dobRaw) return '';
            const dob = parseLocalDate(dobRaw);
            if (!dob || isNaN(dob.getTime())) return '';

            const now = new Date();
            let years = now.getFullYear() - dob.getFullYear();
            let months = now.getMonth() - dob.getMonth();
            let days = now.getDate() - dob.getDate();

            if (days < 0) {
                months--;
                const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                days += prevMonth.getDate();
            }
            if (months < 0) {
                years--;
                months += 12;
            }
            if (years < 0) return '';

            if (lang === 'en') {
                let res = `${years} yr${years > 1 ? 's' : ''}`;
                if (format === 'detailed' && months > 0) res += `, ${months} mo`;
                else if (format === 'precise') {
                    const parts = [res];
                    if (months > 0) parts.push(`${months} mo`);
                    if (days > 0) parts.push(`${days} d`);
                    res = parts.join(', ');
                }
                return res;
            }

            let res = `${years} ans`;
            if (format === 'detailed') {
                if (months > 0) res += ` et ${months} mois`;
            } else if (format === 'precise') {
                if (months > 0 && days > 0) res = `${years} ans, ${months} mois et ${days} jours`;
                else if (months > 0) res = `${years} ans et ${months} mois`;
                else if (days > 0) res = `${years} ans et ${days} jours`;
            }
            return res;
        }

        const metaEl = document.getElementById('profile-display-meta');
        if (metaEl) {
            metaEl.textContent = dobStr
                ? computeFormattedAge(dobStr, ageFormat)
                : (window.I18n ? window.I18n.get('profile.meta') : 'Complétez votre profil');
        }

        // XP System
        if (window.ProfileCard) {
            const seriesStatsXP = await DB.getSeriesStats();
            const movieStatsXP = await DB.getMovieStats();
            let achievementCountXP = 0;
            try {
                const ach = await db.achievements.toArray();
                achievementCountXP = ach.filter(a => a.unlocked).length;
            } catch (e) {}
            const allMoviesXP = await db.movies.toArray();
            const xpStats = {
                episodes: seriesStatsXP.count,
                movies: allMoviesXP.filter(m => m.status === 'watched').length,
                totalMinutes: seriesStatsXP.totalMinutes + movieStatsXP.totalMinutes,
                achievements: achievementCountXP,
            };
            const xp = ProfileCard.calculateXP(xpStats);
            const level = ProfileCard.getLevel(xp);
            const xpCurrent = ProfileCard.getXPForLevel(level);
            const xpNext = ProfileCard.getXPForLevel(level + 1);
            const progress = xpNext > xpCurrent ? ((xp - xpCurrent) / (xpNext - xpCurrent)) * 100 : 100;
            const rankName = ProfileCard.getRankName(level, lang, xp);
            const rank = ProfileCard.getRank(level);

            window.dfwatch_current_level = level;

            const avatarRingDiv = document.getElementById('profile-avatar-ring');
            const avatarRingBgDiv = document.querySelector('.profile-avatar-ring-bg');
            const rankBadgeDiv = document.getElementById('profile-rank-name');
            const ringElements = [avatarRingDiv, avatarRingBgDiv].filter(Boolean);

            [...ringElements, rankBadgeDiv].filter(Boolean).forEach(el => {
                if (el.id === 'profile-rank-name') el.className = 'profile-rank-badge';
                else if (el.classList.contains('profile-avatar-ring-bg')) el.className = 'profile-avatar-ring-bg';
                else el.className = 'profile-avatar-ring';
                el.removeAttribute('data-style');
                el.removeAttribute('data-anim');
                el.style = el.id === 'profile-rank-name' ? 'margin:0;' : '';
            });

            if (ringElements.length > 0) {
                const customRing = safeJsonParse(localStorage.getItem('dfwatch_custom_ring'), null);
                if (!customRing) {
                    const oldSaved = localStorage.getItem('dfwatch_avatar_ring');
                    ringElements.forEach(el => {
                        if (oldSaved) el.classList.add(oldSaved);
                        else if (rank.cssClass) el.classList.add(rank.cssClass);
                    });
                } else {
                    ringElements.forEach(el => {
                        if (customRing.style) el.setAttribute('data-style', customRing.style);
                        if (customRing.anim) el.setAttribute('data-anim', customRing.anim);
                        (customRing.colors || []).forEach((c, i) => {
                            if (c) el.style.setProperty(`--ring-c${i + 1}`, c);
                        });
                    });
                    if (window.renderAvatarParticles) {
                        window.renderAvatarParticles(customRing.style === 'particles' ? customRing.colors : null);
                    }
                }
                if (avatarRingDiv) avatarRingDiv.style.setProperty('--progress', Math.max(0, Math.min(1, progress / 100)));
            }

            if (rankBadgeDiv) {
                const customBadge = safeJsonParse(localStorage.getItem('dfwatch_custom_badge'), null);
                if (!customBadge) {
                    if (rank.cssClass) rankBadgeDiv.classList.add(rank.cssClass);
                } else {
                    if (customBadge.style) rankBadgeDiv.setAttribute('data-style', customBadge.style);
                    if (customBadge.anim) rankBadgeDiv.setAttribute('data-anim', customBadge.anim);
                    (customBadge.colors || []).forEach((c, i) => {
                        if (c) rankBadgeDiv.style.setProperty(`--ring-c${i + 1}`, c);
                    });
                }
            }

            const lvlBadge = document.getElementById('profile-level-badge');
            if (lvlBadge) lvlBadge.textContent = `${xp.toLocaleString(locale)} XP`;
            const rankNameEl = document.getElementById('profile-rank-name');
            if (rankNameEl) rankNameEl.textContent = `${rank.icon} ${rankName}`;

            const nextRank = ProfileCard.XP_RANKS.find(r => r.minLevel > level);
            let nextLevelStr = '';
            if (nextRank) {
                const nextRankXP = ProfileCard.getXPForLevel(nextRank.minLevel);
                const xpToRank = Math.max(0, nextRankXP - xp);
                const moviesNeeded = Math.ceil(xpToRank / 25);
                const epsNeeded = Math.ceil(xpToRank / 10);
                const nextRankName = lang === 'en' ? nextRank.name_en : nextRank.name_fr;
                nextLevelStr = xpToRank > 0
                    ? (lang === 'en'
                        ? `${moviesNeeded} movies / ${epsNeeded} eps to reach ${nextRankName}`
                        : `${moviesNeeded} films / ${epsNeeded} eps avant le rang ${nextRankName}`)
                    : '';
            }
            const nextLevelEl = document.getElementById('profile-next-level');
            if (nextLevelEl) nextLevelEl.textContent = nextLevelStr;
        }

        // Populate Hero Genres
        const savedGenres = safeJsonParse(localStorage.getItem('dfwatch_genres'), []);
        const heroGenresDiv = document.getElementById('profile-hero-genres');
        if (heroGenresDiv) {
            heroGenresDiv.innerHTML = '';
            (Array.isArray(savedGenres) ? savedGenres : []).forEach(genre => {
                const span = document.createElement('span');
                span.className = 'hero-genre-tag';
                span.textContent = genre;
                heroGenresDiv.appendChild(span);
            });
        }

        // Populate Edit Modal inputs safely
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        setVal('profile-firstname', firstName);
        setVal('profile-lastname', lastName);
        setVal('profile-dob', dobStr || '');
        setVal('profile-age-format', ageFormat);
        setVal('profile-country', localStorage.getItem('dfwatch_country') || 'FR');
        setVal('profile-tmdb-key', localStorage.getItem('custom_tmdb_api_key') || '');
        setVal('profile-tvdb-key', localStorage.getItem('custom_tvdb_api_key') || '');
        document.querySelectorAll('#profile-edit-modal .genre-checkbox input').forEach(cb => {
            cb.checked = Array.isArray(savedGenres) && savedGenres.includes(cb.value);
        });

        // --- 2. Calculate Stats ---
        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const totalRuntimeMinutes = seriesStats.totalMinutes + movieStats.totalMinutes;
        const hours = Math.floor(totalRuntimeMinutes / 60);

        const totalTimeEl = document.getElementById('stat-total-time');
        if (totalTimeEl) totalTimeEl.textContent = hours > 0 ? `${hours}h` : '0h';

        const shows = await db.shows.where('is_followed').equals(1).toArray();
        const completedSeriesCount = shows.filter(s => s.is_finished === 1).length;
        const totalSeriesEl = document.getElementById('stat-total-series');
        if (totalSeriesEl) totalSeriesEl.textContent = completedSeriesCount;

        const movies = await db.movies.toArray();
        const totalMoviesEl = document.getElementById('stat-total-movies');
        if (totalMoviesEl) totalMoviesEl.textContent = movies.filter(m => m.status === 'watched').length;

        // --- 3. Top 10 horizontal scroll ---
        const top10Scroll = document.getElementById('profile-top10-scroll');
        if (top10Scroll) {
            top10Scroll.innerHTML = '';
            const savedTop10 = safeJsonParse(localStorage.getItem('dfwatch_top10'), []);
            if (!Array.isArray(savedTop10) || savedTop10.length === 0) {
                top10Scroll.innerHTML = `<div style="color:var(--text-muted); font-size:13px; padding: 20px 0;">${lang === 'en' ? 'No Top 10 selected yet. Edit your profile to add titles!' : 'Aucun top 10 sélectionné. Éditez votre profil pour en ajouter !'}</div>`;
            } else {
                for (const item of savedTop10) {
                    const isMovie = item.type === 'movie';
                    const dbTable = isMovie ? db.movies : db.shows;
                    const dbItem = await dbTable.where('tmdb_id').equals(item.tmdb_id).first();
                    if (!dbItem || !dbItem.poster_path) continue;
                    const posterUrl = TMDB.imgUrl(dbItem.poster_path, 'w185');
                    if (!posterUrl) continue;

                    const div = document.createElement('div');
                    div.className = 'h-poster';
                    const img = document.createElement('img');
                    img.src = posterUrl;
                    img.alt = dbItem.name || '';
                    img.loading = 'lazy';
                    div.appendChild(img);
                    div.addEventListener('click', async () => {
                        const details = isMovie ? await TMDB.getMovieDetails(dbItem.tmdb_id) : await TMDB.getShowDetails(dbItem.tmdb_id);
                        if (details) openDetail(details, isMovie ? 'movie' : 'tv');
                    });
                    top10Scroll.appendChild(div);
                }
            }
        }

        updateSidebarStats();

        // --- 4. Watching Tendency & My Taste ---
        const genreTally = {};
        const processGenres = (item) => {
            if (item.genres && Array.isArray(item.genres)) {
                item.genres.forEach(g => {
                    const genreName = typeof g === 'string' ? g : (g ? g.name : null);
                    if (!genreName || genreName === 'null') return;
                    const baseCategory = window.ProfileCard ? window.ProfileCard.getGenreCategory(genreName) : genreName;
                    if (!baseCategory || baseCategory === 'null') return;
                    genreTally[baseCategory] = (genreTally[baseCategory] || 0) + 1;
                });
            }
        };

        const allDbShows = await db.shows.toArray();
        const allDbMovies = await db.movies.toArray();
        allDbShows.forEach(processGenres);
        allDbMovies.forEach(processGenres);

        const sortedGenres = Object.keys(genreTally).sort((a, b) => genreTally[b] - genreTally[a]);
        const tasteSummaryEl = document.getElementById('profile-taste-summary');
        const genresListEl = document.getElementById('profile-genres-list');

        if (tasteSummaryEl && genresListEl) {
            if (sortedGenres.length > 0) {
                const top3 = sortedGenres.slice(0, 3).map(g => escapeHtml(window.ProfileCard ? window.ProfileCard.translateGenre(g) : g));

                let titleDesc = '';
                if (window.ProfileCard && typeof window.ProfileCard.getBestPersonality === 'function') {
                    const statsForTitle = { totalHours: hours, episodes: seriesStats.count, movies: movies.filter(m => m.status === 'watched').length, topGenres: sortedGenres };
                    const bestTitle = escapeHtml(window.ProfileCard.getBestPersonality(statsForTitle, lang));
                    const asText = lang === 'en' ? 'As a' : 'En tant que';
                    titleDesc = `${asText} <span style="color:var(--iris-400); font-weight:700;">${bestTitle}</span>, `;
                }

                const baseStr = window.I18n ? window.I18n.get('profile.taste_desc', { top: `<span style="color:var(--cyan-400)">${top3.join(', ')}</span>` }) : `vous êtes un grand fan de <span style="color:var(--cyan-400)">${top3.join(', ')}</span>.`;
                const finalStr = titleDesc ? `${titleDesc}${baseStr.charAt(0).toLowerCase()}${baseStr.slice(1)}` : baseStr;
                tasteSummaryEl.innerHTML = finalStr;

                genresListEl.innerHTML = '';
                sortedGenres.forEach(genre => {
                    const translatedGenre = window.ProfileCard ? window.ProfileCard.translateGenre(genre) : genre;
                    const count = genreTally[genre];
                    const div = document.createElement('div');
                    div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--surface-3); border-radius:var(--r-8); font-size:13px;';
                    const titleCountStr = window.I18n ? window.I18n.get('profile.titles_count', { count }) : `${count} titre${count > 1 ? 's' : ''}`;
                    div.innerHTML = `<span>${escapeHtml(translatedGenre)}</span><span style="color:var(--text-muted); font-weight:700;">${escapeHtml(titleCountStr)}</span>`;
                    genresListEl.appendChild(div);
                });
            } else {
                tasteSummaryEl.textContent = window.I18n ? window.I18n.get('profile.taste_empty') : 'Continuez à utiliser l\'application pour découvrir vos genres favoris !';
                genresListEl.innerHTML = '';
            }
        }

        // Sync ALL TMDB data
        const btnSyncAll = document.getElementById('btn-sync-all-tmdb');
        if (btnSyncAll && !btnSyncAll.dataset.bound) {
            btnSyncAll.dataset.bound = '1';
            btnSyncAll.addEventListener('click', async function() {
                if (!await window.customConfirm(window.I18n ? window.I18n.get('action.sync_global_prompt') : "Voulez-vous vraiment actualiser toutes vos données depuis TMDB ? (Cela peut prendre plusieurs secondes)", window.I18n ? window.I18n.get('action.sync_global_title') : "Actualisation globale", window.I18n ? window.I18n.get('action.sync_global_btn') : "Actualiser", window.I18n ? window.I18n.get('action.sync_global_cancel') : "Annuler")) return;

                const prevText = this.textContent;
                this.textContent = window.I18n ? window.I18n.get('action.sync_global_progress') : 'Synchronisation en cours...';
                this.disabled = true;
                showToast(window.I18n ? window.I18n.get('action.sync_global_progress') : "Actualisation en cours...");

                try {
                    const allShowsSync = await db.shows.toArray();
                    for (const s of allShowsSync) {
                        if (!s.tmdb_id) continue;
                        try {
                            const details = await TMDB.getShowDetails(s.tmdb_id);
                            if (details) {
                                const updates = {
                                    name: details.name || s.name,
                                    poster_path: details.poster_path || s.poster_path,
                                    backdrop_path: details.backdrop_path || s.backdrop_path,
                                    genres: Array.isArray(details.genres) ? details.genres.map(g => g.name) : s.genres,
                                    origin_country: Array.isArray(details.origin_country) ? details.origin_country : s.origin_country,
                                    nb_episodes_total: details.number_of_episodes || s.nb_episodes_total,
                                    next_air_date: details.next_episode_to_air ? details.next_episode_to_air.air_date : null,
                                    last_sync: Date.now()
                                };
                                await db.shows.update(s.id, updates);
                                if (details.name && s.name && details.name !== s.name) {
                                    await db.watch_history.where('show_name').equals(s.name).modify({ show_name: details.name });
                                }
                            }
                        } catch (e) {}
                    }

                    const allMoviesSync = await db.movies.toArray();
                    for (const m of allMoviesSync) {
                        if (!m.tmdb_id) continue;
                        try {
                            const details = await TMDB.getMovieDetails(m.tmdb_id);
                            if (details) {
                                await db.movies.update(m.id, {
                                    name: details.title || m.name,
                                    release_date: details.release_date || m.release_date,
                                    poster_path: details.poster_path || m.poster_path,
                                    backdrop_path: details.backdrop_path || m.backdrop_path,
                                    genres: Array.isArray(details.genres) ? details.genres.map(g => g.name) : m.genres,
                                    production_countries: Array.isArray(details.production_countries) ? details.production_countries : m.production_countries,
                                    runtime: details.runtime ? details.runtime * 60 : m.runtime
                                });
                            }
                        } catch (e) {}
                    }
                    showToast(window.I18n ? window.I18n.get('action.sync_global_done') : "Actualisation terminée !");
                    refreshSeriesList();
                    refreshFilmsList();
                    refreshProfile();
                    refreshStats();
                } catch (e) {
                    showToast(window.I18n ? window.I18n.get('action.sync_global_error') : "Erreur lors de l'actualisation");
                } finally {
                    this.textContent = prevText;
                    this.disabled = false;
                }
            });
        }

        // Sync finished series button
        const btnSync = document.getElementById('btn-sync-finished');
        if (btnSync && !btnSync.dataset.bound) {
            btnSync.dataset.bound = '1';
            btnSync.addEventListener('click', async function() {
                const prevText = this.textContent;
                this.textContent = 'Synchronisation en cours...';
                this.disabled = true;

                try {
                    const followed = await db.shows.where('is_followed').equals(1).toArray();
                    for (const show of followed) {
                        if (!show.tmdb_id) continue;
                        const details = await TMDB.getShowDetails(show.tmdb_id);
                        if (!details) continue;

                        let history = [];
                        if (show.tvtime_id) history = await db.watch_history.where('show_tvtime_id').equals(String(show.tvtime_id)).toArray();
                        if (history.length === 0) history = await db.watch_history.where('show_name').equals(show.name).toArray();

                        const uniqueWatched = new Set();
                        history.forEach(h => {
                            if (h.season_number > 0) uniqueWatched.add(`S${h.season_number}E${h.episode_number}`);
                        });
                        const doneEps = uniqueWatched.size;
                        const totalEps = details.number_of_episodes || 0;

                        if (totalEps > 0) {
                            const shouldBeFinished = doneEps >= totalEps;
                            if ((show.is_finished === 1) !== shouldBeFinished) {
                                await db.shows.update(show.id, { is_finished: shouldBeFinished ? 1 : 0 });
                            }
                        }
                    }
                    showToast('Synchronisation terminée !');
                    refreshSeriesList();
                } catch (e) {
                    console.error(e);
                    showToast('Erreur lors de la synchronisation.');
                } finally {
                    this.textContent = prevText;
                    this.disabled = false;
                }
            });
        }
    }

    // ---- Stats & Achievements ----
    let statsChartInstance = null;
    let activeAchFilter = 'all';

    async function renderStatsChart() {
        const canvas = document.getElementById('stats-chart');
        if (!canvas || !window.Chart) return;

        const shows = (await db.shows.toArray()).filter(s => s.is_followed === 1 || s.is_finished === 1);
        const movies = (await db.movies.toArray()).filter(m => m.status === 'watched');

        const genreCounts = {};
        const countGenres = (items) => {
            items.forEach(item => {
                if (item.genres && Array.isArray(item.genres)) {
                    item.genres.forEach(g => {
                        const rawName = typeof g === 'string' ? g : (g ? g.name : '');
                        if (!rawName || rawName === 'null') return;
                        const cat = window.ProfileCard ? window.ProfileCard.getGenreCategory(rawName) : rawName;
                        const display = window.ProfileCard ? window.ProfileCard.translateGenre(cat) : cat;
                        if (display) genreCounts[display] = (genreCounts[display] || 0) + 1;
                    });
                }
            });
        };
        countGenres(shows);
        countGenres(movies);

        const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
        const labels = sortedGenres.map(g => g[0]);
        const data = sortedGenres.map(g => g[1]);
        const legendColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#8b8ba3';

        if (statsChartInstance) statsChartInstance.destroy();

        statsChartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: ['#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#6366f1'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: legendColor, font: { family: "'Inter', sans-serif", size: 11 } }
                    }
                },
                layout: { padding: 0 }
            }
        });
    }

    // ---- Wrapped Logic ----
    const btnShowWrapped = document.getElementById('btn-show-wrapped');
    const wrappedYearLabel = document.getElementById('wrapped-year-label');
    const currentYearStr = new Date().getFullYear().toString();
    if (wrappedYearLabel) wrappedYearLabel.textContent = currentYearStr;

    async function renderWrappedForYear(year) {
        const lang = (window.I18n && window.I18n.lang) || 'fr';
        const titleEl = document.getElementById('wrapped-year-title');
        if (titleEl) {
            titleEl.textContent = year === 'all'
                ? (lang === 'en' ? 'All Time' : 'Tout temps')
                : year;
        }
        const content = document.getElementById('wrapped-content');
        if (!content) return;
        content.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-secondary);">${lang === 'en' ? 'Calculating your stats...' : 'Calcul de votre année...'}</div>`;

        const [history, mHistory, allShows, allMovies] = await Promise.all([
            db.watch_history.toArray(),
            db.movie_watches.toArray(),
            db.shows.toArray(),
            db.movies.toArray()
        ]);

        const matchesYear = (iso) => year === 'all' || (iso && String(iso).startsWith(year));
        const yearHistory = history.filter(h => matchesYear(h.watched_at));
        const yearMovies = mHistory.filter(m => matchesYear(m.watched_at));

        let totalEpisodes = 0;
        let totalRewatches = 0;
        let totalEpMinutes = 0;
        const showWatchCount = {};

        yearHistory.forEach(h => {
            const views = 1 + (h.rewatch_count || 0);
            totalEpisodes += views;
            totalRewatches += (h.rewatch_count || 0);
            const min = DB.normalizeRuntimeMinutes(h.runtime, 45);
            totalEpMinutes += min * views;
            const sName = h.show_name || 'Inconnu';
            showWatchCount[sName] = (showWatchCount[sName] || 0) + views;
        });

        let totalMovies = 0;
        let totalMovieMinutes = 0;
        const movieWatchCount = {};
        const movieByUuid = new Map(allMovies.map(m => [m.uuid, m]));

        yearMovies.forEach(w => {
            const views = 1 + (w.rewatch_count || 0);
            totalMovies += views;
            totalRewatches += (w.rewatch_count || 0);
            const libMovie = w.movie_uuid ? movieByUuid.get(w.movie_uuid) : null;
            const min = DB.normalizeRuntimeMinutes(w.runtime || (libMovie ? libMovie.runtime : 0), 110);
            totalMovieMinutes += min * views;
            const mName = w.movie_name || (libMovie ? libMovie.name : 'Film');
            movieWatchCount[mName] = (movieWatchCount[mName] || 0) + views;
        });

        const genreTally = {};
        const watchedShowSet = new Set(Object.keys(showWatchCount));
        allShows.forEach(s => {
            if (!watchedShowSet.has(s.name) || !Array.isArray(s.genres)) return;
            s.genres.forEach(g => {
                const n = typeof g === 'string' ? g : (g && g.name);
                if (n) genreTally[n] = (genreTally[n] || 0) + (showWatchCount[s.name] || 1);
            });
        });
        const watchedMovieSet = new Set(Object.keys(movieWatchCount));
        allMovies.forEach(m => {
            if (!watchedMovieSet.has(m.name) || !Array.isArray(m.genres)) return;
            m.genres.forEach(g => {
                const n = typeof g === 'string' ? g : (g && g.name);
                if (n) genreTally[n] = (genreTally[n] || 0) + (movieWatchCount[m.name] || 1);
            });
        });

        const topShows = Object.entries(showWatchCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topMovies = Object.entries(movieWatchCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topGenreEntry = Object.entries(genreTally).sort((a, b) => b[1] - a[1])[0];
        const totalHours = Math.floor((totalEpMinutes + totalMovieMinutes) / 60);

        let html = `
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; text-align:center; background:var(--surface-2); padding: 16px; border-radius: var(--r-12);">
                <div><div style="font-size:22px; font-weight:800; color:var(--iris-400);">${totalEpisodes}</div><div style="font-size:11px; color:var(--text-secondary);">${lang === 'en' ? 'Episodes' : 'Épisodes'}</div></div>
                <div><div style="font-size:22px; font-weight:800; color:var(--cyan-400);">${totalMovies}</div><div style="font-size:11px; color:var(--text-secondary);">${lang === 'en' ? 'Movies' : 'Films'}</div></div>
                <div><div style="font-size:22px; font-weight:800; color:var(--text-primary);">${totalHours}h</div><div style="font-size:11px; color:var(--text-secondary);">${lang === 'en' ? 'Total' : 'Total'}</div></div>
                <div><div style="font-size:22px; font-weight:800; color:#f59e0b;">${totalRewatches}</div><div style="font-size:11px; color:var(--text-secondary);">Rewatch</div></div>
            </div>`;

        if (topGenreEntry) {
            html += `<div style="margin-top:12px; padding:10px 14px; background:var(--surface-3); border-radius:var(--r-8); display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px; color:var(--text-secondary);">${lang === 'en' ? 'Top Genre' : 'Genre favori'}</span>
                <strong style="color:var(--iris-400);">${escapeHtml(topGenreEntry[0])}</strong>
            </div>`;
        }

        html += `
            <div style="margin-top:14px;">
                <h3 style="font-size:15px; margin-bottom:10px; color:var(--text-primary);">${lang === 'en' ? 'Most Watched Shows' : 'Séries les plus dévorées'}</h3>
                <div style="display:flex; flex-direction:column; gap:8px;">
        `;
        if (topShows.length === 0) {
            html += `<div style="padding:12px; text-align:center; color:var(--text-muted);">${lang === 'en' ? 'No show data for this period.' : 'Aucune donnée série pour cette période.'}</div>`;
        } else {
            topShows.forEach((s, idx) => {
                html += `<div style="display:flex; justify-content:space-between; padding: 10px 12px; background:var(--surface-3); border-radius:var(--r-8);">
                    <span style="font-weight:600; color:var(--text-primary);">#${idx + 1} ${escapeHtml(s[0])}</span>
                    <span style="color:var(--text-muted);">${s[1]} ép.</span>
                </div>`;
            });
        }
        html += `</div></div>`;

        if (topMovies.length > 0) {
            html += `
                <div style="margin-top:14px;">
                    <h3 style="font-size:15px; margin-bottom:10px; color:var(--text-primary);">${lang === 'en' ? 'Top Movies' : 'Films marquants'}</h3>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${topMovies.map((m, idx) => `<div style="display:flex; justify-content:space-between; padding: 10px 12px; background:var(--surface-3); border-radius:var(--r-8);"><span style="font-weight:600; color:var(--text-primary);">#${idx + 1} ${escapeHtml(m[0])}</span><span style="color:var(--text-muted);">${m[1]}x</span></div>`).join('')}
                    </div>
                </div>`;
        }

        content.innerHTML = html;
    }

    if (btnShowWrapped) {
        btnShowWrapped.addEventListener('click', async () => {
            const yearSelect = document.getElementById('wrapped-year-select');
            if (yearSelect) {
                const [hist, mHist] = await Promise.all([db.watch_history.toArray(), db.movie_watches.toArray()]);
                const years = new Set([currentYearStr]);
                hist.forEach(h => { if (h.watched_at && /^\d{4}/.test(h.watched_at)) years.add(h.watched_at.slice(0, 4)); });
                mHist.forEach(m => { if (m.watched_at && /^\d{4}/.test(m.watched_at)) years.add(m.watched_at.slice(0, 4)); });
                const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
                yearSelect.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('') +
                    `<option value="all">${(window.I18n && window.I18n.get('common.all')) || 'Tous'}</option>`;
                yearSelect.value = currentYearStr;
                if (!yearSelect.dataset.bound) {
                    yearSelect.dataset.bound = '1';
                    yearSelect.addEventListener('change', () => renderWrappedForYear(yearSelect.value));
                }
            }
            window.openOverlay('wrapped-modal');
            await renderWrappedForYear(currentYearStr);
        });
    }

    function renderActivityHeatmapAndStreaks(watchHistory, movieWatches) {
        const container = document.getElementById('stats-activity-container');
        if (!container) return;
        const lang = (window.I18n && window.I18n.lang) || 'fr';

        const dayCounts = {};
        const allDates = [];
        watchHistory.forEach(h => {
            const key = DB.getLocalDateKey(h.watched_at);
            if (key) {
                allDates.push(key);
                dayCounts[key] = (dayCounts[key] || 0) + 1;
            }
        });
        movieWatches.forEach(m => {
            const key = DB.getLocalDateKey(m.watched_at);
            if (key) {
                allDates.push(key);
                dayCounts[key] = (dayCounts[key] || 0) + 1;
            }
        });

        const streaks = (window.Achievements && typeof Achievements.getStreaksFromDates === 'function')
            ? Achievements.getStreaksFromDates(allDates)
            : { currentStreak: 0, maxStreak: 0 };

        // Build 16 weeks (112 days) ending today
        const totalDays = 16 * 7;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setDate(today.getDate() - (totalDays - 1));

        let cellsHtml = '';
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = DB.getLocalDateKey(d);
            const count = dayCounts[key] || 0;
            const level = count === 0 ? 0 : (count === 1 ? 1 : (count <= 3 ? 2 : (count <= 6 ? 3 : 4)));
            cellsHtml += `<div class="activity-cell level-${level}" title="${escapeHtml(key)} : ${count}"></div>`;
        }

        const daysWord = (window.I18n && window.I18n.get('stats.days')) || 'jours';
        const curLabel = (window.I18n && window.I18n.get('stats.current_streak')) || 'Série actuelle';
        const bestLabel = (window.I18n && window.I18n.get('stats.best_streak')) || 'Meilleure série';
        const titleLabel = (window.I18n && window.I18n.get('stats.activity_title')) || 'Activité récente (16 semaines)';

        container.innerHTML = `
            <div class="activity-header">
                <h3 style="margin:0; font-size:15px;">${escapeHtml(titleLabel)}</h3>
                <div class="activity-streaks">
                    <span class="streak-pill">🔥 ${escapeHtml(curLabel)}: <strong>${streaks.currentStreak}</strong> ${escapeHtml(daysWord)}</span>
                    <span class="streak-pill">🏆 ${escapeHtml(bestLabel)}: <strong>${streaks.maxStreak}</strong> ${escapeHtml(daysWord)}</span>
                </div>
            </div>
            <div class="activity-grid">${cellsHtml}</div>
        `;
    }

    async function openBBFeedbackModal() {
        const modal = document.getElementById('bb-feedback-modal');
        const body = document.getElementById('bb-feedback-list');
        if (!modal || !body) return;
        const lang = (window.I18n && window.I18n.lang) || 'fr';

        const renderList = async () => {
            const rows = await db.recommendation_feedback.toArray();
            if (rows.length === 0) {
                body.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:24px 0;">${escapeHtml((window.I18n && window.I18n.get('bb.no_feedback')) || 'Aucun like ou dislike enregistré pour le moment.')}</p>`;
                return;
            }
            rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            body.innerHTML = rows.map(r => {
                const badge = r.rating > 0 ? '❤️' : '👎';
                const label = escapeHtml(r.name || `#${r.tmdb_id}`);
                const typeTag = r.type === 'tv' ? 'TV' : (lang === 'en' ? 'Movie' : 'Film');
                return `<div class="bb-feedback-row">
                    <span>${badge} <strong>${label}</strong> <small style="color:var(--text-muted);">(${typeTag})</small></span>
                    <button type="button" class="action-btn secondary btn-del-fb" data-id="${r.id}" style="width:auto; padding:4px 10px; font-size:12px;">✕</button>
                </div>`;
            }).join('');

            body.querySelectorAll('.btn-del-fb').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await db.recommendation_feedback.delete(parseInt(btn.dataset.id, 10));
                    renderList();
                    refreshStats();
                    if (typeof loadRecommendations === 'function') loadRecommendations();
                });
            });
        };

        await renderList();
        window.openOverlay('bb-feedback-modal');
    }

    function renderAchievementsSection(achs) {
        const container = document.getElementById('achievements-container');
        if (!container) return;
        container.innerHTML = '';

        const unlockedCount = achs.filter(a => a.unlocked).length;
        const totalCount = achs.length;
        const progTextEl = document.getElementById('achievements-progress-text');
        const progFillEl = document.getElementById('achievements-progress-fill');
        if (progTextEl) progTextEl.textContent = `${unlockedCount}/${totalCount}`;
        if (progFillEl) progFillEl.style.width = `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`;

        let filtered = achs;
        if (activeAchFilter === 'unlocked') filtered = achs.filter(a => a.unlocked);
        else if (activeAchFilter === 'locked') filtered = achs.filter(a => !a.unlocked);
        else if (activeAchFilter === 'near') filtered = achs.filter(a => !a.unlocked && (a.progress || 0) >= 0.5);

        const cats = Achievements.getCategories();
        for (const cat of cats) {
            const catAchs = filtered.filter(a => a.cat === cat.key);
            if (catAchs.length === 0) continue;

            const catSection = document.createElement('div');
            catSection.className = 'achievements-category';
            const h3 = document.createElement('h3');
            h3.textContent = `${cat.icon} ${cat.displayName || cat.name}`;
            catSection.appendChild(h3);

            const grid = document.createElement('div');
            grid.className = 'achievements-grid-inner';
            catAchs.sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0));
            catAchs.forEach(ach => grid.appendChild(Achievements.renderCard(ach)));
            catSection.appendChild(grid);
            container.appendChild(catSection);
        }

        if (container.children.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'text-align:center; color:var(--text-muted); padding:24px 0;';
            emptyMsg.textContent = (window.I18n && window.I18n.lang === 'en') ? 'No achievements match this filter.' : 'Aucun succès pour ce filtre.';
            container.appendChild(emptyMsg);
        }
    }

    async function refreshStats() {
        const lang = (window.I18n && window.I18n.lang) || 'fr';
        const locale = lang === 'en' ? 'en-US' : 'fr-FR';
        const achs = await Achievements.evaluate();

        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const sParts = DB.minutesToParts(seriesStats.totalMinutes);
        const mParts = DB.minutesToParts(movieStats.totalMinutes);

        const updateTime = (prefix, parts) => {
            const numSpans = document.querySelectorAll(`#${prefix} .big`);
            if (numSpans.length === 3) {
                numSpans[0].textContent = parts.months;
                numSpans[1].textContent = parts.days;
                numSpans[2].textContent = parts.hours;
            }
        };
        updateTime('stat-series-time', sParts);
        updateTime('stat-films-time', mParts);
        const epEl = document.getElementById('stat-episodes-count');
        const filmEl = document.getElementById('stat-films-count');
        if (epEl) epEl.textContent = seriesStats.count.toLocaleString(locale);
        if (filmEl) filmEl.textContent = movieStats.count.toLocaleString(locale);

        const hoursWord = lang === 'en' ? 'hours' : 'heures';
        const sHours = Math.floor(seriesStats.totalMinutes / 60);
        const mHours = Math.floor(movieStats.totalMinutes / 60);
        const sHoursEl = document.getElementById('stat-series-hours');
        const mHoursEl = document.getElementById('stat-films-hours');
        if (sHoursEl) sHoursEl.textContent = `Total : ${sHours.toLocaleString(locale)} ${hoursWord}`;
        if (mHoursEl) mHoursEl.textContent = `Total : ${mHours.toLocaleString(locale)} ${hoursWord}`;

        // 16-Week Activity Heatmap & Watch Streaks
        const [watchHist, movieWatches] = await Promise.all([db.watch_history.toArray(), db.movie_watches.toArray()]);
        renderActivityHeatmapAndStreaks(watchHist, movieWatches);

        await renderStatsChart();

        // Render BB Dashboard
        const bbContainer = document.getElementById('bb-dashboard-container');
        if (bbContainer) {
            try {
                const affinities = await _bigBrotherEngine.buildProfile(_bigBrotherAdapter);
                const GENRES_MAP = {
                    28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime',
                    99: 'Documentaire', 18: 'Drame', 10751: 'Familial', 14: 'Fantastique',
                    36: 'Histoire', 27: 'Horreur', 10402: 'Musique', 9648: 'Mystère',
                    10749: 'Romance', 878: 'Science-Fiction', 10770: 'Téléfilm', 53: 'Thriller',
                    10752: 'Guerre', 37: 'Western', 10759: 'Action & Aventure',
                    10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
                    10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
                };
                const noDataMsg = lang === 'en' ? '<li>Not enough data</li>' : '<li>Pas assez de données</li>';

                const topGenresData = Object.entries(affinities.genre || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([id, score]) => ({ id, name: GENRES_MAP[id] || `Genre ${id}`, score }));
                const topGenresHtml = topGenresData.map(g => `<li>${escapeHtml(g.name)} <span style="color:var(--text-muted);">(${g.score.toFixed(1)})</span></li>`).join('');

                const topDecadesData = Object.entries(affinities.decade || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([decade, score]) => ({ decade, name: lang === 'en' ? `${decade}s` : `Années ${decade}`, score }));
                const topDecadesHtml = topDecadesData.map(d => `<li>${escapeHtml(d.name)} <span style="color:var(--text-muted);">(${d.score.toFixed(1)})</span></li>`).join('');

                const topDirectorsData = Object.values(affinities.people || {}).sort((a, b) => b.score - a.score).slice(0, 3);
                const topDirectorsHtml = topDirectorsData.length > 0
                    ? topDirectorsData.map(d => `<li>${escapeHtml(d.name || ('Talent #' + d.id))} <span style="color:var(--text-muted);">(${d.score.toFixed(1)})</span></li>`).join('')
                    : noDataMsg;

                const topKeywordsData = Object.values(affinities.keyword || {}).sort((a, b) => b.score - a.score).slice(0, 3);
                const topKeywordsHtml = topKeywordsData.length > 0
                    ? topKeywordsData.map(k => `<li>${escapeHtml(k.name || ('Tag #' + k.id))} <span style="color:var(--text-muted);">(${k.score.toFixed(1)})</span></li>`).join('')
                    : noDataMsg;

                let profileInsight = '';
                if (window.BBNLP) {
                    await BBNLP.init(lang);
                    const totalWatches = (seriesStats.count || 0) + (movieStats.count || 0);
                    profileInsight = BBNLP.generateProfileDescription(affinities, totalWatches, topGenresData, topDecadesData, topDirectorsData, topKeywordsData);
                }

                const manageBtnLabel = (window.I18n && window.I18n.get('bb.manage_feedback')) || 'Gérer mes préférences';
                bbContainer.innerHTML = `
                    <div style="background:var(--surface-3); padding:16px; border-radius:var(--r-8); margin-bottom:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
                            <h4 style="margin:0; font-size:15px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                                <span>🧠</span> ${lang === 'en' ? 'Psychological Analysis' : 'Analyse Psychologique'}
                            </h4>
                            <button type="button" id="btn-manage-bb-feedback" class="action-btn secondary" style="width:auto; padding:5px 10px; font-size:12px;">⚙️ ${escapeHtml(manageBtnLabel)}</button>
                        </div>
                        <p style="margin:0; font-size:14px; color:var(--text-secondary); line-height:1.5;">
                            ${escapeHtml(profileInsight)}
                        </p>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:16px;">
                        <div style="background:var(--surface-3); padding:12px; border-radius:var(--r-8);">
                            <h4 style="margin:0 0 8px 0; font-size:14px; color:var(--text-muted); display:flex; align-items:center; gap:8px;"><span>🎭</span> Top Genres</h4>
                            <ul style="margin:0; padding-left:20px; font-size:13px; color:var(--text-primary);">${topGenresHtml || noDataMsg}</ul>
                        </div>
                        <div style="background:var(--surface-3); padding:12px; border-radius:var(--r-8);">
                            <h4 style="margin:0 0 8px 0; font-size:14px; color:var(--text-muted); display:flex; align-items:center; gap:8px;"><span>⏳</span> ${lang === 'en' ? 'Top Decades' : 'Décennies Favorites'}</h4>
                            <ul style="margin:0; padding-left:20px; font-size:13px; color:var(--text-primary);">${topDecadesHtml || noDataMsg}</ul>
                        </div>
                        <div style="background:var(--surface-3); padding:12px; border-radius:var(--r-8);">
                            <h4 style="margin:0 0 8px 0; font-size:14px; color:var(--text-muted); display:flex; align-items:center; gap:8px;"><span>🎬</span> ${lang === 'en' ? 'Top Creators' : 'Top Cinéastes'}</h4>
                            <ul style="margin:0; padding-left:20px; font-size:13px; color:var(--text-primary);">${topDirectorsHtml}</ul>
                        </div>
                        <div style="background:var(--surface-3); padding:12px; border-radius:var(--r-8);">
                            <h4 style="margin:0 0 8px 0; font-size:14px; color:var(--text-muted); display:flex; align-items:center; gap:8px;"><span>🔑</span> ${lang === 'en' ? 'Keywords' : 'Mots-clés'}</h4>
                            <ul style="margin:0; padding-left:20px; font-size:13px; color:var(--text-primary);">${topKeywordsHtml}</ul>
                        </div>
                    </div>
                `;
                const btnManageFB = document.getElementById('btn-manage-bb-feedback');
                if (btnManageFB) btnManageFB.addEventListener('click', openBBFeedbackModal);
            } catch (e) {
                console.error(e);
                bbContainer.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center;">${lang === 'en' ? 'Unable to load profile insights.' : 'Impossible de charger les données.'}</p>`;
            }
        }

        // Achievements Filter Bar
        const achFilterBar = document.getElementById('achievements-filters');
        if (achFilterBar && !achFilterBar.dataset.bound) {
            achFilterBar.dataset.bound = '1';
            achFilterBar.querySelectorAll('[data-ach-filter]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    activeAchFilter = btn.dataset.achFilter || 'all';
                    achFilterBar.querySelectorAll('[data-ach-filter]').forEach(b => b.classList.toggle('active', b === btn));
                    const latestAchs = await Achievements.evaluate();
                    renderAchievementsSection(latestAchs);
                });
            });
        }
        renderAchievementsSection(achs);
    }

    // ---- Import / Export ----
    const fileInput = document.getElementById('csv-file-input');
    const fileNames = document.getElementById('import-file-names');
    const importStatus = document.getElementById('import-status');
    let selectedFiles = [];

    const dropZone = document.getElementById('file-drop-zone');
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.style.borderColor = ''; });
        });
        dropZone.addEventListener('drop', e => {
            selectedFiles = Array.from(e.dataTransfer.files).filter(f => {
                const lower = f.name.toLowerCase();
                return lower.endsWith('.csv') || lower.endsWith('.json');
            });
            updateFileNames();
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', e => {
            selectedFiles = Array.from(e.target.files);
            updateFileNames();
        });
    }

    function updateFileNames() {
        if (!fileNames) return;
        fileNames.innerHTML = selectedFiles.map(f => `<div class="fname">📄 ${escapeHtml(f.name)}</div>`).join('');
    }

    const btnImport = document.getElementById('btn-import');
    if (btnImport) {
        btnImport.addEventListener('click', async () => {
            if (selectedFiles.length === 0) {
                importStatus.textContent = 'Veuillez sélectionner au moins un fichier.';
                importStatus.className = 'status-msg error';
                return;
            }
            const type = document.getElementById('import-type').value;
            importStatus.textContent = '';
            importStatus.className = 'status-msg';

            const progressContainer = document.getElementById('import-progress');
            const progressBar = document.getElementById('import-progress-bar');
            if (progressContainer) progressContainer.classList.remove('hidden');
            if (progressBar) progressBar.style.width = '10%';

            try {
                if (type === 'tvtime') {
                    const total = await Importer.importTVTime(selectedFiles, msg => {
                        importStatus.textContent = msg;
                        const w = parseInt(progressBar.style.width, 10) || 10;
                        progressBar.style.width = Math.min(w + 25, 90) + '%';
                    });
                    progressBar.style.width = '100%';
                    importStatus.textContent = `✓ Import terminé — ${total} éléments importés.`;
                    importStatus.className = 'status-msg success';
                    showToast('Import réussi ! 🎉');
                    refreshSeriesList();
                    refreshFilmsList();
                    refreshProfile();
                    enrichAllMedia();
                } else {
                    const file = selectedFiles[0];
                    const reader = new FileReader();
                    reader.onerror = () => {
                        importStatus.textContent = 'Erreur de lecture du fichier.';
                        importStatus.className = 'status-msg error';
                        if (progressContainer) progressContainer.classList.add('hidden');
                    };
                    reader.onload = (e) => {
                        try {
                            const backup = JSON.parse(e.target.result);
                            if (backup.format === 'algo_complete_v1') {
                                window.openOverlay('import-algo-modal');
                            } else if (backup.format === 'id_broker_v1') {
                                importStatus.textContent = 'Erreur: Format Data Broker non réimportable.';
                                importStatus.className = 'status-msg error';
                                progressBar.style.width = '0%';
                                if (progressContainer) progressContainer.classList.add('hidden');
                            } else {
                                window.openOverlay('import-modal');
                            }
                        } catch (err) {
                            importStatus.textContent = 'Erreur: Fichier JSON invalide.';
                            importStatus.className = 'status-msg error';
                            progressBar.style.width = '0%';
                            if (progressContainer) progressContainer.classList.add('hidden');
                        }
                    };
                    reader.readAsText(file);
                }
            } catch (err) {
                importStatus.textContent = `Erreur: ${err.message}`;
                importStatus.className = 'status-msg error';
                if (progressBar) progressBar.style.width = '0%';
            }
        });
    }

    const btnImportCancel = document.getElementById('btn-import-cancel');
    if (btnImportCancel) {
        btnImportCancel.addEventListener('click', () => {
            window.closeOverlay('import-modal');
            const pc = document.getElementById('import-progress');
            const pb = document.getElementById('import-progress-bar');
            if (pc) pc.classList.add('hidden');
            if (pb) pb.style.width = '0%';
        });
    }

    const btnImportConfirm = document.getElementById('btn-import-confirm');
    if (btnImportConfirm) {
        btnImportConfirm.addEventListener('click', async () => {
            window.closeOverlay('import-modal');
            const options = {
                data: document.getElementById('import-chk-data').checked,
                settings: document.getElementById('import-chk-settings').checked,
                cache: document.getElementById('import-chk-cache').checked
            };
            const progressBar = document.getElementById('import-progress-bar');
            const progressContainer = document.getElementById('import-progress');
            if (progressContainer) progressContainer.classList.remove('hidden');

            try {
                const total = await Importer.importDFWatch(selectedFiles, options, msg => {
                    importStatus.textContent = msg;
                });
                progressBar.style.width = '100%';
                importStatus.textContent = `✓ Import terminé — ${total} éléments importés.`;
                importStatus.className = 'status-msg success';
                showToast('Import réussi ! 🎉');

                refreshSeriesList();
                refreshFilmsList();
                refreshProfile();
                if (options.data || options.cache) {
                    await enrichAllMedia();
                }
                if (options.settings) {
                    location.reload();
                }
            } catch (err) {
                importStatus.textContent = `Erreur: ${err.message}`;
                importStatus.className = 'status-msg error';
                if (progressBar) progressBar.style.width = '0%';
            }
        });
    }

    const btnImportAlgoCancel = document.getElementById('btn-import-algo-cancel');
    if (btnImportAlgoCancel) {
        btnImportAlgoCancel.addEventListener('click', () => {
            window.closeOverlay('import-algo-modal');
            const pc = document.getElementById('import-progress');
            const pb = document.getElementById('import-progress-bar');
            if (pc) pc.classList.add('hidden');
            if (pb) pb.style.width = '0%';
        });
    }

    const btnImportAlgoConfirm = document.getElementById('btn-import-algo-confirm');
    if (btnImportAlgoConfirm) {
        btnImportAlgoConfirm.addEventListener('click', async () => {
            window.closeOverlay('import-algo-modal');
            const checkedMode = document.querySelector('input[name="import-algo-mode"]:checked');
            const options = { algoMode: checkedMode ? checkedMode.value : 'merge' };
            const progressBar = document.getElementById('import-progress-bar');
            const progressContainer = document.getElementById('import-progress');
            if (progressContainer) progressContainer.classList.remove('hidden');
            if (progressBar) progressBar.style.width = '10%';

            try {
                const total = await Importer.importDFWatch(selectedFiles, options, msg => {
                    importStatus.textContent = msg;
                });
                progressBar.style.width = '100%';
                importStatus.textContent = `✓ Import de l'algorithme terminé — ${total} éléments affectés.`;
                importStatus.className = 'status-msg success';
                showToast('Import réussi ! 🎉');

                refreshSeriesList();
                refreshFilmsList();
                refreshProfile();
                enrichAllMedia();
            } catch (err) {
                importStatus.textContent = `Erreur: ${err.message}`;
                importStatus.className = 'status-msg error';
                if (progressBar) progressBar.style.width = '0%';
            }
        });
    }

    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            window.openOverlay('export-modal');
            const defRadio = document.querySelector('input[name="export-format"][value="app_complete"]');
            if (defRadio) defRadio.checked = true;
            const oc = document.getElementById('export-options-container');
            const iw = document.getElementById('export-id-warning');
            if (oc) oc.classList.remove('hidden');
            if (iw) iw.classList.add('hidden');
        });
    }

    document.querySelectorAll('input[name="export-format"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const optionsContainer = document.getElementById('export-options-container');
            const idWarning = document.getElementById('export-id-warning');
            if (e.target.value === 'id') {
                if (optionsContainer) optionsContainer.classList.add('hidden');
                if (idWarning) idWarning.classList.remove('hidden');
            } else if (e.target.value === 'algo_complete' || e.target.value === 'letterboxd' || e.target.value === 'trakt') {
                if (optionsContainer) optionsContainer.classList.add('hidden');
                if (idWarning) idWarning.classList.add('hidden');
            } else {
                if (optionsContainer) optionsContainer.classList.remove('hidden');
                if (idWarning) idWarning.classList.add('hidden');
            }
        });
    });

    const btnExportCancel = document.getElementById('btn-export-cancel');
    if (btnExportCancel) btnExportCancel.addEventListener('click', () => window.closeOverlay('export-modal'));

    const btnExportConfirm = document.getElementById('btn-export-confirm');
    if (btnExportConfirm) {
        btnExportConfirm.addEventListener('click', async () => {
            window.closeOverlay('export-modal');
            const format = document.querySelector('input[name="export-format"]:checked')?.value || 'app_complete';
            if (format === 'id') {
                await window.Exporter.exportID();
            } else if (format === 'algo_complete') {
                await window.Exporter.exportAlgoComplete();
            } else if (format === 'letterboxd') {
                await window.Exporter.exportLetterboxdCSV();
            } else if (format === 'trakt') {
                await window.Exporter.exportTraktMoviesCSV();
                await window.Exporter.exportTraktShowsCSV();
            } else {
                const options = {
                    data: document.getElementById('export-chk-data').checked,
                    settings: document.getElementById('export-chk-settings').checked,
                    cache: document.getElementById('export-chk-cache').checked
                };
                await window.Exporter.exportComplete(options);
            }
            localStorage.setItem('dfwatch_has_exported', '1');
            localStorage.setItem('dfwatch_last_backup_at', String(Date.now()));
            showToast(window.I18n ? window.I18n.get('toast.export') : 'Export téléchargé !');
        });
    }

    const btnForceUpdate = document.getElementById('btn-force-update');
    if (btnForceUpdate) {
        btnForceUpdate.addEventListener('click', async () => {
            const confirmed = await window.customConfirm(window.I18n ? window.I18n.get('profile.force_update_prompt') : "Cela va vider le cache de l'application et forcer le téléchargement de la dernière version. Continuer ?");
            if (confirmed) {
                try {
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (const registration of registrations) await registration.unregister();
                    }
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        for (const key of keys) await caches.delete(key);
                    }
                    window.location.href = window.location.href.split('?')[0] + '?update=' + Date.now();
                } catch (err) {
                    console.error('Erreur de maj', err);
                    showToast('Erreur lors du vidage du cache');
                }
            }
        });
    }

    const btnClear = document.getElementById('btn-clear');
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            const confirmed = await window.customConfirm(window.I18n ? window.I18n.get('profile.clear_data_prompt') : '⚠️ Effacer TOUTES vos données ? Cette action est irréversible.');
            if (confirmed) {
                await DB.clearAll();
                ['dfwatch_firstname', 'dfwatch_lastname', 'dfwatch_dob', 'dfwatch_genres', 'dfwatch_top10',
                 'dfwatch_avatar_custom', 'dfwatch_has_imported', 'dfwatch_has_exported', 'dfwatch_last_backup_at',
                 'dfwatch_custom_ring', 'dfwatch_custom_badge'].forEach(k => localStorage.removeItem(k));
                showToast('Données effacées');
                refreshSeriesList();
                refreshFilmsList();
                refreshProfile();
                refreshStats();
                refreshCalendar();
                renderCustomLists();
                updateSidebarStats();
            }
        });
    }

    // ---- Background TMDB enrichment & Cache ----
    let _isEnriching = false;
    async function enrichAllMedia() {
        if (_isEnriching) return;
        _isEnriching = true;
        try {
            const shows = await db.shows.filter(s => !s.tmdb_id && s.name).toArray();
            for (const show of shows) {
                try {
                    const result = await TMDB.findShowByName(show.name);
                    if (result) {
                        await db.shows.update(show.id, {
                            tmdb_id: result.id,
                            poster_path: result.poster_path,
                            backdrop_path: result.backdrop_path
                        });
                    }
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {}
            }
            const movies = await db.movies.filter(m => !m.tmdb_id && m.name).toArray();
            for (const movie of movies) {
                try {
                    const result = await TMDB.findMovieByName(movie.name);
                    if (result) {
                        await db.movies.update(movie.id, {
                            tmdb_id: result.id,
                            poster_path: result.poster_path,
                            backdrop_path: result.backdrop_path
                        });
                    }
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {}
            }
            refreshSeriesList();
            refreshFilmsList();
        } finally {
            _isEnriching = false;
        }
    }

    async function checkBackupReminder() {
        if (sessionStorage.getItem('dfwatch_backup_reminded') === '1') return;
        const last = parseInt(localStorage.getItem('dfwatch_last_backup_at') || '0', 10);
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (last && Date.now() - last < thirtyDays) return;
        const [sCount, mCount] = await Promise.all([db.shows.count(), db.movies.count()]);
        if (sCount + mCount < 10) return;
        sessionStorage.setItem('dfwatch_backup_reminded', '1');
        const lang = (window.I18n && window.I18n.lang) || 'fr';
        showToast(lang === 'en'
            ? 'Tip: Back up your DFWatch library in Profile > Export.'
            : 'Pensez à sauvegarder vos données (Profil > Exporter).', 5000);
    }

    // ---- Custom Confirm ----
    window.customConfirm = function(message, title = window.I18n ? window.I18n.get('modal.confirm_title') : "Confirmation", okText = window.I18n ? window.I18n.get('modal.confirm_btn') : "Confirmer", cancelText = window.I18n ? window.I18n.get('action.cancel') : "Annuler") {
        return new Promise((resolve) => {
            document.getElementById('custom-confirm-title').textContent = title;
            document.getElementById('custom-confirm-message').textContent = message;
            const btnOk = document.getElementById('custom-confirm-ok');
            const btnCancel = document.getElementById('custom-confirm-cancel');
            btnOk.textContent = okText;
            btnCancel.textContent = cancelText;

            let settled = false;
            const cleanup = () => {
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                document.removeEventListener('modal_closed_custom-confirm-modal', onOverlayClosed);
            };
            const onOk = () => { if (settled) return; settled = true; cleanup(); window.closeOverlay('custom-confirm-modal'); resolve(true); };
            const onCancel = () => { if (settled) return; settled = true; cleanup(); window.closeOverlay('custom-confirm-modal'); resolve(false); };
            const onOverlayClosed = () => { if (settled) return; settled = true; cleanup(); resolve(false); };

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
            document.addEventListener('modal_closed_custom-confirm-modal', onOverlayClosed);
            window.openOverlay('custom-confirm-modal');
        });
    };

    // ---- Custom Prompt ----
    window.customPrompt = function(message, title = window.I18n ? window.I18n.get('modal.prompt_title') : "Prompt", placeholder = "") {
        return new Promise((resolve) => {
            document.getElementById('custom-prompt-title').textContent = title;
            document.getElementById('custom-prompt-message').textContent = message;
            const input = document.getElementById('custom-prompt-input');
            input.placeholder = placeholder;
            input.value = '';
            const btnOk = document.getElementById('custom-prompt-ok');
            const btnCancel = document.getElementById('custom-prompt-cancel');

            let settled = false;
            const cleanup = () => {
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                input.removeEventListener('keydown', onKeyDown);
                document.removeEventListener('modal_closed_custom-prompt-modal', onOverlayClosed);
            };
            const onOk = () => { if (settled) return; settled = true; const val = input.value; cleanup(); window.closeOverlay('custom-prompt-modal'); resolve(val); };
            const onCancel = () => { if (settled) return; settled = true; cleanup(); window.closeOverlay('custom-prompt-modal'); resolve(null); };
            const onOverlayClosed = () => { if (settled) return; settled = true; cleanup(); resolve(null); };
            const onKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); onOk(); } };

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
            input.addEventListener('keydown', onKeyDown);
            document.addEventListener('modal_closed_custom-prompt-modal', onOverlayClosed);
            window.openOverlay('custom-prompt-modal');
            input.focus();
        });
    };

    // ---- Toast ----
    let _toastHideTimer = null;
    let _toastGoneTimer = null;
    window.showToast = function(msg, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        if (_toastHideTimer) clearTimeout(_toastHideTimer);
        if (_toastGoneTimer) clearTimeout(_toastGoneTimer);
        toast.innerHTML = msg;
        toast.classList.remove('hidden');
        requestAnimationFrame(() => toast.classList.add('show'));
        _toastHideTimer = setTimeout(() => {
            toast.classList.remove('show');
            _toastGoneTimer = setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    };

    window.showAchievementToast = function(def) {
        if (!def) return;
        const lang = (window.I18n && window.I18n.lang) || 'fr';
        const titleLabel = lang === 'en' ? 'New Achievement Unlocked!' : 'Nouveau Succès Débloqué !';
        const achName = escapeHtml(lang === 'en' && def.name_en ? def.name_en : (def.name || ''));
        const toast = document.createElement('div');
        toast.className = 'achievement-toast show';
        toast.innerHTML = `
            <div class="ach-icon" style="font-size:36px; filter:drop-shadow(0 0 15px var(--iris-glow));">${escapeHtml(def.icon || '🏆')}</div>
            <div class="ach-text" style="display:flex; flex-direction:column; gap:2px;">
                <span style="font-size:11px; color:var(--iris-400); font-weight:800; letter-spacing:1px; text-transform:uppercase;">${escapeHtml(titleLabel)}</span>
                <span style="font-size:16px; font-weight:700; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.5);">${achName}</span>
            </div>
        `;
        document.body.appendChild(toast);

        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduceMotion) {
            for (let i = 0; i < 20; i++) {
                const conf = document.createElement('div');
                conf.textContent = ['✨','🎉','🎊','🔥','⭐'][Math.floor(Math.random() * 5)];
                conf.style.cssText = `position:fixed; left:50%; top:60px; font-size:${12 + Math.random() * 16}px; pointer-events:none; z-index:5001; transition:all 1.5s cubic-bezier(.25,.8,.25,1);`;
                document.body.appendChild(conf);
                requestAnimationFrame(() => {
                    const angle = (Math.random() * Math.PI) - (Math.PI / 2);
                    const dist = 60 + Math.random() * 150;
                    conf.style.transform = `translate(calc(-50% + ${Math.sin(angle) * dist}px), ${-Math.cos(angle) * dist + (Math.random() * 50)}px) scale(${Math.random() * 0.5 + 0.5}) rotate(${Math.random() * 360}deg)`;
                    conf.style.opacity = '0';
                });
                setTimeout(() => conf.remove(), 1600);
            }
        }

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 600);
        }, 5000);
    };

    // ---- Update sidebar mini-stats ----
    async function updateSidebarStats() {
        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const elEp = document.getElementById('sidebar-stat-ep');
        const elFilm = document.getElementById('sidebar-stat-film');
        if (elEp) elEp.textContent = seriesStats.count.toLocaleString();
        if (elFilm) elFilm.textContent = movieStats.count.toLocaleString();
    }

    // ---- Profile Save & Modal ----
    const profileEditModal = document.getElementById('profile-edit-modal');
    let currentTop10 = [];
    let pendingAvatarDataUrl = undefined; // undefined = unchanged, null = removed, string = new image

    function renderTop10Selected() {
        const list = document.getElementById('top10-selected-list');
        if (!list) return;
        list.innerHTML = '';
        currentTop10.forEach(item => {
            const pill = document.createElement('div');
            pill.style.cssText = 'background:var(--surface-2); border:1px solid var(--border-subtle); padding:4px 8px; border-radius:var(--r-pill); font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer; color:var(--text-primary);';
            pill.innerHTML = `<span>${escapeHtml(item.name || '')}</span><span style="color:var(--text-muted);">&times;</span>`;
            pill.addEventListener('click', () => {
                currentTop10 = currentTop10.filter(t => !(t.tmdb_id === item.tmdb_id && t.type === item.type));
                renderTop10Selected();
            });
            list.appendChild(pill);
        });
    }

    const top10SearchEl = document.getElementById('top10-search');
    if (top10SearchEl) {
        top10SearchEl.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase().trim();
            const resultsContainer = document.getElementById('top10-search-results');
            if (!resultsContainer) return;

            if (!query) {
                resultsContainer.classList.add('hidden');
                return;
            }

            const [allShows, allMovies] = await Promise.all([db.shows.toArray(), db.movies.toArray()]);
            const matches = [...allShows.map(s => ({ ...s, _type: 'tv' })), ...allMovies.map(m => ({ ...m, _type: 'movie' }))]
                .filter(item => item.name && item.name.toLowerCase().includes(query))
                .slice(0, 10);

            resultsContainer.innerHTML = '';
            if (matches.length > 0) {
                resultsContainer.classList.remove('hidden');
                matches.forEach(m => {
                    const row = document.createElement('div');
                    row.style.cssText = 'padding:6px 8px; cursor:pointer; font-size:13px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;';
                    const typeLabel = m._type === 'movie'
                        ? (window.I18n ? window.I18n.get('media.movie') : 'Film')
                        : (window.I18n ? window.I18n.get('media.series') : 'Série');
                    row.innerHTML = `<span>${escapeHtml(m.name)}</span><span style="font-size:10px; padding:2px 4px; background:var(--bg-card); border-radius:4px; color:var(--text-muted);">${escapeHtml(typeLabel)}</span>`;
                    row.addEventListener('mouseover', () => { row.style.background = 'var(--surface-3)'; });
                    row.addEventListener('mouseout', () => { row.style.background = 'transparent'; });
                    row.addEventListener('click', () => {
                        if (currentTop10.length >= 10) {
                            showToast(window.I18n ? window.I18n.get('toast.top10_max') : 'Vous avez déjà 10 éléments dans votre Top 10.');
                            return;
                        }
                        if (!currentTop10.find(t => t.tmdb_id === m.tmdb_id && t.type === m._type)) {
                            currentTop10.push({ tmdb_id: m.tmdb_id, type: m._type, name: m.name });
                            renderTop10Selected();
                        }
                        top10SearchEl.value = '';
                        resultsContainer.classList.add('hidden');
                    });
                    resultsContainer.appendChild(row);
                });
            } else {
                resultsContainer.classList.add('hidden');
            }
        });
    }

    const avatarUploadZone = document.getElementById('avatar-upload-zone');
    const avatarUploadInput = document.getElementById('profile-avatar-upload');
    const avatarUploadPreview = document.getElementById('avatar-upload-preview');
    const btnRemoveAvatar = document.getElementById('btn-remove-avatar');

    const btnEditProfile = document.getElementById('btn-edit-profile');
    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', () => {
            pendingAvatarDataUrl = undefined;
            const parsedTop10 = safeJsonParse(localStorage.getItem('dfwatch_top10'), []);
            currentTop10 = Array.isArray(parsedTop10) ? parsedTop10 : [];
            renderTop10Selected();
            if (top10SearchEl) top10SearchEl.value = '';
            const resBox = document.getElementById('top10-search-results');
            if (resBox) resBox.classList.add('hidden');

            const existingAvatar = localStorage.getItem('dfwatch_avatar_custom');
            if (existingAvatar && avatarUploadPreview) {
                avatarUploadPreview.innerHTML = `<img src="${existingAvatar}" alt="Preview">`;
                if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'block';
            } else {
                if (avatarUploadPreview) avatarUploadPreview.innerHTML = '<span>📷</span>';
                if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'none';
            }

            const currLevel = window.dfwatch_current_level || 0;
            const lang = (window.I18n && window.I18n.lang) || 'fr';

            const styles = [
                { val: 'solid', min: 0, label_fr: 'Solid (Noob)', label_en: 'Solid (Noob)' },
                { val: 'gradient', min: 10, label_fr: 'Dégradé 2 couleurs (Passionné)', label_en: '2-Color Gradient (Enthusiast)' },
                { val: 'multicolor', min: 20, label_fr: 'Multicolore (Expert)', label_en: 'Multicolor (Expert)' },
                { val: 'particles', min: 35, label_fr: 'Particules (Mythe)', label_en: 'Particles (Myth)' }
            ];

            const anims = [
                { val: 'none', min: 0, label_fr: 'Fixe', label_en: 'Fixed' },
                { val: 'pulse', min: 5, label_fr: 'Pulsation (Amateur)', label_en: 'Pulse (Amateur)' },
                { val: 'rotate', min: 15, label_fr: 'Rotation (Cinéphile)', label_en: 'Rotate (Cinephile)' },
                { val: 'blend', min: 25, label_fr: 'Blend Magique (Maître)', label_en: 'Magic Blend (Master)' },
                { val: 'particle_spin', min: 40, label_fr: 'Vortex Cosmique (Hacker)', label_en: 'Cosmic Vortex (Hacker)' }
            ];

            const setupCustomization = (prefix, storageKey) => {
                const styleSelect = document.getElementById(`${prefix}-style-select`);
                const animSelect = document.getElementById(`${prefix}-anim-select`);
                if (!styleSelect || !animSelect) return;

                styleSelect.innerHTML = '';
                animSelect.innerHTML = '';

                styles.forEach(s => {
                    if (currLevel >= s.min) {
                        const opt = document.createElement('option');
                        opt.value = s.val;
                        opt.textContent = lang === 'en' ? s.label_en : s.label_fr;
                        styleSelect.appendChild(opt);
                    }
                });

                anims.forEach(a => {
                    if (currLevel >= a.min) {
                        const opt = document.createElement('option');
                        opt.value = a.val;
                        opt.textContent = lang === 'en' ? a.label_en : a.label_fr;
                        animSelect.appendChild(opt);
                    }
                });

                const savedData = safeJsonParse(localStorage.getItem(storageKey), null);
                if (savedData) {
                    if (savedData.style) styleSelect.value = savedData.style;
                    if (savedData.anim) animSelect.value = savedData.anim;
                    if (savedData.colors) {
                        savedData.colors.forEach((c, i) => {
                            const input = document.getElementById(`${prefix}-color-${i + 1}`);
                            if (input && c) input.value = c;
                        });
                    }
                } else {
                    if (currLevel >= 35) styleSelect.value = 'particles';
                    else if (currLevel >= 20) styleSelect.value = 'multicolor';
                    else if (currLevel >= 10) styleSelect.value = 'gradient';
                    else styleSelect.value = 'solid';

                    if (currLevel >= 40) animSelect.value = 'particle_spin';
                    else if (currLevel >= 25) animSelect.value = 'blend';
                    else if (currLevel >= 15) animSelect.value = 'rotate';
                    else if (currLevel >= 5) animSelect.value = 'pulse';
                    else animSelect.value = 'none';
                }

                const updateColorPickers = () => {
                    const style = styleSelect.value;
                    const c1 = document.getElementById(`${prefix}-color-1`);
                    const c2 = document.getElementById(`${prefix}-color-2`);
                    const c3 = document.getElementById(`${prefix}-color-3`);
                    const c4 = document.getElementById(`${prefix}-color-4`);
                    if (c1) c1.style.display = 'block';
                    if (c2) c2.style.display = (style === 'gradient' || style === 'multicolor' || style === 'particles') ? 'block' : 'none';
                    if (c3) c3.style.display = (style === 'multicolor' || style === 'particles') ? 'block' : 'none';
                    if (c4) c4.style.display = (style === 'multicolor') ? 'block' : 'none';
                };
                styleSelect.onchange = updateColorPickers;
                updateColorPickers();
            };

            setupCustomization('ring', 'dfwatch_custom_ring');
            setupCustomization('badge', 'dfwatch_custom_badge');
            window.openOverlay('profile-edit-modal');
        });
    }

    const btnProfileCancel = document.getElementById('btn-profile-edit-cancel');
    if (btnProfileCancel) {
        btnProfileCancel.addEventListener('click', () => {
            pendingAvatarDataUrl = undefined;
            window.closeOverlay('profile-edit-modal');
        });
    }

    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', () => {
            localStorage.setItem('dfwatch_firstname', document.getElementById('profile-firstname').value);
            localStorage.setItem('dfwatch_lastname', document.getElementById('profile-lastname').value);
            localStorage.setItem('dfwatch_dob', document.getElementById('profile-dob').value);
            localStorage.setItem('dfwatch_age_format', document.getElementById('profile-age-format').value);
            localStorage.setItem('dfwatch_country', document.getElementById('profile-country').value);

            if (pendingAvatarDataUrl === null) {
                localStorage.removeItem('dfwatch_avatar_custom');
            } else if (typeof pendingAvatarDataUrl === 'string') {
                localStorage.setItem('dfwatch_avatar_custom', pendingAvatarDataUrl);
            }
            pendingAvatarDataUrl = undefined;

            const tmdbKey = document.getElementById('profile-tmdb-key').value.trim();
            if (tmdbKey) localStorage.setItem('custom_tmdb_api_key', tmdbKey);
            else localStorage.removeItem('custom_tmdb_api_key');

            const tvdbKey = document.getElementById('profile-tvdb-key').value.trim();
            const oldTvdbKey = localStorage.getItem('custom_tvdb_api_key');
            if (tvdbKey) localStorage.setItem('custom_tvdb_api_key', tvdbKey);
            else localStorage.removeItem('custom_tvdb_api_key');

            if (oldTvdbKey !== (tvdbKey || null) && window.TMDB && typeof TMDB.resetTokens === 'function') {
                TMDB.resetTokens();
            }

            const checkedGenres = Array.from(document.querySelectorAll('#profile-edit-modal .genre-checkbox input:checked')).map(cb => cb.value);
            localStorage.setItem('dfwatch_genres', JSON.stringify(checkedGenres));
            localStorage.setItem('dfwatch_top10', JSON.stringify(currentTop10));

            const saveCustomization = (prefix, storageKey) => {
                const styleSelect = document.getElementById(`${prefix}-style-select`);
                if (styleSelect) {
                    const animSelect = document.getElementById(`${prefix}-anim-select`);
                    const colors = [1, 2, 3, 4].map(i => {
                        const el = document.getElementById(`${prefix}-color-${i}`);
                        return el ? el.value : '';
                    });
                    localStorage.setItem(storageKey, JSON.stringify({
                        style: styleSelect.value,
                        anim: animSelect ? animSelect.value : 'none',
                        colors
                    }));
                }
            };
            saveCustomization('ring', 'dfwatch_custom_ring');
            saveCustomization('badge', 'dfwatch_custom_badge');

            window.closeOverlay('profile-edit-modal');
            refreshProfile();
            showToast(window.I18n ? window.I18n.get('toast.profile_saved') : 'Profil enregistré avec succès !');
        });
    }

    // ---- Avatar Upload (deferred until Save click) ----
    if (avatarUploadZone && avatarUploadInput) {
        avatarUploadZone.addEventListener('click', () => avatarUploadInput.click());
        avatarUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showToast('Image trop lourde (max 2MB)');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxSize = 256;
                    let w = img.width, h = img.height;
                    if (w > h) { h = (h / w) * maxSize; w = maxSize; }
                    else { w = (w / h) * maxSize; h = maxSize; }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    pendingAvatarDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    if (avatarUploadPreview) {
                        avatarUploadPreview.innerHTML = `<img src="${pendingAvatarDataUrl}" alt="Preview">`;
                    }
                    if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'block';
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnRemoveAvatar) {
        btnRemoveAvatar.addEventListener('click', () => {
            pendingAvatarDataUrl = null;
            if (avatarUploadPreview) avatarUploadPreview.innerHTML = '<span>📷</span>';
            btnRemoveAvatar.style.display = 'none';
        });
    }

    // ---- Profile Card Modal ----
    const cardModal = document.getElementById('profile-card-modal');
    const btnShareCard = document.getElementById('btn-share-profile-card');
    const btnCardClose = document.getElementById('btn-card-close');
    const btnCardDownload = document.getElementById('btn-card-download');
    const btnCardShare = document.getElementById('btn-card-share');

    let cardCurrentFormat = '1:1';
    let cardCurrentTheme = 'void_neon';
    let cardCurrentTitle = '';
    let cardSelectedPosterIndices = [];
    let cardProfileData = null;
    let cardLastCanvas = null;
    let cardShowPersonality = true;
    let cardShowPersonalityDesc = true;

    async function _renderCardPreviewNow() {
        if (!cardProfileData || !window.ProfileCard) return;

        const savedTop10 = safeJsonParse(localStorage.getItem('dfwatch_top10'), []);
        const selectedPosters = [];
        for (const idx of [...cardSelectedPosterIndices].sort((a, b) => a - b)) {
            const item = savedTop10[idx];
            if (!item) continue;
            const isMovie = item.type === 'movie';
            const dbTable = isMovie ? db.movies : db.shows;
            const dbItem = await dbTable.where('tmdb_id').equals(item.tmdb_id).first();
            if (dbItem && dbItem.poster_path) {
                try {
                    const img = await ProfileCard.loadImage(TMDB.imgUrl(dbItem.poster_path, 'w342'));
                    selectedPosters.push(img);
                } catch (e) {}
            }
        }

        let desc;
        if (cardShowPersonalityDesc) {
            const personalitySelect = document.getElementById('card-personality-select');
            if (personalitySelect && personalitySelect.options.length > 0 && personalitySelect.value === cardCurrentTitle) {
                desc = personalitySelect.options[personalitySelect.selectedIndex].dataset.desc;
            }
        }

        const canvas = await ProfileCard.generate({
            format: cardCurrentFormat,
            theme: cardCurrentTheme,
            personalityTitle: cardCurrentTitle,
            personalityDesc: desc,
            showPersonality: cardShowPersonality,
            selectedPosters: selectedPosters.length > 0 ? selectedPosters : undefined,
            preloadedData: cardProfileData
        });

        cardLastCanvas = canvas;
        const container = document.getElementById('card-preview-container');
        const previewCanvas = document.getElementById('card-preview-canvas');
        if (container) container.setAttribute('data-ratio', cardCurrentFormat);
        if (previewCanvas && canvas) {
            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
            previewCanvas.getContext('2d').drawImage(canvas, 0, 0);
        }
    }
    const renderCardPreview = debounce(_renderCardPreviewNow, 120);

    // Bind static Profile Card controls ONCE
    (function bindProfileCardStaticControls() {
        const personalitySelect = document.getElementById('card-personality-select');
        const personalityCustom = document.getElementById('card-personality-custom');
        const showPersonalityCheckbox = document.getElementById('card-show-personality');
        const personalityControls = document.getElementById('card-personality-controls');
        const showPersonalityDescCheckbox = document.getElementById('card-show-personality-desc');

        if (personalitySelect) {
            personalitySelect.addEventListener('change', () => {
                cardCurrentTitle = personalitySelect.value;
                if (personalityCustom) personalityCustom.value = '';
                renderCardPreview();
            });
        }
        if (showPersonalityCheckbox) {
            showPersonalityCheckbox.addEventListener('change', () => {
                cardShowPersonality = showPersonalityCheckbox.checked;
                if (personalityControls) personalityControls.style.display = cardShowPersonality ? 'block' : 'none';
                renderCardPreview();
            });
        }
        if (showPersonalityDescCheckbox) {
            showPersonalityDescCheckbox.addEventListener('change', () => {
                cardShowPersonalityDesc = showPersonalityDescCheckbox.checked;
                renderCardPreview();
            });
        }
        if (personalityCustom) {
            personalityCustom.addEventListener('input', () => {
                const customVal = personalityCustom.value.trim();
                cardCurrentTitle = customVal || (personalitySelect ? personalitySelect.value : '');
                renderCardPreview();
            });
        }
    })();

    async function openCardModal() {
        if (!cardModal || !window.ProfileCard) return;
        window.openOverlay('profile-card-modal');

        cardProfileData = await ProfileCard.collectProfileData();
        cardCurrentTitle = cardProfileData.personalityTitle;

        const personalitySelect = document.getElementById('card-personality-select');
        const personalityCustom = document.getElementById('card-personality-custom');
        if (personalitySelect) {
            personalitySelect.innerHTML = '';
            const suggestions = ProfileCard.generatePersonalitySuggestions(cardProfileData.stats, cardProfileData.lang);
            const bestSuggestion = suggestions.find(s => s.text === cardProfileData.personalityTitle);
            const bestDesc = bestSuggestion ? bestSuggestion.desc : (cardProfileData.lang === 'en' ? 'Passionate viewer' : 'Spectateur passionné');

            const bestOpt = document.createElement('option');
            bestOpt.value = cardProfileData.personalityTitle;
            bestOpt.textContent = `⭐ ${cardProfileData.personalityTitle} - ${bestDesc}`;
            bestOpt.dataset.desc = bestDesc;
            bestOpt.selected = true;
            personalitySelect.appendChild(bestOpt);
            suggestions.forEach(s => {
                if (s.text === cardProfileData.personalityTitle) return;
                const opt = document.createElement('option');
                opt.value = s.text;
                opt.textContent = `${s.text} - ${s.desc}`;
                opt.dataset.desc = s.desc;
                personalitySelect.appendChild(opt);
            });
        }

        const showPersonalityCheckbox = document.getElementById('card-show-personality');
        const personalityControls = document.getElementById('card-personality-controls');
        if (showPersonalityCheckbox) {
            showPersonalityCheckbox.checked = true;
            cardShowPersonality = true;
            if (personalityControls) personalityControls.style.display = 'block';
        }
        const showPersonalityDescCheckbox = document.getElementById('card-show-personality-desc');
        if (showPersonalityDescCheckbox) {
            showPersonalityDescCheckbox.checked = true;
            cardShowPersonalityDesc = true;
        }
        if (personalityCustom) personalityCustom.value = '';

        const posterContainer = document.getElementById('card-poster-selection');
        if (posterContainer) {
            posterContainer.innerHTML = '';
            const savedTop10 = safeJsonParse(localStorage.getItem('dfwatch_top10'), []);
            cardSelectedPosterIndices = savedTop10.map((_, i) => i).slice(0, 10);

            for (let idx = 0; idx < savedTop10.length; idx++) {
                const item = savedTop10[idx];
                const isMovie = item.type === 'movie';
                const dbTable = isMovie ? db.movies : db.shows;
                const dbItem = await dbTable.where('tmdb_id').equals(item.tmdb_id).first();
                if (!dbItem || !dbItem.poster_path) continue;

                const div = document.createElement('div');
                div.className = 'card-poster-item' + (cardSelectedPosterIndices.includes(idx) ? ' selected' : '');
                div.dataset.idx = idx;
                const pUrl = TMDB.imgUrl(dbItem.poster_path, 'w185');
                div.innerHTML = `<img src="${pUrl}" alt="${escapeHtml(dbItem.name || '')}" loading="lazy"><div class="poster-check">✓</div>`;
                div.addEventListener('click', () => {
                    const i = parseInt(div.dataset.idx, 10);
                    if (div.classList.contains('selected')) {
                        div.classList.remove('selected');
                        cardSelectedPosterIndices = cardSelectedPosterIndices.filter(x => x !== i);
                    } else {
                        if (cardSelectedPosterIndices.length >= 10) {
                            showToast('Maximum 10 posters');
                            return;
                        }
                        div.classList.add('selected');
                        cardSelectedPosterIndices.push(i);
                    }
                    renderCardPreview();
                });
                posterContainer.appendChild(div);
            }

            if (savedTop10.length === 0) {
                posterContainer.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">${window.I18n ? window.I18n.get('card.no_posters') : 'Ajoutez des séries ou films à votre Top 10.'}</p>`;
            }
        }

        _renderCardPreviewNow();
    }

    document.querySelectorAll('#card-format-selector .card-format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#card-format-selector .card-format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cardCurrentFormat = btn.dataset.format;
            renderCardPreview();
        });
    });

    document.querySelectorAll('#card-theme-selector .card-theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#card-theme-selector .card-theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cardCurrentTheme = btn.dataset.cardTheme;
            renderCardPreview();
        });
    });

    if (btnShareCard) btnShareCard.addEventListener('click', () => openCardModal());
    if (btnCardClose) btnCardClose.addEventListener('click', () => window.closeOverlay('profile-card-modal'));
    if (btnCardDownload) {
        btnCardDownload.addEventListener('click', () => {
            if (cardLastCanvas) ProfileCard.download(cardLastCanvas, cardCurrentFormat);
        });
    }
    if (btnCardShare) {
        btnCardShare.addEventListener('click', async () => {
            if (cardLastCanvas) {
                const shared = await ProfileCard.share(cardLastCanvas);
                if (!shared) ProfileCard.download(cardLastCanvas, cardCurrentFormat);
            }
        });
    }

    // ---- Calendar ----
    let calendarDate = new Date();
    let _lastCalendarEvents = [];

    const calPrev = document.getElementById('cal-prev');
    const calNext = document.getElementById('cal-next');
    const calToday = document.getElementById('cal-today');
    const calExportIcs = document.getElementById('cal-export-ics');

    if (calPrev) {
        calPrev.addEventListener('click', () => {
            calendarDate.setDate(1);
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            refreshCalendar();
        });
    }
    if (calNext) {
        calNext.addEventListener('click', () => {
            calendarDate.setDate(1);
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            refreshCalendar();
        });
    }
    if (calToday) {
        calToday.addEventListener('click', () => {
            calendarDate = new Date();
            refreshCalendar();
        });
    }
    if (calExportIcs) {
        calExportIcs.addEventListener('click', async () => {
            if (!_lastCalendarEvents.length) await refreshCalendar();
            if (!_lastCalendarEvents.length) {
                showToast((window.I18n && window.I18n.lang === 'en') ? 'No upcoming events to export.' : 'Aucun événement à exporter.');
                return;
            }
            const icsPayload = _lastCalendarEvents.map(ev => ({
                id: `${ev.media_type}-${ev.tmdb_id}-${DB.getLocalDateKey(ev.date)}`,
                date: DB.getLocalDateKey(ev.date),
                title: ev.name,
                subtitle: ev.detail
            }));
            if (window.Exporter && typeof Exporter.exportCalendarICS === 'function') {
                Exporter.exportCalendarICS(icsPayload);
                showToast((window.I18n && window.I18n.lang === 'en') ? 'Calendar exported (.ics)!' : 'Calendrier exporté (.ics) !');
            }
        });
    }

    async function refreshCalendar() {
        const monthLabel = document.getElementById('cal-month-label');
        const grid = document.getElementById('calendar-grid');
        const eventsContainer = document.getElementById('calendar-events');
        if (!monthLabel || !grid || !eventsContainer) return;

        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const currentLang = (window.I18n && window.I18n.lang === 'en') ? 'en-US' : 'fr-FR';
        monthLabel.textContent = new Date(year, month, 1).toLocaleDateString(currentLang, { month: 'long', year: 'numeric' });
        monthLabel.style.textTransform = 'capitalize';

        const events = [];

        const shows = await db.shows.where('is_followed').equals(1).toArray();
        for (const show of shows) {
            if (show.next_air_date) {
                const d = parseLocalDate(show.next_air_date);
                if (d && !isNaN(d.getTime())) {
                    events.push({ date: d, type: 'episode', name: show.name, detail: (window.I18n ? window.I18n.get('calendar.next_episode') : 'Prochain épisode'), poster: show.poster_path, tmdb_id: show.tmdb_id, media_type: 'tv' });
                }
            }
        }

        const movies = await db.movies.toArray();
        for (const movie of movies) {
            if (movie.release_date) {
                const d = parseLocalDate(movie.release_date);
                if (d && !isNaN(d.getTime())) {
                    events.push({ date: d, type: 'movie', name: movie.name, detail: (window.I18n ? window.I18n.get('calendar.movie_release') : 'Sortie du film'), poster: movie.poster_path, tmdb_id: movie.tmdb_id, media_type: 'movie' });
                }
            }
        }
        _lastCalendarEvents = events;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1;

        const dayNames = [
            window.I18n ? window.I18n.get('calendar.days.mon') : 'Lun',
            window.I18n ? window.I18n.get('calendar.days.tue') : 'Mar',
            window.I18n ? window.I18n.get('calendar.days.wed') : 'Mer',
            window.I18n ? window.I18n.get('calendar.days.thu') : 'Jeu',
            window.I18n ? window.I18n.get('calendar.days.fri') : 'Ven',
            window.I18n ? window.I18n.get('calendar.days.sat') : 'Sam',
            window.I18n ? window.I18n.get('calendar.days.sun') : 'Dim'
        ];
        let gridHTML = dayNames.map(d => `<div class="cal-header">${escapeHtml(d)}</div>`).join('');
        for (let i = 0; i < adjustedFirst; i++) gridHTML += '<div class="cal-day empty"></div>';

        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dayEvents = events.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === day);
            const isToday = dateObj.toDateString() === today.toDateString();
            const hasEvents = dayEvents.length > 0;

            let postersHtml = '';
            if (hasEvents) {
                const eventsWithPosters = dayEvents.filter(e => e.poster);
                if (eventsWithPosters.length > 0) {
                    const displayCount = Math.min(3, eventsWithPosters.length);
                    const toShow = eventsWithPosters.slice(0, displayCount);
                    postersHtml = '<div class="cal-mini-posters">' + toShow.map(e => `<img src="${TMDB.imgUrl(e.poster, 'w92')}" alt="" loading="lazy">`).join('');
                    if (dayEvents.length > displayCount) postersHtml += `<div class="cal-more">+${dayEvents.length - displayCount}</div>`;
                    postersHtml += '</div>';
                } else {
                    postersHtml = '<div class="cal-dots" style="position:relative; z-index:2;">' + dayEvents.map(e => `<span class="cal-dot ${e.type}"></span>`).join('') + '</div>';
                }
            }

            gridHTML += `<div class="cal-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">
                <span class="cal-day-num">${day}</span>
                ${postersHtml}
            </div>`;
        }

        grid.innerHTML = gridHTML;

        grid.querySelectorAll('.cal-day[data-date]').forEach(el => {
            el.addEventListener('click', () => {
                grid.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
                el.classList.add('selected');
                const [y, m, d] = el.dataset.date.split('-').map(Number);
                const dayEvents = events.filter(e => e.date.getFullYear() === y && e.date.getMonth() === m - 1 && e.date.getDate() === d);
                renderCalendarEvents(dayEvents, eventsContainer, el.dataset.date);
            });
        });

        const monthEvents = events.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month);
        monthEvents.sort((a, b) => a.date - b.date);
        renderCalendarEvents(monthEvents, eventsContainer, null);
    }

    function renderCalendarEvents(events, container, selectedDate) {
        const currentLang = (window.I18n && window.I18n.lang === 'en') ? 'en-US' : 'fr-FR';
        const parsedSelected = selectedDate ? parseLocalDate(selectedDate) : null;
        if (events.length === 0) {
            const label = (parsedSelected && !isNaN(parsedSelected.getTime()))
                ? `${window.I18n ? window.I18n.get('calendar.on') : 'le'} ${parsedSelected.toLocaleDateString(currentLang, { day: 'numeric', month: 'long' })}`
                : (window.I18n ? window.I18n.get('calendar.this_month') : 'ce mois-ci');
            container.innerHTML = `<div class="empty-state" style="padding:32px 0;"><div class="empty-icon">📅</div><h3>${escapeHtml(window.I18n ? window.I18n.get('calendar.empty_title', { label }) : 'Rien de prévu ' + label)}</h3><p>${escapeHtml(window.I18n ? window.I18n.get('calendar.empty_desc') : 'Suivez des séries ou ajoutez des films pour voir vos dates importantes ici.')}</p></div>`;
            return;
        }

        const title = (parsedSelected && !isNaN(parsedSelected.getTime()))
            ? parsedSelected.toLocaleDateString(currentLang, { weekday: 'long', day: 'numeric', month: 'long' })
            : (window.I18n ? window.I18n.get('calendar.title_month') : 'Ce mois');
        let html = `<h3 style="margin-bottom:16px; text-transform:capitalize;">${escapeHtml(title)}</h3>`;

        events.forEach(ev => {
            const posterUrl = ev.poster ? TMDB.imgUrl(ev.poster, 'w92') : '';
            const dateStr = ev.date.toLocaleDateString(currentLang, { day: 'numeric', month: 'short' });
            html += `
                <div class="calendar-event-card" data-tmdb-id="${ev.tmdb_id || ''}" data-type="${escapeHtml(ev.media_type)}" style="display:flex; gap:12px; align-items:center; padding:12px; background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--r-12); margin-bottom:8px; cursor:pointer; transition: all 0.2s;">
                    ${posterUrl ? `<img src="${posterUrl}" alt="" style="width:48px; border-radius:var(--r-8);" loading="lazy">` : '<div style="width:48px;height:72px;background:var(--surface-3);border-radius:var(--r-8);"></div>'}
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:14px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(ev.name || '')}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(ev.detail || '')} · ${escapeHtml(dateStr)}</div>
                    </div>
                    <span class="cal-type-badge ${ev.type}" style="font-size:10px; padding:3px 8px; border-radius:var(--r-pill); font-weight:600;">${ev.type === 'movie' ? (window.I18n ? window.I18n.get('media.movie_icon') : '🎬 Film') : (window.I18n ? window.I18n.get('media.episode_icon') : '📺 Épisode')}</span>
                </div>`;
        });
        container.innerHTML = html;

        container.querySelectorAll('.calendar-event-card').forEach(card => {
            card.addEventListener('click', async () => {
                const tmdbId = parseInt(card.dataset.tmdbId, 10);
                if (!tmdbId) return;
                const type = card.dataset.type;
                const details = type === 'tv' ? await TMDB.getShowDetails(tmdbId) : await TMDB.getMovieDetails(tmdbId);
                if (details) openDetail(details, type);
            });
        });
    }

    // ---- Init (lazy secondary tabs) ----
    refreshSeriesList();
    updateSidebarStats();
    setTimeout(() => {
        if (window.Achievements) Achievements.evaluate().catch(() => {});
        checkBackupReminder();
        enrichAllMedia();
    }, 2000);

    // ---- Pull-to-Refresh ----
    function setupPullToRefresh(containerId, indicatorId, refreshFn) {
        const container = document.getElementById(containerId);
        const indicator = document.getElementById(indicatorId);
        if (!container || !indicator) return;

        let startY = 0, pulling = false;

        container.addEventListener('touchstart', (e) => {
            if (container.scrollTop === 0) {
                startY = e.touches[0].clientY;
                pulling = true;
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!pulling) return;
            const diff = e.touches[0].clientY - startY;
            if (diff > 60) {
                indicator.classList.add('visible');
                indicator.textContent = window.I18n ? window.I18n.get('action.pull_release') : '↻ Relâchez pour actualiser';
            } else if (diff > 10) {
                indicator.classList.add('visible');
                indicator.textContent = window.I18n ? window.I18n.get('action.pull_refresh') : '⬇ Tirez pour actualiser';
            } else {
                indicator.classList.remove('visible');
            }
        }, { passive: true });

        container.addEventListener('touchend', async () => {
            if (!pulling) return;
            pulling = false;
            if (indicator.classList.contains('visible') && indicator.textContent.includes(window.I18n ? window.I18n.get('action.release_word') : 'Relâchez')) {
                indicator.textContent = window.I18n ? window.I18n.get('action.loading') : '⏳ Actualisation...';
                indicator.classList.add('loading');
                if (window._syncingShows) window._syncingShows.clear();
                await refreshFn();
                setTimeout(() => {
                    indicator.classList.remove('visible', 'loading');
                }, 500);
            } else {
                indicator.classList.remove('visible');
            }
        });
    }

    setupPullToRefresh('tab-series-watching', 'series-pull-indicator', refreshSeriesList);
    setupPullToRefresh('tab-films-watched', 'films-pull-indicator', refreshFilmsList);

// ---- Avatar Particles System ----
window.renderAvatarParticles = function(colors) {
    const canvas = document.getElementById('profile-particles-canvas');
    if (!canvas) return;

    if (window._avatarParticleRaf) cancelAnimationFrame(window._avatarParticleRaf);

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!colors || colors.length === 0 || reduceMotion) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = 140;
    canvas.height = 140;

    const particles = [];
    const validColors = colors.filter(Boolean);
    if (validColors.length === 0) return;

    for (let i = 0; i < 40; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            angle: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.8,
            radius: 1 + Math.random() * 2,
            color: validColors[Math.floor(Math.random() * validColors.length)],
            life: Math.random(),
            decay: 0.005 + Math.random() * 0.015
        });
    }

    function animate() {
        const profilePage = document.getElementById('page-profile');
        if (!document.hidden && profilePage && profilePage.classList.contains('active')) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.life -= p.decay;
                if (p.life <= 0) {
                    p.life = 1;
                    p.x = canvas.width / 2;
                    p.y = canvas.height / 2;
                    p.angle = Math.random() * Math.PI * 2;
                }
                p.x += Math.cos(p.angle) * p.speed;
                p.y += Math.sin(p.angle) * p.speed;
                p.angle += 0.02;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        }
        window._avatarParticleRaf = requestAnimationFrame(animate);
    }
    animate();
};

// ==================================================================================================================
    async function renderCustomLists() {
        const container = document.getElementById('custom-lists-container');
        if (!container) return;
        try {
            const lists = await db.custom_lists.toArray();
            let favShows = 0;
            let favMovies = 0;
            try {
                favShows = await db.shows.where('is_favorited').equals(1).count();
                favMovies = await db.movies.where('is_favorited').equals(1).count();
            } catch (err) {
                const allShows = await db.shows.toArray();
                favShows = allShows.filter(s => s.is_favorited === 1).length;
                const allMovies = await db.movies.toArray();
                favMovies = allMovies.filter(m => m.is_favorited === 1).length;
            }
            const totalFavs = favShows + favMovies;

            let html = `
                <div class="list-card-v2 favoris" data-id="favoris" role="button" tabindex="0">
                    <div class="list-icon">❤️</div>
                    <h3>${escapeHtml(window.I18n ? window.I18n.get('lists.favoris') : 'Favoris')}</h3>
                    <p>${escapeHtml(window.I18n ? window.I18n.get('lists.items_count', { count: totalFavs }) : totalFavs + ' élément(s)')}</p>
                </div>
            `;

            for (const list of lists) {
                const items = await db.list_items.where('list_id').equals(list.id).toArray();
                html += `
                    <div class="list-card-v2" data-id="${list.id}" role="button" tabindex="0">
                        <div class="list-icon">📋</div>
                        <h3>${escapeHtml(list.name)}</h3>
                        <p>${escapeHtml(window.I18n ? window.I18n.get('lists.items_count', { count: items.length }) : items.length + ' élément(s)')}</p>
                        <button type="button" class="btn-delete-list-v2" data-id="${list.id}" title="${escapeHtml(window.I18n ? window.I18n.get('lists.delete') : 'Supprimer la liste')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                `;
            }

            html += `
                <div class="list-card-v2 create-new" id="btn-create-list-card" role="button" tabindex="0">
                    <div class="list-icon" style="color:var(--text-secondary);">+</div>
                    <h3 style="color:var(--text-secondary);">${escapeHtml(window.I18n ? window.I18n.get('lists.create') : 'Créer une liste')}</h3>
                </div>
            `;

            container.innerHTML = html;
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div style="color: var(--danger); padding: 20px;">Erreur: ${escapeHtml(e.message)}</div>`;
            return;
        }

        const oldCreateBtn = document.getElementById('btn-create-list');
        if (oldCreateBtn) oldCreateBtn.style.display = 'none';

        container.querySelectorAll('.btn-delete-list-v2').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await window.customConfirm(window.I18n ? window.I18n.get('lists.delete_confirm') : "Voulez-vous vraiment supprimer cette liste ?", window.I18n ? window.I18n.get('lists.delete_title') : "Suppression", window.I18n ? window.I18n.get('lists.delete_btn') : "Supprimer", window.I18n ? window.I18n.get('lists.cancel_btn') : "Annuler")) {
                    const listId = parseInt(btn.dataset.id, 10);
                    await db.custom_lists.delete(listId);
                    await db.list_items.where('list_id').equals(listId).delete();
                    renderCustomLists();
                }
            });
        });

        container.querySelectorAll('.list-card-v2:not(.create-new)').forEach(card => {
            card.addEventListener('click', () => openCustomList(card.dataset.id));
        });

        const createCardBtn = document.getElementById('btn-create-list-card');
        if (createCardBtn) {
            createCardBtn.addEventListener('click', async () => {
                const name = await window.customPrompt(window.I18n ? window.I18n.get('lists.prompt_name') : "Nom de la nouvelle liste :", window.I18n ? window.I18n.get('lists.prompt_default') : "Nouvelle Liste");
                if (name && name.trim()) {
                    await db.custom_lists.add({ name: name.trim(), created_at: new Date().toISOString() });
                    renderCustomLists();
                }
            });
        }
    }

    let currentListId = null;

    async function openCustomList(id) {
        currentListId = id;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-list-detail').classList.add('active');
        try { history.pushState({ page: 'list-detail', listId: id }, '', `#list-${encodeURIComponent(id)}`); } catch (e) {}

        const titleEl = document.getElementById('list-detail-title');
        if (id === 'favoris') {
            titleEl.textContent = window.I18n ? window.I18n.get('lists.favoris') : 'Favoris';
            await renderListDetailItems('favoris');
        } else {
            const list = await db.custom_lists.get(parseInt(id, 10));
            if (list) {
                titleEl.textContent = list.name;
                await renderListDetailItems(parseInt(id, 10));
            }
        }
    }

    const btnBackLists = document.getElementById('btn-back-lists');
    if (btnBackLists) {
        btnBackLists.addEventListener('click', () => {
            navigateTo('calendar');
            renderCustomLists();
        });
    }

    async function renderListDetailItems(id) {
        const contentEl = document.getElementById('list-detail-content');
        if (!contentEl) return;
        const items = [];

        if (id === 'favoris') {
            const favShows = await db.shows.where('is_favorited').equals(1).toArray();
            const favMovies = await db.movies.where('is_favorited').equals(1).toArray();
            favShows.forEach(s => items.push({ type: 'show', data: s }));
            favMovies.forEach(m => items.push({ type: 'movie', data: m }));
        } else {
            const listItems = await db.list_items.where('list_id').equals(id).toArray();
            for (const item of listItems) {
                const isShow = item.media_type === 'show' || item.media_type === 'tv';
                if (isShow) {
                    let s = await db.shows.where('tmdb_id').equals(item.tmdb_id).first();
                    if (!s && item.tmdb_id) {
                        const details = await TMDB.getShowDetails(item.tmdb_id).catch(() => null);
                        if (details) s = { tmdb_id: details.id, name: details.name, poster_path: details.poster_path };
                    }
                    if (s) items.push({ type: 'show', data: s, listItemId: item.id });
                } else {
                    let m = await db.movies.where('tmdb_id').equals(item.tmdb_id).first();
                    if (!m && item.tmdb_id) {
                        const details = await TMDB.getMovieDetails(item.tmdb_id).catch(() => null);
                        if (details) m = { tmdb_id: details.id, name: details.title, poster_path: details.poster_path };
                    }
                    if (m) items.push({ type: 'movie', data: m, listItemId: item.id });
                }
            }
        }

        if (items.length === 0) {
            contentEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📭</div><h3>${escapeHtml(window.I18n ? window.I18n.get('lists.empty_state') : 'Liste vide')}</h3><p>${escapeHtml(window.I18n ? window.I18n.get('lists.empty_desc') : 'Vous n\'avez pas encore ajouté d\'éléments à cette liste.')}</p></div>`;
            return;
        }

        let html = '';
        for (const item of items) {
            const { type, data, listItemId } = item;
            const linkClass = type === 'show' ? 'show-link' : 'movie-link';
            const posterUrl = data.poster_path ? TMDB.imgUrl(data.poster_path, 'w185') : '';
            const deleteBtnHtml = id === 'favoris'
                ? `<button type="button" class="btn-remove-from-list" data-type="${type}" data-tmdb="${data.tmdb_id}" data-id="favoris" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">&times;</button>`
                : `<button type="button" class="btn-remove-from-list" data-item-id="${listItemId}" data-id="custom" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">&times;</button>`;

            html += `
                <div style="position:relative;">
                    <div class="poster-container ${linkClass}" data-id="${data.tmdb_id}" style="cursor:pointer; width:100%; height:100%;">
                        ${posterUrl ? `<img src="${posterUrl}" alt="${escapeHtml(data.name || '')}" class="poster-img" loading="lazy">` : `<div class="poster-placeholder">${escapeHtml(data.name || 'No Image')}</div>`}
                    </div>
                    ${deleteBtnHtml}
                </div>
            `;
        }
        contentEl.innerHTML = html;

        contentEl.querySelectorAll('.show-link').forEach(el => {
            el.addEventListener('click', async () => {
                const tmdbId = parseInt(el.dataset.id, 10);
                const details = await TMDB.getShowDetails(tmdbId);
                if (details) openDetail(details, 'tv');
                else {
                    const s = await db.shows.where('tmdb_id').equals(tmdbId).first();
                    if (s) openDetail({ id: s.tmdb_id, name: s.name, poster_path: s.poster_path, backdrop_path: s.backdrop_path }, 'tv');
                }
            });
        });
        contentEl.querySelectorAll('.movie-link').forEach(el => {
            el.addEventListener('click', async () => {
                const tmdbId = parseInt(el.dataset.id, 10);
                const details = await TMDB.getMovieDetails(tmdbId);
                if (details) openDetail(details, 'movie');
                else {
                    const m = await db.movies.where('tmdb_id').equals(tmdbId).first();
                    if (m) openDetail({ id: m.tmdb_id, title: m.name, poster_path: m.poster_path, backdrop_path: m.backdrop_path }, 'movie');
                }
            });
        });

        contentEl.querySelectorAll('.btn-remove-from-list').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (btn.dataset.id === 'favoris') {
                    const mType = btn.dataset.type;
                    const tmdb = parseInt(btn.dataset.tmdb, 10);
                    if (mType === 'show') await db.shows.where('tmdb_id').equals(tmdb).modify({ is_favorited: 0 });
                    else await db.movies.where('tmdb_id').equals(tmdb).modify({ is_favorited: 0 });
                } else {
                    await db.list_items.delete(parseInt(btn.dataset.itemId, 10));
                }
                renderListDetailItems(currentListId);
            });
        });
    }

    async function ensureLibraryRecordForFavorite(tmdbId, mediaType) {
        const numericId = parseInt(tmdbId, 10);
        if (mediaType === 'show' || mediaType === 'tv') {
            let s = await db.shows.where('tmdb_id').equals(numericId).first();
            if (!s) {
                const details = await TMDB.getShowDetails(numericId).catch(() => null);
                const newId = await db.shows.add({
                    tvtime_id: '', tmdb_id: numericId, name: details ? details.name : `Show #${numericId}`,
                    poster_path: details ? details.poster_path : '', backdrop_path: details ? details.backdrop_path : '',
                    genres: (details && details.genres) ? details.genres.map(g => g.name) : [],
                    status: 'following', is_followed: 0, is_favorited: 1, user_rating: 0, type: 'tv'
                });
                s = await db.shows.get(newId);
            }
            return s;
        } else {
            let m = await db.movies.where('tmdb_id').equals(numericId).first();
            if (!m) {
                const details = await TMDB.getMovieDetails(numericId).catch(() => null);
                const newId = await db.movies.add({
                    uuid: randomUuid('mov'), tmdb_id: numericId, name: details ? details.title : `Movie #${numericId}`,
                    poster_path: details ? details.poster_path : '', backdrop_path: details ? details.backdrop_path : '',
                    genres: (details && details.genres) ? details.genres.map(g => g.name) : [],
                    status: 'watchlist', release_date: details ? details.release_date : null,
                    is_favorited: 1, user_rating: 0, runtime: (details && details.runtime) ? details.runtime * 60 : 0
                });
                m = await db.movies.get(newId);
            }
            return m;
        }
    }

    async function renderAddToListContent(tmdbId, mediaType) {
        const container = document.getElementById('add-to-list-container');
        if (!container) return;
        const numericId = parseInt(tmdbId, 10);
        const normType = (mediaType === 'tv' || mediaType === 'show') ? 'show' : 'movie';
        const lists = await db.custom_lists.toArray();

        let isFavorited = false;
        if (normType === 'show') {
            const s = await db.shows.where('tmdb_id').equals(numericId).first();
            if (s && s.is_favorited) isFavorited = true;
        } else {
            const m = await db.movies.where('tmdb_id').equals(numericId).first();
            if (m && m.is_favorited) isFavorited = true;
        }

        let html = `
            <div class="modal-list-row is-favoris ${isFavorited ? 'checked' : ''}" data-list="favoris">
                <div class="modal-list-info">
                    <div class="modal-list-icon">❤️</div>
                    <div class="modal-list-text">
                        <h4>${escapeHtml(window.I18n ? window.I18n.get('lists.favoris') : 'Favoris')}</h4>
                        <p>${escapeHtml(window.I18n ? window.I18n.get('lists.add_favoris') : 'Ajouter aux favoris')}</p>
                    </div>
                </div>
                <div class="list-checkbox">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            </div>
        `;

        for (const list of lists) {
            const itemsInList = await db.list_items.where('list_id').equals(list.id).toArray();
            const existing = itemsInList.find(li => Number(li.tmdb_id) === numericId && (li.media_type === normType || li.media_type === mediaType || !li.media_type));
            html += `
                <div class="modal-list-row ${existing ? 'checked' : ''}" data-list="${list.id}">
                    <div class="modal-list-info">
                        <div class="modal-list-icon">📋</div>
                        <div class="modal-list-text">
                            <h4>${escapeHtml(list.name)}</h4>
                            <p>${escapeHtml(window.I18n ? window.I18n.get('lists.items_count', { count: itemsInList.length }) : itemsInList.length + ' élément(s)')}</p>
                        </div>
                    </div>
                    <div class="list-checkbox">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        container.querySelectorAll('.modal-list-row').forEach(row => {
            row.addEventListener('click', async () => {
                const listId = row.dataset.list;
                const isChecked = row.classList.contains('checked');

                if (listId === 'favoris') {
                    if (isChecked) {
                        row.classList.remove('checked');
                        if (normType === 'show') await db.shows.where('tmdb_id').equals(numericId).modify({ is_favorited: 0 });
                        else await db.movies.where('tmdb_id').equals(numericId).modify({ is_favorited: 0 });
                    } else {
                        row.classList.add('checked');
                        const existed = normType === 'show'
                            ? await db.shows.where('tmdb_id').equals(numericId).first()
                            : await db.movies.where('tmdb_id').equals(numericId).first();
                        if (!existed) await ensureLibraryRecordForFavorite(numericId, normType);
                        else if (normType === 'show') await db.shows.where('tmdb_id').equals(numericId).modify({ is_favorited: 1 });
                        else await db.movies.where('tmdb_id').equals(numericId).modify({ is_favorited: 1 });
                    }
                } else {
                    const lId = parseInt(listId, 10);
                    if (isChecked) {
                        row.classList.remove('checked');
                        await db.list_items.where('list_id').equals(lId)
                            .filter(li => Number(li.tmdb_id) === numericId && (li.media_type === normType || li.media_type === mediaType || !li.media_type))
                            .delete();
                    } else {
                        row.classList.add('checked');
                        await db.list_items.add({ list_id: lId, tmdb_id: numericId, media_type: normType, added_at: Date.now() });
                    }
                }

                renderCustomLists();
                if (normType === 'show') refreshSeriesList();
                else refreshFilmsList();
            });
        });
    }

    async function showAddToListModal(tmdbId, mediaType) {
        await renderAddToListContent(tmdbId, mediaType);
        const numericId = parseInt(tmdbId, 10);
        const normType = (mediaType === 'tv' || mediaType === 'show') ? 'show' : 'movie';

        const nameInput = document.getElementById('new-list-name');
        if (nameInput) nameInput.value = '';
        const createBtn = document.getElementById('btn-create-add-list');
        if (createBtn) {
            const freshBtn = createBtn.cloneNode(true);
            createBtn.replaceWith(freshBtn);
            freshBtn.addEventListener('click', async () => {
                const name = nameInput ? nameInput.value.trim() : '';
                if (name) {
                    const newListId = await db.custom_lists.add({ name, description: '', created_at: Date.now() });
                    await db.list_items.add({ list_id: newListId, tmdb_id: numericId, media_type: normType, added_at: Date.now() });
                    if (nameInput) nameInput.value = '';
                    await renderAddToListContent(tmdbId, mediaType);
                    renderCustomLists();
                    showToast(window.I18n ? window.I18n.get('toast.list_created') : "Liste créée et ajoutée !");
                }
            });
        }

        window.openOverlay('add-to-list-modal');
    }

    const btnAddToListCancel = document.getElementById('btn-add-to-list-cancel');
    if (btnAddToListCancel) btnAddToListCancel.addEventListener('click', () => window.closeOverlay('add-to-list-modal'));

    // ==========================================
    // EPISODE NOTES
    // ==========================================
    let currentNoteCtx = null;
    async function showEpisodeNoteModal(showId, season, ep, epName) {
        currentNoteCtx = { showId, season, ep };
        document.getElementById('episode-note-title').textContent = epName;

        const noteId = `${showId}_S${season}_E${ep}`;
        const note = await db.episode_notes.get(noteId);
        const rating = note ? note.rating : 0;
        const text = note ? note.note : '';

        currentNoteCtx.rating = rating;
        document.querySelectorAll('#episode-star-rating .star-btn').forEach(btn => {
            const val = parseInt(btn.dataset.val, 10);
            btn.classList.toggle('active', val <= rating);
            btn.onclick = () => {
                const nextRating = (currentNoteCtx.rating === val) ? 0 : val;
                currentNoteCtx.rating = nextRating;
                document.querySelectorAll('#episode-star-rating .star-btn').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.val, 10) <= nextRating);
                });
            };
        });
        document.getElementById('episode-note-text').value = text;
        window.openOverlay('episode-note-modal');
    }

    const btnNoteCancel = document.getElementById('btn-episode-note-cancel');
    if (btnNoteCancel) btnNoteCancel.addEventListener('click', () => window.closeOverlay('episode-note-modal'));

    const btnNoteSave = document.getElementById('btn-episode-note-save');
    if (btnNoteSave) {
        btnNoteSave.addEventListener('click', async () => {
            if (!currentNoteCtx) return;
            const noteId = `${currentNoteCtx.showId}_S${currentNoteCtx.season}_E${currentNoteCtx.ep}`;
            const text = document.getElementById('episode-note-text').value.trim();
            const rating = currentNoteCtx.rating || 0;

            if (text || rating > 0) {
                await db.episode_notes.put({
                    id: noteId,
                    show_id: currentNoteCtx.showId,
                    season_num: currentNoteCtx.season,
                    ep_num: currentNoteCtx.ep,
                    rating,
                    note: text,
                    updated_at: Date.now()
                });
                showToast("Note enregistrée !");
            } else {
                await db.episode_notes.delete(noteId);
            }

            window.closeOverlay('episode-note-modal');
            const hasContent = Boolean(text || rating > 0);
            document.querySelectorAll('.ep-note-sm').forEach(el => {
                if (el.dataset.showId === String(currentNoteCtx.showId) &&
                    parseInt(el.dataset.season, 10) === currentNoteCtx.season &&
                    parseInt(el.dataset.ep, 10) === currentNoteCtx.ep) {
                    el.classList.toggle('has-note', hasContent);
                    el.style.opacity = hasContent ? '1' : '0.6';
                    el.style.color = hasContent ? 'var(--iris-400)' : '';
                }
            });
        });
    }

    // ==========================================
    // REWATCH MODAL
    // ==========================================
    let currentRewatchCtx = null;
    window.showRewatchModal = function(type, ctx, currentViews, showObj) {
        currentRewatchCtx = { type, ctx, currentViews, showObj };
        document.getElementById('rewatch-count').textContent = currentViews;

        let title = '';
        if (type === 'movie') title = ctx.movieName;
        else if (type === 'episode') title = `${ctx.showName} - S${ctx.season}E${ctx.epNum}`;
        else if (type === 'season') title = window.I18n ? window.I18n.get('toast.season_all', {show: ctx.showName, season: ctx.season}) : `${ctx.showName} - Saison ${ctx.season} entière`;

        document.getElementById('rewatch-title').textContent = title;
        window.openOverlay('rewatch-modal');
    };

    const refreshRewatchDetail = () => {
        if (currentRewatchCtx && currentRewatchCtx.showObj) {
            if (currentRewatchCtx.type === 'movie') renderMovieDetail(currentRewatchCtx.showObj);
            else renderShowDetail(currentRewatchCtx.showObj);
        }
    };

    document.addEventListener('modal_closed_rewatch-modal', refreshRewatchDetail);

    const btnRewatchClose = document.getElementById('btn-rewatch-close');
    if (btnRewatchClose) {
        btnRewatchClose.addEventListener('click', () => {
            window.closeOverlay('rewatch-modal');
        });
    }

    const btnRewatchPlus = document.getElementById('btn-rewatch-plus');
    if (btnRewatchPlus) {
        btnRewatchPlus.addEventListener('click', async () => {
            if (!currentRewatchCtx) return;
            currentRewatchCtx.currentViews++;
            document.getElementById('rewatch-count').textContent = currentRewatchCtx.currentViews;
            await updateRewatchCount(currentRewatchCtx.currentViews);
        });
    }

    const btnRewatchMinus = document.getElementById('btn-rewatch-minus');
    if (btnRewatchMinus) {
        btnRewatchMinus.addEventListener('click', async () => {
            if (!currentRewatchCtx) return;
            if (currentRewatchCtx.currentViews > 0) {
                currentRewatchCtx.currentViews--;
                document.getElementById('rewatch-count').textContent = currentRewatchCtx.currentViews;
                await updateRewatchCount(currentRewatchCtx.currentViews);
            }
        });
    }

    async function updateRewatchCount(views) {
        const targetRewatchCount = views > 0 ? views - 1 : 0;
        const ctx = currentRewatchCtx.ctx;

        if (currentRewatchCtx.type === 'episode') {
            const row = await db.watch_history.get(ctx.historyId);
            if (!row) return;
            if (views === 0) {
                await db.watch_history.delete(row.id);
                window.closeOverlay('rewatch-modal');
            } else {
                await db.watch_history.update(row.id, { rewatch_count: targetRewatchCount });
            }
        } else if (currentRewatchCtx.type === 'season') {
            for (const r of ctx.records) {
                if (views === 0) await db.watch_history.delete(r.id);
                else await db.watch_history.update(r.id, { rewatch_count: targetRewatchCount });
            }
            if (views === 0) window.closeOverlay('rewatch-modal');
        } else if (currentRewatchCtx.type === 'movie') {
            if (ctx.records && ctx.records.length > 0) {
                const keepId = ctx.records[0].id;
                for (let i = 1; i < ctx.records.length; i++) {
                    await db.movie_watches.delete(ctx.records[i].id);
                }
                ctx.records.length = 1;
                if (views === 0) {
                    await db.movie_watches.delete(keepId);
                    ctx.records.length = 0;
                    await db.movies.where('tmdb_id').equals(ctx.tmdbId).modify({ status: 'watchlist' });
                    window.closeOverlay('rewatch-modal');
                } else {
                    await db.movie_watches.update(keepId, { rewatch_count: targetRewatchCount });
                }
            } else if (views > 0) {
                const mObj = currentRewatchCtx.showObj;
                const fallbackRuntime = mObj && mObj.runtime ? (mObj.runtime > 500 ? mObj.runtime : mObj.runtime * 60) : 7200;
                const newRec = {
                    movie_uuid: ctx.movieUuid, movie_name: ctx.movieName,
                    watched_at: new Date().toISOString(), rewatch_count: targetRewatchCount, runtime: fallbackRuntime
                };
                const insertedId = await db.movie_watches.add(newRec);
                if (!ctx.records) ctx.records = [];
                ctx.records.push({ ...newRec, id: insertedId });
            }
        }
    }

    // ---- Share Card Logic ----
    let currentShareCardItem = null;

    async function fetchAsDataURL(url) {
        if (!url) return '';
        try {
            const fetchUrl = url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now();
            const response = await fetch(fetchUrl, { mode: 'cors', cache: 'no-cache' });
            if (!response.ok) return url;
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return url;
        }
    }

    function getPEGIText(item, mediaType) {
        let cert = '';
        if (mediaType === 'tv' && item.content_ratings && item.content_ratings.results) {
            const target = item.content_ratings.results.find(r => r.iso_3166_1 === 'FR')
                        || item.content_ratings.results.find(r => r.iso_3166_1 === 'US')
                        || item.content_ratings.results[0];
            if (target) cert = target.rating || '';
        } else if (mediaType === 'movie' && item.release_dates && item.release_dates.results) {
            const target = item.release_dates.results.find(r => r.iso_3166_1 === 'FR')
                        || item.release_dates.results.find(r => r.iso_3166_1 === 'US')
                        || item.release_dates.results[0];
            if (target && target.release_dates && target.release_dates.length > 0) {
                const nonEmpty = target.release_dates.find(d => d.certification && d.certification.trim());
                if (nonEmpty) cert = nonEmpty.certification;
            }
        }
        if (!cert && item.adult) cert = '18';
        if (!cert) return 'TP';

        const c = cert.toLowerCase();
        if (c.includes('18') || c === 'r' || c === 'nc-17' || c === 'tv-ma') return '18+';
        if (c.includes('16') || c === '15') return '16+';
        if (c.includes('12') || c.includes('13') || c === 'tv-14' || c === 'pg-13') return '12+';
        if (c.includes('7') || c.includes('10') || c === 'tv-pg' || c === 'pg') return '7+';
        return cert;
    }

    async function showShareCardModal(item, mediaType, userRating) {
        currentShareCardItem = item;
        const title = item.name || item.title || 'Sans titre';
        const year = ((mediaType === 'tv' ? item.first_air_date : item.release_date) || '').split('-')[0] || '';
        const genres = (item.genres || []).map(g => g.name).join(', ');

        let durationStr = '';
        if (mediaType === 'tv' && item.episode_run_time && item.episode_run_time.length > 0) {
            durationStr = `${item.episode_run_time[0]} min`;
        } else if (mediaType === 'movie' && item.runtime) {
            durationStr = `${item.runtime} min`;
        }

        const pegi = getPEGIText(item, mediaType);
        const commuRating = item.vote_average ? (item.vote_average * 10).toFixed(0) + '%' : '';
        const posterUrl = item.poster_path ? TMDB.imgUrl(item.poster_path, 'w500') : '';
        const backdropUrl = item.backdrop_path ? TMDB.imgUrl(item.backdrop_path, 'w500') : '';

        document.getElementById('share-card-title').textContent = title;
        document.getElementById('share-card-year').textContent = year;
        document.getElementById('share-card-duration').textContent = durationStr;
        document.getElementById('share-card-pegi').textContent = pegi;
        document.getElementById('share-card-genres').textContent = genres;
        document.getElementById('share-card-commu-rating').textContent = commuRating;

        const posterEl = document.getElementById('share-card-poster');
        const bgBlur = document.getElementById('share-card-bg-blur');
        posterEl.removeAttribute('src');
        bgBlur.style.backgroundImage = 'none';

        let userRatingHtml = '';
        for (let i = 1; i <= 5; i++) userRatingHtml += i <= userRating ? '★' : '☆';
        document.getElementById('share-card-user-rating').textContent = userRatingHtml;

        ['logo', 'year', 'duration', 'pegi', 'genres', 'user-rating', 'commu-rating'].forEach(id => {
            const checkbox = document.getElementById(`toggle-card-${id}`);
            if (checkbox) {
                const valueHasData = (id === 'year' && year) || (id === 'duration' && durationStr) ||
                                     (id === 'pegi' && pegi) || (id === 'genres' && genres) ||
                                     (id === 'commu-rating' && commuRating) ||
                                     (id === 'user-rating' || id === 'logo');
                checkbox.checked = Boolean(valueHasData);
                checkbox.parentElement.style.display = valueHasData ? 'flex' : 'none';
            }
        });
        updateShareCardPreview();
        window.openOverlay('share-card-overlay');

        const btnDl = document.getElementById('btn-share-card-download');
        const btnSh = document.getElementById('btn-share-card-share');
        if (btnDl) btnDl.disabled = true;
        if (btnSh) btnSh.disabled = true;

        try {
            const [pDataUrl, bDataUrl] = await Promise.all([
                posterUrl ? fetchAsDataURL(posterUrl) : Promise.resolve(''),
                (backdropUrl || posterUrl) ? fetchAsDataURL(backdropUrl || posterUrl) : Promise.resolve('')
            ]);
            if (pDataUrl) {
                posterEl.style.display = 'block';
                posterEl.src = pDataUrl;
            } else {
                posterEl.style.display = 'none';
            }
            if (bDataUrl) {
                bgBlur.style.backgroundImage = `url(${bDataUrl})`;
            }
        } finally {
            if (btnDl) btnDl.disabled = false;
            if (btnSh) btnSh.disabled = false;
        }
    }

    function updateShareCardPreview() {
        const logo = document.getElementById('toggle-card-logo').checked;
        const year = document.getElementById('toggle-card-year').checked;
        const duration = document.getElementById('toggle-card-duration').checked;
        const pegi = document.getElementById('toggle-card-pegi').checked;
        const genres = document.getElementById('toggle-card-genres').checked;
        const userRating = document.getElementById('toggle-card-user-rating').checked;
        const commuRating = document.getElementById('toggle-card-commu-rating').checked;

        document.getElementById('share-card-logo').style.display = logo ? 'block' : 'none';
        document.getElementById('share-card-year').style.display = year ? 'inline' : 'none';
        document.getElementById('share-card-duration').style.display = duration ? 'inline' : 'none';
        document.getElementById('share-card-pegi').style.display = pegi ? 'inline' : 'none';
        document.getElementById('share-card-genres').style.display = genres ? 'block' : 'none';
        document.getElementById('share-card-user-rating-container').style.display = userRating ? 'block' : 'none';
        document.getElementById('share-card-commu-rating-container').style.display = commuRating ? 'block' : 'none';

        const seps = document.querySelectorAll('#share-card-meta .share-card-sep');
        if (seps.length >= 2) {
            seps[0].style.display = (year && duration) ? 'inline' : 'none';
            seps[1].style.display = ((year || duration) && pegi) ? 'inline' : 'none';
        }
        document.getElementById('share-card-meta').style.display = (!year && !duration && !pegi) ? 'none' : 'flex';
        document.getElementById('share-card-ratings-container').style.display = (!userRating && !commuRating) ? 'none' : 'flex';
    }

    ['logo', 'year', 'duration', 'pegi', 'genres', 'user-rating', 'commu-rating'].forEach(id => {
        const checkbox = document.getElementById(`toggle-card-${id}`);
        if (checkbox) checkbox.addEventListener('change', updateShareCardPreview);
    });

    const shareCardBack = document.getElementById('share-card-back');
    if (shareCardBack) shareCardBack.addEventListener('click', () => window.closeOverlay('share-card-overlay'));

    async function generateShareCanvas(btnElement) {
        if (typeof html2canvas === 'undefined') {
            showToast('L\'outil de génération n\'est pas chargé.');
            return null;
        }
        const canvasArea = document.getElementById('share-card-canvas-area');
        const originalHtml = btnElement.innerHTML;
        try {
            btnElement.textContent = 'Génération...';
            btnElement.disabled = true;
            return await html2canvas(canvasArea, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#13131a',
                scrollX: 0,
                scrollY: 0,
                windowWidth: document.documentElement.scrollWidth,
                windowHeight: document.documentElement.scrollHeight
            });
        } catch (e) {
            console.error('Error generating card:', e);
            showToast('Erreur lors de la génération de l\'image.');
            return null;
        } finally {
            btnElement.innerHTML = originalHtml;
            btnElement.disabled = false;
        }
    }

    const btnShareCardShare = document.getElementById('btn-share-card-share');
    if (btnShareCardShare) {
        btnShareCardShare.addEventListener('click', async function() {
            const canvas = await generateShareCanvas(this);
            if (!canvas) return;
            if (navigator.share && navigator.canShare) {
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        showToast('Erreur lors de la création de l\'image.');
                        return;
                    }
                    const file = new File([blob], 'dfwatch-share.png', { type: 'image/png' });
                    const rawTitle = currentShareCardItem ? (currentShareCardItem.name || currentShareCardItem.title || 'DFWatch') : 'DFWatch';
                    const shareData = {
                        files: [file],
                        title: `${rawTitle} - DFWatch`,
                        text: `Découvrez mon avis sur ${rawTitle} !`
                    };
                    if (navigator.canShare(shareData)) {
                        try {
                            await navigator.share(shareData);
                        } catch (err) {
                            if (err.name !== 'AbortError') showToast('Erreur lors du partage.');
                        }
                    } else {
                        showToast('Partage de fichier non supporté sur ce navigateur.');
                    }
                }, 'image/png');
            } else {
                showToast('L\'API de partage n\'est pas supportée sur cet appareil.');
            }
        });
    }

    const btnShareCardDownload = document.getElementById('btn-share-card-download');
    if (btnShareCardDownload) {
        btnShareCardDownload.addEventListener('click', async function() {
            const canvas = await generateShareCanvas(this);
            if (canvas) downloadCanvas(canvas);
        });
    }

    function downloadCanvas(canvas) {
        const rawTitle = currentShareCardItem ? (currentShareCardItem.name || currentShareCardItem.title || 'DFWatch') : 'DFWatch';
        const link = document.createElement('a');
        link.download = `DFWatch-${sanitizeFilename(rawTitle)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Image téléchargée !');
    }

    // ── Trailer Lite-Embed: load iframe on click ──
    document.addEventListener('click', (e) => {
        const lite = e.target.closest('.trailer-lite');
        if (!lite) return;
        const ytId = lite.dataset.ytId;
        if (!ytId || !isValidYoutubeId(ytId)) return;
        lite.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(ytId)}?rel=0&autoplay=1&modestbranding=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen title="Trailer"></iframe>`;
        lite.classList.remove('trailer-lite');
    });

    // Expose for external modules
    window.openDetail = openDetail;

})();
