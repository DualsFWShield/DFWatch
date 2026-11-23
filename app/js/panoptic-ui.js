document.addEventListener('DOMContentLoaded', () => {
    const notify = (msg) => {
        if (typeof window.showToast === 'function') window.showToast(msg);
        else console.log('[Panoptic]', msg);
    };
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const btnSolo = document.getElementById('pan-mode-solo');
    const btnGroup = document.getElementById('pan-mode-group');
    const bbToggleContainer = document.getElementById('pan-bb-toggle-container');
    const panUseBb = document.getElementById('pan-use-bb');

    const btnMediaMovie = document.getElementById('pan-media-movie');
    const btnMediaTv = document.getElementById('pan-media-tv');
    const runtimeRange = document.getElementById('pan-runtime');
    const runtimeVal = document.getElementById('pan-runtime-val');
    const genresContainer = document.getElementById('pan-genres-grid');

    const MOVIE_GENRES = [
        { val: '28', i18n: 'genres.action', label: 'Action' },
        { val: '12', i18n: 'genres.adventure', label: 'Aventure' },
        { val: '35', i18n: 'genres.comedy', label: 'Comédie' },
        { val: '18', i18n: 'genres.drama', label: 'Drame' },
        { val: '27', i18n: 'genres.horror', label: 'Horreur' },
        { val: '878', i18n: 'genres.scifi', label: 'Sci-Fi' },
        { val: '14', i18n: 'genres.fantasy', label: 'Fantastique' },
        { val: '53', i18n: 'genres.thriller', label: 'Thriller' },
        { val: '10749', i18n: 'genres.romance', label: 'Romance' },
        { val: '16', i18n: 'genres.animation', label: 'Animation' },
        { val: '99', i18n: 'genres.documentary', label: 'Documentaire' }
    ];

    const TV_GENRES = [
        { val: '10759', i18n: 'genres.action_adventure', label: 'Action & Aventure' },
        { val: '35', i18n: 'genres.comedy', label: 'Comédie' },
        { val: '18', i18n: 'genres.drama', label: 'Drame' },
        { val: '10765', i18n: 'genres.sci_fi_fantasy', label: 'Sci-Fi & Fantastique' },
        { val: '80', i18n: 'genres.crime', label: 'Crime / Policier' },
        { val: '9648', i18n: 'genres.mystery', label: 'Mystère' },
        { val: '10751', i18n: 'genres.family', label: 'Famille' },
        { val: '16', i18n: 'genres.animation', label: 'Animation' },
        { val: '99', i18n: 'genres.documentary', label: 'Documentaire' },
        { val: '10768', i18n: 'genres.war_politics', label: 'Guerre & Politique' }
    ];

    let currentMediaType = 'movie';
    let pistes = [];
    let bannis = [];
    let renderChipsPistes = () => {};
    let renderChipsBannis = () => {};

    function renderGenreButtons() {
        if (!genresContainer) return;
        const list = currentMediaType === 'tv' ? TV_GENRES : MOVIE_GENRES;
        genresContainer.innerHTML = '';
        list.forEach(g => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pan-genre-btn';
            btn.dataset.val = g.val;
            btn.dataset.i18n = g.i18n;
            btn.textContent = (window.I18n && window.I18n.has(g.i18n)) ? window.I18n.get(g.i18n) : g.label;
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });
            genresContainer.appendChild(btn);
        });
    }

    function syncMediaUi(mediaType) {
        currentMediaType = mediaType;
        btnMediaMovie?.classList.toggle('active', mediaType === 'movie');
        btnMediaTv?.classList.toggle('active', mediaType === 'tv');
        if (runtimeRange && runtimeVal) {
            if (mediaType === 'tv') {
                runtimeRange.min = '20';
                runtimeRange.max = '120';
                runtimeRange.step = '5';
                if (parseInt(runtimeRange.value, 10) > 120 || parseInt(runtimeRange.value, 10) === 240) {
                    runtimeRange.value = '60';
                }
            } else {
                runtimeRange.min = '60';
                runtimeRange.max = '240';
                runtimeRange.step = '10';
                if (parseInt(runtimeRange.value, 10) < 60) {
                    runtimeRange.value = '150';
                }
            }
            runtimeVal.textContent = runtimeRange.value + 'm';
        }
        renderGenreButtons();
    }

    btnMediaMovie?.addEventListener('click', () => {
        if (currentMediaType === 'movie') return;
        pistes.length = 0;
        bannis.length = 0;
        renderChipsPistes();
        renderChipsBannis();
        syncMediaUi('movie');
        loadProviders();
    });

    btnMediaTv?.addEventListener('click', () => {
        if (currentMediaType === 'tv') return;
        pistes.length = 0;
        bannis.length = 0;
        renderChipsPistes();
        renderChipsBannis();
        syncMediaUi('tv');
        loadProviders();
    });

    let currentMode = 'solo';
    let groupParticipants = [];
    const groupUi = document.getElementById('pan-group-ui');
    const groupCount = document.getElementById('pan-group-count');
    const groupList = document.getElementById('pan-group-list');
    const btnAddParticipant = document.getElementById('pan-btn-add-participant');

    function renderGroupParticipants() {
        if (groupCount) groupCount.textContent = String(groupParticipants.length);
        if (!groupList) return;
        groupList.innerHTML = '';
        const isEn = window.I18n && window.I18n.lang === 'en';
        groupParticipants.forEach((p, idx) => {
            const pill = document.createElement('div');
            pill.className = 'pan-participant-pill';
            const label = document.createElement('span');
            label.textContent = `${isEn ? 'Player' : 'Joueur'} ${idx + 1} (${p.genres.length})`;
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'pan-pill-remove';
            rm.textContent = '✕';
            rm.setAttribute('aria-label', isEn ? 'Remove participant' : 'Retirer le participant');
            rm.addEventListener('click', () => {
                groupParticipants.splice(idx, 1);
                renderGroupParticipants();
            });
            pill.append(label, rm);
            groupList.appendChild(pill);
        });
    }

    btnAddParticipant?.addEventListener('click', () => {
        const activeBtns = Array.from(document.querySelectorAll('.pan-genre-btn.active'));
        const activeGenres = activeBtns.map(b => b.dataset.val);
        if (activeGenres.length === 0) {
            const isEn = window.I18n && window.I18n.lang === 'en';
            notify(isEn ? 'Please select at least one genre.' : 'Veuillez sélectionner au moins un genre.');
            return;
        }
        groupParticipants.push({
            id: groupParticipants.length + 1,
            genres: activeGenres
        });
        renderGroupParticipants();
        document.querySelectorAll('.pan-genre-btn').forEach(btn => btn.classList.remove('active'));
    });

    btnSolo?.addEventListener('click', () => {
        currentMode = 'solo';
        btnSolo.classList.add('active');
        btnGroup?.classList.remove('active');
        if (bbToggleContainer) bbToggleContainer.style.opacity = '1';
        if (panUseBb) panUseBb.disabled = false;
        if (groupUi) groupUi.classList.add('hidden');
    });

    btnGroup?.addEventListener('click', () => {
        currentMode = 'group';
        btnGroup.classList.add('active');
        btnSolo?.classList.remove('active');
        if (bbToggleContainer) bbToggleContainer.style.opacity = '0.5';
        if (panUseBb) {
            panUseBb.disabled = true;
            panUseBb.checked = false;
        }
        if (groupUi) groupUi.classList.remove('hidden');
        groupParticipants = [];
        renderGroupParticipants();
        document.querySelectorAll('.pan-genre-btn').forEach(btn => btn.classList.remove('active'));
    });

    runtimeRange?.addEventListener('input', (e) => {
        if (runtimeVal) runtimeVal.textContent = e.target.value + 'm';
    });

    // Initialize dynamic genre buttons once
    renderGenreButtons();

    function setupAutocomplete(inputId, autoId, chipsId, listArray, otherArray, maxItems) {
        const input = document.getElementById(inputId);
        const auto = document.getElementById(autoId);
        const chips = document.getElementById(chipsId);
        let timeout = null;

        if (!input || !auto || !chips) return () => {};

        function renderChips() {
            chips.innerHTML = '';
            listArray.forEach((item, idx) => {
                const chip = document.createElement('div');
                chip.className = 'pan-chip';
                const label = document.createElement('span');
                label.textContent = item.title || item.name || '';
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'pan-chip-remove';
                del.textContent = '✕';
                del.addEventListener('click', () => {
                    listArray.splice(idx, 1);
                    renderChips();
                });
                chip.append(label, del);
                chips.appendChild(chip);
            });
        }

        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const val = e.target.value.trim();
            if (val.length < 2) {
                auto.style.display = 'none';
                return;
            }
            timeout = setTimeout(async () => {
                if (!window.TMDB) return;
                const results = await window.TMDB.search(val, currentMediaType);
                if (results && results.length > 0) {
                    auto.innerHTML = '';
                    results.slice(0, 5).forEach(r => {
                        const row = document.createElement('div');
                        row.className = 'pan-auto-item';
                        const y = (r.release_date || r.first_air_date || '').substring(0, 4);
                        row.textContent = `${r.title || r.name}${y ? ' (' + y + ')' : ''}`;
                        row.addEventListener('click', () => {
                            const idNum = Number(r.id);
                            const isEn = window.I18n && window.I18n.lang === 'en';
                            if (listArray.length >= maxItems) {
                                notify(window.I18n ? window.I18n.get('panoptic.max_movies', { max: maxItems }) : `Maximum ${maxItems}.`);
                            } else if (listArray.some(x => Number(x.id) === idNum)) {
                                notify(isEn ? 'Already added.' : 'Déjà ajouté.');
                            } else if (otherArray.some(x => Number(x.id) === idNum)) {
                                notify(isEn ? 'Already present in the opposite list.' : 'Déjà présent dans la liste opposée.');
                            } else {
                                listArray.push({
                                    id: idNum,
                                    title: r.title || r.name || '',
                                    genre_ids: Array.isArray(r.genre_ids) ? r.genre_ids : []
                                });
                                renderChips();
                            }
                            input.value = '';
                            auto.style.display = 'none';
                        });
                        auto.appendChild(row);
                    });
                    auto.style.display = 'block';
                } else {
                    auto.style.display = 'none';
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (e.target !== input && !auto.contains(e.target)) {
                auto.style.display = 'none';
            }
        });

        return renderChips;
    }

    renderChipsPistes = setupAutocomplete('pan-search-pistes', 'pan-autocomplete-pistes', 'pan-chips-pistes', pistes, bannis, 10);
    renderChipsBannis = setupAutocomplete('pan-search-bannis', 'pan-autocomplete-bannis', 'pan-chips-bannis', bannis, pistes, 10);

    // Providers setup
    const providerRegion = document.getElementById('pan-provider-region');
    const anyProvider = document.getElementById('pan-any-provider');
    const providersGrid = document.getElementById('pan-providers-grid');
    let selectedProviders = new Set();

    const savedCountry = localStorage.getItem('dfwatch_country') || (window.I18n?.lang === 'en' ? 'US' : 'FR');
    if (providerRegion) {
        const hasOpt = Array.from(providerRegion.options).some(o => o.value === savedCountry);
        providerRegion.value = hasOpt ? savedCountry : 'FR';
    }

    async function loadProviders() {
        if (!window.TMDB || !providerRegion || !providersGrid) return;
        const region = providerRegion.value || 'FR';
        const providers = await window.TMDB.getWatchProviders(region, currentMediaType);
        providersGrid.innerHTML = '';
        selectedProviders.clear();
        if (anyProvider) anyProvider.checked = true;
        providersGrid.style.display = 'none';

        providers.slice(0, 20).forEach(p => {
            const img = document.createElement('img');
            img.src = window.TMDB.imgUrl(p.logo_path, 'w92');
            img.alt = p.provider_name || 'Provider';
            img.className = 'pan-provider-logo';
            img.title = p.provider_name;
            img.addEventListener('click', () => {
                if (anyProvider) anyProvider.checked = false;
                providersGrid.style.display = 'grid';
                if (selectedProviders.has(p.provider_id)) {
                    selectedProviders.delete(p.provider_id);
                    img.classList.remove('selected');
                } else {
                    selectedProviders.add(p.provider_id);
                    img.classList.add('selected');
                }
                if (selectedProviders.size === 0) {
                    if (anyProvider) anyProvider.checked = true;
                    providersGrid.style.display = 'none';
                }
            });
            providersGrid.appendChild(img);
        });
    }

    providerRegion?.addEventListener('change', loadProviders);

    anyProvider?.addEventListener('change', (e) => {
        if (!providersGrid) return;
        if (e.target.checked) {
            providersGrid.style.display = 'none';
            selectedProviders.clear();
            providersGrid.querySelectorAll('img').forEach(img => img.classList.remove('selected'));
        } else {
            providersGrid.style.display = 'grid';
        }
    });

    setTimeout(loadProviders, 800);

    const btnSearch = document.getElementById('btn-panoptic-search');
    const resultsOverlay = document.getElementById('panoptic-results-overlay');
    const btnClose = document.getElementById('pan-results-close');
    const cardContainer = document.getElementById('pan-card-container');
    const stepLabel = document.getElementById('pan-step');
    const totalLabel = document.getElementById('pan-total');
    const btnUndo = document.getElementById('pan-btn-undo');

    const engine = new (window.PanopticEngine || class { async interrogate() { return { results: [], hasMore: false }; } })();

    let currentResults = [];
    let currentIndex = 0;
    let acceptedItems = [];
    let likedItems = [];
    let shownIds = new Set();
    let swipeHistory = [];
    let currentStartPage = 1;
    let hasMorePages = false;
    let isSwiping = false;

    function openResultsOverlay() {
        if (!resultsOverlay) return;
        if (typeof window.openOverlay === 'function') {
            window.openOverlay('panoptic-results-overlay');
        } else {
            resultsOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeResultsOverlay() {
        if (!resultsOverlay) return;
        if (typeof window.closeOverlay === 'function') {
            window.closeOverlay('panoptic-results-overlay');
        } else {
            resultsOverlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    async function executePanopticSearch(isEncore = false) {
        let activeGenres = Array.from(document.querySelectorAll('.pan-genre-btn.active')).map(btn => btn.getAttribute('data-val'));
        let finalGroupParticipants = [...groupParticipants];

        if (currentMode === 'group') {
            if (activeGenres.length > 0) {
                finalGroupParticipants.push({
                    id: finalGroupParticipants.length + 1,
                    genres: activeGenres
                });
            }
            if (finalGroupParticipants.length === 0) {
                const isEn = window.I18n && window.I18n.lang === 'en';
                notify(isEn ? 'Please add participants with their genres first.' : 'Veuillez ajouter des participants avec leurs genres pour lancer la recherche.');
                return;
            }
        }

        if (!isEncore) {
            currentStartPage = 1;
            shownIds.clear();
            acceptedItems = [];
            likedItems = [];
        }

        const criteria = {
            mediaType: currentMediaType,
            mode: currentMode,
            useBB: panUseBb ? panUseBb.checked : true,
            bbProfile: window._bigBrotherEngine?.lastAffinities || null,
            runtimeMax: runtimeRange ? parseInt(runtimeRange.value, 10) : 180,
            genres: currentMode === 'group' ? [] : activeGenres,
            groupParticipants: currentMode === 'group' ? finalGroupParticipants : null,
            pistes: pistes,
            bannis: bannis,
            excludeIds: Array.from(shownIds),
            region: providerRegion ? providerRegion.value : 'FR',
            providers: (anyProvider && anyProvider.checked) ? [] : Array.from(selectedProviders),
            startPage: currentStartPage
        };

        if (btnSearch) {
            btnSearch.textContent = window.I18n ? window.I18n.get('panoptic.connecting') : 'Connexion à Panoptic...';
            btnSearch.disabled = true;
        }

        try {
            const resp = await engine.interrogate(criteria);
            if (resp && resp.results) {
                currentResults = resp.results;
                hasMorePages = Boolean(resp.hasMore);
            } else {
                currentResults = Array.isArray(resp) ? resp : [];
                hasMorePages = false;
            }

            currentResults.forEach(item => { if (item && item.id) shownIds.add(Number(item.id)); });
            currentIndex = 0;
            swipeHistory = [];
            if (btnUndo) btnUndo.disabled = true;

            if (currentResults.length === 0) {
                notify(window.I18n ? window.I18n.get('panoptic.no_results') : 'Aucun résultat trouvé pour ces critères.');
                if (isEncore) finishPanoptic();
            } else {
                openResultsOverlay();
                const actionArea = document.querySelector('.pan-action-area');
                if (actionArea) actionArea.style.display = 'flex';
                showCurrentCard();
            }
        } catch (e) {
            console.error('Panoptic Error:', e);
            notify(window.I18n ? window.I18n.get('panoptic.error') : 'Erreur lors de la communication avec Panoptic.');
        } finally {
            if (btnSearch) {
                btnSearch.textContent = window.I18n ? window.I18n.get('panoptic.btn_search') : 'Interroger Panoptic';
                btnSearch.disabled = false;
            }
        }
    }

    btnSearch?.addEventListener('click', () => executePanopticSearch(false));

    // Next Episode Mode
    const btnNextEpisode = document.getElementById('pan-btn-next-episode');
    btnNextEpisode?.addEventListener('click', async () => {
        if (!window.db || !window.TMDB) return;
        const shows = await window.db.shows.where('is_followed').equals(1).toArray();
        const activeShows = shows.filter(s => s.is_finished === 0 && s.status !== 'completed');
        if (activeShows.length === 0) {
            notify(window.I18n ? window.I18n.get('panoptic.no_active_shows') : 'Aucune série en cours.');
            return;
        }

        btnNextEpisode.textContent = window.I18n ? window.I18n.get('panoptic.connecting') : 'Connexion...';
        btnNextEpisode.disabled = true;

        try {
            const withTmdb = activeShows.filter(s => s.tmdb_id);
            const fullCandidates = [];
            for (let i = 0; i < withTmdb.length; i += 6) {
                const chunk = withTmdb.slice(i, i + 6);
                const fetched = await Promise.all(chunk.map(async s => {
                    try {
                        const details = await window.TMDB.getShowDetails(s.tmdb_id);
                        if (details) {
                            details.media_type = 'tv';
                            const rating = s.user_rating || 0;
                            details._panScore = 1.0 + (rating > 0 ? rating / 10 : 0.25);
                            details.confidence = Math.min(100, Math.round(details._panScore * 60));
                            return details;
                        }
                    } catch (e) {}
                    return null;
                }));
                fullCandidates.push(...fetched.filter(Boolean));
            }
            fullCandidates.sort((a, b) => b._panScore - a._panScore);

            currentResults = fullCandidates;
            currentIndex = 0;
            acceptedItems = [];
            likedItems = [];
            swipeHistory = [];
            if (btnUndo) btnUndo.disabled = true;
            hasMorePages = false;
            syncMediaUi('tv');

            if (currentResults.length > 0) {
                openResultsOverlay();
                const actionArea = document.querySelector('.pan-action-area');
                if (actionArea) actionArea.style.display = 'flex';
                showCurrentCard();
            } else {
                notify(window.I18n ? window.I18n.get('panoptic.no_results') : 'Aucun résultat trouvé.');
            }
        } catch (e) {
            console.error(e);
            notify(window.I18n ? window.I18n.get('panoptic.error') : 'Erreur.');
        } finally {
            btnNextEpisode.textContent = window.I18n ? window.I18n.get('panoptic.next_episode') : '📺 Que regarder (Prochain Épisode)';
            btnNextEpisode.disabled = false;
        }
    });

    btnClose?.addEventListener('click', closeResultsOverlay);

    function showCurrentCard() {
        if (!cardContainer) return;
        if (currentIndex >= currentResults.length) {
            finishPanoptic();
            return;
        }
        if (stepLabel) stepLabel.textContent = String(currentIndex + 1);
        if (totalLabel) totalLabel.textContent = String(currentResults.length);
        if (btnUndo) btnUndo.disabled = swipeHistory.length === 0;

        const item = currentResults[currentIndex];
        const imgUrl = (window.TMDB && item.poster_path) ? window.TMDB.imgUrl(item.poster_path, 'w500') : '';
        const title = item.title || item.name || '';
        const year = (item.release_date || item.first_air_date || '').substring(0, 4);
        const isEn = window.I18n && window.I18n.lang === 'en';

        let consensusBadge = '';
        if (currentMode === 'group' && item.matchedParticipants !== undefined) {
            consensusBadge = `<span class="pan-badge-consensus">🤝 ${item.matchedParticipants}/${item.totalParticipants} ${isEn ? 'votes' : 'votes'}</span>`;
        }

        cardContainer.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'pan-card';
        if (imgUrl) {
            card.style.backgroundImage = `url("${imgUrl.replace(/"/g, '%22')}")`;
        }
        card.innerHTML = `
            <div class="pan-swipe-stamp pan-stamp-like">${isEn ? 'LIKE' : 'AIMER'}</div>
            <div class="pan-swipe-stamp pan-stamp-pass">${isEn ? 'PASS' : 'PASSER'}</div>
            <div class="pan-card-gradient">
                <h3 class="pan-card-title">${esc(title)}</h3>
                <p class="pan-card-meta">
                    ⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '?'}
                    <span class="pan-card-year">${year ? '• ' + esc(year) : ''}</span>
                    ${item.confidence ? `<span class="pan-badge-match">🎯 Match ${item.confidence}%</span>` : ''}
                    ${consensusBadge}
                </p>
                <p class="pan-card-overview">${esc(item.overview || '')}</p>
                <p class="pan-card-hint">${esc(window.I18n ? window.I18n.get('panoptic.click_details') : 'Cliquez pour voir les détails')}</p>
            </div>
        `;
        cardContainer.appendChild(card);
    }

    function nextCard() {
        currentIndex++;
        showCurrentCard();
    }

    function handleReject() {
        if (isSwiping || currentIndex >= currentResults.length) return;
        swipeHistory.push({ index: currentIndex, action: 'reject' });
        nextCard();
    }

    function handleLike() {
        if (isSwiping || currentIndex >= currentResults.length) return;
        const item = currentResults[currentIndex];
        likedItems.push(item);
        swipeHistory.push({ index: currentIndex, action: 'like', itemId: item.id });
        if (currentMode === 'solo' && window.db && window.db.recommendation_feedback) {
            window.db.recommendation_feedback.put({
                tmdb_id: item.id,
                type: currentMediaType,
                feedback_value: 1,
                timestamp: Date.now(),
                genre_ids: item.genre_ids || (item.genres ? item.genres.map(g => g.id).filter(Boolean) : [])
            }).catch(() => {});
        }
        nextCard();
    }

    function handleAccept() {
        if (isSwiping || currentIndex >= currentResults.length) return;
        acceptedItems.push(currentResults[currentIndex]);
        finishPanoptic();
    }

    function handleUndo() {
        if (isSwiping || swipeHistory.length === 0) return;
        const last = swipeHistory.pop();
        if (last.action === 'like') {
            const idx = likedItems.findIndex(x => x.id === last.itemId);
            if (idx !== -1) likedItems.splice(idx, 1);
        }
        currentIndex = last.index;
        const actionArea = document.querySelector('.pan-action-area');
        if (actionArea) actionArea.style.display = 'flex';
        showCurrentCard();
    }

    document.getElementById('pan-btn-reject')?.addEventListener('click', handleReject);
    document.getElementById('pan-btn-like')?.addEventListener('click', handleLike);
    document.getElementById('pan-btn-accept')?.addEventListener('click', handleAccept);
    btnUndo?.addEventListener('click', handleUndo);

    // Keyboard navigation when Panoptic overlay is open
    document.addEventListener('keydown', (e) => {
        if (!resultsOverlay || resultsOverlay.classList.contains('hidden')) return;
        if (window.modalStack && window.modalStack[window.modalStack.length - 1] !== 'panoptic-results-overlay') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); handleReject(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); handleLike(); }
        else if (e.key === 'ArrowUp' || e.key === 'Enter') { e.preventDefault(); handleAccept(); }
        else if (e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
    });

    function finishPanoptic() {
        if (!cardContainer) return;
        const actionArea = document.querySelector('.pan-action-area');
        if (actionArea) actionArea.style.display = 'none';

        const total = acceptedItems.concat(likedItems);
        if (total.length === 0) {
            const encoreLabel = window.I18n ? window.I18n.get('panoptic.search_encore') : '🔄 Chercher Encore';
            cardContainer.innerHTML = `
                <div class="pan-empty-results">
                    <h3>${esc(window.I18n ? window.I18n.get('panoptic.search_exhausted') : 'Recherche Épuisée')}</h3>
                    <p>${esc(window.I18n ? window.I18n.get('panoptic.all_rejected') : 'Vous avez rejeté toutes les propositions.')}</p>
                    ${hasMorePages ? `<button id="pan-btn-encore" class="pan-encore-btn">${esc(encoreLabel)}</button>` : ''}
                </div>
            `;
            document.getElementById('pan-btn-encore')?.addEventListener('click', () => {
                currentStartPage += 3;
                executePanopticSearch(true);
            });
            return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'pan-final-wrap';

        const heading = document.createElement('h3');
        heading.textContent = window.I18n ? window.I18n.get('panoptic.analysis_done') : 'Analyse Terminée';
        const sub = document.createElement('p');
        sub.textContent = window.I18n ? window.I18n.get('panoptic.final_results') : 'Voici vos résultats finaux.';
        const grid = document.createElement('div');
        grid.className = 'pan-final-grid';

        total.forEach(item => {
            const isChosen = acceptedItems.includes(item);
            const row = document.createElement('div');
            row.className = `pan-final-item ${isChosen ? 'chosen' : ''}`;
            row.addEventListener('click', () => {
                if (window.openDetail) {
                    window.openDetail({
                        id: item.id,
                        name: item.title || item.name || '',
                        title: item.title || item.name || '',
                        backdrop_path: item.backdrop_path || null,
                        poster_path: item.poster_path || null
                    }, currentMediaType);
                }
            });

            if (item.poster_path && window.TMDB) {
                const img = document.createElement('img');
                img.src = window.TMDB.imgUrl(item.poster_path, 'w92');
                img.alt = item.title || item.name || '';
                row.appendChild(img);
            }

            const info = document.createElement('div');
            info.className = 'pan-final-info';
            const tDiv = document.createElement('div');
            tDiv.className = 'pan-final-title';
            tDiv.textContent = item.title || item.name || '';
            const rDiv = document.createElement('div');
            rDiv.className = 'pan-final-score';
            rDiv.textContent = `⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '?'}`;
            info.append(tDiv, rDiv);

            const badge = document.createElement('div');
            badge.className = `pan-final-badge ${isChosen ? 'chosen' : ''}`;
            badge.textContent = isChosen
                ? (window.I18n ? window.I18n.get('panoptic.chosen') : '✅ Choisi')
                : (window.I18n ? window.I18n.get('panoptic.liked') : '👍🏻 Aimé');

            row.append(info, badge);
            grid.appendChild(row);
        });

        wrap.append(heading, sub, grid);
        cardContainer.innerHTML = '';
        cardContainer.appendChild(wrap);
    }

    // --- Swipe Mechanics ---
    if (!cardContainer) return;
    let isDragging = false;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let swipeCard = null;

    const startDrag = (clientX, clientY) => {
        if (isSwiping) return;
        swipeCard = cardContainer.querySelector('.pan-card');
        if (!swipeCard) return;
        isDragging = true;
        startX = clientX;
        startY = clientY;
        currentX = 0; currentY = 0;
        swipeCard.style.transition = 'none';
    };

    cardContainer.addEventListener('touchstart', e => {
        if (e.touches && e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    cardContainer.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        startDrag(e.clientX, e.clientY);
    });

    const handleMove = (clientX, clientY) => {
        if (!isDragging || !swipeCard) return;
        currentX = clientX - startX;
        currentY = clientY - startY;
        const rotation = currentX * 0.05;
        swipeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
        const likeStamp = swipeCard.querySelector('.pan-stamp-like');
        const passStamp = swipeCard.querySelector('.pan-stamp-pass');
        if (likeStamp) likeStamp.style.opacity = currentX > 25 ? String(Math.min(1, currentX / 100)) : '0';
        if (passStamp) passStamp.style.opacity = currentX < -25 ? String(Math.min(1, -currentX / 100)) : '0';
    };

    window.addEventListener('touchmove', e => {
        if (isDragging && e.touches && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('mousemove', e => {
        if (isDragging) handleMove(e.clientX, e.clientY);
    });

    const handleEnd = () => {
        if (!isDragging || !swipeCard) return;
        isDragging = false;

        if (Math.abs(currentX) < 10 && Math.abs(currentY) < 10) {
            const item = currentResults[currentIndex];
            if (window.openDetail && item) {
                window.openDetail({
                    id: item.id,
                    name: item.title || item.name || '',
                    title: item.title || item.name || '',
                    backdrop_path: item.backdrop_path || null,
                    poster_path: item.poster_path || null
                }, currentMediaType);
            }
            swipeCard.style.transform = 'translate(0px, 0px) rotate(0deg)';
            swipeCard = null;
            return;
        }

        swipeCard.style.transition = 'transform 0.28s ease-out';
        const threshold = 100;
        const cardRef = swipeCard;
        swipeCard = null;

        if (currentX < -threshold) {
            isSwiping = true;
            cardRef.style.transform = `translate(-1000px, ${currentY}px) rotate(-30deg)`;
            setTimeout(() => { isSwiping = false; handleReject(); }, 260);
        } else if (currentX > threshold) {
            isSwiping = true;
            cardRef.style.transform = `translate(1000px, ${currentY}px) rotate(30deg)`;
            setTimeout(() => { isSwiping = false; handleLike(); }, 260);
        } else if (currentY < -threshold) {
            isSwiping = true;
            cardRef.style.transform = `translate(${currentX}px, -1000px) rotate(0deg)`;
            setTimeout(() => { isSwiping = false; handleAccept(); }, 260);
        } else {
            cardRef.style.transform = 'translate(0px, 0px) rotate(0deg)';
            const likeStamp = cardRef.querySelector('.pan-stamp-like');
            const passStamp = cardRef.querySelector('.pan-stamp-pass');
            if (likeStamp) likeStamp.style.opacity = '0';
            if (passStamp) passStamp.style.opacity = '0';
        }
    };

    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mouseup', handleEnd);
});
