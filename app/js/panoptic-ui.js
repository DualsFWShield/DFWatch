document.addEventListener('DOMContentLoaded', () => {
    const btnSolo = document.getElementById('pan-mode-solo');
    const btnGroup = document.getElementById('pan-mode-group');
    const bbToggleContainer = document.getElementById('pan-bb-toggle-container');
    const panUseBb = document.getElementById('pan-use-bb');
    
    let currentMode = 'solo';

    btnSolo?.addEventListener('click', () => {
        currentMode = 'solo';
        btnSolo.classList.add('active');
        btnGroup.classList.remove('active');
        bbToggleContainer.style.opacity = '1';
        panUseBb.disabled = false;
    });

    btnGroup?.addEventListener('click', () => {
        currentMode = 'group';
        btnGroup.classList.add('active');
        btnSolo.classList.remove('active');
        bbToggleContainer.style.opacity = '0.5';
        panUseBb.disabled = true;
        panUseBb.checked = false;
    });

    const runtimeRange = document.getElementById('pan-runtime');
    const runtimeVal = document.getElementById('pan-runtime-val');
    runtimeRange?.addEventListener('input', (e) => {
        runtimeVal.textContent = e.target.value + 'm';
    });

    // Genres setup
    const genreBtns = document.querySelectorAll('.pan-genre-btn');
    genreBtns.forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#888';
        btn.style.border = '1px solid #444';
        btn.style.borderRadius = '9999px';
        btn.style.padding = '8px 14px';
        btn.style.fontSize = '12px';
        btn.style.cursor = 'pointer';

        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            if (btn.classList.contains('active')) {
                btn.style.background = '#ff5500';
                btn.style.color = '#fff';
                btn.style.borderColor = '#ff5500';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = '#888';
                btn.style.borderColor = '#444';
            }
        });
    });

    // Pistes and Bannis setup
    let pistes = [];
    let bannis = [];

    function setupAutocomplete(inputId, autoId, chipsId, listArray, maxItems) {
        const input = document.getElementById(inputId);
        const auto = document.getElementById(autoId);
        const chips = document.getElementById(chipsId);
        let timeout = null;

        if (!input || !auto || !chips) return;

        function renderChips() {
            chips.innerHTML = listArray.map((item, idx) => `
                <div style="background: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 4px 10px; font-size: 11px; display: flex; align-items: center; gap: 6px;">
                    ${item.title || item.name}
                    <span style="cursor: pointer; color: #ff5500; font-weight: bold;" data-idx="${idx}">✕</span>
                </div>
            `).join('');
            
            chips.querySelectorAll('span').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const i = parseInt(e.target.getAttribute('data-idx'), 10);
                    listArray.splice(i, 1);
                    renderChips();
                });
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
                const results = await window.TMDB.search(val, 'movie');
                if (results && results.length > 0) {
                    auto.innerHTML = results.slice(0, 5).map(r => `
                        <div class="pan-auto-item" style="padding: 8px; border-bottom: 1px solid #444; cursor: pointer; font-size: 12px; color: #fff;" data-id="${r.id}" data-title="${(r.title || r.name).replace(/"/g, '&quot;')}">
                            ${r.title || r.name} ${(r.release_date || '').substring(0,4)}
                        </div>
                    `).join('');
                    auto.style.display = 'block';

                    auto.querySelectorAll('.pan-auto-item').forEach(item => {
                        item.addEventListener('click', (ev) => {
                            if (listArray.length >= maxItems) {
                                alert(window.I18n ? window.I18n.get('panoptic.max_movies', { max: maxItems }) : `Maximum ${maxItems} films autorisés.`);
                            } else {
                                const t = ev.currentTarget;
                                listArray.push({ id: t.getAttribute('data-id'), title: t.getAttribute('data-title') });
                                renderChips();
                            }
                            input.value = '';
                            auto.style.display = 'none';
                        });
                    });
                } else {
                    auto.style.display = 'none';
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (e.target !== input && e.target !== auto) {
                auto.style.display = 'none';
            }
        });
    }

    setupAutocomplete('pan-search-pistes', 'pan-autocomplete-pistes', 'pan-chips-pistes', pistes, 10);
    setupAutocomplete('pan-search-bannis', 'pan-autocomplete-bannis', 'pan-chips-bannis', bannis, 10);

    // Providers setup
    const providerRegion = document.getElementById('pan-provider-region');
    const anyProvider = document.getElementById('pan-any-provider');
    const providersGrid = document.getElementById('pan-providers-grid');
    let selectedProviders = new Set();

    const defaultRegion = localStorage.getItem('user_region') || (window.I18n?.lang === 'en' ? 'US' : 'BE');
    if (providerRegion) providerRegion.value = defaultRegion;

    async function loadProviders() {
        if (!window.TMDB || !providerRegion || !providersGrid) return;
        const region = providerRegion.value;
        const providers = await window.TMDB.getWatchProviders(region, 'movie');
        providersGrid.innerHTML = '';
        selectedProviders.clear();

        providers.slice(0, 20).forEach(p => {
            const img = document.createElement('img');
            img.src = window.TMDB.imgUrl(p.logo_path, 'w92');
            img.style.width = '100%';
            img.style.borderRadius = '8px';
            img.style.cursor = 'pointer';
            img.style.opacity = '0.4';
            img.style.transition = '0.2s';
            img.title = p.provider_name;
            img.addEventListener('click', () => {
                anyProvider.checked = false;
                providersGrid.style.display = 'grid';
                if (selectedProviders.has(p.provider_id)) {
                    selectedProviders.delete(p.provider_id);
                    img.style.opacity = '0.4';
                    img.style.border = 'none';
                } else {
                    selectedProviders.add(p.provider_id);
                    img.style.opacity = '1';
                    img.style.border = '2px solid #ff5500';
                }
                if (selectedProviders.size === 0) {
                    anyProvider.checked = true;
                    providersGrid.style.display = 'none';
                }
            });
            providersGrid.appendChild(img);
        });
    }

    providerRegion?.addEventListener('change', loadProviders);
    
    anyProvider?.addEventListener('change', (e) => {
        if (e.target.checked) {
            providersGrid.style.display = 'none';
            selectedProviders.clear();
            providersGrid.querySelectorAll('img').forEach(img => {
                img.style.opacity = '0.4';
                img.style.border = 'none';
            });
        } else {
            providersGrid.style.display = 'grid';
        }
    });

    setTimeout(loadProviders, 1000);

    const btnSearch = document.getElementById('btn-panoptic-search');
    const resultsOverlay = document.getElementById('panoptic-results-overlay');
    const btnClose = document.getElementById('pan-results-close');
    const cardContainer = document.getElementById('pan-card-container');
    const stepLabel = document.getElementById('pan-step');
    
    const engine = new (window.PanopticEngine || class {})();

    let currentResults = [];
    let currentIndex = 0;
    let acceptedItems = [];
    let likedItems = [];

    btnSearch?.addEventListener('click', async () => {
        const activeGenres = Array.from(document.querySelectorAll('.pan-genre-btn.active')).map(btn => btn.getAttribute('data-val'));
        
        const criteria = {
            mode: currentMode,
            useBB: panUseBb.checked,
            runtimeMax: parseInt(runtimeRange.value, 10),
            genres: activeGenres,
            pistes: pistes,
            bannis: bannis,
            region: providerRegion.value,
            providers: anyProvider.checked ? [] : Array.from(selectedProviders)
        };

        btnSearch.textContent = window.I18n ? window.I18n.get('panoptic.connecting') : 'Connexion à Panoptic...';
        btnSearch.disabled = true;

        try {
            currentResults = await engine.interrogate(criteria);
            currentIndex = 0;
            acceptedItems = [];
            likedItems = [];
            
            if (currentResults.length === 0) {
                alert(window.I18n ? window.I18n.get('panoptic.no_results') : 'Aucun résultat trouvé pour ces critères.');
            } else {
                resultsOverlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
                const actionArea = document.querySelector('.pan-action-area');
                if (actionArea) actionArea.style.display = 'flex';
                showCurrentCard();
            }
        } catch (e) {
            console.error('Panoptic Error:', e);
            alert(window.I18n ? window.I18n.get('panoptic.error') : 'Erreur lors de la communication avec Panoptic.');
        } finally {
            btnSearch.textContent = window.I18n ? window.I18n.get('panoptic.btn_search') : 'Interroger Panoptic';
            btnSearch.disabled = false;
        }
    });

    btnClose?.addEventListener('click', () => {
        resultsOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    });

    function showCurrentCard() {
        if (currentIndex >= currentResults.length) {
            finishPanoptic();
            return;
        }
        stepLabel.textContent = (currentIndex + 1);
        const item = currentResults[currentIndex];
        const imgUrl = window.TMDB ? window.TMDB.imgUrl(item.poster_path, 'w500') : '';
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').substring(0, 4);

        cardContainer.innerHTML = `
            <div class="pan-card" style="width: 100%; max-width: 420px; aspect-ratio: 2/3; background-image: url('${imgUrl}'); background-size: cover; background-position: center; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; touch-action: none;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);">
                    <h3 style="margin: 0; color: white; font-size: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${title}</h3>
                    <p style="margin: 4px 0 0 0; color: #ff5a00; font-size: 14px; font-weight: 500;">⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '?'} <span style="color:#888;">${year ? '• ' + year : ''}</span></p>
                    <p style="margin: 8px 0 0 0; color: #ccc; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${item.overview || ''}</p>
                    <p style="margin-top: 8px; font-size: 10px; color: #666; font-style: italic;">${window.I18n ? window.I18n.get('panoptic.click_details') : 'Cliquez pour voir les détails'}</p>
                </div>
            </div>
        `;
    }

    function nextCard() {
        currentIndex++;
        showCurrentCard();
    }

    document.getElementById('pan-btn-reject')?.addEventListener('click', () => {
        if (currentIndex < currentResults.length) nextCard();
    });

    document.getElementById('pan-btn-like')?.addEventListener('click', () => {
        if (currentIndex < currentResults.length) {
            const item = currentResults[currentIndex];
            likedItems.push(item);
            if (currentMode === 'solo' && window.db && window.db.recommendation_feedback) {
                // Hack: mark as liked to inform BB
                window.db.recommendation_feedback.put({
                    tmdb_id: item.id,
                    type: 'movie',
                    feedback_value: 1,
                    genre_ids: item.genre_ids || (item.genres ? item.genres.map(g => g.id) : [])
                });
            }
            nextCard();
        }
    });

    document.getElementById('pan-btn-accept')?.addEventListener('click', () => {
        if (currentIndex < currentResults.length) {
            acceptedItems.push(currentResults[currentIndex]);
            finishPanoptic();
        }
    });

    function finishPanoptic() {
        // Hide action buttons at the bottom during results
        const actionArea = document.querySelector('.pan-action-area');
        if (actionArea) actionArea.style.display = 'none';

        const total = acceptedItems.concat(likedItems);
        if (total.length === 0) {
            cardContainer.innerHTML = `
                <div style="width: 100%; text-align: center;">
                    <h3 style="color: #ef4444; margin-bottom: 20px; font-size: 24px;">${window.I18n ? window.I18n.get('panoptic.search_exhausted') : 'Recherche Épuisée'}</h3>
                    <p style="color: #888; font-size: 16px;">${window.I18n ? window.I18n.get('panoptic.all_rejected') : 'Vous avez rejeté toutes les propositions.'}</p>
                </div>
            `;
            return;
        }

        cardContainer.innerHTML = `
            <div style="width: 100%; text-align: center; display: flex; flex-direction: column; max-height: 80vh;">
                <h3 style="color: #ffffff; margin-bottom: 8px; font-size: 24px;">${window.I18n ? window.I18n.get('panoptic.analysis_done') : 'Analyse Terminée'}</h3>
                <p style="color: #888; margin-bottom: 24px;">${window.I18n ? window.I18n.get('panoptic.final_results') : 'Voici vos résultats finaux.'}</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; overflow-y: auto; padding: 10px; flex: 1; align-content: start; text-align: left;">
                    ${total.map(item => `
                        <div style="display: flex; align-items: center; gap: 16px; background: #1a1a1a; padding: 12px; border-radius: 24px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05); border: 1px solid ${acceptedItems.includes(item) ? 'rgba(255,90,0,0.5)' : 'rgba(255,255,255,0.02)'}; cursor: pointer; transition: transform 0.2s;" onclick="if(window.openDetail) window.openDetail({id: ${item.id}, name: \`${(item.title||item.name||'').replace(/`/g, '')}\`, backdrop_path: '${item.backdrop_path}'}, 'movie')">
                            <img src="${window.TMDB ? window.TMDB.imgUrl(item.poster_path, 'w92') : ''}" style="width: 50px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                            <div style="text-align: left; flex: 1;">
                                <div style="font-weight: 600; color: white; font-size: 16px; margin-bottom: 4px;">${item.title || item.name}</div>
                                <div style="font-size: 13px; color: #888;">⭐ ${item.vote_average?.toFixed(1) || '?'}</div>
                            </div>
                            <div style="padding: 6px 16px; border-radius: 999px; font-size: 12px; font-weight: 500; background: ${acceptedItems.includes(item) ? '#ff5a00' : '#2a2a2a'}; color: ${acceptedItems.includes(item) ? '#fff' : '#888'};">
                                ${acceptedItems.includes(item) ? (window.I18n ? window.I18n.get('panoptic.chosen') : '✅ Choisi') : (window.I18n ? window.I18n.get('panoptic.liked') : '👍🏻 Aimé')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // --- Swipe Mechanics ---
    let isDragging = false;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let swipeCard = null;

    const startDrag = (clientX, clientY) => {
        swipeCard = cardContainer.querySelector('.pan-card');
        if (!swipeCard) return;
        isDragging = true;
        startX = clientX;
        startY = clientY;
        currentX = 0; currentY = 0;
        swipeCard.style.transition = 'none';
    };

    cardContainer.addEventListener('touchstart', e => startDrag(e.touches[0].clientX, e.touches[0].clientY), {passive: true});
    cardContainer.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));

    const handleMove = (clientX, clientY, e) => {
        if (!isDragging || !swipeCard) return;
        currentX = clientX - startX;
        currentY = clientY - startY;
        
        const rotation = currentX * 0.05;
        swipeCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
    };

    window.addEventListener('touchmove', e => {
        if (isDragging) handleMove(e.touches[0].clientX, e.touches[0].clientY, e);
    }, {passive: true});

    window.addEventListener('mousemove', e => {
        if (isDragging) handleMove(e.clientX, e.clientY, e);
    });

    const handleEnd = () => {
        if (!isDragging || !swipeCard) return;
        isDragging = false;
        
        if (Math.abs(currentX) < 10 && Math.abs(currentY) < 10) {
            // Click!
            const item = currentResults[currentIndex];
            if (window.openDetail && item) {
                window.openDetail({id: item.id, name: (item.title||item.name||'').replace(/`/g, ''), backdrop_path: item.backdrop_path}, 'movie');
            }
            swipeCard.style.transform = 'translate(0px, 0px) rotate(0deg)';
            swipeCard = null;
            return;
        }

        swipeCard.style.transition = 'transform 0.3s ease-out';
        const threshold = 100;
        if (currentX < -threshold) {
            swipeCard.style.transform = `translate(-1000px, ${currentY}px) rotate(-30deg)`;
            setTimeout(() => document.getElementById('pan-btn-reject').click(), 300);
        } else if (currentX > threshold) {
            swipeCard.style.transform = `translate(1000px, ${currentY}px) rotate(30deg)`;
            setTimeout(() => document.getElementById('pan-btn-like').click(), 300);
        } else if (currentY < -threshold) {
            swipeCard.style.transform = `translate(${currentX}px, -1000px) rotate(0deg)`;
            setTimeout(() => document.getElementById('pan-btn-accept').click(), 300);
        } else {
            swipeCard.style.transform = 'translate(0px, 0px) rotate(0deg)';
        }
        swipeCard = null;
    };

    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mouseup', handleEnd);

});
