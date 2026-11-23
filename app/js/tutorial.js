(function() {
    'use strict';

    function startTutorial() {
        if (!window.driver || !window.driver.js) {
            console.error("Driver.js not loaded");
            return;
        }

        document.body.classList.add('tutorial-active');

        const isEn = window.I18n && window.I18n.lang === 'en';
        const t = (fr, en) => (isEn ? en : fr);
        const driverFn = window.driver.js.driver;
        const getNavBtn = (page) => () => {
            const isDesktop = window.matchMedia('(min-width: 900px)').matches;
            return isDesktop ? `.sidebar-btn[data-page="${page}"]` : `.nav-btn[data-page="${page}"]`;
        };

        let isBusy = false;
        const timers = new Set();
        const intervals = new Set();

        function safeTimeout(fn, ms) {
            const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
            timers.add(id);
            return id;
        }

        function clearAllAsync() {
            timers.forEach(clearTimeout);
            timers.clear();
            intervals.forEach(clearInterval);
            intervals.clear();
            isBusy = false;
        }

        function waitForElement(selector, timeout = 3500) {
            return new Promise(resolve => {
                if (document.querySelector(selector)) return resolve(true);
                const obs = new MutationObserver(() => {
                    if (document.querySelector(selector)) {
                        obs.disconnect();
                        resolve(true);
                    }
                });
                obs.observe(document.body, { childList: true, subtree: true });
                safeTimeout(() => {
                    obs.disconnect();
                    resolve(false);
                }, timeout);
            });
        }

        function typeSearchAndOpen(query, detailItem, mediaType, waitSelector) {
            if (isBusy) return;
            isBusy = true;
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = '';
                let i = 0;
                const iv = setInterval(() => {
                    if (i < query.length) {
                        searchInput.value += query[i++];
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        clearInterval(iv);
                        intervals.delete(iv);
                        safeTimeout(async () => {
                            if (window.openDetail) {
                                window.openDetail(detailItem, mediaType, { isTutorial: true });
                            }
                            await waitForElement(waitSelector, 3500);
                            isBusy = false;
                            driverObj.moveNext();
                        }, 500);
                    }
                }, 70);
                intervals.add(iv);
            } else {
                isBusy = false;
                driverObj.moveNext();
            }
        }

        const driverObj = driverFn({
            showProgress: true,
            animate: true,
            allowClose: true,
            popoverClass: 'mystic-driver-popover',
            steps: [
                {
                    popover: {
                        title: t('Bienvenue sur DFWatch ! 🎬', 'Welcome to DFWatch! 🎬'),
                        description: t(
                            'Votre hub pour suivre vos séries et films préférés. Faisons un rapide tour du propriétaire.',
                            'Your hub to track your favorite shows and movies. Let\'s take a quick tour.'
                        )
                    }
                },
                {
                    element: getNavBtn('search'),
                    popover: {
                        title: t('Explorer', 'Explore'),
                        description: t(
                            "C'est ici que vous pouvez rechercher n'importe quel film ou série pour l'ajouter à votre collection.",
                            'Here you can search for any movie or TV show to add to your library.'
                        ),
                        side: "top",
                        align: 'start',
                        onNextClick: () => {
                            if (isBusy) return;
                            if (window.appNavigateTo) window.appNavigateTo('search');
                            safeTimeout(() => driverObj.moveNext(), 250);
                        }
                    }
                },
                {
                    element: '#search-input',
                    popover: {
                        title: t("Big Brother à l'œuvre", 'Big Brother at Work'),
                        description: t(
                            "Faisons une recherche... Je vais ouvrir la fiche d'Inception pour vous montrer les actions.",
                            "Let's run a quick search... I'll open Inception to show you what you can do."
                        ),
                        side: "bottom",
                        onPrevClick: () => {
                            if (isBusy) return;
                            driverObj.movePrevious();
                        },
                        onNextClick: () => {
                            typeSearchAndOpen(
                                'Inception',
                                { id: 27205, title: 'Inception', backdrop_path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg', poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg' },
                                'movie',
                                '.detail-actions'
                            );
                        }
                    }
                },
                {
                    element: '.detail-actions',
                    popover: {
                        title: t('Les Actions', 'Quick Actions'),
                        description: t(
                            'Sur la fiche d\'un film, ajoutez-le à votre liste "À voir", marquez-le "Vu" ou mettez-le en Favori.',
                            'On a movie page, add it to your Watchlist, mark it Watched, or Favorite it.'
                        ),
                        side: "bottom",
                        onPrevClick: () => {
                            if (isBusy) return;
                            if (window.closeOverlay) window.closeOverlay('show-detail-overlay');
                            safeTimeout(() => driverObj.movePrevious(), 200);
                        }
                    }
                },
                {
                    element: '.detail-hero-info',
                    popover: {
                        title: t('Analyse Big Brother', 'Big Brother Analysis'),
                        description: t(
                            'Big Brother évalue chaque œuvre selon vos goûts et vous explique pourquoi elle vous correspond.',
                            'Big Brother evaluates every title against your taste and explains why it fits you.'
                        ),
                        side: "top",
                        onNextClick: () => {
                            if (isBusy) return;
                            if (window.closeOverlay) window.closeOverlay('show-detail-overlay');
                            safeTimeout(() => {
                                typeSearchAndOpen(
                                    'Young Sheldon',
                                    { id: 71728, name: 'Young Sheldon', backdrop_path: '/vRptkFqg3vL5uIqIin8jP6aO3B8.jpg', poster_path: '/Mpv3Y9eT5c79s6jR503GndqSjI.jpg' },
                                    'tv',
                                    '#detail-tv-tracker'
                                );
                            }, 350);
                        }
                    }
                },
                {
                    element: '#detail-tv-tracker',
                    popover: {
                        title: t('Suivi de Série', 'Show Tracker'),
                        description: t(
                            "Pour les séries, suivez votre progression épisode par épisode et consultez la heatmap des notes.",
                            'For TV shows, track progress episode by episode and check the episode rating heatmap.'
                        ),
                        side: "top",
                        onPrevClick: () => {
                            if (isBusy) return;
                            if (window.closeOverlay) window.closeOverlay('show-detail-overlay');
                            safeTimeout(() => {
                                if (window.openDetail) {
                                    window.openDetail({ id: 27205, title: 'Inception', backdrop_path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg', poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg' }, 'movie', { isTutorial: true });
                                }
                                waitForElement('.detail-hero-info', 2500).then(() => driverObj.movePrevious());
                            }, 200);
                        },
                        onNextClick: () => {
                            if (isBusy) return;
                            if (window.closeOverlay) window.closeOverlay('show-detail-overlay');
                            safeTimeout(() => driverObj.moveNext(), 250);
                        }
                    }
                },
                {
                    element: getNavBtn('panoptic'),
                    popover: {
                        title: t("L'œil qui voit tout 👁️", 'The All-Seeing Eye 👁️'),
                        description: t(
                            "Voici Panoptic, notre outil interactif pour trouver rapidement quoi regarder seul ou en groupe.",
                            'Meet Panoptic, our interactive tool to quickly pick what to watch solo or with friends.'
                        ),
                        side: "top",
                        onNextClick: () => {
                            if (isBusy) return;
                            if (window.appNavigateTo) window.appNavigateTo('panoptic');
                            safeTimeout(() => driverObj.moveNext(), 250);
                        }
                    }
                },
                {
                    element: '#btn-panoptic-search',
                    popover: {
                        title: t('Panoptic + Big Brother', 'Panoptic + Big Brother'),
                        description: t(
                            "Filtrez par durée, plateformes, genres ou films de référence et swipez les meilleures suggestions.",
                            'Filter by runtime, streaming platforms, genres, or reference titles and swipe through top picks.'
                        ),
                        side: "bottom"
                    }
                },
                {
                    element: getNavBtn('calendar'),
                    popover: {
                        title: t('Calendrier & Listes', 'Calendar & Lists'),
                        description: t(
                            "Suivez les prochaines sorties de vos séries et films et organisez vos collections personnalisées.",
                            'Track upcoming releases for your shows and movies, and organize custom collections.'
                        ),
                        side: "top",
                        onNextClick: () => {
                            if (isBusy) return;
                            if (window.appNavigateTo) window.appNavigateTo('calendar');
                            safeTimeout(() => driverObj.moveNext(), 250);
                        }
                    }
                },
                {
                    element: getNavBtn('stats'),
                    popover: {
                        title: t('Statistiques & Succès', 'Stats & Achievements'),
                        description: t(
                            "Explorez votre temps de visionnage, vos séries de jours, votre profil BigBrother et 130+ succès !",
                            'Explore your watch time, daily streaks, BigBrother profile, and 130+ achievements!'
                        ),
                        side: "top",
                        onNextClick: () => {
                            if (isBusy) return;
                            if (window.appNavigateTo) window.appNavigateTo('stats');
                            safeTimeout(() => driverObj.moveNext(), 250);
                        }
                    }
                },
                {
                    element: getNavBtn('profile'),
                    popover: {
                        title: t('Votre Profil', 'Your Profile'),
                        description: t(
                            "Personnalisez votre thème, votre carte sociale, et importez ou exportez vos données à tout moment.",
                            'Customize your theme, social card, and import or export your data anytime.'
                        ),
                        side: "top",
                        onNextClick: () => {
                            if (isBusy) return;
                            if (window.appNavigateTo) window.appNavigateTo('profile');
                            safeTimeout(() => driverObj.moveNext(), 250);
                        }
                    }
                },
                {
                    popover: {
                        title: t('Prêt à commencer !', 'Ready to Start!'),
                        description: t(
                            "Vous savez tout. Ajoutez votre premier film ou série et laissez Big Brother faire le reste.",
                            "You're all set. Add your first movie or show and let Big Brother do the rest."
                        )
                    }
                }
            ],
            onDestroyStarted: async () => {
                if (!driverObj.hasNextStep()) {
                    clearAllAsync();
                    driverObj.destroy();
                    document.body.classList.remove('tutorial-active');
                    localStorage.setItem('dfwatch_tutorial_done', 'true');
                    if (window.closeOverlay) window.closeOverlay('show-detail-overlay');
                    if (window.appNavigateTo) window.appNavigateTo('series');
                    return;
                }
                const confirmed = typeof window.customConfirm === 'function'
                    ? await window.customConfirm(t('Quitter le tutoriel ?', 'Quit Tutorial?'), t('Êtes-vous sûr de vouloir quitter le tutoriel ?', 'Are you sure you want to exit the tutorial?'))
                    : confirm(t('Êtes-vous sûr de vouloir quitter le tutoriel ?', 'Are you sure you want to exit the tutorial?'));
                if (confirmed) {
                    clearAllAsync();
                    driverObj.destroy();
                    document.body.classList.remove('tutorial-active');
                    localStorage.setItem('dfwatch_tutorial_done', 'true');
                    if (window.closeOverlay) window.closeOverlay('show-detail-overlay');
                    if (window.appNavigateTo) window.appNavigateTo('series');
                }
            },
        });

        driverObj.drive();
    }

    window.startTutorial = startTutorial;

    // Attach to Replay button
    const replayBtn = document.getElementById('btn-replay-tutorial');
    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            startTutorial();
        });
    }

    // First time check
    const isDone = localStorage.getItem('dfwatch_tutorial_done');
    if (!isDone) {
        const isEn = window.I18n && window.I18n.lang === 'en';
        const promptDiv = document.createElement('div');
        promptDiv.className = 'tutorial-welcome-backdrop';
        promptDiv.innerHTML = `
            <div class="tutorial-welcome-card" role="dialog" aria-modal="true">
                <h2>${isEn ? 'Welcome to DFWatch!' : 'Bienvenue sur DFWatch !'}</h2>
                <p>${isEn ? 'Would you like to take a quick guided tour of all features?' : 'Voulez-vous suivre un petit tutoriel pour découvrir toutes les fonctionnalités ?'}</p>
                <div class="tutorial-welcome-actions">
                    <button id="btn-tut-skip" class="action-btn secondary">${isEn ? 'Skip' : 'Passer'}</button>
                    <button id="btn-tut-start" class="action-btn primary">${isEn ? 'Start' : 'Commencer'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(promptDiv);

        document.getElementById('btn-tut-skip')?.addEventListener('click', () => {
            localStorage.setItem('dfwatch_tutorial_done', 'true');
            promptDiv.remove();
        });

        document.getElementById('btn-tut-start')?.addEventListener('click', () => {
            promptDiv.remove();
            startTutorial();
        });
    }
})();
