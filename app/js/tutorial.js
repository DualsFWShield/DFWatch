(function() {
    'use strict';

    function startTutorial() {
        if (!window.driver || !window.driver.js) {
            console.error("Driver.js not loaded");
            return;
        }

        document.body.classList.add('tutorial-active');

        const driverFn = window.driver.js.driver;
        const getNavBtn = (page) => window.innerWidth <= 768 ? `.nav-btn[data-page="${page}"]` : `.sidebar-btn[data-page="${page}"]`;

        const driverObj = driverFn({
            showProgress: true,
            animate: true,
            allowClose: false,
            popoverClass: 'mystic-driver-popover',
            steps: [
                {
                    popover: {
                        title: 'Bienvenue sur DFWatch ! 🎬',
                        description: 'Votre nouveau hub pour suivre vos séries et films préférés. Faisons un rapide tour du propriétaire.'
                    }
                },
                {
                    element: getNavBtn('search'),
                    popover: {
                        title: 'Explorer',
                        description: "C'est ici que vous pouvez rechercher n'importe quel film ou série pour l'ajouter à votre collection.",
                        side: "top",
                        align: 'start',
                        onNextClick: () => {
                            if(window.appNavigateTo) window.appNavigateTo('search');
                            setTimeout(() => driverObj.moveNext(), 300);
                        }
                    }
                },
                {
                    element: '#search-input',
                    popover: {
                        title: 'Big Brother à l\'œuvre',
                        description: "Faisons une recherche... Je vais demander à Big Brother de chercher Inception pour vous.",
                        side: "bottom",
                        onNextClick: () => {
                            const searchInput = document.getElementById('search-input');
                            if(searchInput) {
                                searchInput.value = '';
                                const text = "Inception";
                                let i = 0;
                                const interval = setInterval(() => {
                                    if(i < text.length) {
                                        searchInput.value += text[i];
                                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        i++;
                                    } else {
                                        clearInterval(interval);
                                        setTimeout(() => {
                                            if(window.openDetail) window.openDetail({ id: 27205, title: 'Inception', backdrop_path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg', poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg' }, 'movie');
                                            setTimeout(() => driverObj.moveNext(), 1500);
                                        }, 800);
                                    }
                                }, 100);
                            } else {
                                driverObj.moveNext();
                            }
                        }
                    }
                },
                {
                    element: '.detail-actions',
                    popover: {
                        title: 'Les Actions',
                        description: 'Sur la fiche d\'un film, vous pouvez l\'ajouter à votre liste "À voir", le marquer comme "Vu", ou le mettre en Favori. (Boutons bloqués pendant le tuto)',
                        side: "bottom"
                    }
                },
                {
                    element: '.detail-rating',
                    popover: {
                        title: 'Score Big Brother',
                        description: 'Big Brother analyse ce film pour vous donner un score de qualité basé sur ses critères stricts.',
                        side: "top",
                        onNextClick: () => {
                            if(window.closeOverlay) window.closeOverlay('show-detail-overlay');
                            setTimeout(() => {
                                const searchInput = document.getElementById('search-input');
                                if(searchInput) {
                                    searchInput.value = '';
                                    const text = "Young Sheldon";
                                    let i = 0;
                                    const interval = setInterval(() => {
                                        if(i < text.length) {
                                            searchInput.value += text[i];
                                            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                                            i++;
                                        } else {
                                            clearInterval(interval);
                                            setTimeout(() => {
                                                if(window.openDetail) window.openDetail({ id: 71728, name: 'Young Sheldon', backdrop_path: '/vRptkFqg3vL5uIqIin8jP6aO3B8.jpg', poster_path: '/Mpv3Y9eT5c79s6jR503GndqSjI.jpg' }, 'tv');
                                                setTimeout(() => driverObj.moveNext(), 1500);
                                            }, 800);
                                        }
                                    }, 100);
                                } else {
                                    driverObj.moveNext();
                                }
                            }, 500);
                        }
                    }
                },
                {
                    element: '#detail-tv-tracker',
                    popover: {
                        title: 'Suivi de Série',
                        description: "Pour les séries, vous pouvez suivre votre progression épisode par épisode, et voir quand sortira la prochaine saison.",
                        side: "top",
                        onNextClick: () => {
                            if(window.closeOverlay) window.closeOverlay('show-detail-overlay');
                            setTimeout(() => driverObj.moveNext(), 300);
                        }
                    }
                },
                {
                    element: getNavBtn('panoptic'),
                    popover: {
                        title: 'L\'œil qui voit tout 👁️',
                        description: "Voici Panoptic. Notre outil mystique pour trouver rapidement quelque chose à regarder.",
                        side: "top",
                        onNextClick: () => {
                            if(window.appNavigateTo) window.appNavigateTo('panoptic');
                            setTimeout(() => driverObj.moveNext(), 300);
                        }
                    }
                },
                {
                    element: '#btn-panoptic-search',
                    popover: {
                        title: 'Big Brother vous regarde',
                        description: "Panoptic interroge Big Brother, notre algorithme de recommandation secret qui apprend de vos goûts pour vous proposer la perle rare.",
                        side: "bottom"
                    }
                },
                {
                    element: getNavBtn('calendar'),
                    popover: {
                        title: 'Votre Calendrier',
                        description: "Suivez les prochaines sorties de vos séries et films favoris. Vous y trouverez aussi vos listes personnalisées.",
                        side: "top",
                        onNextClick: () => {
                            if(window.appNavigateTo) window.appNavigateTo('calendar');
                            setTimeout(() => driverObj.moveNext(), 300);
                        }
                    }
                },
                {
                    element: getNavBtn('stats'),
                    popover: {
                        title: 'Vos Statistiques',
                        description: "Découvrez vos statistiques de visionnage, votre temps passé, et débloquez des succès amusants !",
                        side: "top",
                        onNextClick: () => {
                            if(window.appNavigateTo) window.appNavigateTo('stats');
                            setTimeout(() => driverObj.moveNext(), 300);
                        }
                    }
                },
                {
                    element: getNavBtn('profile'),
                    popover: {
                        title: 'Votre Profil',
                        description: "Personnalisez votre expérience, choisissez un thème, et importez ou exportez vos données.",
                        side: "top",
                        onNextClick: () => {
                            if(window.appNavigateTo) window.appNavigateTo('profile');
                            setTimeout(() => driverObj.moveNext(), 300);
                        }
                    }
                },
                {
                    popover: {
                        title: 'Prêt à commencer !',
                        description: "Vous savez tout. Ajoutez votre premier film ou série et laissez Big Brother faire le reste.",
                    }
                }
            ],
            onDestroyStarted: () => {
                if (!driverObj.hasNextStep() || confirm("Êtes-vous sûr de vouloir quitter le tutoriel ?")) {
                    driverObj.destroy();
                    document.body.classList.remove('tutorial-active');
                    localStorage.setItem('dfwatch_tutorial_done', 'true');
                    if(window.appNavigateTo) window.appNavigateTo('series');
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
        // Show a custom prompt
        const promptDiv = document.createElement('div');
        promptDiv.innerHTML = `
            <div style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:999999;">
                <div style="background:var(--bg-card, #1a1a1a); padding:30px; border-radius:12px; max-width:400px; text-align:center; border: 1px solid var(--border, #333);">
                    <h2 style="margin-bottom:15px; font-size:22px;">Bienvenue sur DFWatch !</h2>
                    <p style="margin-bottom:25px; color:#aaa; font-size:15px;">Voulez-vous suivre un petit tutoriel pour découvrir toutes les fonctionnalités ?</p>
                    <div style="display:flex; gap:10px;">
                        <button id="btn-tut-skip" class="action-btn secondary" style="flex:1;">Passer</button>
                        <button id="btn-tut-start" class="action-btn primary" style="flex:1;">Commencer</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(promptDiv);

        document.getElementById('btn-tut-skip').addEventListener('click', () => {
            localStorage.setItem('dfwatch_tutorial_done', 'true');
            promptDiv.remove();
        });

        document.getElementById('btn-tut-start').addEventListener('click', () => {
            promptDiv.remove();
            startTutorial();
        });
    }

})();
