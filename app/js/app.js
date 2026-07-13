// app.js — DFWatch Main Application Logic

(function () {
    'use strict';

    // ---- i18n Init ----
    if (window.I18n) window.I18n.init();

    // ---- Navigation (syncs sidebar + bottom nav) ----
    const pages = document.querySelectorAll('.page');

    function navigateTo(target) {
        if (typeof closeDetail === 'function') closeDetail();
        // Sync both navs
        document.querySelectorAll('.nav-btn, .sidebar-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll(`.nav-btn[data-page="${target}"], .sidebar-btn[data-page="${target}"]`).forEach(b => b.classList.add('active'));
        pages.forEach(p => {
            p.classList.remove('active');
            if (p.id === `page-${target}`) p.classList.add('active');
        });
        if (target === 'profile') refreshProfile();
        if (target === 'stats') refreshStats();
        if (target === 'series') refreshSeriesList();
        if (target === 'films') refreshFilmsList();
        if (target === 'lists') renderCustomLists();
        if (target === 'search') initSearch();
        if (target === 'calendar') refreshCalendar();
    }

    // ---- Theme Init ----
    const savedTheme = localStorage.getItem('dfwatch_theme') || 'default';
    document.body.setAttribute('data-theme', savedTheme);
    const themeOptions = document.querySelectorAll('.theme-option');
    if (themeOptions.length > 0) {
        themeOptions.forEach(opt => {
            if (opt.dataset.theme === savedTheme) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
            
            opt.addEventListener('click', () => {
                themeOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                
                const newTheme = opt.dataset.theme;
                document.body.setAttribute('data-theme', newTheme);
                localStorage.setItem('dfwatch_theme', newTheme);
            });
        });
    }

    const langSelect = document.getElementById('app-language');
    if (langSelect && window.I18n) {
        langSelect.value = window.I18n.lang;
        langSelect.addEventListener('change', (e) => {
            window.I18n.setLang(e.target.value);
            // Re-render UI that depends on JS strings
            refreshProfile();
            refreshStats();
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
                bar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Find sibling tab contents
                const parent = bar.parentElement;
                parent.querySelectorAll('.tab-content').forEach(tc => {
                    tc.classList.remove('active');
                    if (tc.id === `tab-${tabId}`) tc.classList.add('active');
                });
            });
        });
    });

    // ---- Favoris ----
    async function refreshFavoris() {
        const seriesGrid = document.getElementById('favoris-series-list');
        const filmsGrid = document.getElementById('favoris-films-list');
        
        seriesGrid.innerHTML = '';
        filmsGrid.innerHTML = '';
        
        const favShows = await db.shows.where('is_favorited').equals(1).toArray();
        const favMovies = await db.movies.where('is_favorited').equals(1).toArray();
        
        if (favShows.length === 0) {
            seriesGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">💔</div><h3>Aucune série en favoris</h3><p>Cliquez sur le coeur dans la fiche d\'une série pour l\'ajouter.</p></div>';
        } else {
            favShows.forEach(show => {
                const posterUrl = show.poster_path ? TMDB.imgUrl(show.poster_path, 'w342') : null;
                const div = document.createElement('div');
                div.className = 'poster-card';
                div.innerHTML = posterUrl
                    ? `<img src="${posterUrl}" alt="${show.name}" loading="lazy"><div class="poster-overlay"><div>${show.name}</div></div>`
                    : `<div class="poster-placeholder">${show.name}</div>`;
                div.addEventListener('click', async () => {
                    if (show.tmdb_id) {
                        const details = await TMDB.getShowDetails(show.tmdb_id);
                        if (details) openDetail(details, 'tv');
                    }
                });
                seriesGrid.appendChild(div);
            });
        }
        
        if (favMovies.length === 0) {
            filmsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">💔</div><h3>Aucun film en favoris</h3><p>Cliquez sur le coeur dans la fiche d\'un film pour l\'ajouter.</p></div>';
        } else {
            favMovies.forEach(movie => {
                const posterUrl = movie.poster_path ? TMDB.imgUrl(movie.poster_path, 'w342') : null;
                const year = (movie.release_date || '').split('-')[0];
                const div = document.createElement('div');
                div.className = 'poster-card';
                div.innerHTML = posterUrl
                    ? `<img src="${posterUrl}" alt="${movie.name}" loading="lazy"><div class="poster-overlay"><div>${movie.name}</div><div class="poster-year">${year}</div></div>`
                    : `<div class="poster-placeholder">${movie.name}</div>`;
                div.addEventListener('click', async () => {
                    if (movie.tmdb_id) {
                        const details = await TMDB.getMovieDetails(movie.tmdb_id);
                        if (details) openDetail(details, 'movie');
                    }
                });
                filmsGrid.appendChild(div);
            });
        }
    }

    // ---- Search tabs ----
    let currentSearchType = 'foryou';
    document.querySelectorAll('.search-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSearchType = tab.dataset.searchType;
            
            const q = document.getElementById('search-input').value.trim();
            if (currentSearchType === 'foryou') {
                document.getElementById('search-input').value = '';
                loadRecommendations();
            } else {
                if (q.length >= 2) doSearch(q);
                else loadTrending();
            }
        });
    });

    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const filtersPanel = document.getElementById('search-filters-panel');
    const btnToggleFilters = document.getElementById('btn-toggle-filters');
    const btnApplyFilters = document.getElementById('btn-apply-filters');
    let searchTimer;

    if (btnToggleFilters) {
        btnToggleFilters.addEventListener('click', () => {
            filtersPanel.classList.toggle('hidden');
        });
    }

    if (btnApplyFilters) {
        btnApplyFilters.addEventListener('click', () => {
            doSearch('', true); // trigger discover
        });
    }

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const q = searchInput.value.trim();
        
        if (currentSearchType === 'foryou' && q.length > 0) {
            document.querySelector('.search-tab[data-search-type="multi"]').click();
            return;
        }

        if (q.length < 2) { 
            if (currentSearchType === 'foryou') loadRecommendations();
            else loadTrending();
            return; 
        }
        searchTimer = setTimeout(() => doSearch(q), 400);
    });

    async function initSearch() {
        if (searchInput.value.trim().length < 2) {
            if (currentSearchType === 'foryou') loadRecommendations();
            else loadTrending();
        }
    }

    async function loadTrending() {
        searchResults.innerHTML = '<div class="empty-state"><p>Chargement des tendances...</p></div>';
        const type = currentSearchType === 'multi' ? 'all' : currentSearchType;
        const results = await TMDB.getTrending(type);
        if (!results.length) {
            searchResults.innerHTML = '<div class="empty-state"><p>Aucune tendance trouvée.</p></div>';
            return;
        }
        searchResults.innerHTML = '';
        const header = document.createElement('h3');
        header.style.gridColumn = '1 / -1';
        header.style.marginBottom = '1rem';
        header.textContent = 'Populaire en ce moment';
        searchResults.appendChild(header);
        
        results.forEach(item => {
            const card = createPosterCard(item);
            searchResults.appendChild(card);
        });
    }

    async function loadRecommendations() {
        searchResults.innerHTML = '<div class="empty-state"><p>Génération de vos recommandations...</p></div>';
        
        // 1. Get user top rated and feedback
        const topShows = await db.shows.where('user_rating').above(3).limit(4).toArray();
        const topMovies = await db.movies.where('user_rating').above(3).limit(4).toArray();
        const feedback = await db.recommendation_feedback.toArray();
        
        const likedIds = feedback.filter(f => f.feedback_value === 1).map(f => f.tmdb_id);
        const dislikedIds = new Set(feedback.filter(f => f.feedback_value === -1).map(f => f.tmdb_id));
        
        // Add liked items as seeds (simulating a mock object with tmdb_id)
        const extraSeeds = likedIds.slice(0, 4).map(id => ({ tmdb_id: id }));
        
        // If not enough rated, fallback to recently added
        if (topShows.length === 0 && topMovies.length === 0 && extraSeeds.length === 0) {
            const allShows = await db.shows.limit(2).toArray();
            const allMovies = await db.movies.limit(2).toArray();
            topShows.push(...allShows);
            topMovies.push(...allMovies);
        }
        
        let allResults = [];
        const seeds = [...topShows, ...topMovies, ...extraSeeds];
        
        // 2. Fetch TMDB Recommendations
        for (const s of seeds) {
            if (s.tmdb_id) {
                const recs = await TMDB.getRecommendations(s.tmdb_id, s.type || 'tv'); // fallback to tv for unknown type
                allResults.push(...recs);
            }
        }
        
        // Get all local tmdb_ids to filter out already watched/followed items
        const localShows = await db.shows.toArray();
        const localMovies = await db.movies.toArray();
        const localTmdbIds = new Set([...localShows.map(s => s.tmdb_id), ...localMovies.map(m => m.tmdb_id)].filter(id => id));
        
        // 3. Deduplicate and filter
        const unique = [];
        const seen = new Set();
        for (const r of allResults) {
            if (!seen.has(r.id) && !localTmdbIds.has(r.id) && !dislikedIds.has(r.id)) {
                seen.add(r.id);
                unique.push(r);
            }
        }
        
        // 4. Shuffle & Limit
        unique.sort(() => 0.5 - Math.random());
        const finalResults = unique.slice(0, 20);
        
        if (finalResults.length === 0) {
            searchResults.innerHTML = "<div class='empty-state'><div class='empty-icon'>⭐</div><h3>Pas encore assez de données</h3><p>Notez ou ajoutez quelques films/séries pour débloquer l'algorithme de recommandation !</p></div>";
            return;
        }
        
        searchResults.innerHTML = '';
        const header = document.createElement('h3');
        header.style.gridColumn = '1 / -1';
        header.style.marginBottom = '1rem';
        header.textContent = 'Sélectionné spécialement pour vous';
        searchResults.appendChild(header);
        
        finalResults.forEach(item => {
            const card = createPosterCard(item, true); // pass isRecommendation = true
            searchResults.appendChild(card);
        });
    }

    async function doSearch(query, useFilters = false) {
        searchResults.innerHTML = '<div class="empty-state"><p>Recherche en cours...</p></div>';
        
        let results = [];
        
        if (useFilters) {
            const genre = document.getElementById('filter-genre').value;
            const year = document.getElementById('filter-year').value;
            const sort = document.getElementById('filter-sort').value;
            
            // If "Pour vous" or "Tendances" is selected, fallback to movie or let user choose via tabs
            let type = currentSearchType === 'tv' ? 'tv' : 'movie'; 
            if (currentSearchType === 'multi' || currentSearchType === 'foryou') {
                // Discover API doesn't support 'multi', so we just default to movie and switch tab
                document.querySelector('.search-tab[data-search-type="movie"]').click();
                type = 'movie';
            }
            
            results = await TMDB.discover(type, { genre, year, sort });
        } else {
            results = await TMDB.search(query, currentSearchType);
        }
        
        if (!results.length) {
            searchResults.innerHTML = '<div class="empty-state"><p>Aucun résultat.</p></div>';
            return;
        }
        searchResults.innerHTML = '';
        results.forEach(item => {
            const card = createPosterCard(item);
            searchResults.appendChild(card);
        });
    }

    function createPosterCard(item, isRecommendation = false) {
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        const title = item.name || item.title || 'Sans titre';
        const year = (item.first_air_date || item.release_date || '').split('-')[0];
        const posterUrl = TMDB.imgUrl(item.poster_path, 'w342');

        const div = document.createElement('div');
        div.className = 'poster-card';
        div.innerHTML = posterUrl
            ? `<img src="${posterUrl}" alt="${title}" loading="lazy"><div class="poster-overlay"><div>${title}</div><div class="poster-year">${year}</div></div>`
            : `<div class="poster-placeholder">${title}</div>`;
            
        if (isRecommendation) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'recommendation-actions';
            actionsDiv.innerHTML = `
                <button class="thumb-btn thumb-down" title="Ne plus me recommander" aria-label="Pouce en bas">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                </button>
                <button class="thumb-btn thumb-up" title="J'aime ce genre" aria-label="Pouce en l'air">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4.33A2.31 2.31 0 0 1 2 20V13a2.31 2.31 0 0 1 2.33-2H7"></path></svg>
                </button>
            `;
            
            actionsDiv.querySelector('.thumb-down').addEventListener('click', async (e) => {
                e.stopPropagation();
                await db.recommendation_feedback.put({ tmdb_id: item.id, type: mediaType, feedback_value: -1 });
                div.remove();
            });
            
            actionsDiv.querySelector('.thumb-up').addEventListener('click', async (e) => {
                e.stopPropagation();
                await db.recommendation_feedback.put({ tmdb_id: item.id, type: mediaType, feedback_value: 1 });
                const btn = e.currentTarget;
                btn.style.color = '#4ade80';
                btn.style.background = 'rgba(74, 222, 128, 0.2)';
            });
            
            div.appendChild(actionsDiv);
        }

        div.addEventListener('click', () => openDetail(item, mediaType));
        return div;
    }

    // ---- TMDB Fix Modal ----
    const tmdbFixModal = document.getElementById('tmdb-fix-modal');
    const tmdbFixInput = document.getElementById('tmdb-fix-input');
    const tmdbFixResults = document.getElementById('tmdb-fix-results');
    const btnTmdbFixSearch = document.getElementById('btn-tmdb-fix-search');
    const btnTmdbFixCancel = document.getElementById('btn-tmdb-fix-cancel');
    
    let tmdbFixResolve = null;
    let tmdbFixMediaType = 'tv';

    if (btnTmdbFixCancel) {
        btnTmdbFixCancel.addEventListener('click', () => {
            tmdbFixModal.classList.add('hidden');
            if (tmdbFixResolve) tmdbFixResolve(null);
        });
    }

    if (btnTmdbFixSearch) {
        btnTmdbFixSearch.addEventListener('click', async () => {
            const q = tmdbFixInput.value.trim();
            if (q.length < 2) return;
            
            tmdbFixResults.innerHTML = '<div style="padding:12px; color:var(--text-muted);">Recherche en cours...</div>';
            const results = await TMDB.search(q, tmdbFixMediaType);
            
            if (!results || results.length === 0) {
                tmdbFixResults.innerHTML = '<div style="padding:12px; color:var(--text-muted);">Aucun résultat trouvé.</div>';
                return;
            }
            
            tmdbFixResults.innerHTML = '';
            results.forEach(item => {
                const title = item.name || item.title || 'Sans titre';
                const year = (item.first_air_date || item.release_date || '').split('-')[0];
                const posterUrl = TMDB.imgUrl(item.poster_path, 'w92');
                
                const div = document.createElement('div');
                div.className = 'modal-result-item';
                div.innerHTML = `
                    ${posterUrl ? `<img src="${posterUrl}" class="modal-result-img">` : `<div class="modal-result-img" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;">?</div>`}
                    <div class="modal-result-info">
                        <div class="modal-result-title">${title}</div>
                        <div class="modal-result-meta">${year}</div>
                    </div>
                `;
                div.addEventListener('click', () => {
                    tmdbFixModal.classList.add('hidden');
                    if (tmdbFixResolve) tmdbFixResolve(item);
                });
                tmdbFixResults.appendChild(div);
            });
        });
        
        tmdbFixInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnTmdbFixSearch.click();
        });
    }

    function openTmdbFixModal(initialName, mediaType) {
        return new Promise(resolve => {
            tmdbFixResolve = resolve;
            tmdbFixMediaType = mediaType;
            tmdbFixInput.value = initialName;
            tmdbFixResults.innerHTML = '';
            tmdbFixModal.classList.remove('hidden');
            tmdbFixInput.focus();
            if (initialName) {
                btnTmdbFixSearch.click();
            }
        });
    }

    // ---- Detail Overlay ----
    const detailOverlay = document.getElementById('show-detail-overlay');
    const detailBackdrop = document.getElementById('detail-backdrop');
    const detailBody = document.getElementById('detail-body');
    document.getElementById('detail-back').addEventListener('click', closeDetail);

    function closeDetail() {
        detailOverlay.classList.add('hidden');
    }

    async function openDetail(item, mediaType) {
        detailOverlay.classList.remove('hidden');
        detailOverlay.classList.add('slide-in');
        detailOverlay.scrollTop = 0;

        const tmdbId = item.id;
        const title = item.name || item.title || 'Sans titre';

        // Backdrop
        const bdUrl = TMDB.backdropUrl(item.backdrop_path);
        detailBackdrop.style.backgroundImage = bdUrl ? `url(${bdUrl})` : 'linear-gradient(135deg, #1a1a2e, #16213e)';

        if (mediaType === 'tv') {
            const details = await TMDB.getShowDetails(tmdbId);
            renderShowDetail(details || item);
        } else {
            const details = await TMDB.getMovieDetails(tmdbId);
            renderMovieDetail(details || item);
        }
    }

    async function renderShowDetail(show) {
        const title = show.name || 'Sans titre';
        const overview = show.overview || 'Pas de description disponible.';
        const year = (show.first_air_date || '').split('-')[0];
        const genres = (show.genres || []).map(g => g.name).join(', ');
        const episodeCount = show.number_of_episodes || '?';
        const posterUrl = show.poster_path ? TMDB.imgUrl(show.poster_path, 'w500') : '';
        const rating = show.vote_average ? (show.vote_average * 10).toFixed(0) + '%' : '';
        const creator = (show.created_by && show.created_by.length > 0) ? show.created_by.map(c => c.name).join(', ') : '';
        
        // --- Cast (improved with known_for_department) ---
        let castHTML = '';
        if (show.credits && show.credits.cast) {
            const cast = show.credits.cast.slice(0, 12);
            if (cast.length > 0) {
                castHTML = '<div class="detail-section"><h3>Têtes d\'affiche</h3><div class="horizontal-scroll cast-scroll">';
                cast.forEach(c => {
                    const img = c.profile_path ? TMDB.imgUrl(c.profile_path, 'w185') : '';
                    const dept = c.known_for_department && c.known_for_department !== 'Acting' ? `<div class="cast-dept">${c.known_for_department}</div>` : '';
                    castHTML += `
                        <div class="cast-card">
                            ${img ? `<img src="${img}" alt="${c.name}" loading="lazy">` : `<div class="cast-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`}
                            <div class="cast-name">${c.name}</div>
                            <div class="cast-char">${c.character || ''}${dept}</div>
                        </div>`;
                });
                castHTML += '</div></div>';
            }
        }

        // --- Trailer ---
        let trailerHTML = '';
        if (show.videos && show.videos.results && show.videos.results.length > 0) {
            const trailer = show.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube')
                         || show.videos.results.find(v => v.site === 'YouTube');
            if (trailer) {
                trailerHTML = `<div class="detail-section"><h3>Bande-annonce</h3><div class="trailer-container"><iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0" frameborder="0" allowfullscreen loading="lazy" title="Bande-annonce"></iframe></div></div>`;
            }
        }

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
        
        // Fetch personal notes
        const allNotes = (await db.episode_notes.toArray()).filter(n => String(n.show_id) === String(show.id));
        allNotes.forEach(n => {
            noteMap[`S${n.season_num}E${n.ep_num}`] = n.rating;
            if (n.rating > 0) hasPersonalNotes = true;
        });

        for (const season of sortedSeasons) {
            const isBonus = season.season_number === 0;
            const seasonTitle = isBonus ? 'Bonus (Specials)' : `Saison ${season.season_number}`;
            const seasonData = await TMDB.getSeasonDetails(show.id, season.season_number);
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
                const airDateStr = ep.air_date ? new Date(ep.air_date).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' }) : '';
                const epOverview = ep.overview ? `<div class="ep-overview">${ep.overview}</div>` : '';
                const runtimeStr = ep.runtime ? `${ep.runtime} min` : '';
                const epMetaParts = [airDateStr, runtimeStr].filter(Boolean).join(' · ');

                epsHTML += `
                    <div class="season-ep-row">
                        <span class="ep-num">${ep.episode_number}</span>
                        <div class="ep-details-col">
                            <span class="ep-name">${ep.name || `Épisode ${ep.episode_number}`} ${rewatchBadge}</span>
                            ${epMetaParts ? `<span class="ep-air-date">${epMetaParts}</span>` : ''}
                            ${epOverview}
                        </div>
                        <div style="display:flex; gap:0.5rem; align-items:center; flex-shrink:0;">
                            ${checked ? `<div class="ep-rewatch-sm" data-show="${title}" data-tvtime="${existing ? existing.tvtime_id : ''}" data-season="${season.season_number}" data-ep="${ep.episode_number}" data-runtime="${ep.runtime || 0}" style="cursor:pointer; color:var(--text-muted); font-size:16px;" title="Revoir">↻</div>` : ''}
                            <div class="ep-note-sm" data-show-id="${show.id}" data-season="${season.season_number}" data-ep="${ep.episode_number}" data-ep-name="${ep.name || `Épisode ${ep.episode_number}`}" style="cursor:pointer; font-size:16px; opacity:0.7;" title="Note & Avis">📝</div>
                            <div class="ep-check-sm ${checked ? 'checked' : ''}" data-show="${title}" data-tvtime="${existing ? existing.tvtime_id : ''}" data-season="${season.season_number}" data-ep="${ep.episode_number}" data-tmdb-id="${show.id}" data-runtime="${ep.runtime || 0}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                        </div>
                    </div>`;
            });

            seasonsHTML += `
                <div class="season-block">
                    <div class="season-header" data-season-id="s${season.season_number}">
                        <h3>${seasonTitle}</h3>
                        <div style="display:flex; gap:1rem; align-items:center;">
                            <span class="season-progress">${watchedInSeason}/${episodes.length}</span>
                            <button class="season-action-btn season-check-all" data-season="${season.season_number}" title="Tout marquer comme vu" style="background:none; border:none; color:var(--text-primary); cursor:pointer;">✓</button>
                            <button class="season-action-btn season-rewatch-all" data-season="${season.season_number}" title="Tout revoir" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">↻</button>
                        </div>
                    </div>
                    <div class="season-episodes" id="season-eps-s${season.season_number}">${epsHTML}</div>
                </div>`;
        }

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

        const heatmapSeasons = regularSeasons; // Exclude bonus seasons from charts
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
                        
                        const persVal = noteMap[`S${s.season_number}E${e}`] || 0;
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

        detailBody.innerHTML = `
            <div class="detail-header-flex">
                ${posterUrl ? `<img src="${posterUrl}" class="detail-main-poster" alt="${title}">` : ''}
                <div class="detail-header-info">
                    <h1>${title}</h1>
                    <div class="detail-meta">${year} · ${genres} · ${episodeCount} épisodes</div>
                    ${rating ? `<div class="detail-rating"><div class="rating-badge">${rating}</div> Score d'évaluation</div>` : ''}
                    <div class="detail-actions">
                        <button class="detail-action-btn follow ${isFollowed ? 'active' : ''}" id="btn-follow-show" data-tmdb-id="${show.id}" data-title="${title}" data-poster="${show.poster_path || ''}" data-backdrop="${show.backdrop_path || ''}">
                            ${isFollowed ? '✓ Suivi' : '+ Suivre'}
                        </button>
                        <button class="detail-action-btn fav-btn ${isFavorited ? 'active' : ''}" id="btn-fav-show">
                            ${isFavorited ? '❤️ Favori' : '🤍 Favori'}
                        </button>
                        <button class="detail-action-btn list-btn" id="btn-add-to-list" data-tmdb-id="${show.id}" data-type="show">
                            📋 Liste
                        </button>
                        <button class="detail-action-btn finish-btn ${isFinished ? 'active' : ''}" id="btn-finish-show" data-tmdb-id="${show.id}" data-title="${title}">
                            ${isFinished ? '🏁 Terminée' : '🏁 Terminer'}
                        </button>
                    </div>
                    <div class="user-rating-widget" id="show-rating-widget">
                        <span style="font-size:12px; color:var(--text-muted); margin-right:8px;">Ma note:</span>
                        <div class="stars">
                            ${[1,2,3,4,5].map(i => `<span class="star ${i <= userRating ? 'active' : ''}" data-val="${i}">★</span>`).join('')}
                        </div>
                    </div>
                    <p class="detail-overview">${overview}</p>
                    ${creator ? `<div class="detail-creator"><strong>Créateur :</strong> ${creator}</div>` : ''}
                </div>
            </div>
            ${castHTML}
            ${trailerHTML}
            
            ${tmdbHeatmapHtml}
            ${personalHeatmapHtml}

            <div class="detail-section">
                <h3>Saisons</h3>
                ${seasonsHTML}
            </div>
            <div class="detail-section" id="detail-similar-shows"></div>
            <div class="detail-section detail-footer-actions" style="margin-top: 2rem; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button class="action-btn secondary" id="btn-sync-show" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);" title="Forcer la synchronisation des données depuis TMDB">🔄 Actualiser les données</button>
                <button class="action-btn secondary" id="btn-share-show" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">📤 Partager</button>
                <button class="action-btn secondary" id="btn-fix-tmdb-tv" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">Mauvaise identification TMDB ?</button>
            </div>
        `;

        // Season accordion
        detailBody.querySelectorAll('.season-header').forEach(header => {
            header.addEventListener('click', () => {
                const id = header.dataset.seasonId;
                const eps = document.getElementById(`season-eps-${id}`);
                eps.classList.toggle('open');
            });
        });

        // Run auto-finish check silently in the background just in case it was out of sync
        setTimeout(() => {
            if (typeof checkAutoFinishShow === 'function') {
                checkAutoFinishShow();
            }
        }, 500);


        // Follow button
        document.getElementById('btn-follow-show').addEventListener('click', async function () {
            const tmdbId = parseInt(this.dataset.tmdbId);
            const t = this.dataset.title;
            const poster = this.dataset.poster;
            const backdrop = this.dataset.backdrop;
            const existing = await db.shows.where('tmdb_id').equals(tmdbId).first();
            if (existing) {
                const newVal = existing.is_followed ? 0 : 1;
                await db.shows.update(existing.id, { is_followed: newVal });
                this.classList.toggle('active');
                this.textContent = newVal ? '✓ Suivi' : '+ Suivre';
            } else {
                await db.shows.add({
                    tvtime_id: '', tmdb_id: tmdbId, name: t,
                    poster_path: poster, backdrop_path: backdrop,
                    status: 'following', is_followed: 1, is_favorited: 0, user_rating: 0, type: 'tv'
                });
                this.classList.add('active');
                this.textContent = '✓ Suivi';
            }
            showToast(this.classList.contains('active') ? `${t} ajouté à vos séries` : `${t} retiré`);
        });

        // Favorite show
        document.getElementById('btn-fav-show').addEventListener('click', async function () {
            const tmdbId = show.id;
            let existing = await db.shows.where('tmdb_id').equals(tmdbId).first();
            if (!existing) {
                const newId = await db.shows.add({
                    tvtime_id: '', tmdb_id: tmdbId, name: title,
                    poster_path: show.poster_path || '', backdrop_path: show.backdrop_path || '',
                    status: 'following', is_followed: 0, is_favorited: 1, user_rating: 0, type: 'tv'
                });
                existing = await db.shows.get(newId);
            } else {
                await db.shows.update(existing.id, { is_favorited: existing.is_favorited ? 0 : 1 });
            }
            const isFav = existing.is_favorited ? false : true; // Toggled value
            this.classList.toggle('active');
            this.textContent = isFav ? '❤️ Favori' : '🤍 Favori';
            showToast(isFav ? `${title} ajouté aux favoris` : `${title} retiré des favoris`);
        });

        // Finish show
        document.getElementById('btn-finish-show').addEventListener('click', async function () {
            const tmdbId = show.id;
            let existing = await db.shows.where('tmdb_id').equals(tmdbId).first();
            if (!existing) {
                const newId = await db.shows.add({
                    tvtime_id: '', tmdb_id: tmdbId, name: title,
                    poster_path: show.poster_path || '', backdrop_path: show.backdrop_path || '',
                    status: 'following', is_followed: 1, is_favorited: 0, is_finished: 1, user_rating: 0, type: 'tv'
                });
                existing = await db.shows.get(newId);
                // Since we added it to following, let's update follow button too if possible
                const followBtn = document.getElementById('btn-follow-show');
                if (followBtn) {
                    followBtn.classList.add('active');
                    followBtn.textContent = '✓ Suivi';
                }
            } else {
                await db.shows.update(existing.id, { is_finished: existing.is_finished ? 0 : 1 });
            }
            const isFin = existing.is_finished ? false : true; // Toggled value
            this.classList.toggle('active');
            this.textContent = isFin ? '🏁 Terminée' : '🏁 Terminer';
            showToast(isFin ? `${title} marquée comme terminée` : `${title} retirée des séries terminées`);
            refreshSeriesList(); // Update main UI list immediately
        });

        // Rate show
        document.querySelectorAll('#show-rating-widget .star').forEach(star => {
            star.addEventListener('click', async function () {
                const val = parseInt(this.dataset.val);
                let existing = await db.shows.where('tmdb_id').equals(show.id).first();
                if (!existing) {
                    await db.shows.add({
                        tvtime_id: '', tmdb_id: show.id, name: title,
                        poster_path: show.poster_path || '', backdrop_path: show.backdrop_path || '',
                        status: 'following', is_followed: 0, is_favorited: 0, user_rating: val, type: 'tv'
                    });
                } else {
                    const newVal = existing.user_rating === val ? 0 : val; // Toggle off if clicked same
                    await db.shows.update(existing.id, { user_rating: newVal });
                }
                const newVal = (!existing || existing.user_rating !== val) ? val : 0;
                document.querySelectorAll('#show-rating-widget .star').forEach(s => {
                    if (parseInt(s.dataset.val) <= newVal) s.classList.add('active');
                    else s.classList.remove('active');
                });
                if (newVal > 0) showToast(`Vous avez noté ${title} ${newVal}/5`);
            });
        });

        async function checkAutoFinishShow() {
            // Re-fetch history to ensure we have the latest truth
            const existingShow = await db.shows.where('tmdb_id').equals(show.id).first();
            if (!existingShow) return;

            let history = [];
            if (existingShow.tvtime_id) {
                history = await db.watch_history.where('show_tvtime_id').equals(String(existingShow.tvtime_id)).toArray();
            }
            if (history.length === 0) {
                history = await db.watch_history.where('show_name').equals(show.name).toArray();
            }

            const watchedEpisodes = new Set(history.map(h => `S${h.season_number}E${h.episode_number}`));

            let totalEps = 0;
            let doneEps = 0;

            const seasons = show.seasons || [];
            for (const season of seasons) {
                if (season.season_number > 0) {
                    const seasonData = await TMDB.getSeasonDetails(show.id, season.season_number);
                    const episodes = seasonData ? seasonData.episodes || [] : [];
                    totalEps += episodes.length;
                    
                    const watchedInSeason = episodes.filter(ep => watchedEpisodes.has(`S${season.season_number}E${ep.episode_number}`)).length;
                    doneEps += watchedInSeason;
                }
            }

            if (totalEps > 0) {
                const shouldBeFinished = doneEps >= totalEps;
                const currentFinished = existingShow.is_finished === 1;
                
                if (currentFinished !== shouldBeFinished) {
                    await db.shows.update(existingShow.id, { is_finished: shouldBeFinished ? 1 : 0 });
                    existingShow.is_finished = shouldBeFinished ? 1 : 0;
                    
                    const finBtn = document.getElementById('btn-finish-show');
                    if (finBtn) {
                        if (shouldBeFinished) {
                            finBtn.classList.add('active');
                            finBtn.textContent = '🏁 Terminée';
                            showToast(`"${title}" marquée comme terminée automatiquement !`);
                        } else {
                            finBtn.classList.remove('active');
                            finBtn.textContent = '🏁 Terminer';
                        }
                    }
                    refreshSeriesList();
                }
            }
        }

        // Episode check buttons
        detailBody.querySelectorAll('.ep-check-sm').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const showName = btn.dataset.show;
                const tvtimeId = btn.dataset.tvtime || '';
                const season = parseInt(btn.dataset.season);
                const epNum = parseInt(btn.dataset.ep);
                const runtime = parseInt(btn.dataset.runtime) || 0;

                if (btn.classList.contains('checked')) {
                    // Uncheck
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
                } else {
                    // Check
                    await db.watch_history.add({
                        show_tvtime_id: String(tvtimeId), show_name: showName,
                        season_number: season, episode_number: epNum,
                        episode_id: '', watched_at: new Date().toISOString(),
                        rewatch_count: 0, runtime: runtime * 60
                    });
                    btn.classList.add('checked');
                }

                // Update season progress
                const seasonBlock = btn.closest('.season-block');
                if (seasonBlock) {
                    const total = seasonBlock.querySelectorAll('.ep-check-sm').length;
                    const done = seasonBlock.querySelectorAll('.ep-check-sm.checked').length;
                    seasonBlock.querySelector('.season-progress').textContent = `${done}/${total}`;
                }
                
                // Auto finish check
                setTimeout(checkAutoFinishShow, 100);
            });
        });

        // Episode rewatch buttons
        detailBody.querySelectorAll('.ep-rewatch-sm').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const showName = btn.dataset.show;
                const tvtimeId = btn.dataset.tvtime || '';
                const season = parseInt(btn.dataset.season);
                const epNum = parseInt(btn.dataset.ep);
                
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
        
        // Season check all
        detailBody.querySelectorAll('.season-check-all').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const season = parseInt(btn.dataset.season);
                const epsContainer = document.getElementById(`season-eps-s${season}`);
                const eps = epsContainer.querySelectorAll('.ep-check-sm:not(.checked)');
                
                if (eps.length > 0) {
                    for (const epBtn of eps) {
                        epBtn.click();
                    }
                    showToast(`Saison ${season} marquée comme vue`);
                    setTimeout(() => renderShowDetail(show), 500);
                } else {
                    // La saison est déjà vue, on retire une vue à tous les épisodes
                    const showName = show.name;
                    let existingShow = await db.shows.where('tmdb_id').equals(show.id).first();
                    const tvtimeId = existingShow ? String(existingShow.tvtime_id) : '';
                    
                    let records = [];
                    if (tvtimeId && tvtimeId !== "undefined") {
                        records = await db.watch_history.where('show_tvtime_id').equals(tvtimeId).filter(r => r.season_number === season).toArray();
                    }
                    if (records.length === 0) {
                        records = await db.watch_history.where('show_name').equals(showName).filter(r => r.season_number === season).toArray();
                    }
                    
                    for (const r of records) {
                        if (r.rewatch_count && r.rewatch_count > 0) {
                            await db.watch_history.update(r.id, { rewatch_count: r.rewatch_count - 1 });
                        } else {
                            await db.watch_history.delete(r.id);
                        }
                    }
                    showToast(`Saison ${season} : une vue retirée`);
                    renderShowDetail(show);
                }
            });
        });
        
        // Season rewatch all
        detailBody.querySelectorAll('.season-rewatch-all').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const season = parseInt(btn.dataset.season);
                const epsContainer = document.getElementById(`season-eps-s${season}`);
                
                const epsUnchecked = epsContainer.querySelectorAll('.ep-check-sm:not(.checked)');
                for (const epBtn of epsUnchecked) {
                    epBtn.click();
                }
                
                setTimeout(async () => {
                    const showName = show.name;
                    const tvtimeId = existing ? String(existing.tvtime_id) : '';
                    let records = [];
                    if (tvtimeId) {
                        records = await db.watch_history.where('show_tvtime_id').equals(tvtimeId).filter(r => r.season_number === season).toArray();
                    }
                    if (records.length === 0) {
                        records = await db.watch_history.where('show_name').equals(showName).filter(r => r.season_number === season).toArray();
                    }
                    
                    let maxCount = 1;
                    for (const r of records) {
                        const newCount = Math.max((r.rewatch_count || 0), 1);
                        if (newCount > maxCount) maxCount = newCount;
                        await db.watch_history.update(r.id, { rewatch_count: newCount });
                    }
                    
                    showRewatchModal('season', { showName, season, records }, maxCount + 1, show);
                }, 200);
            });
        });
        // Fix TMDB
        document.getElementById('btn-fix-tmdb-tv').addEventListener('click', async function() {
            const result = await openTmdbFixModal(show.name, 'tv');
            if (result) {
                let existing = await db.shows.where('tmdb_id').equals(show.id).first();
                if (existing) {
                    await db.shows.update(existing.id, {
                        tmdb_id: result.id,
                        poster_path: result.poster_path,
                        backdrop_path: result.backdrop_path,
                        nb_episodes_total: undefined // reset this so it recalculates
                    });
                }
                showToast('Identification mise à jour !');
                closeDetail();
                refreshSeriesList();
            }
        });

        // Manual sync button
        document.getElementById('btn-sync-show').addEventListener('click', async function() {
            this.disabled = true;
            this.textContent = '⏳ Synchronisation...';
            try {
                const details = await TMDB.getShowDetails(show.id);
                if (details) {
                    const existing = await db.shows.where('tmdb_id').equals(show.id).first();
                    if (existing) {
                        const total = details.number_of_episodes || 0;
                        const nextAir = details.next_episode_to_air ? details.next_episode_to_air.air_date : null;
                        const genres = details.genres ? details.genres.map(g => g.name) : [];
                        
                        // Re-calculate finished status from scratch
                        let history = [];
                        if (existing.tvtime_id) history = await db.watch_history.where('show_tvtime_id').equals(String(existing.tvtime_id)).toArray();
                        if (history.length === 0) history = await db.watch_history.where('show_name').equals(existing.name).toArray();
                        const uniqueWatched = new Set();
                        history.forEach(h => { if (h.season_number > 0) uniqueWatched.add(`S${h.season_number}E${h.episode_number}`); });
                        const doneEps = uniqueWatched.size;
                        const shouldBeFinished = doneEps >= total && total > 0;
                        
                        await db.shows.update(existing.id, { 
                            nb_episodes_total: total, next_air_date: nextAir,
                            is_finished: shouldBeFinished ? 1 : 0,
                            last_sync: Date.now(), genres: genres
                        });
                    }
                    showToast('Données actualisées !');
                    refreshSeriesList();
                    renderShowDetail(details); // Re-render detail view
                } else {
                    showToast('Impossible de récupérer les données.');
                }
            } catch (e) {
                showToast('Erreur lors de la synchronisation.');
            }
            this.disabled = false;
            this.textContent = '🔄 Actualiser les données';
        });

        // Share button
        document.getElementById('btn-share-show').addEventListener('click', async function() {
            const shareData = {
                title: `${title} — DFWatch`,
                text: `Je suis ${title} sur DFWatch ! ${genres ? '(' + genres + ')' : ''}`,
                url: `https://www.themoviedb.org/tv/${show.id}`
            };
            if (navigator.share) {
                try { await navigator.share(shareData); } catch (e) { /* user cancelled */ }
            } else {
                // Fallback: copy to clipboard
                try {
                    await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                    showToast('Lien copié dans le presse-papier !');
                } catch (e) {
                    console.error('Error updating watch history', e);
                }
            }
        });

        document.querySelectorAll('.ep-note-sm').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const showId = btn.dataset.showId;
                const season = parseInt(btn.dataset.season);
                const ep = parseInt(btn.dataset.ep);
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

        // Episode Notes
        document.querySelectorAll('.ep-note-sm').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const showId = btn.dataset.showId;
                const season = parseInt(btn.dataset.season);
                const ep = parseInt(btn.dataset.ep);
                const epName = btn.dataset.epName;
                showEpisodeNoteModal(showId, season, ep, epName);
            });
        });

        // Load similar shows asynchronously
        (async () => {
            try {
                const similar = await TMDB.getRecommendations(show.id, 'tv');
                const container = document.getElementById('detail-similar-shows');
                if (similar && similar.length > 0 && container) {
                    let html = '<h3>Vous aimerez aussi</h3><div class="horizontal-scroll">';
                    similar.slice(0, 10).forEach(item => {
                        const pUrl = TMDB.imgUrl(item.poster_path, 'w185');
                        const name = item.name || item.title || '';
                        if (pUrl) {
                            html += `<div class="h-poster similar-poster" data-tmdb-id="${item.id}" data-type="${item.media_type || 'tv'}"><img src="${pUrl}" alt="${name}" loading="lazy"><div class="similar-label">${name}</div></div>`;
                        }
                    });
                    html += '</div>';
                    container.innerHTML = html;
                    
                    container.querySelectorAll('.similar-poster').forEach(el => {
                        el.addEventListener('click', async () => {
                            const tmdbId = parseInt(el.dataset.tmdbId);
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
        const title = movie.title || 'Sans titre';
        const overview = movie.overview || 'Pas de description disponible.';
        const year = (movie.release_date || '').split('-')[0];
        const genres = (movie.genres || []).map(g => g.name).join(', ');
        const runtime = movie.runtime || '?';
        const posterUrl = movie.poster_path ? TMDB.imgUrl(movie.poster_path, 'w500') : '';
        const rating = movie.vote_average ? (movie.vote_average * 10).toFixed(0) + '%' : '';
        
        let director = '';
        if (movie.credits && movie.credits.crew) {
            const dir = movie.credits.crew.find(c => c.job === 'Director');
            if (dir) director = dir.name;
        }
        
        // --- Cast (improved) ---
        let castHTML = '';
        if (movie.credits && movie.credits.cast) {
            const cast = movie.credits.cast.slice(0, 12);
            if (cast.length > 0) {
                castHTML = '<div class="detail-section"><h3>Têtes d\'affiche</h3><div class="horizontal-scroll cast-scroll">';
                cast.forEach(c => {
                    const img = c.profile_path ? TMDB.imgUrl(c.profile_path, 'w185') : '';
                    castHTML += `
                        <div class="cast-card">
                            ${img ? `<img src="${img}" alt="${c.name}" loading="lazy">` : `<div class="cast-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`}
                            <div class="cast-name">${c.name}</div>
                            <div class="cast-char">${c.character || ''}</div>
                        </div>`;
                });
                castHTML += '</div></div>';
            }
        }

        // --- Trailer ---
        let trailerHTML = '';
        if (movie.videos && movie.videos.results && movie.videos.results.length > 0) {
            const trailer = movie.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube')
                         || movie.videos.results.find(v => v.site === 'YouTube');
            if (trailer) {
                trailerHTML = `<div class="detail-section"><h3>Bande-annonce</h3><div class="trailer-container"><iframe src="https://www.youtube.com/embed/${trailer.key}?rel=0" frameborder="0" allowfullscreen loading="lazy" title="Bande-annonce"></iframe></div></div>`;
            }
        }

        const existingMovie = await db.movies.where('tmdb_id').equals(movie.id).first();
        const inWatchlist = existingMovie && existingMovie.status === 'watchlist';
        const isWatched = existingMovie && existingMovie.status === 'watched';
        const isFavorited = existingMovie && existingMovie.is_favorited === 1;
        const userRating = existingMovie ? existingMovie.user_rating || 0 : 0;

        detailBody.innerHTML = `
            <div class="detail-header-flex">
                ${posterUrl ? `<img src="${posterUrl}" class="detail-main-poster" alt="${title}">` : ''}
                <div class="detail-header-info">
                    <h1>${title}</h1>
                    <div class="detail-meta">${year} · ${genres} · ${runtime} min</div>
                    ${rating ? `<div class="detail-rating"><div class="rating-badge">${rating}</div> Score d'évaluation</div>` : ''}
                    <div class="detail-actions">
                        <button class="detail-action-btn follow ${inWatchlist ? 'active' : ''}" id="btn-add-movie" data-tmdb-id="${movie.id}" data-title="${title}" data-poster="${movie.poster_path || ''}" data-runtime="${movie.runtime || 0}">
                            ${inWatchlist ? '✓ Ajouté' : '+ Ajouter'}
                        </button>
                        <button class="detail-action-btn rewatch ${isWatched ? 'active' : ''}" id="btn-watched-movie" data-title="${title}" data-tmdb-id="${movie.id}" data-runtime="${movie.runtime || 0}">
                            ${isWatched ? '✓ Vu' : '✓ Vu'}
                        </button>
                        ${isWatched ? `<button class="detail-action-btn rewatch" id="btn-re-watch-movie" data-title="${title}" data-tmdb-id="${movie.id}" data-runtime="${movie.runtime || 0}">↻ Revoir</button>` : ''}
                        <button class="detail-action-btn fav-btn ${isFavorited ? 'active' : ''}" id="btn-fav-movie">
                            ${isFavorited ? '❤️ Favori' : '🤍 Favori'}
                        </button>
                        <button class="detail-action-btn list-btn" id="btn-add-to-list-movie" data-tmdb-id="${movie.id}" data-type="movie">
                            📋 Liste
                        </button>
                    </div>
                    <div class="user-rating-widget" id="movie-rating-widget">
                        <span style="font-size:12px; color:var(--text-muted); margin-right:8px;">Ma note:</span>
                        <div class="stars">
                            ${[1,2,3,4,5].map(i => `<span class="star ${i <= userRating ? 'active' : ''}" data-val="${i}">★</span>`).join('')}
                        </div>
                    </div>
                    <p class="detail-overview">${overview}</p>
                    ${director ? `<div class="detail-creator"><strong>Réalisateur :</strong> ${director}</div>` : ''}
                </div>
            </div>
            ${castHTML}
            ${trailerHTML}
            <div class="detail-section" id="detail-similar-movies"></div>
            <div class="detail-section detail-footer-actions" style="margin-top: 2rem; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <button class="action-btn secondary" id="btn-share-movie" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">📤 Partager</button>
                <button class="action-btn secondary" id="btn-fix-tmdb-movie" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">Mauvaise identification TMDB ?</button>
            </div>
        `;

        document.getElementById('btn-fix-tmdb-movie').addEventListener('click', async function() {
            const result = await openTmdbFixModal(movie.title || movie.name, 'movie');
            if (result) {
                let existing = await db.movies.where('tmdb_id').equals(movie.id).first();
                if (existing) {
                    await db.movies.update(existing.id, {
                        tmdb_id: result.id,
                        poster_path: result.poster_path,
                        backdrop_path: result.backdrop_path
                    });
                }
                showToast('Identification mise à jour !');
                closeDetail();
                refreshFilmsList();
            }
        });

        // Share movie
        document.getElementById('btn-share-movie').addEventListener('click', async function() {
            const shareData = {
                title: `${title} — DFWatch`,
                text: `J'ai vu ${title} sur DFWatch ! ${genres ? '(' + genres + ')' : ''}`,
                url: `https://www.themoviedb.org/movie/${movie.id}`
            };
            if (navigator.share) {
                try { await navigator.share(shareData); } catch (e) {}
            } else {
                try {
                    await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
                    showToast('Lien copié dans le presse-papier !');
                } catch(e) { showToast('Impossible de partager.'); }
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
                        const name = item.title || item.name || '';
                        if (pUrl) {
                            html += `<div class="h-poster similar-poster" data-tmdb-id="${item.id}" data-type="movie"><img src="${pUrl}" alt="${name}" loading="lazy"><div class="similar-label">${name}</div></div>`;
                        }
                    });
                    html += '</div>';
                    container.innerHTML = html;
                    container.querySelectorAll('.similar-poster').forEach(el => {
                        el.addEventListener('click', async () => {
                            const details = await TMDB.getMovieDetails(parseInt(el.dataset.tmdbId));
                            if (details) openDetail(details, 'movie');
                        });
                    });
                }
            } catch(e) {}
        })();

        document.getElementById('btn-add-movie').addEventListener('click', async function () {
            const tmdbId = parseInt(this.dataset.tmdbId);
            const existing = await db.movies.where('tmdb_id').equals(tmdbId).first();
            if (!existing) {
                await db.movies.add({
                    uuid: '', tmdb_id: tmdbId, name: this.dataset.title,
                    poster_path: this.dataset.poster, backdrop_path: movie.backdrop_path || '',
                    status: 'watchlist', release_date: movie.release_date || null,
                    runtime: parseInt(this.dataset.runtime) || 0
                });
                this.classList.add('active');
                this.textContent = '✓ Ajouté';
                showToast(`${this.dataset.title} ajouté à votre liste`);
            } else if (existing.status === 'watchlist') {
                await db.movies.delete(existing.id);
                this.classList.remove('active');
                this.textContent = '+ Ajouter';
                showToast(`${this.dataset.title} retiré de votre liste`);
            } else {
                showToast('Déjà marqué comme vu');
            }
        });

        document.getElementById('btn-watched-movie').addEventListener('click', async function () {
            const tmdbId = parseInt(this.dataset.tmdbId);
            let existing = await db.movies.where('tmdb_id').equals(tmdbId).first();
            
            if (existing && existing.status === 'watched') {
                // Unmark as watched
                await db.movies.update(existing.id, { status: 'watchlist' });
                // We should theoretically remove the watch record, but let's just delete the first watch record for this movie
                const watchRecord = await db.movie_watches.where('movie_uuid').equals(existing.uuid).first();
                if (watchRecord) {
                    await db.movie_watches.delete(watchRecord.id);
                }
                this.classList.remove('active');
                showToast(`${this.dataset.title} retiré de vos films vus`);
                // Optional: Hide "Revoir" button if it exists
                const reBtn = document.getElementById('btn-re-watch-movie');
                if (reBtn) reBtn.style.display = 'none';
            } else {
                if (!existing) {
                    const newId = await db.movies.add({
                        uuid: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(), tmdb_id: tmdbId, name: this.dataset.title,
                        poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '',
                        status: 'watched', release_date: movie.release_date || null,
                        is_favorited: 0, user_rating: 0, runtime: parseInt(this.dataset.runtime) || 0
                    });
                    existing = await db.movies.get(newId);
                } else {
                    await db.movies.update(existing.id, { status: 'watched' });
                }
                await db.movie_watches.add({
                    movie_uuid: existing.uuid || '', movie_name: this.dataset.title,
                    watched_at: new Date().toISOString(), rewatch_count: 0, runtime: parseInt(this.dataset.runtime) || 0
                });
                this.classList.add('active');
                showToast(`${this.dataset.title} marqué comme vu ✓`);
                // If "Revoir" button exists, show it (or we could just redraw the component, but reloading is annoying)
                const reBtn = document.getElementById('btn-re-watch-movie');
                if (reBtn) reBtn.style.display = 'inline-block';
            }
        });
        
        const rewatchBtn = document.getElementById('btn-re-watch-movie');
        if (rewatchBtn) {
            rewatchBtn.addEventListener('click', async function () {
                const tmdbId = parseInt(this.dataset.tmdbId);
                const existing = await db.movies.where('tmdb_id').equals(tmdbId).first();
                if (existing) {
                    const records = await db.movie_watches.where('movie_uuid').equals(existing.uuid).toArray();
                    let views = 0;
                    if (records.length > 0) {
                        views = records.reduce((sum, r) => sum + (r.rewatch_count || 0) + 1, 0);
                    } else {
                        views = 1; // Fallback
                    }
                    showRewatchModal('movie', { tmdbId, movieUuid: existing.uuid, movieName: this.dataset.title, records }, views, movie);
                }
            });
        }

        // Favorite movie
        document.getElementById('btn-fav-movie').addEventListener('click', async function () {
            const tmdbId = movie.id;
            let existing = await db.movies.where('tmdb_id').equals(tmdbId).first();
            if (!existing) {
                const newId = await db.movies.add({
                    uuid: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(), tmdb_id: tmdbId, name: title,
                    poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '',
                    status: 'watchlist', release_date: movie.release_date || null,
                    is_favorited: 1, user_rating: 0, runtime: parseInt(movie.runtime) || 0
                });
                existing = await db.movies.get(newId);
            } else {
                await db.movies.update(existing.id, { is_favorited: existing.is_favorited ? 0 : 1 });
            }
            const isFav = existing.is_favorited ? false : true;
            this.classList.toggle('active');
            this.textContent = isFav ? '❤️ Favori' : '🤍 Favori';
            showToast(isFav ? `${title} ajouté aux favoris` : `${title} retiré des favoris`);
        });

        // Rate movie
        document.querySelectorAll('#movie-rating-widget .star').forEach(star => {
            star.addEventListener('click', async function () {
                const val = parseInt(this.dataset.val);
                let existing = await db.movies.where('tmdb_id').equals(movie.id).first();
                if (!existing) {
                    await db.movies.add({
                        uuid: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(), tmdb_id: movie.id, name: title,
                        poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '',
                        status: 'watchlist', release_date: movie.release_date || null,
                        is_favorited: 0, user_rating: val, runtime: parseInt(movie.runtime) || 0
                    });
                } else {
                    const newVal = existing.user_rating === val ? 0 : val;
                    await db.movies.update(existing.id, { user_rating: newVal });
                }
                const newVal = (!existing || existing.user_rating !== val) ? val : 0;
                document.querySelectorAll('#movie-rating-widget .star').forEach(s => {
                    if (parseInt(s.dataset.val) <= newVal) s.classList.add('active');
                    else s.classList.remove('active');
                });
                if (newVal > 0) showToast(`Vous avez noté ${title} ${newVal}/5`);
            });
        });
    }

    // ---- Series list ----
    async function refreshSeriesList() {
        const watchingList = document.getElementById('series-list');
        const finishedList = document.getElementById('series-finished-list');
        const upcomingList = document.getElementById('series-upcoming-list');
        
        const sortVal = document.getElementById('series-sort').value;
        const searchQuery = (document.getElementById('series-local-search').value || '').trim().toLowerCase();
        let shows = await db.shows.where('is_followed').equals(1).toArray();
        if (searchQuery) {
            shows = shows.filter(s => s.name.toLowerCase().includes(searchQuery));
        }
        
        // Basic sort
        shows.sort((a, b) => {
            if (sortVal === 'name_asc') return a.name.localeCompare(b.name);
            if (sortVal === 'name_desc') return b.name.localeCompare(a.name);
            if (sortVal === 'added_asc') return a.id - b.id;
            if (sortVal === 'rating_desc') return (b.user_rating || 0) - (a.user_rating || 0);
            return b.id - a.id; // default: added_desc
        });

        watchingList.innerHTML = '';
        finishedList.innerHTML = '';
        upcomingList.innerHTML = '';

        let watchingCount = 0, finishedCount = 0, upcomingCount = 0;

        for (const show of shows) {
            const history = await db.watch_history.where('show_name').equals(show.name).toArray();
            const episodesWatched = history.length;
            const posterUrl = show.poster_path ? TMDB.imgUrl(show.poster_path, 'w185') : null;

            let lastSeason = 0, lastEp = 0;
            let doneEps = 0;
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
            doneEps = uniqueWatched.size;

            // Check for background sync
            const now = new Date().getTime();
            const lastSync = show.last_sync || 0;
            const isAlreadyFinished = show.is_finished === 1;
            const needsSync = !show.nb_episodes_total || (now - lastSync) > 86400000;
            // Skip auto-sync for finished series — use manual "Recalculer" to re-check them
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
                                const genres = details.genres ? details.genres.map(g => g.name) : [];
                                
                                await db.shows.update(show.id, { 
                                    nb_episodes_total: total,
                                    next_air_date: nextAir,
                                    is_finished: shouldBeFinished ? 1 : 0,
                                    last_sync: now,
                                    genres: genres
                                });
                                show.nb_episodes_total = total;
                                show.next_air_date = nextAir;
                                show.is_finished = shouldBeFinished ? 1 : 0;
                                show.genres = genres;
                                refreshSeriesList(); // Re-render to move to correct tab
                            }
                        } catch(e) {}
                    }, Math.random() * 5000 + 1000); // spread over 1-6 seconds
                }
            } else if (!isAlreadyFinished) {
                // Auto-correct is_finished if we have nb_episodes_total cached (only for non-finished shows)
                if (show.nb_episodes_total > 0) {
                    const shouldBeFinished = doneEps >= show.nb_episodes_total;
                    if (!shouldBeFinished !== !show.is_finished) {
                        show.is_finished = shouldBeFinished ? 1 : 0;
                        db.shows.update(show.id, { is_finished: show.is_finished }); // fire and forget
                    }
                }
            }

            const nextEp = lastEp + 1;
            const nextSeason = lastSeason || 1;
            const remaining = (show.nb_episodes_seen || episodesWatched) > 0 ? `+${show.nb_episodes_seen || episodesWatched}` : '';
            
            // Logic for categories
            let category = 'watching';
            if (show.is_finished) category = 'finished';
            
            let releaseDateLabel = '';
            if (show.next_air_date && new Date(show.next_air_date) > new Date()) {
                category = 'upcoming';
                releaseDateLabel = new Date(show.next_air_date).toLocaleDateString();
            } else if (show.first_air_date && new Date(show.first_air_date) > new Date()) {
                category = 'upcoming';
                releaseDateLabel = new Date(show.first_air_date).toLocaleDateString();
            }

            const displayName = show.name === 'Série inconnue' && show.tvtime_id ? 'Inconnue (ID: ' + show.tvtime_id + ')' : show.name;

            // Create card
            const card = document.createElement('div');
            
            const attachClickListener = (el) => {
                el.addEventListener('click', async () => {
                    if (show.tmdb_id) {
                        const details = await TMDB.getShowDetails(show.tmdb_id);
                        if (details) { openDetail(details, 'tv'); return; }
                    }
                    const result = await TMDB.findShowByName(show.name);
                    let shouldAutoLink = true;

                    if (result) {
                        // Verification to prevent bad automatic matching
                        const details = await TMDB.getShowDetails(result.id);
                        if (details) {
                            const totalEps = details.number_of_episodes || 0;
                            const totalSeasons = details.number_of_seasons || 0;
                            
                            // Check for mismatch (user watched more seasons than exist, or significantly more episodes)
                            if ((totalSeasons > 0 && lastSeason > totalSeasons) || (totalEps > 0 && doneEps > totalEps + 5)) {
                                shouldAutoLink = false;
                                const msg = `Nous avons trouvé "${details.name}" mais votre historique (${doneEps} eps vus jusqu'à la saison ${lastSeason}) ne correspond pas à cette série (${totalSeasons} saisons, ${totalEps} eps).\n\nLier quand même ?`;
                                const answer = await window.customConfirm(msg, "Incohérence détectée", "Lier quand même", "Rechercher la bonne");
                                if (answer) {
                                    shouldAutoLink = true;
                                }
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
                            show.tmdb_id = manualResult.id;
                            show.name = manualResult.name || manualResult.title;
                            show.poster_path = manualResult.poster_path;
                            refreshSeriesList();
                            const finalDetails = await TMDB.getShowDetails(show.tmdb_id);
                            if (finalDetails) openDetail(finalDetails, 'tv');
                        }
                    }
                });
            };

            if (category === 'finished' || category === 'upcoming') {
                card.className = 'poster-card';
                const badgeHtml = category === 'upcoming' && releaseDateLabel ? `<div class="poster-badge">${releaseDateLabel}</div>` : '';
                card.innerHTML = posterUrl
                    ? `<img src="${posterUrl}" alt="${displayName}" loading="lazy"><div class="poster-overlay"><div>${displayName}</div></div>${badgeHtml}`
                    : `<div class="poster-placeholder">${displayName}</div>${badgeHtml}`;
                
                attachClickListener(card);
                
                if (category === 'finished') {
                    finishedList.appendChild(card);
                    finishedCount++;
                } else {
                    upcomingList.appendChild(card);
                    upcomingCount++;
                }
            } else {
                card.className = 'episode-card';
                card.innerHTML = `
                    ${posterUrl ? `<img class="ep-poster" src="${posterUrl}" alt="${displayName}" loading="lazy">` : `<div class="ep-poster" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);text-align:center;word-break:break-all;">${displayName.substring(0, 30)}</div>`}
                    <div class="ep-info" style="cursor:pointer;">
                        <div class="ep-show-name">${displayName} ›</div>
                        <div class="ep-episode">S${String(nextSeason).padStart(2, '0')} | E${String(nextEp).padStart(2, '0')} <span class="ep-remaining">${remaining}</span></div>
                    </div>
                    <div class="ep-check" data-show-id="${show.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                `;
                
                attachClickListener(card.querySelector('.ep-info'));
                
                card.querySelector('.ep-check').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const checkBtn = card.querySelector('.ep-check');
                    checkBtn.classList.add('checked');
                    await db.watch_history.add({
                        show_tvtime_id: show.tvtime_id || '',
                        show_name: show.name,
                        season_number: nextSeason,
                        episode_number: nextEp,
                        episode_id: '',
                        watched_at: new Date().toISOString(),
                        rewatch_count: 0,
                        runtime: 0
                    });
                    showToast(window.I18n ? window.I18n.get('toast.seen', { name: show.name }) : `${show.name} S${nextSeason}E${nextEp} vu ✓`);
                    setTimeout(() => refreshSeriesList(), 600);
                });
                
                watchingList.appendChild(card);
                watchingCount++;
            }
        }
        
        if (watchingCount === 0) watchingList.innerHTML = `<div class="empty-state"><h3>${window.I18n ? window.I18n.get('series.empty_watching') : 'Aucune série en cours'}</h3></div>`;
        if (finishedCount === 0) finishedList.innerHTML = `<div class="empty-state"><h3>${window.I18n ? window.I18n.get('series.empty_finished') : 'Aucune série terminée'}</h3></div>`;
        if (upcomingCount === 0) upcomingList.innerHTML = `<div class="empty-state"><h3>${window.I18n ? window.I18n.get('series.empty_upcoming') : 'Rien à venir'}</h3></div>`;
    }

    // Attach sort and search listeners
    document.getElementById('series-sort').addEventListener('change', refreshSeriesList);
    const btnSearchSeries = document.getElementById('btn-search-series');
    if (btnSearchSeries) {
        btnSearchSeries.addEventListener('click', () => {
            const container = document.getElementById('series-search-container');
            container.classList.toggle('hidden');
            if (!container.classList.contains('hidden')) document.getElementById('series-local-search').focus();
            else { document.getElementById('series-local-search').value = ''; refreshSeriesList(); }
        });
    }
    const seriesSearchInput = document.getElementById('series-local-search');
    if (seriesSearchInput) {
        seriesSearchInput.addEventListener('input', () => refreshSeriesList());
    }

    // ---- Films list ----
    async function refreshFilmsList() {
        const watchlistList = document.getElementById('films-watchlist-list');
        const watchedList = document.getElementById('films-list');
        const upcomingList = document.getElementById('films-upcoming-list');
        
        const sortVal = document.getElementById('films-sort').value;
        const searchQuery = (document.getElementById('films-local-search').value || '').trim().toLowerCase();
        let movies = await db.movies.toArray();
        if (searchQuery) {
            movies = movies.filter(m => m.name.toLowerCase().includes(searchQuery));
        }
        
        movies.sort((a, b) => {
            if (sortVal === 'name_asc') return a.name.localeCompare(b.name);
            if (sortVal === 'name_desc') return b.name.localeCompare(a.name);
            if (sortVal === 'added_asc') return a.id - b.id;
            if (sortVal === 'rating_desc') return (b.user_rating || 0) - (a.user_rating || 0);
            if (sortVal === 'release_desc') return new Date(b.release_date || 0) - new Date(a.release_date || 0);
            return b.id - a.id;
        });

        watchlistList.innerHTML = '';
        watchedList.innerHTML = '';
        upcomingList.innerHTML = '';
        
        let wlCount = 0, wCount = 0, upCount = 0;

        for (const movie of movies) {
            const posterUrl = movie.poster_path ? TMDB.imgUrl(movie.poster_path, 'w342') : null;
            const year = (movie.release_date || '').split('-')[0];
            
            let category = 'watchlist';
            if (movie.status === 'watched') category = 'watched';
            if (movie.release_date && new Date(movie.release_date) > new Date()) category = 'upcoming';

            const div = document.createElement('div');
            div.className = 'poster-card';
            div.innerHTML = posterUrl
                ? `<img src="${posterUrl}" alt="${movie.name}" loading="lazy"><div class="poster-overlay"><div>${movie.name}</div><div class="poster-year">${year}</div></div>`
                : `<div class="poster-placeholder">${movie.name}</div>`;
            div.addEventListener('click', async () => {
                if (movie.tmdb_id) {
                    const details = await TMDB.getMovieDetails(movie.tmdb_id);
                    if (details) { openDetail(details, 'movie'); return; }
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
                        movie.tmdb_id = manualResult.id;
                        movie.name = manualResult.name || manualResult.title;
                        movie.poster_path = manualResult.poster_path;
                        refreshFilmsList();
                        const details = await TMDB.getMovieDetails(movie.tmdb_id);
                        if (details) openDetail(details, 'movie');
                    }
                }
            });
            
            if (category === 'upcoming') { upcomingList.appendChild(div); upCount++; }
            else if (category === 'watched') { watchedList.appendChild(div); wCount++; }
            else { watchlistList.appendChild(div); wlCount++; }
        }
        
        if (wlCount === 0) watchlistList.innerHTML = `<div class="empty-state"><h3>${window.I18n ? window.I18n.get('movies.empty_watchlist') : 'Rien à voir'}</h3></div>`;
        if (wCount === 0) watchedList.innerHTML = `<div class="empty-state"><h3>${window.I18n ? window.I18n.get('movies.empty_watched') : 'Aucun film vu'}</h3></div>`;
        if (upCount === 0) upcomingList.innerHTML = `<div class="empty-state"><h3>${window.I18n ? window.I18n.get('movies.empty_upcoming') : 'Rien à venir'}</h3></div>`;
    }
    
    // Attach sort and search listeners
    document.getElementById('films-sort').addEventListener('change', refreshFilmsList);
    const btnSearchFilms = document.getElementById('btn-search-films');
    if (btnSearchFilms) {
        btnSearchFilms.addEventListener('click', () => {
            const container = document.getElementById('films-search-container');
            container.classList.toggle('hidden');
            if (!container.classList.contains('hidden')) document.getElementById('films-local-search').focus();
            else { document.getElementById('films-local-search').value = ''; refreshFilmsList(); }
        });
    }
    const filmsSearchInput = document.getElementById('films-local-search');
    if (filmsSearchInput) {
        filmsSearchInput.addEventListener('input', () => refreshFilmsList());
    }

    // ---- Profile ----
    async function refreshProfile() {
        // --- 1. Populate Hero ---
        const firstName = localStorage.getItem('dfwatch_firstname') || '';
        const lastName = localStorage.getItem('dfwatch_lastname') || '';
        const age = localStorage.getItem('dfwatch_age') || '';
        
        let displayName = 'Utilisateur';
        let initials = '?';
        if (firstName || lastName) {
            displayName = `${firstName} ${lastName}`.trim();
            initials = (firstName ? firstName[0].toUpperCase() : '') + (lastName ? lastName[0].toUpperCase() : '');
        }
        
        document.getElementById('profile-display-name').textContent = displayName;
        document.getElementById('profile-avatar-initials').textContent = initials;
        
        const metaText = age ? `${age} ans` : 'Complétez votre profil';
        document.getElementById('profile-display-meta').textContent = metaText;
        
        // Populate Hero Genres
        const savedGenres = JSON.parse(localStorage.getItem('dfwatch_genres') || '[]');
        const heroGenresDiv = document.getElementById('profile-hero-genres');
        heroGenresDiv.innerHTML = '';
        savedGenres.forEach(genre => {
            const span = document.createElement('span');
            span.className = 'hero-genre-tag';
            span.textContent = genre;
            heroGenresDiv.appendChild(span);
        });
        
        // Populate Edit Modal inputs
        document.getElementById('profile-firstname').value = firstName;
        document.getElementById('profile-lastname').value = lastName;
        document.getElementById('profile-age').value = age;
        document.querySelectorAll('#profile-edit-modal .genre-checkbox input').forEach(cb => {
            cb.checked = savedGenres.includes(cb.value);
        });

        // --- 2. Calculate Stats ---
        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        
        const totalRuntimeMinutes = seriesStats.totalMinutes + movieStats.totalMinutes;
        const hours = Math.floor(totalRuntimeMinutes / 60);
        
        document.getElementById('stat-total-time').textContent = hours > 0 ? `${hours}h` : '0h';

        const shows = await db.shows.where('is_followed').equals(1).toArray();
        let completedSeriesCount = shows.filter(s => s.is_finished === 1).length;
        document.getElementById('stat-total-series').textContent = completedSeriesCount;
        
        const movies = await db.movies.toArray();
        document.getElementById('stat-total-movies').textContent = movies.filter(m => m.status === 'watched').length;

        // --- 3. Top 10 horizontal scroll ---
        const top10Scroll = document.getElementById('profile-top10-scroll');
        top10Scroll.innerHTML = '';
        const savedTop10 = JSON.parse(localStorage.getItem('dfwatch_top10') || '[]');
        
        if (savedTop10.length === 0) {
            top10Scroll.innerHTML = '<div style="color:var(--text-muted); font-size:13px; padding: 20px 0;">Aucun top 10 sélectionné. Éditez votre profil pour en ajouter !</div>';
        } else {
            for (const item of savedTop10) {
                const isMovie = item.type === 'movie';
                const dbTable = isMovie ? db.movies : db.shows;
                const dbItem = await dbTable.where('tmdb_id').equals(item.tmdb_id).first();
                if (!dbItem) continue;
                
                const posterUrl = dbItem.poster_path ? TMDB.imgUrl(dbItem.poster_path, 'w185') : null;
                if (!posterUrl) continue;
                
                const div = document.createElement('div');
                div.className = 'h-poster';
                div.innerHTML = `<img src="${posterUrl}" alt="${dbItem.name}" loading="lazy">`;
                div.addEventListener('click', async () => {
                    const details = isMovie ? await TMDB.getMovieDetails(dbItem.tmdb_id) : await TMDB.getShowDetails(dbItem.tmdb_id);
                    if (details) openDetail(details, isMovie ? 'movie' : 'tv');
                });
                top10Scroll.appendChild(div);
            }
        }

        // Sidebar mini-stats
        updateSidebarStats();

        // --- 4. Watching Tendency & My Taste ---
        const genreTally = {};
        
        const processGenres = (item) => {
            if (item.genres && Array.isArray(item.genres)) {
                item.genres.forEach(g => {
                    if (!genreTally[g]) genreTally[g] = 0;
                    genreTally[g]++;
                });
            }
        };
        
        // We look at all db shows/movies (since some might not be followed anymore but were watched)
        const allDbShows = await db.shows.toArray();
        const allDbMovies = await db.movies.toArray();
        allDbShows.forEach(processGenres);
        allDbMovies.forEach(processGenres);
        
        const sortedGenres = Object.keys(genreTally).sort((a, b) => genreTally[b] - genreTally[a]);
        
        const tasteSummaryEl = document.getElementById('profile-taste-summary');
        const genresListEl = document.getElementById('profile-genres-list');
        
        if (tasteSummaryEl && genresListEl) {
            if (sortedGenres.length > 0) {
                const top3 = sortedGenres.slice(0, 3);
                tasteSummaryEl.innerHTML = window.I18n ? window.I18n.get('profile.taste_desc', { top: top3.join(', ') }) : `Vous êtes un grand fan de <span style="color:var(--cyan-400)">${top3.join(', ')}</span>.`;
                
                genresListEl.innerHTML = '';
                sortedGenres.forEach(genre => {
                    const count = genreTally[genre];
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.style.alignItems = 'center';
                    div.style.padding = '8px 12px';
                    div.style.background = 'var(--surface-3)';
                    div.style.borderRadius = 'var(--r-8)';
                    div.style.fontSize = '13px';
                    
                    const titleCountStr = window.I18n ? window.I18n.get('profile.titles_count', { count }) : `${count} titre${count > 1 ? 's' : ''}`;
                    
                    div.innerHTML = `
                        <span>${genre}</span>
                        <span style="color:var(--text-muted); font-weight:700;">${titleCountStr}</span>
                    `;
                    genresListEl.appendChild(div);
                });
            } else {
                tasteSummaryEl.textContent = window.I18n ? window.I18n.get('profile.taste_empty') : 'Continuez à utiliser l\'application pour découvrir vos genres favoris ! (Les genres sont mis à jour en tâche de fond)';
                genresListEl.innerHTML = '';
            }
        }

        // Sync finished series button
        const btnSync = document.getElementById('btn-sync-finished');
        if (btnSync && !btnSync.dataset.bound) {
            btnSync.dataset.bound = "1";
            btnSync.addEventListener('click', async function() {
                const prevText = this.textContent;
                this.textContent = 'Synchronisation en cours...';
                this.disabled = true;
                
                try {
                    const followed = await db.shows.where('is_followed').equals(1).toArray();
                    for (const show of followed) {
                        const details = await TMDB.getShowDetails(show.tmdb_id);
                        if (!details) continue;
                        
                        let history = [];
                        if (show.tvtime_id) history = await db.watch_history.where('show_tvtime_id').equals(String(show.tvtime_id)).toArray();
                        if (history.length === 0) history = await db.watch_history.where('show_name').equals(show.name).toArray();
                        
                        let doneEps = 0;
                        const uniqueWatched = new Set();
                        history.forEach(h => {
                            if (h.season_number > 0) uniqueWatched.add(`S${h.season_number}E${h.episode_number}`);
                        });
                        doneEps = uniqueWatched.size;
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
                }
                
                this.textContent = prevText;
                this.disabled = false;
            });
        }
    }

    // ---- Stats & Achievements ----
    let statsChartInstance = null;

    async function renderStatsChart() {
        const canvas = document.getElementById('stats-chart');
        if (!canvas || !window.Chart) return;
        
        const shows = await db.shows.toArray();
        const movies = await db.movies.toArray();
        
        const genreCounts = {};
        const countGenres = (items) => {
            items.forEach(item => {
                if (item.genres && Array.isArray(item.genres)) {
                    item.genres.forEach(g => {
                        const name = g.name || g;
                        genreCounts[name] = (genreCounts[name] || 0) + 1;
                    });
                }
            });
        };
        countGenres(shows);
        countGenres(movies);
        
        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7); // Top 7 genres
            
        const labels = sortedGenres.map(g => g[0]);
        const data = sortedGenres.map(g => g[1]);
        
        if (statsChartInstance) statsChartInstance.destroy();
        
        statsChartInstance = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#8b5cf6', // iris
                        '#06b6d4', // cyan
                        '#ec4899', // pink
                        '#3b82f6', // blue
                        '#10b981', // emerald
                        '#f59e0b', // amber
                        '#6366f1'  // indigo
                    ],
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
                        labels: { color: '#8b8ba3', font: { family: "'Inter', sans-serif", size: 11 } }
                    }
                },
                layout: { padding: 0 }
            }
        });
    }

    async function refreshStats() {
        const achs = await Achievements.evaluate();
        
        // Update top stats
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
        document.getElementById('stat-episodes-count').textContent = seriesStats.count.toLocaleString();
        document.getElementById('stat-films-count').textContent = movieStats.count.toLocaleString();

        const sHours = Math.floor(seriesStats.totalMinutes / 60);
        document.getElementById('stat-series-hours').textContent = `Total : ${sHours.toLocaleString()} heures`;
        
        const mHours = Math.floor(movieStats.totalMinutes / 60);
        document.getElementById('stat-films-hours').textContent = `Total : ${mHours.toLocaleString()} heures`;

        // Render Chart
        await renderStatsChart();

        // Render achievements
        const container = document.getElementById('achievements-container');
        container.innerHTML = '';
        
        const unlockedCount = achs.filter(a => a.unlocked).length;
        const totalCount = achs.length;
        
        document.getElementById('achievements-progress-text').textContent = `${unlockedCount}/${totalCount}`;
        const pct = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;
        document.getElementById('achievements-progress-fill').style.width = `${pct}%`;

        // Group by category
        const cats = Achievements.getCategories();
        for (const cat of cats) {
            const catAchs = achs.filter(a => a.cat === cat.key);
            if (catAchs.length === 0) continue;
            
            const catSection = document.createElement('div');
            catSection.className = 'achievements-category';
            catSection.innerHTML = `<h3>${cat.icon} ${cat.name}</h3>`;
            
            const grid = document.createElement('div');
            grid.className = 'achievements-grid-inner';
            
            // Unlocked first, then locked
            catAchs.sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0));
            
            catAchs.forEach(ach => {
                grid.appendChild(Achievements.renderCard(ach));
            });
            catSection.appendChild(grid);
            container.appendChild(catSection);
        }
    }

    // ---- Import / Export ----
    const fileInput = document.getElementById('csv-file-input');
    const fileNames = document.getElementById('import-file-names');
    const importStatus = document.getElementById('import-status');
    let selectedFiles = [];

    // Drag & Drop
    const dropZone = document.getElementById('file-drop-zone');
    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
    });
    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.style.borderColor = ''; });
    });
    dropZone.addEventListener('drop', e => {
        selectedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
        updateFileNames();
    });
    fileInput.addEventListener('change', e => {
        selectedFiles = Array.from(e.target.files);
        updateFileNames();
    });

    function updateFileNames() {
        fileNames.innerHTML = selectedFiles.map(f => `<div class="fname">📄 ${f.name}</div>`).join('');
    }

    document.getElementById('btn-import').addEventListener('click', async () => {
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
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '10%';

        try {
            let total;
            if (type === 'tvtime') {
                total = await Importer.importTVTime(selectedFiles, msg => {
                    importStatus.textContent = msg;
                    const w = parseInt(progressBar.style.width) || 10;
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
                // For DFWatch backup, show the import modal to pick what to restore
                document.getElementById('import-modal').classList.remove('hidden');
            }
        } catch (err) {
            importStatus.textContent = `Erreur: ${err.message}`;
            importStatus.className = 'status-msg error';
            progressBar.style.width = '0%';
        }
    });

    // Handle Import Confirmation from Modal
    document.getElementById('btn-import-cancel').addEventListener('click', () => {
        document.getElementById('import-modal').classList.add('hidden');
    });

    document.getElementById('btn-import-confirm').addEventListener('click', async () => {
        document.getElementById('import-modal').classList.add('hidden');
        const options = {
            data: document.getElementById('import-chk-data').checked,
            settings: document.getElementById('import-chk-settings').checked,
            cache: document.getElementById('import-chk-cache').checked
        };
        
        const progressBar = document.getElementById('import-progress-bar');
        const progressContainer = document.getElementById('import-progress');
        progressContainer.classList.remove('hidden');
        
        try {
            const total = await Importer.importDFWatch(selectedFiles, options, msg => {
                importStatus.textContent = msg;
            });
            progressBar.style.width = '100%';
            importStatus.textContent = `✓ Import terminé — ${total} éléments importés.`;
            importStatus.className = 'status-msg success';
            showToast('Import réussi ! 🎉');
            
            // Reload page to apply settings/data if necessary, or just refresh
            refreshSeriesList();
            refreshFilmsList();
            refreshProfile();
            if (options.data || options.cache) {
                enrichAllMedia();
            }
            if (options.settings) {
                location.reload(); // Hard refresh to apply theme and lang instantly
            }
        } catch (err) {
            importStatus.textContent = `Erreur: ${err.message}`;
            importStatus.className = 'status-msg error';
            progressBar.style.width = '0%';
        }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
        document.getElementById('export-modal').classList.remove('hidden');
    });

    document.getElementById('btn-export-cancel').addEventListener('click', () => {
        document.getElementById('export-modal').classList.add('hidden');
    });

    document.getElementById('btn-export-confirm').addEventListener('click', async () => {
        document.getElementById('export-modal').classList.add('hidden');
        const options = {
            data: document.getElementById('export-chk-data').checked,
            settings: document.getElementById('export-chk-settings').checked,
            cache: document.getElementById('export-chk-cache').checked
        };
        await Importer.exportDFWatch(options);
        localStorage.setItem('dfwatch_has_exported', '1');
        showToast(window.I18n ? window.I18n.get('toast.export') : 'Export téléchargé !');
    });


    document.getElementById('btn-force-update').addEventListener('click', async () => {
        const confirmed = await window.customConfirm("Cela va vider le cache de l'application et forcer le téléchargement de la dernière version. Continuer ?");
        if (confirmed) {
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) {
                        await registration.unregister();
                    }
                }
                if ('caches' in window) {
                    const keys = await caches.keys();
                    for (let key of keys) {
                        await caches.delete(key);
                    }
                }
                // Hard reload
                window.location.href = window.location.href.split('?')[0] + '?update=' + new Date().getTime();
            } catch (err) {
                console.error('Erreur de maj', err);
                showToast('Erreur lors du vidage du cache');
            }
        }
    });

    document.getElementById('btn-clear').addEventListener('click', async () => {
        const confirmed = await window.customConfirm('⚠️ Effacer TOUTES vos données ? Cette action est irréversible.');
        if (confirmed) {
            await DB.clearAll();
            showToast('Données effacées');
            refreshSeriesList();
            refreshFilmsList();
            refreshProfile();
        }
    });

    // ---- Background TMDB enrichment & Cache ----
    async function enrichAllMedia() {
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
                // Rate limit: 200ms between calls
                await new Promise(r => setTimeout(r, 200));
            } catch (e) { /* skip */ }
        }
        // Movies
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
            } catch (e) { /* skip */ }
        }
        refreshSeriesList();
        refreshFilmsList();
    }



    // ---- Custom Confirm ----
    window.customConfirm = function(message, title = "Confirmation", okText = "Confirmer", cancelText = "Annuler") {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-confirm-modal');
            document.getElementById('custom-confirm-title').textContent = title;
            document.getElementById('custom-confirm-message').textContent = message;
            
            const btnOk = document.getElementById('custom-confirm-ok');
            const btnCancel = document.getElementById('custom-confirm-cancel');
            
            btnOk.textContent = okText;
            btnCancel.textContent = cancelText;

            modal.classList.remove('hidden');

            const cleanup = () => {
                modal.classList.add('hidden');
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
        });
    };

    // ---- Custom Prompt ----
    window.customPrompt = function(message, title = "Prompt", placeholder = "") {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-prompt-modal');
            document.getElementById('custom-prompt-title').textContent = title;
            document.getElementById('custom-prompt-message').textContent = message;
            
            const input = document.getElementById('custom-prompt-input');
            input.placeholder = placeholder;
            input.value = "";
            
            const btnOk = document.getElementById('custom-prompt-ok');
            const btnCancel = document.getElementById('custom-prompt-cancel');
            
            modal.classList.remove('hidden');
            input.focus();

            const cleanup = () => {
                modal.classList.add('hidden');
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
            };

            const onOk = () => { cleanup(); resolve(input.value); };
            const onCancel = () => { cleanup(); resolve(null); };

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);

        });
    };

    // ---- Toast ----
    window.showToast = function(msg, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.innerHTML = msg; // allow HTML for the update button
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
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
    
    function renderTop10Selected() {
        const list = document.getElementById('top10-selected-list');
        list.innerHTML = '';
        currentTop10.forEach(item => {
            const pill = document.createElement('div');
            pill.style = 'background:var(--bg-panel); border:1px solid var(--border-light); padding:4px 8px; border-radius:var(--r-pill); font-size:12px; display:flex; align-items:center; gap:6px; cursor:pointer; color:var(--text-primary);';
            pill.innerHTML = `<span>${item.name}</span><span style="color:var(--text-muted);">&times;</span>`;
            pill.addEventListener('click', () => {
                currentTop10 = currentTop10.filter(t => t.tmdb_id !== item.tmdb_id);
                renderTop10Selected();
            });
            list.appendChild(pill);
        });
    }

    document.getElementById('top10-search').addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase().trim();
        const resultsContainer = document.getElementById('top10-search-results');
        
        if (!query) {
            resultsContainer.classList.add('hidden');
            return;
        }
        
        const allShows = await db.shows.toArray();
        const allMovies = await db.movies.toArray();
        
        const matches = [...allShows.map(s => ({...s, _type: 'tv'})), ...allMovies.map(m => ({...m, _type: 'movie'}))]
            .filter(item => item.name && item.name.toLowerCase().includes(query))
            .slice(0, 10);
            
        resultsContainer.innerHTML = '';
        if (matches.length > 0) {
            resultsContainer.classList.remove('hidden');
            matches.forEach(m => {
                const row = document.createElement('div');
                row.style = 'padding:6px 8px; cursor:pointer; font-size:13px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;';
                row.innerHTML = `<span>${m.name}</span><span style="font-size:10px; padding:2px 4px; background:var(--bg-card); border-radius:4px; color:var(--text-muted);">${m._type === 'movie' ? 'Film' : 'Série'}</span>`;
                row.addEventListener('mouseover', () => row.style.background = 'var(--border-light)');
                row.addEventListener('mouseout', () => row.style.background = 'transparent');
                row.addEventListener('click', () => {
                    if (currentTop10.length >= 10) {
                        showToast('Vous avez déjà 10 éléments dans votre Top 10.');
                        return;
                    }
                    if (!currentTop10.find(t => t.tmdb_id === m.tmdb_id)) {
                        currentTop10.push({ tmdb_id: m.tmdb_id, type: m._type, name: m.name });
                        renderTop10Selected();
                    }
                    document.getElementById('top10-search').value = '';
                    resultsContainer.classList.add('hidden');
                });
                resultsContainer.appendChild(row);
            });
        } else {
            resultsContainer.classList.add('hidden');
        }
    });
    
    document.getElementById('btn-edit-profile').addEventListener('click', () => {
        currentTop10 = JSON.parse(localStorage.getItem('dfwatch_top10') || '[]');
        renderTop10Selected();
        document.getElementById('top10-search').value = '';
        document.getElementById('top10-search-results').classList.add('hidden');
        profileEditModal.classList.remove('hidden');
    });
    
    document.getElementById('btn-profile-edit-cancel').addEventListener('click', () => {
        profileEditModal.classList.add('hidden');
    });

    document.getElementById('btn-save-profile').addEventListener('click', () => {
        localStorage.setItem('dfwatch_firstname', document.getElementById('profile-firstname').value);
        localStorage.setItem('dfwatch_lastname', document.getElementById('profile-lastname').value);
        localStorage.setItem('dfwatch_age', document.getElementById('profile-age').value);
        
        const checkedGenres = Array.from(document.querySelectorAll('#profile-edit-modal .genre-checkbox input:checked')).map(cb => cb.value);
        localStorage.setItem('dfwatch_genres', JSON.stringify(checkedGenres));
        localStorage.setItem('dfwatch_top10', JSON.stringify(currentTop10));
        
        profileEditModal.classList.add('hidden');
        refreshProfile();
        showToast(window.I18n ? window.I18n.get('toast.profile_saved') : 'Profil enregistré avec succès !');
    });

    // ---- Calendar / Agenda ----
    let calendarDate = new Date();
    
    const calPrev = document.getElementById('cal-prev');
    const calNext = document.getElementById('cal-next');
    if (calPrev) calPrev.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); refreshCalendar(); });
    if (calNext) calNext.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); refreshCalendar(); });

    async function refreshCalendar() {
        const monthLabel = document.getElementById('cal-month-label');
        const grid = document.getElementById('calendar-grid');
        const eventsContainer = document.getElementById('calendar-events');
        if (!monthLabel || !grid || !eventsContainer) return;

        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        monthLabel.textContent = new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        monthLabel.style.textTransform = 'capitalize';

        // Gather events from DB
        const events = [];
        
        // 1. Series with next_air_date
        const shows = await db.shows.where('is_followed').equals(1).toArray();
        for (const show of shows) {
            if (show.next_air_date) {
                const d = new Date(show.next_air_date);
                events.push({ date: d, type: 'episode', name: show.name, detail: 'Prochain épisode', poster: show.poster_path, tmdb_id: show.tmdb_id, media_type: 'tv' });
            }
        }
        
        // 2. Movies with future release dates
        const movies = await db.movies.toArray();
        for (const movie of movies) {
            if (movie.release_date && new Date(movie.release_date) > new Date()) {
                const d = new Date(movie.release_date);
                events.push({ date: d, type: 'movie', name: movie.name, detail: 'Sortie du film', poster: movie.poster_path, tmdb_id: movie.tmdb_id, media_type: 'movie' });
            }
        }
        
        // Build calendar grid
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const adjustedFirst = firstDay === 0 ? 6 : firstDay - 1; // Monday-first
        
        const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        let gridHTML = dayNames.map(d => `<div class="cal-header">${d}</div>`).join('');
        
        // Empty cells before first day
        for (let i = 0; i < adjustedFirst; i++) gridHTML += '<div class="cal-day empty"></div>';
        
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dayEvents = events.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month && e.date.getDate() === day);
            const isToday = dateObj.toDateString() === today.toDateString();
            const hasEvents = dayEvents.length > 0;
            
            let dots = '';
            let bgImage = '';
            if (hasEvents) {
                dots = '<div class="cal-dots" style="position:relative; z-index:2;">' + dayEvents.map(e => `<span class="cal-dot ${e.type}"></span>`).join('') + '</div>';
                const firstWithPoster = dayEvents.find(e => e.poster);
                if (firstWithPoster) {
                    bgImage = `background-image: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 50%), url('${TMDB.imgUrl(firstWithPoster.poster, 'w185')}'); background-size: cover; background-position: center; border: none;`;
                }
            }
            
            gridHTML += `<div class="cal-day ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}" data-date="${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}" style="${bgImage}">
                <span style="position:relative; z-index:2; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${day}</span>
                ${dots}
            </div>`;
        }
        
        grid.innerHTML = gridHTML;
        
        // Click on day to show events
        grid.querySelectorAll('.cal-day[data-date]').forEach(el => {
            el.addEventListener('click', () => {
                grid.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
                el.classList.add('selected');
                const [y, m, d] = el.dataset.date.split('-').map(Number);
                const dayEvents = events.filter(e => e.date.getFullYear() === y && e.date.getMonth() === m - 1 && e.date.getDate() === d);
                renderCalendarEvents(dayEvents, eventsContainer, el.dataset.date);
            });
        });
        
        // Show all events for this month by default
        const monthEvents = events.filter(e => e.date.getFullYear() === year && e.date.getMonth() === month);
        monthEvents.sort((a, b) => a.date - b.date);
        renderCalendarEvents(monthEvents, eventsContainer, null);
    }
    
    function renderCalendarEvents(events, container, selectedDate) {
        if (events.length === 0) {
            const label = selectedDate ? `le ${new Date(selectedDate).toLocaleDateString('fr-FR', { day:'numeric', month:'long' })}` : 'ce mois-ci';
            container.innerHTML = `<div class="empty-state" style="padding:32px 0;"><div class="empty-icon">📅</div><h3>Rien de prévu ${label}</h3><p>Suivez des séries ou ajoutez des films pour voir vos dates importantes ici.</p></div>`;
            return;
        }
        
        const title = selectedDate ? new Date(selectedDate).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }) : 'Ce mois';
        let html = `<h3 style="margin-bottom:16px; text-transform:capitalize;">${title}</h3>`;
        
        events.forEach(ev => {
            const posterUrl = ev.poster ? TMDB.imgUrl(ev.poster, 'w92') : '';
            const dateStr = ev.date.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
            html += `
                <div class="calendar-event-card" data-tmdb-id="${ev.tmdb_id}" data-type="${ev.media_type}" style="display:flex; gap:12px; align-items:center; padding:12px; background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--r-12); margin-bottom:8px; cursor:pointer; transition: all 0.2s;">
                    ${posterUrl ? `<img src="${posterUrl}" style="width:48px; border-radius:var(--r-8);" loading="lazy">` : '<div style="width:48px;height:72px;background:var(--surface-3);border-radius:var(--r-8);"></div>'}
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:14px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.name}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${ev.detail} · ${dateStr}</div>
                    </div>
                    <span class="cal-type-badge ${ev.type}" style="font-size:10px; padding:3px 8px; border-radius:var(--r-pill); font-weight:600;">${ev.type === 'movie' ? '🎬 Film' : '📺 Épisode'}</span>
                </div>`;
        });
        container.innerHTML = html;
        
        // Click handlers
        container.querySelectorAll('.calendar-event-card').forEach(card => {
            card.addEventListener('click', async () => {
                const tmdbId = parseInt(card.dataset.tmdbId);
                const type = card.dataset.type;
                const details = type === 'tv' ? await TMDB.getShowDetails(tmdbId) : await TMDB.getMovieDetails(tmdbId);
                if (details) openDetail(details, type);
            });
        });
    }

    // ---- Init ----
    refreshSeriesList();
    refreshProfile();
    refreshStats();
    updateSidebarStats();

    // Start background enrichment (won't block UI)
    setTimeout(() => {
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
                indicator.textContent = '↻ Relâchez pour actualiser';
            } else if (diff > 10) {
                indicator.classList.add('visible');
                indicator.textContent = '⬇ Tirez pour actualiser';
            } else {
                indicator.classList.remove('visible');
            }
        }, { passive: true });
        
        container.addEventListener('touchend', async () => {
            if (!pulling) return;
            pulling = false;
            if (indicator.classList.contains('visible') && indicator.textContent.includes('Relâchez')) {
                indicator.textContent = '⏳ Actualisation...';
                indicator.classList.add('loading');
                // Clear sync cache to force re-fetch
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

    // ==========================================
    // CUSTOM LISTS
    // ==========================================
    async function renderCustomLists() {
        const container = document.getElementById('custom-lists-container');
        try {
            const lists = await db.custom_lists.toArray();
            
            // Fetch favoris count (safely fallback if index fails)
            let favShows = 0;
            let favMovies = 0;
            try {
                favShows = await db.shows.where('is_favorited').equals(1).count();
                favMovies = await db.movies.where('is_favorited').equals(1).count();
            } catch (err) {
                // Fallback if index is broken
                const allShows = await db.shows.toArray();
                favShows = allShows.filter(s => s.is_favorited === 1).length;
                const allMovies = await db.movies.toArray();
                favMovies = allMovies.filter(m => m.is_favorited === 1).length;
            }
            const totalFavs = favShows + favMovies;

            let html = `
                <div class="list-card-v2 favoris" data-id="favoris">
                    <div class="list-icon">❤️</div>
                    <h3>Favoris</h3>
                    <p>${totalFavs} élément(s)</p>
                </div>
            `;
            
            for (const list of lists) {
                const items = await db.list_items.where('list_id').equals(list.id).toArray();
                let iconHtml = '📋';
                html += `
                    <div class="list-card-v2" data-id="${list.id}">
                        <div class="list-icon">${iconHtml}</div>
                        <h3>${list.name}</h3>
                        <p>${items.length} élément(s)</p>
                        <button class="btn-delete-list-v2" data-id="${list.id}" title="Supprimer la liste">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                `;
            }

            html += `
                <div class="list-card-v2 create-new" id="btn-create-list-card">
                    <div class="list-icon" style="color:var(--text-secondary);">+</div>
                    <h3 style="color:var(--text-secondary);">Créer une liste</h3>
                </div>
            `;

            container.innerHTML = html;
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div style="color: red; padding: 20px;">Erreur renderCustomLists: ${e.message}<br>${e.stack}</div>`;
            return;
        }
        
        // Also hide the old btn-create-list from the header
        const oldCreateBtn = document.getElementById('btn-create-list');
        if (oldCreateBtn) oldCreateBtn.style.display = 'none';
        
        container.querySelectorAll('.btn-delete-list-v2').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(await window.customConfirm("Voulez-vous vraiment supprimer cette liste ?", "Suppression", "Supprimer", "Annuler")) {
                    const listId = parseInt(btn.dataset.id);
                    await db.custom_lists.delete(listId);
                    await db.list_items.where('list_id').equals(listId).delete();
                    renderCustomLists();
                }
            });
        });

        container.querySelectorAll('.list-card-v2:not(.create-new)').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                openCustomList(id); 
            });
        });

        const createCardBtn = document.getElementById('btn-create-list-card');
        if (createCardBtn) {
            createCardBtn.addEventListener('click', async () => {
                const name = await window.customPrompt("Nom de la nouvelle liste :", "Nouvelle Liste");
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
        
        const titleEl = document.getElementById('list-detail-title');
        const contentEl = document.getElementById('list-detail-content');
        
        if (id === 'favoris') {
            titleEl.textContent = 'Favoris';
            await renderListDetailItems('favoris');
        } else {
            const list = await db.custom_lists.get(parseInt(id));
            if (list) {
                titleEl.textContent = list.name;
                await renderListDetailItems(parseInt(id));
            }
        }
    }

    document.getElementById('btn-back-lists').addEventListener('click', () => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-lists').classList.add('active');
        renderCustomLists();
    });

    async function renderListDetailItems(id) {
        const contentEl = document.getElementById('list-detail-content');
        let items = [];
        let html = '';
        
        if (id === 'favoris') {
            const favShows = await db.shows.where('is_favorited').equals(1).toArray();
            const favMovies = await db.movies.where('is_favorited').equals(1).toArray();
            
            favShows.forEach(s => items.push({ type: 'show', data: s }));
            favMovies.forEach(m => items.push({ type: 'movie', data: m }));
        } else {
            const listItems = await db.list_items.where('list_id').equals(id).toArray();
            for (const item of listItems) {
                if (item.media_type === 'show') {
                    const s = await db.shows.where('tmdb_id').equals(item.tmdb_id).first();
                    if (s) items.push({ type: 'show', data: s, listItemId: item.id });
                } else {
                    const m = await db.movies.where('tmdb_id').equals(item.tmdb_id).first();
                    if (m) items.push({ type: 'movie', data: m, listItemId: item.id });
                }
            }
        }
        
        if (items.length === 0) {
            contentEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📭</div><h3>Liste vide</h3><p>Vous n'avez pas encore ajouté d'éléments à cette liste.</p></div>`;
            return;
        }

        for (const item of items) {
            const { type, data, listItemId } = item;
            const linkClass = type === 'show' ? 'show-link' : 'movie-link';
            
            // Delete button logic
            let deleteBtnHtml = '';
            if (id === 'favoris') {
                deleteBtnHtml = `<button class="btn-remove-from-list" data-type="${type}" data-tmdb="${data.tmdb_id}" data-id="favoris" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">&times;</button>`;
            } else {
                deleteBtnHtml = `<button class="btn-remove-from-list" data-item-id="${listItemId}" data-id="custom" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">&times;</button>`;
            }

            html += `
                <div style="position:relative;">
                    <div class="poster-container ${linkClass}" data-id="${data.tmdb_id}" style="cursor:pointer; width:100%; height:100%;">
                        ${data.poster_path ? `<img src="https://image.tmdb.org/t/p/w200${data.poster_path}" class="poster-img" loading="lazy">` : `<div class="poster-placeholder">No Image</div>`}
                    </div>
                    ${deleteBtnHtml}
                </div>
            `;
        }
        
        contentEl.innerHTML = html;
        
        // Navigation events
        contentEl.querySelectorAll('.show-link').forEach(el => {
            el.addEventListener('click', async () => {
                const s = await db.shows.where('tmdb_id').equals(parseInt(el.dataset.id)).first();
                if (s) openDetail({ id: s.tmdb_id, name: s.name, backdrop_path: s.poster_path }, 'tv');
            });
        });
        contentEl.querySelectorAll('.movie-link').forEach(el => {
            el.addEventListener('click', async () => {
                const m = await db.movies.where('tmdb_id').equals(parseInt(el.dataset.id)).first();
                if (m) openDetail({ id: m.tmdb_id, title: m.name, backdrop_path: m.poster_path }, 'movie');
            });
        });
        
        // Remove events
        contentEl.querySelectorAll('.btn-remove-from-list').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const listType = btn.dataset.id;
                if (listType === 'favoris') {
                    const mType = btn.dataset.type;
                    const tmdb = parseInt(btn.dataset.tmdb);
                    if (mType === 'show') {
                        await db.shows.where('tmdb_id').equals(tmdb).modify({ is_favorited: 0 });
                    } else {
                        await db.movies.where('tmdb_id').equals(tmdb).modify({ is_favorited: 0 });
                    }
                } else {
                    const listItemId = parseInt(btn.dataset.itemId);
                    await db.list_items.delete(listItemId);
                }
                renderListDetailItems(currentListId); // refresh
            });
        });
    }

    document.querySelector('[data-page="lists"]').addEventListener('click', () => renderCustomLists());

    async function showAddToListModal(tmdbId, mediaType) {
        const modal = document.getElementById('add-to-list-modal');
        const container = document.getElementById('add-to-list-container');
        const lists = await db.custom_lists.toArray();
        
        let html = '';

        // Favoris toggle
        let isFavorited = false;
        if (mediaType === 'show') {
            const s = await db.shows.where('tmdb_id').equals(parseInt(tmdbId)).first();
            if (s && s.is_favorited) isFavorited = true;
        } else {
            const m = await db.movies.where('tmdb_id').equals(parseInt(tmdbId)).first();
            if (m && m.is_favorited) isFavorited = true;
        }

        html += `
            <div class="modal-list-row is-favoris ${isFavorited ? 'checked' : ''}" data-list="favoris">
                <div class="modal-list-info">
                    <div class="modal-list-icon">❤️</div>
                    <div class="modal-list-text">
                        <h4>Favoris</h4>
                        <p>Ajouter aux favoris</p>
                    </div>
                </div>
                <div class="list-checkbox">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            </div>
        `;

        if (lists.length > 0) {
            for (const list of lists) {
                const existing = await db.list_items.where({list_id: list.id, tmdb_id: parseInt(tmdbId)}).first();
                const itemCount = await db.list_items.where('list_id').equals(list.id).count();
                html += `
                    <div class="modal-list-row ${existing ? 'checked' : ''}" data-list="${list.id}">
                        <div class="modal-list-info">
                            <div class="modal-list-icon">📋</div>
                            <div class="modal-list-text">
                                <h4>${list.name}</h4>
                                <p>${itemCount} élément(s)</p>
                            </div>
                        </div>
                        <div class="list-checkbox">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    </div>
                `;
            }
        }
        
        container.innerHTML = html;
        
        container.querySelectorAll('.modal-list-row').forEach(row => {
            row.addEventListener('click', async () => {
                const listId = row.dataset.list;
                const isChecked = row.classList.contains('checked');
                
                if (listId === 'favoris') {
                    if (isChecked) {
                        row.classList.remove('checked');
                        if (mediaType === 'show') await db.shows.where('tmdb_id').equals(parseInt(tmdbId)).modify({ is_favorited: 0 });
                        else await db.movies.where('tmdb_id').equals(parseInt(tmdbId)).modify({ is_favorited: 0 });
                    } else {
                        row.classList.add('checked');
                        if (mediaType === 'show') await db.shows.where('tmdb_id').equals(parseInt(tmdbId)).modify({ is_favorited: 1 });
                        else await db.movies.where('tmdb_id').equals(parseInt(tmdbId)).modify({ is_favorited: 1 });
                    }
                } else {
                    const lId = parseInt(listId);
                    if (isChecked) {
                        row.classList.remove('checked');
                        await db.list_items.where({list_id: lId, tmdb_id: parseInt(tmdbId)}).delete();
                    } else {
                        row.classList.add('checked');
                        await db.list_items.add({ list_id: lId, tmdb_id: parseInt(tmdbId), media_type: mediaType, added_at: Date.now() });
                    }
                }
                
                renderCustomLists(); 
                if (mediaType === 'show') renderShowsView();
                if (mediaType === 'movie') renderMoviesView();
            });
        });

        document.getElementById('new-list-name').value = '';
        const createBtn = document.getElementById('btn-create-add-list');
        const newCreateHandler = async () => {
            const name = document.getElementById('new-list-name').value.trim();
            if (name) {
                const newListId = await db.custom_lists.add({ name, description: '', created_at: Date.now() });
                await db.list_items.add({ list_id: newListId, tmdb_id: parseInt(tmdbId), media_type: mediaType, added_at: Date.now() });
                showAddToListModal(tmdbId, mediaType);
                renderCustomLists();
                showToast("Liste créée et ajoutée !");
            }
        };
        createBtn.replaceWith(createBtn.cloneNode(true));
        document.getElementById('btn-create-add-list').addEventListener('click', newCreateHandler);

        modal.classList.remove('hidden');
    }

    document.getElementById('btn-add-to-list-cancel').addEventListener('click', () => {
        document.getElementById('add-to-list-modal').classList.add('hidden');
    });

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
        
        document.querySelectorAll('#episode-star-rating .star-btn').forEach(btn => {
            const val = parseInt(btn.dataset.val);
            btn.classList.toggle('active', val <= rating);
            
            btn.onclick = () => {
                document.querySelectorAll('#episode-star-rating .star-btn').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.val) <= val);
                });
                currentNoteCtx.rating = val;
            };
        });
        currentNoteCtx.rating = rating;
        document.getElementById('episode-note-text').value = text;
        
        document.getElementById('episode-note-modal').classList.remove('hidden');
    }

    document.getElementById('btn-episode-note-cancel').addEventListener('click', () => {
        document.getElementById('episode-note-modal').classList.add('hidden');
    });

    document.getElementById('btn-episode-note-save').addEventListener('click', async () => {
        if (!currentNoteCtx) return;
        const noteId = `${currentNoteCtx.showId}_S${currentNoteCtx.season}_E${currentNoteCtx.ep}`;
        const text = document.getElementById('episode-note-text').value.trim();
        const rating = currentNoteCtx.rating;
        
        if (text || rating > 0) {
            await db.episode_notes.put({
                id: noteId,
                show_id: currentNoteCtx.showId,
                season_num: currentNoteCtx.season,
                ep_num: currentNoteCtx.ep,
                rating: rating,
                note: text,
                updated_at: Date.now()
            });
            showToast("Note enregistrée !");
        } else {
            await db.episode_notes.delete(noteId);
        }
        
        document.getElementById('episode-note-modal').classList.add('hidden');
        
        // Optional: refresh icon color to indicate a note exists
        const noteIcon = document.querySelector(`.ep-note-sm[data-show-id="${currentNoteCtx.showId}"][data-season="${currentNoteCtx.season}"][data-ep="${currentNoteCtx.ep}"]`);
        if (noteIcon) {
            noteIcon.style.opacity = (text || rating > 0) ? '1' : '0.3';
            noteIcon.style.color = (text || rating > 0) ? 'var(--iris-400)' : '';
        }
    });

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
        else if (type === 'season') title = `${ctx.showName} - Saison ${ctx.season} entière`;
        
        document.getElementById('rewatch-title').textContent = title;
        document.getElementById('rewatch-modal').classList.remove('hidden');
    };
    
    document.getElementById('btn-rewatch-close').addEventListener('click', () => {
        document.getElementById('rewatch-modal').classList.add('hidden');
        if (currentRewatchCtx && currentRewatchCtx.showObj) {
            if (currentRewatchCtx.type === 'movie') {
                renderMovieDetail(currentRewatchCtx.showObj);
            } else {
                renderShowDetail(currentRewatchCtx.showObj);
            }
        }
    });

    document.getElementById('btn-rewatch-plus').addEventListener('click', async () => {
        if (!currentRewatchCtx) return;
        currentRewatchCtx.currentViews++;
        document.getElementById('rewatch-count').textContent = currentRewatchCtx.currentViews;
        
        await updateRewatchCount(currentRewatchCtx.currentViews);
    });

    document.getElementById('btn-rewatch-minus').addEventListener('click', async () => {
        if (!currentRewatchCtx) return;
        if (currentRewatchCtx.currentViews > 0) {
            currentRewatchCtx.currentViews--;
            document.getElementById('rewatch-count').textContent = currentRewatchCtx.currentViews;
            
            await updateRewatchCount(currentRewatchCtx.currentViews);
        }
    });

    async function updateRewatchCount(views) {
        const targetRewatchCount = views > 0 ? views - 1 : 0;
        const ctx = currentRewatchCtx.ctx;
        
        if (currentRewatchCtx.type === 'episode') {
            const row = await db.watch_history.get(ctx.historyId);
            if (!row) return;
            if (views === 0) {
                await db.watch_history.delete(row.id);
                document.getElementById('rewatch-modal').classList.add('hidden');
                renderShowDetail(currentRewatchCtx.showObj);
            } else {
                await db.watch_history.update(row.id, { rewatch_count: targetRewatchCount });
            }
        } else if (currentRewatchCtx.type === 'season') {
            for (const r of ctx.records) {
                if (views === 0) {
                    await db.watch_history.delete(r.id);
                } else {
                    await db.watch_history.update(r.id, { rewatch_count: targetRewatchCount });
                }
            }
            if (views === 0) {
                document.getElementById('rewatch-modal').classList.add('hidden');
                renderShowDetail(currentRewatchCtx.showObj);
            }
        } else if (currentRewatchCtx.type === 'movie') {
            // For movies, consolidate to a single watch record if multiple existed
            if (ctx.records && ctx.records.length > 0) {
                const keepId = ctx.records[0].id;
                for (let i = 1; i < ctx.records.length; i++) {
                    await db.movie_watches.delete(ctx.records[i].id);
                }
                if (views === 0) {
                    await db.movie_watches.delete(keepId);
                    await db.movies.where('tmdb_id').equals(ctx.tmdbId).modify({ status: 'watchlist' });
                    document.getElementById('rewatch-modal').classList.add('hidden');
                    renderMovieDetail(currentRewatchCtx.showObj);
                } else {
                    await db.movie_watches.update(keepId, { rewatch_count: targetRewatchCount });
                }
            } else if (views > 0) {
                // If somehow they increment from 0 to 1 but no record existed
                await db.movie_watches.add({
                    movie_uuid: ctx.movieUuid, movie_name: ctx.movieName,
                    watched_at: new Date().toISOString(), rewatch_count: targetRewatchCount, runtime: 0
                });
            }
        }
    }

})();
