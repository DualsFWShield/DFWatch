// app.js — DFWatch Main Application Logic

(function () {
    'use strict';

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
        if (target === 'favoris') refreshFavoris();
        if (target === 'search') initSearch();
    }

    // ---- Theme Init ----
    const savedTheme = localStorage.getItem('dfwatch_theme') || 'default';
    document.body.setAttribute('data-theme', savedTheme);
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = savedTheme;
        themeSelect.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('dfwatch_theme', newTheme);
            const themeColorMeta = document.getElementById('meta-theme-color');
            if (themeColorMeta) {
                // Mettre à jour si nécessaire
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
    let currentSearchType = 'multi';
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

    // ---- Search ----
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchTimer;

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
        
        // 1. Get user top rated
        const topShows = await db.shows.where('user_rating').above(3).limit(4).toArray();
        const topMovies = await db.movies.where('user_rating').above(3).limit(4).toArray();
        
        // If not enough rated, fallback to recently added
        if (topShows.length === 0 && topMovies.length === 0) {
            const allShows = await db.shows.limit(2).toArray();
            const allMovies = await db.movies.limit(2).toArray();
            topShows.push(...allShows);
            topMovies.push(...allMovies);
        }
        
        let allResults = [];
        
        // 2. Fetch TMDB Recommendations
        for (const s of topShows) {
            if (s.tmdb_id) {
                const recs = await TMDB.getRecommendations(s.tmdb_id, 'tv');
                allResults.push(...recs);
            }
        }
        for (const m of topMovies) {
            if (m.tmdb_id) {
                const recs = await TMDB.getRecommendations(m.tmdb_id, 'movie');
                allResults.push(...recs);
            }
        }
        
        // 3. Deduplicate
        const unique = [];
        const seen = new Set();
        for (const r of allResults) {
            if (!seen.has(r.id)) {
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
            const card = createPosterCard(item);
            searchResults.appendChild(card);
        });
    }

    async function doSearch(query) {
        searchResults.innerHTML = '<div class="empty-state"><p>Recherche en cours...</p></div>';
        const results = await TMDB.search(query, currentSearchType);
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

    function createPosterCard(item) {
        const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        const title = item.name || item.title || 'Sans titre';
        const year = (item.first_air_date || item.release_date || '').split('-')[0];
        const posterUrl = TMDB.imgUrl(item.poster_path, 'w342');

        const div = document.createElement('div');
        div.className = 'poster-card';
        div.innerHTML = posterUrl
            ? `<img src="${posterUrl}" alt="${title}" loading="lazy"><div class="poster-overlay"><div>${title}</div><div class="poster-year">${year}</div></div>`
            : `<div class="poster-placeholder">${title}</div>`;
        div.addEventListener('click', () => openDetail(item, mediaType));
        return div;
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
        
        let castHTML = '';
        if (show.credits && show.credits.cast) {
            const cast = show.credits.cast.slice(0, 10);
            if (cast.length > 0) {
                castHTML = '<div class="detail-section"><h3>Têtes d\'affiche</h3><div class="horizontal-scroll cast-scroll">';
                cast.forEach(c => {
                    const img = c.profile_path ? TMDB.imgUrl(c.profile_path, 'w185') : '';
                    castHTML += `
                        <div class="cast-card">
                            ${img ? `<img src="${img}" alt="${c.name}" loading="lazy">` : `<div class="cast-placeholder"></div>`}
                            <div class="cast-name">${c.name}</div>
                            <div class="cast-char">${c.character}</div>
                        </div>`;
                });
                castHTML += '</div></div>';
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
        for (const season of sortedSeasons) {
            const isBonus = season.season_number === 0;
            const seasonTitle = isBonus ? 'Bonus (Specials)' : `Saison ${season.season_number}`;
            const seasonData = await TMDB.getSeasonDetails(show.id, season.season_number);
            const episodes = seasonData ? seasonData.episodes || [] : [];
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

                epsHTML += `
                    <div class="season-ep-row">
                        <span class="ep-num">${ep.episode_number}</span>
                        <span class="ep-name">${ep.name || `Épisode ${ep.episode_number}`} ${rewatchBadge}</span>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            ${checked ? `<div class="ep-rewatch-sm" data-show="${title}" data-tvtime="${existing ? existing.tvtime_id : ''}" data-season="${season.season_number}" data-ep="${ep.episode_number}" data-runtime="${ep.runtime || 0}" style="cursor:pointer; color:var(--text-muted); font-size:16px;" title="Revoir">↻</div>` : ''}
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
            <div class="detail-section">
                <h3>Saisons</h3>
                ${seasonsHTML}
            </div>
            <div class="detail-section" style="margin-top: 2rem;">
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
            let totalEps = 0;
            let doneEps = 0;
            detailBody.querySelectorAll('.season-block').forEach(block => {
                const seasonId = block.querySelector('.season-header').dataset.seasonId;
                if (seasonId !== 's0') {
                    const progText = block.querySelector('.season-progress').textContent; // e.g. "10/12"
                    const [done, total] = progText.split('/').map(Number);
                    totalEps += total;
                    doneEps += done;
                }
            });
            
            const existingShow = await db.shows.where('tmdb_id').equals(show.id).first();
            if (existingShow && totalEps > 0) {
                const shouldBeFinished = doneEps === totalEps;
                if (existingShow.is_finished !== (shouldBeFinished ? 1 : 0)) {
                    await db.shows.update(existingShow.id, { is_finished: shouldBeFinished ? 1 : 0 });
                    existingShow.is_finished = shouldBeFinished ? 1 : 0;
                    
                    const finBtn = document.getElementById('btn-finish-show');
                    if (finBtn) {
                        if (shouldBeFinished) {
                            finBtn.classList.add('active');
                            finBtn.textContent = '🏁 Terminée';
                            showToast(`"${title}" a été marquée comme terminée !`);
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
                    await db.watch_history.update(r.id, { rewatch_count: (r.rewatch_count || 0) + 1 });
                    showToast(`${showName} S${season}E${epNum} revu !`);
                    renderShowDetail(show); // Refresh to show new badge
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
                
                for (const epBtn of eps) {
                    epBtn.click();
                }
                showToast(`Saison ${season} marquée comme vue`);
                setTimeout(() => renderShowDetail(show), 500);
            });
        });
        
        // Season rewatch all
        detailBody.querySelectorAll('.season-rewatch-all').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const season = parseInt(btn.dataset.season);
                const epsContainer = document.getElementById(`season-eps-s${season}`);
                const eps = epsContainer.querySelectorAll('.ep-rewatch-sm');
                
                for (const epBtn of eps) {
                    epBtn.click();
                }
                if(eps.length > 0) {
                    showToast(`Saison ${season} revue`);
                }
            });
        });
        // Fix TMDB
        document.getElementById('btn-fix-tmdb-tv').addEventListener('click', async function() {
            const newName = prompt('Entrez le nom exact de la série :');
            if (newName && newName.trim().length > 1) {
                const results = await TMDB.search(newName.trim(), 'tv');
                if (results && results.length > 0) {
                    const first = results[0];
                    if (confirm(`Voulez-vous remplacer cette série par : "${first.name}" ?`)) {
                        let existing = await db.shows.where('tmdb_id').equals(show.id).first();
                        if (existing) {
                            await db.shows.update(existing.id, {
                                tmdb_id: first.id,
                                poster_path: first.poster_path,
                                backdrop_path: first.backdrop_path
                            });
                        }
                        showToast('Identification mise à jour !');
                        closeDetail();
                        refreshSeriesList();
                    }
                } else {
                    showToast('Aucun résultat trouvé sur TMDB.');
                }
            }
        });
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
        
        let castHTML = '';
        if (movie.credits && movie.credits.cast) {
            const cast = movie.credits.cast.slice(0, 10);
            if (cast.length > 0) {
                castHTML = '<div class="detail-section"><h3>Têtes d\'affiche</h3><div class="horizontal-scroll cast-scroll">';
                cast.forEach(c => {
                    const img = c.profile_path ? TMDB.imgUrl(c.profile_path, 'w185') : '';
                    castHTML += `
                        <div class="cast-card">
                            ${img ? `<img src="${img}" alt="${c.name}" loading="lazy">` : `<div class="cast-placeholder"></div>`}
                            <div class="cast-name">${c.name}</div>
                            <div class="cast-char">${c.character}</div>
                        </div>`;
                });
                castHTML += '</div></div>';
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
            <div class="detail-section" style="margin-top: 2rem;">
                <button class="action-btn secondary" id="btn-fix-tmdb-movie" style="font-size:12px; padding:6px 12px; width:auto; border:1px solid var(--border-subtle);">Mauvaise identification TMDB ?</button>
            </div>
        `;

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
                    await db.movie_watches.add({
                        movie_uuid: existing.uuid || '', movie_name: this.dataset.title,
                        watched_at: new Date().toISOString(), rewatch_count: 1, runtime: parseInt(this.dataset.runtime) || 0
                    });
                    showToast(`${this.dataset.title} revu !`);
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
        let shows = await db.shows.where('is_followed').equals(1).toArray();
        
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

            // Determine next episode
            let lastSeason = 0, lastEp = 0;
            history.forEach(h => {
                if (h.season_number > 0) {
                    if (h.season_number > lastSeason || (h.season_number === lastSeason && h.episode_number > lastEp)) {
                        lastSeason = h.season_number;
                        lastEp = h.episode_number;
                    }
                }
            });
            const nextEp = lastEp + 1;
            const nextSeason = lastSeason || 1;
            const remaining = (show.nb_episodes_seen || episodesWatched) > 0 ? `+${show.nb_episodes_seen || episodesWatched}` : '';
            
            // Logic for categories (Approximation based on cached data if available)
            let category = 'watching';
            if (show.is_finished) category = 'finished';
            // Upcoming logic
            if (show.first_air_date && new Date(show.first_air_date) > new Date()) {
                category = 'upcoming';
            }

            // Create card
            const card = document.createElement('div');
            card.className = 'episode-card';
            card.innerHTML = `
                ${posterUrl ? `<img class="ep-poster" src="${posterUrl}" alt="${show.name}" loading="lazy">` : `<div class="ep-poster" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);text-align:center;">${show.name.substring(0, 20)}</div>`}
                <div class="ep-info">
                    <div class="ep-show-name">${show.name} ›</div>
                    <div class="ep-episode">S${String(nextSeason).padStart(2, '0')} | E${String(nextEp).padStart(2, '0')} <span class="ep-remaining">${remaining}</span></div>
                </div>
                <div class="ep-check" data-show-id="${show.id}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            `;

            // Click on card → search on TMDB for details
            card.querySelector('.ep-info').addEventListener('click', async () => {
                if (show.tmdb_id) {
                    const details = await TMDB.getShowDetails(show.tmdb_id);
                    if (details) { openDetail(details, 'tv'); return; }
                }
                // Fallback: search by name
                const result = await TMDB.findShowByName(show.name);
                if (result) {
                    // Cache the tmdb_id
                    await db.shows.update(show.id, { tmdb_id: result.id, poster_path: result.poster_path, backdrop_path: result.backdrop_path });
                    openDetail(result, 'tv');
                } else {
                    showToast('Série non trouvée sur TMDB');
                }
            });

            // Check button → mark next episode as watched
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
                showToast(`${show.name} S${nextSeason}E${nextEp} vu ✓`);
                setTimeout(() => refreshSeriesList(), 600);
            });

            if (category === 'finished') {
                card.className = 'poster-card';
                card.innerHTML = posterUrl
                    ? `<img src="${posterUrl}" alt="${show.name}" loading="lazy"><div class="poster-overlay"><div>${show.name}</div></div>`
                    : `<div class="poster-placeholder">${show.name}</div>`;
                finishedList.appendChild(card);
                finishedCount++;
            } else if (category === 'upcoming') {
                card.className = 'poster-card';
                card.innerHTML = posterUrl
                    ? `<img src="${posterUrl}" alt="${show.name}" loading="lazy"><div class="poster-overlay"><div>${show.name}</div></div>`
                    : `<div class="poster-placeholder">${show.name}</div>`;
                upcomingList.appendChild(card);
                upcomingCount++;
            } else {
                watchingList.appendChild(card);
                watchingCount++;
            }
        }
        
        if (watchingCount === 0) watchingList.innerHTML = '<div class="empty-state"><h3>Aucune série en cours</h3></div>';
        if (finishedCount === 0) finishedList.innerHTML = '<div class="empty-state"><h3>Aucune série terminée</h3></div>';
        if (upcomingCount === 0) upcomingList.innerHTML = '<div class="empty-state"><h3>Rien à venir</h3></div>';
    }

    // Attach sort listener
    document.getElementById('series-sort').addEventListener('change', refreshSeriesList);

    // ---- Films list ----
    async function refreshFilmsList() {
        const watchlistList = document.getElementById('films-watchlist-list');
        const watchedList = document.getElementById('films-list');
        const upcomingList = document.getElementById('films-upcoming-list');
        
        const sortVal = document.getElementById('films-sort').value;
        let movies = await db.movies.toArray();
        
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
                }
            });
            
            if (category === 'upcoming') { upcomingList.appendChild(div); upCount++; }
            else if (category === 'watched') { watchedList.appendChild(div); wCount++; }
            else { watchlistList.appendChild(div); wlCount++; }
        }
        
        if (wlCount === 0) watchlistList.innerHTML = '<div class="empty-state"><h3>Rien à voir</h3></div>';
        if (wCount === 0) watchedList.innerHTML = '<div class="empty-state"><h3>Aucun film vu</h3></div>';
        if (upCount === 0) upcomingList.innerHTML = '<div class="empty-state"><h3>Rien à venir</h3></div>';
    }
    
    // Attach sort listener
    document.getElementById('films-sort').addEventListener('change', refreshFilmsList);

    // ---- Profile ----
    async function refreshProfile() {
        // Series horizontal scroll
        const seriesScroll = document.getElementById('profile-series-scroll');
        seriesScroll.innerHTML = '';
        const shows = await db.shows.where('is_followed').equals(1).toArray();
        for (const show of shows.slice(0, 20)) {
            const posterUrl = show.poster_path ? TMDB.imgUrl(show.poster_path, 'w185') : null;
            if (!posterUrl) continue;
            const div = document.createElement('div');
            div.className = 'h-poster';
            div.innerHTML = `<img src="${posterUrl}" alt="${show.name}" loading="lazy">`;
            div.addEventListener('click', async () => {
                if (show.tmdb_id) {
                    const details = await TMDB.getShowDetails(show.tmdb_id);
                    if (details) openDetail(details, 'tv');
                }
            });
            seriesScroll.appendChild(div);
        }

        // Sidebar mini-stats
        updateSidebarStats();

        // Load personal info
        document.getElementById('profile-firstname').value = localStorage.getItem('dfwatch_firstname') || '';
        document.getElementById('profile-lastname').value = localStorage.getItem('dfwatch_lastname') || '';
        document.getElementById('profile-age').value = localStorage.getItem('dfwatch_age') || '';
        
        const savedGenres = JSON.parse(localStorage.getItem('dfwatch_genres') || '[]');
        document.querySelectorAll('.genre-checkbox input').forEach(cb => {
            cb.checked = savedGenres.includes(cb.value);
        });
    }

    // ---- Stats & Achievements ----
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
            } else {
                total = await Importer.importDFWatch(selectedFiles, msg => {
                    importStatus.textContent = msg;
                });
            }
            progressBar.style.width = '100%';
            importStatus.textContent = `✓ Import terminé — ${total} éléments importés.`;
            importStatus.className = 'status-msg success';
            showToast('Import réussi ! 🎉');

            // Refresh all pages
            refreshSeriesList();
            refreshFilmsList();
            refreshProfile();

            // Now try to fetch posters from TMDB for imported shows (in background)
            enrichAllMedia();
        } catch (err) {
            importStatus.textContent = `Erreur: ${err.message}`;
            importStatus.className = 'status-msg error';
            progressBar.style.width = '0%';
        }
    });

    document.getElementById('btn-export').addEventListener('click', async () => {
        await Importer.exportDFWatch();
        showToast('Export téléchargé !');
    });

    document.getElementById('btn-export-cache').addEventListener('click', async () => {
        showToast('Préparation de l\'export cache...');
        await exportPosterCache();
    });

    document.getElementById('cache-file-input').addEventListener('change', async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        showToast('Import du cache en cours...');
        const success = await importPosterCache(e.target.files[0]);
        if (success) {
            showToast('Cache importé avec succès !');
            refreshSeriesList();
            refreshFilmsList();
        } else {
            showToast('Erreur lors de l\'import du cache');
        }
        e.target.value = '';
    });

    document.getElementById('btn-clear').addEventListener('click', async () => {
        if (confirm('⚠️ Effacer TOUTES vos données ? Cette action est irréversible.')) {
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

    async function exportPosterCache() {
        const shows = await db.shows.filter(s => !!s.tmdb_id).toArray();
        const movies = await db.movies.filter(m => !!m.tmdb_id).toArray();
        const cache = {
            shows: shows.map(s => ({ name: s.name, tvtime_id: s.tvtime_id, tmdb_id: s.tmdb_id, poster_path: s.poster_path, backdrop_path: s.backdrop_path })),
            movies: movies.map(m => ({ name: m.name, uuid: m.uuid, tmdb_id: m.tmdb_id, poster_path: m.poster_path, backdrop_path: m.backdrop_path }))
        };
        const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfwatch-posters-cache.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function importPosterCache(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const cache = JSON.parse(e.target.result);
                    if (cache.shows) {
                        for (const s of cache.shows) {
                            if (!s.tmdb_id) continue;
                            const existing = await db.shows.where('name').equals(s.name).first();
                            if (existing && !existing.tmdb_id) {
                                await db.shows.update(existing.id, { tmdb_id: s.tmdb_id, poster_path: s.poster_path, backdrop_path: s.backdrop_path });
                            }
                        }
                    }
                    if (cache.movies) {
                        for (const m of cache.movies) {
                            if (!m.tmdb_id) continue;
                            const existing = await db.movies.where('name').equals(m.name).first();
                            if (existing && !existing.tmdb_id) {
                                await db.movies.update(existing.id, { tmdb_id: m.tmdb_id, poster_path: m.poster_path, backdrop_path: m.backdrop_path });
                            }
                        }
                    }
                    resolve(true);
                } catch(err) {
                    resolve(false);
                }
            };
            reader.readAsText(file);
        });
    }

    // ---- Toast ----
    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.remove('hidden');
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2500);
    }

    // ---- Update sidebar mini-stats ----
    async function updateSidebarStats() {
        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const elEp = document.getElementById('sidebar-stat-ep');
        const elFilm = document.getElementById('sidebar-stat-film');
        if (elEp) elEp.textContent = seriesStats.count.toLocaleString();
        if (elFilm) elFilm.textContent = movieStats.count.toLocaleString();
    }

    // ---- Profile Save ----
    document.getElementById('btn-save-profile').addEventListener('click', () => {
        localStorage.setItem('dfwatch_firstname', document.getElementById('profile-firstname').value);
        localStorage.setItem('dfwatch_lastname', document.getElementById('profile-lastname').value);
        localStorage.setItem('dfwatch_age', document.getElementById('profile-age').value);
        
        const checkedGenres = Array.from(document.querySelectorAll('.genre-checkbox input:checked')).map(cb => cb.value);
        localStorage.setItem('dfwatch_genres', JSON.stringify(checkedGenres));
        
        showToast('Profil enregistré avec succès !');
    });

    // ---- Init ----
    refreshSeriesList();
    refreshProfile();
    refreshStats();
    updateSidebarStats();

    // Start background enrichment (won't block UI)
    setTimeout(() => {
        enrichAllMedia();
    }, 2000);

})();
