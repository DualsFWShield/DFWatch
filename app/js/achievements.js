// achievements.js — DFWatch Achievement Engine (~150 achievements)

const ACHIEVEMENTS_DEFS = [
    // ═══════════════════════════════════════════
    // ÉPISODES (20)
    // ═══════════════════════════════════════════
    { id: 'ep_1',       cat: 'episodes', name: 'Premier Épisode',      icon: '📺', desc: 'Regarder 1 épisode',               check: s => s.episodes >= 1 },
    { id: 'ep_10',      cat: 'episodes', name: 'Débutant',             icon: '📺', desc: 'Regarder 10 épisodes',              check: s => s.episodes >= 10 },
    { id: 'ep_25',      cat: 'episodes', name: 'Spectateur',           icon: '📺', desc: 'Regarder 25 épisodes',              check: s => s.episodes >= 25 },
    { id: 'ep_50',      cat: 'episodes', name: 'Habitué',              icon: '📺', desc: 'Regarder 50 épisodes',              check: s => s.episodes >= 50 },
    { id: 'ep_100',     cat: 'episodes', name: 'Assidu',               icon: '🍿', desc: 'Regarder 100 épisodes',             check: s => s.episodes >= 100 },
    { id: 'ep_250',     cat: 'episodes', name: 'Passionné',            icon: '🍿', desc: 'Regarder 250 épisodes',             check: s => s.episodes >= 250 },
    { id: 'ep_500',     cat: 'episodes', name: 'Binge Watcher',        icon: '🔥', desc: 'Regarder 500 épisodes',             check: s => s.episodes >= 500 },
    { id: 'ep_750',     cat: 'episodes', name: 'Sérievore',            icon: '🔥', desc: 'Regarder 750 épisodes',             check: s => s.episodes >= 750 },
    { id: 'ep_1000',    cat: 'episodes', name: 'Marathonien',          icon: '🏃', desc: 'Regarder 1 000 épisodes',           check: s => s.episodes >= 1000 },
    { id: 'ep_1500',    cat: 'episodes', name: 'Ultra-Marathonien',    icon: '🏃', desc: 'Regarder 1 500 épisodes',           check: s => s.episodes >= 1500 },
    { id: 'ep_2000',    cat: 'episodes', name: 'Drogué de Séries',     icon: '💉', desc: 'Regarder 2 000 épisodes',           check: s => s.episodes >= 2000 },
    { id: 'ep_2500',    cat: 'episodes', name: 'Légende',              icon: '👑', desc: 'Regarder 2 500 épisodes',           check: s => s.episodes >= 2500 },
    { id: 'ep_3000',    cat: 'episodes', name: 'Mythe Vivant',         icon: '👑', desc: 'Regarder 3 000 épisodes',           check: s => s.episodes >= 3000 },
    { id: 'ep_4000',    cat: 'episodes', name: 'Dieu du Canapé',       icon: '🛋️', desc: 'Regarder 4 000 épisodes',          check: s => s.episodes >= 4000 },
    { id: 'ep_5000',    cat: 'episodes', name: 'No-Life Absolu',       icon: '🧠', desc: 'Regarder 5 000 épisodes',           check: s => s.episodes >= 5000 },
    { id: 'ep_6000',    cat: 'episodes', name: 'Au-Delà du Réel',      icon: '🌌', desc: 'Regarder 6 000 épisodes',           check: s => s.episodes >= 6000 },
    { id: 'ep_7500',    cat: 'episodes', name: 'Transcendance',        icon: '✨', desc: 'Regarder 7 500 épisodes',           check: s => s.episodes >= 7500 },
    { id: 'ep_10000',   cat: 'episodes', name: 'L\'Élu',               icon: '🌟', desc: 'Regarder 10 000 épisodes',          check: s => s.episodes >= 10000 },
    { id: 'ep_15000',   cat: 'episodes', name: 'Dimension Parallèle',  icon: '🪐', desc: 'Regarder 15 000 épisodes',          check: s => s.episodes >= 15000 },
    { id: 'ep_20000',   cat: 'episodes', name: 'Omniscient',           icon: '🔮', desc: 'Regarder 20 000 épisodes',          check: s => s.episodes >= 20000 },

    // ═══════════════════════════════════════════
    // FILMS (15)
    // ═══════════════════════════════════════════
    { id: 'mov_1',      cat: 'films',   name: 'Première Séance',       icon: '🎬', desc: 'Regarder 1 film',                   check: s => s.movies >= 1 },
    { id: 'mov_5',      cat: 'films',   name: 'Cinéphile Curieux',     icon: '🎬', desc: 'Regarder 5 films',                  check: s => s.movies >= 5 },
    { id: 'mov_10',     cat: 'films',   name: 'Fan de Ciné',           icon: '🎞️', desc: 'Regarder 10 films',                 check: s => s.movies >= 10 },
    { id: 'mov_25',     cat: 'films',   name: 'Cinéphile',             icon: '🎞️', desc: 'Regarder 25 films',                 check: s => s.movies >= 25 },
    { id: 'mov_50',     cat: 'films',   name: 'Cinémaniaque',          icon: '🎥', desc: 'Regarder 50 films',                 check: s => s.movies >= 50 },
    { id: 'mov_75',     cat: 'films',   name: 'Critique Amateur',      icon: '🎥', desc: 'Regarder 75 films',                 check: s => s.movies >= 75 },
    { id: 'mov_100',    cat: 'films',   name: 'Critique de Cinéma',    icon: '⭐', desc: 'Regarder 100 films',                check: s => s.movies >= 100 },
    { id: 'mov_150',    cat: 'films',   name: 'Connaisseur',           icon: '⭐', desc: 'Regarder 150 films',                check: s => s.movies >= 150 },
    { id: 'mov_200',    cat: 'films',   name: 'Projectionniste',       icon: '📽️', desc: 'Regarder 200 films',                check: s => s.movies >= 200 },
    { id: 'mov_250',    cat: 'films',   name: 'Oscar du Public',       icon: '🏆', desc: 'Regarder 250 films',                check: s => s.movies >= 250 },
    { id: 'mov_300',    cat: 'films',   name: 'Palme d\'Or',           icon: '🏆', desc: 'Regarder 300 films',                check: s => s.movies >= 300 },
    { id: 'mov_400',    cat: 'films',   name: 'Cinémathèque Vivante',  icon: '🏛️', desc: 'Regarder 400 films',                check: s => s.movies >= 400 },
    { id: 'mov_500',    cat: 'films',   name: 'Martin Scorsese',       icon: '🎭', desc: 'Regarder 500 films',                check: s => s.movies >= 500 },
    { id: 'mov_750',    cat: 'films',   name: 'Steven Spielberg',      icon: '🎭', desc: 'Regarder 750 films',                check: s => s.movies >= 750 },
    { id: 'mov_1000',   cat: 'films',   name: 'Stanley Kubrick',       icon: '💫', desc: 'Regarder 1 000 films',              check: s => s.movies >= 1000 },

    // ═══════════════════════════════════════════
    // SÉRIES SUIVIES (12)
    // ═══════════════════════════════════════════
    { id: 'show_1',     cat: 'series',  name: 'Première Série',        icon: '📖', desc: 'Suivre 1 série',                    check: s => s.shows >= 1 },
    { id: 'show_5',     cat: 'series',  name: 'Curieux',               icon: '🔍', desc: 'Suivre 5 séries',                   check: s => s.shows >= 5 },
    { id: 'show_10',    cat: 'series',  name: 'Explorateur',           icon: '🔍', desc: 'Suivre 10 séries',                  check: s => s.shows >= 10 },
    { id: 'show_15',    cat: 'series',  name: 'Collectionneur',        icon: '📚', desc: 'Suivre 15 séries',                  check: s => s.shows >= 15 },
    { id: 'show_25',    cat: 'series',  name: 'Bibliothécaire',        icon: '📚', desc: 'Suivre 25 séries',                  check: s => s.shows >= 25 },
    { id: 'show_35',    cat: 'series',  name: 'Archiviste',            icon: '🗄️', desc: 'Suivre 35 séries',                  check: s => s.shows >= 35 },
    { id: 'show_50',    cat: 'series',  name: 'Encyclopédie',          icon: '📖', desc: 'Suivre 50 séries',                  check: s => s.shows >= 50 },
    { id: 'show_75',    cat: 'series',  name: 'Mémoire Vivante',       icon: '🧩', desc: 'Suivre 75 séries',                  check: s => s.shows >= 75 },
    { id: 'show_100',   cat: 'series',  name: 'Centenaire',            icon: '💯', desc: 'Suivre 100 séries',                 check: s => s.shows >= 100 },
    { id: 'show_125',   cat: 'series',  name: 'Ultra-Fan',             icon: '🤩', desc: 'Suivre 125 séries',                 check: s => s.shows >= 125 },
    { id: 'show_150',   cat: 'series',  name: 'Insatiable',            icon: '♾️', desc: 'Suivre 150 séries',                  check: s => s.shows >= 150 },
    { id: 'show_200',   cat: 'series',  name: 'Infini',                icon: '🌌', desc: 'Suivre 200 séries',                 check: s => s.shows >= 200 },

    // ═══════════════════════════════════════════
    // TEMPS DE VISIONNAGE (15)
    // ═══════════════════════════════════════════
    { id: 'time_1h',    cat: 'temps',   name: 'Première Heure',        icon: '⏱️', desc: '1h de visionnage cumulé',            check: s => s.totalHours >= 1 },
    { id: 'time_12h',   cat: 'temps',   name: 'Demi-Journée',          icon: '⏱️', desc: '12h de visionnage',                  check: s => s.totalHours >= 12 },
    { id: 'time_24h',   cat: 'temps',   name: 'Journée Continue',      icon: '⏰', desc: '24h de visionnage',                  check: s => s.totalHours >= 24 },
    { id: 'time_48h',   cat: 'temps',   name: 'Weekend Entier',        icon: '⏰', desc: '48h de visionnage',                  check: s => s.totalHours >= 48 },
    { id: 'time_168h',  cat: 'temps',   name: 'Semaine Non-Stop',      icon: '📅', desc: '168h (1 semaine)',                   check: s => s.totalHours >= 168 },
    { id: 'time_336h',  cat: 'temps',   name: 'Quinzaine',             icon: '📅', desc: '336h (2 semaines)',                  check: s => s.totalHours >= 336 },
    { id: 'time_720h',  cat: 'temps',   name: 'Mois de Streaming',     icon: '🗓️', desc: '720h (1 mois)',                      check: s => s.totalHours >= 720 },
    { id: 'time_1440h', cat: 'temps',   name: 'Bimestriel',            icon: '🗓️', desc: '1440h (2 mois)',                     check: s => s.totalHours >= 1440 },
    { id: 'time_2160h', cat: 'temps',   name: 'Trimestre Bingewatché', icon: '🔥', desc: '2160h (3 mois)',                    check: s => s.totalHours >= 2160 },
    { id: 'time_4320h', cat: 'temps',   name: 'Demi-Année',            icon: '💎', desc: '4320h (6 mois)',                    check: s => s.totalHours >= 4320 },
    { id: 'time_6480h', cat: 'temps',   name: 'Neuf Mois',             icon: '💎', desc: '6480h (9 mois)',                    check: s => s.totalHours >= 6480 },
    { id: 'time_8760h', cat: 'temps',   name: 'Année de Streaming',    icon: '🏅', desc: '8760h (1 an)',                      check: s => s.totalHours >= 8760 },
    { id: 'time_17520', cat: 'temps',   name: 'Deux Années',           icon: '🏅', desc: '17520h (2 ans)',                    check: s => s.totalHours >= 17520 },
    { id: 'time_26280', cat: 'temps',   name: 'Trois Années',          icon: '🥇', desc: '26280h (3 ans)',                    check: s => s.totalHours >= 26280 },
    { id: 'time_43800', cat: 'temps',   name: 'Demi-Décennie',         icon: '🥇', desc: '43800h (5 ans)',                    check: s => s.totalHours >= 43800 },

    // ═══════════════════════════════════════════
    // ALPHABET — Séries A-Z (26)
    // ═══════════════════════════════════════════
    ...('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => ({
        id: `alpha_${letter}`, cat: 'alphabet', name: `Lettre ${letter}`, icon: '🔤',
        desc: `Suivre une série commençant par "${letter}"`,
        check: s => s.showFirstLetters?.has(letter)
    }))),

    // ═══════════════════════════════════════════
    // DÉCENNIES (8)
    // ═══════════════════════════════════════════
    { id: 'dec_60s',    cat: 'decades', name: 'Années 60',             icon: '📻', desc: 'Regarder du contenu des années 60',  check: s => s.decades?.has('196') },
    { id: 'dec_70s',    cat: 'decades', name: 'Années 70',             icon: '📻', desc: 'Regarder du contenu des années 70',  check: s => s.decades?.has('197') },
    { id: 'dec_80s',    cat: 'decades', name: 'Années 80',             icon: '📼', desc: 'Regarder du contenu des années 80',  check: s => s.decades?.has('198') },
    { id: 'dec_90s',    cat: 'decades', name: 'Années 90',             icon: '📼', desc: 'Regarder du contenu des années 90',  check: s => s.decades?.has('199') },
    { id: 'dec_00s',    cat: 'decades', name: 'Années 2000',           icon: '💿', desc: 'Regarder du contenu des années 2000',check: s => s.decades?.has('200') },
    { id: 'dec_10s',    cat: 'decades', name: 'Années 2010',           icon: '📱', desc: 'Regarder du contenu des années 2010',check: s => s.decades?.has('201') },
    { id: 'dec_20s',    cat: 'decades', name: 'Années 2020',           icon: '🤖', desc: 'Regarder du contenu des années 2020',check: s => s.decades?.has('202') },
    { id: 'dec_all',    cat: 'decades', name: 'Voyageur Temporel',     icon: '⏳', desc: 'Contenu de 5 décennies différentes', check: s => (s.decades?.size || 0) >= 5 },

    // ═══════════════════════════════════════════
    // HABITUDES DE VISIONNAGE (10)
    // ═══════════════════════════════════════════
    { id: 'hab_night',     cat: 'habitudes', name: 'Noctambule',         icon: '🌙', desc: 'Regarder après minuit',              check: s => s.hasWatchedLateNight },
    { id: 'hab_early',     cat: 'habitudes', name: 'Lève-Tôt',           icon: '🌅', desc: 'Regarder avant 7h du matin',         check: s => s.hasWatchedEarlyMorning },
    { id: 'hab_weekend',   cat: 'habitudes', name: 'Weekend Warrior',    icon: '🛋️', desc: 'Regarder un samedi et dimanche',     check: s => s.hasWeekendWatch },
    { id: 'hab_lunch',     cat: 'habitudes', name: 'Pause Déjeuner',     icon: '🍽️', desc: 'Regarder entre 12h et 14h',          check: s => s.hasLunchWatch },
    { id: 'hab_alldays',   cat: 'habitudes', name: 'Tous les Jours',     icon: '📅', desc: 'Avoir regardé chaque jour de la semaine', check: s => (s.watchDays?.size || 0) >= 7 },
    { id: 'hab_5shows',    cat: 'habitudes', name: 'Multitâche',         icon: '🔀', desc: 'Regarder 5 séries différentes en 1 semaine', check: s => s.maxWeekShows >= 5 },
    { id: 'hab_10shows',   cat: 'habitudes', name: 'Zappeur Fou',        icon: '🔀', desc: '10 séries différentes en 1 semaine',  check: s => s.maxWeekShows >= 10 },
    { id: 'hab_speed',     cat: 'habitudes', name: 'Speed Runner',       icon: '⚡', desc: 'Regarder 3+ épisodes en 1h',          check: s => s.hasSpeedRun },
    { id: 'hab_variety',   cat: 'habitudes', name: 'Éclectique',         icon: '🎨', desc: 'Regarder 10+ genres différents',      check: s => s.uniqueGenres >= 10 },
    { id: 'hab_world',     cat: 'habitudes', name: 'Globe-Trotter',      icon: '🌍', desc: 'Regarder du contenu de 5+ pays',      check: s => s.uniqueCountries >= 5 },

    // ═══════════════════════════════════════════
    // STREAKS & PATTERNS (15)
    // ═══════════════════════════════════════════
    { id: 'streak_3',      cat: 'streaks', name: 'Mini-Streak',        icon: '🔥', desc: 'Regarder 3 jours de suite',         check: s => s.maxStreak >= 3 },
    { id: 'streak_7',      cat: 'streaks', name: 'Semaine Parfaite',   icon: '🔥', desc: 'Regarder 7 jours de suite',         check: s => s.maxStreak >= 7 },
    { id: 'streak_14',     cat: 'streaks', name: 'Quinzaine Active',   icon: '🔥', desc: 'Regarder 14 jours de suite',        check: s => s.maxStreak >= 14 },
    { id: 'streak_30',     cat: 'streaks', name: 'Mois Complet',       icon: '💫', desc: 'Regarder 30 jours de suite',        check: s => s.maxStreak >= 30 },
    { id: 'streak_60',     cat: 'streaks', name: 'Deux Mois Non-Stop', icon: '💫', desc: 'Regarder 60 jours de suite',        check: s => s.maxStreak >= 60 },
    { id: 'streak_100',    cat: 'streaks', name: 'Centenaire de Streak',icon: '🏆', desc: 'Regarder 100 jours de suite',       check: s => s.maxStreak >= 100 },
    { id: 'streak_365',    cat: 'streaks', name: 'Année Parfaite',     icon: '🏆', desc: 'Regarder 365 jours de suite',       check: s => s.maxStreak >= 365 },
    { id: 'binge_5',       cat: 'streaks', name: 'Mini-Binge',         icon: '⚡', desc: '5 épisodes en 1 jour',              check: s => s.maxDayEpisodes >= 5 },
    { id: 'binge_10',      cat: 'streaks', name: 'Binge Sérieux',      icon: '⚡', desc: '10 épisodes en 1 jour',             check: s => s.maxDayEpisodes >= 10 },
    { id: 'binge_15',      cat: 'streaks', name: 'Binge Extrême',      icon: '⚡', desc: '15 épisodes en 1 jour',             check: s => s.maxDayEpisodes >= 15 },
    { id: 'binge_20',      cat: 'streaks', name: 'Binge Ultime',       icon: '💀', desc: '20 épisodes en 1 jour',             check: s => s.maxDayEpisodes >= 20 },
    { id: 'rewatch_1',     cat: 'streaks', name: 'Première Rewatch',   icon: '🔄', desc: 'Revoir un épisode/film',            check: s => s.totalRewatches >= 1 },
    { id: 'rewatch_5',     cat: 'streaks', name: 'Nostalgique',        icon: '🔄', desc: '5 rewatches',                       check: s => s.totalRewatches >= 5 },
    { id: 'rewatch_25',    cat: 'streaks', name: 'Incorrigible',       icon: '🔄', desc: '25 rewatches',                      check: s => s.totalRewatches >= 25 },
    { id: 'rewatch_50',    cat: 'streaks', name: 'Déjà-Vu Permanent',  icon: '🔄', desc: '50 rewatches',                      check: s => s.totalRewatches >= 50 },

    // ═══════════════════════════════════════════
    // MILESTONES (12)
    // ═══════════════════════════════════════════
    { id: 'ms_import',     cat: 'milestones', name: 'Migrant',         icon: '📦', desc: 'Importer des données',              check: s => s.imported },
    { id: 'ms_1st_follow', cat: 'milestones', name: 'Abonné',          icon: '➕', desc: 'Suivre une première série',          check: s => s.shows >= 1 },
    { id: 'ms_1st_movie',  cat: 'milestones', name: 'Ticket d\'Entrée',icon: '🎟️', desc: 'Ajouter un premier film',           check: s => s.totalMoviesLibrary >= 1 },
    { id: 'ms_poster50',   cat: 'milestones', name: 'Galerie',         icon: '🖼️', desc: '50 posters dans la collection',     check: s => s.postersCount >= 50 },
    { id: 'ms_poster100',  cat: 'milestones', name: 'Musée du Poster', icon: '🖼️', desc: '100 posters dans la collection',    check: s => s.postersCount >= 100 },
    { id: 'ms_poster250',  cat: 'milestones', name: 'Galerie Royale',  icon: '🖼️', desc: '250 posters dans la collection',    check: s => s.postersCount >= 250 },
    { id: 'ms_complete_1', cat: 'milestones', name: 'Fin d\'une Ère',  icon: '✅', desc: 'Terminer 1 série entièrement',      check: s => s.completedShows >= 1 },
    { id: 'ms_complete_5', cat: 'milestones', name: 'Finisseur',       icon: '✅', desc: 'Terminer 5 séries',                 check: s => s.completedShows >= 5 },
    { id: 'ms_complete_10',cat: 'milestones', name: 'Complétiste',     icon: '✅', desc: 'Terminer 10 séries',                check: s => s.completedShows >= 10 },
    { id: 'ms_complete_25',cat: 'milestones', name: 'Perfectionniste', icon: '💯', desc: 'Terminer 25 séries',                check: s => s.completedShows >= 25 },
    { id: 'ms_complete_50',cat: 'milestones', name: 'Légende Ultime',  icon: '🏆', desc: 'Terminer 50 séries',                check: s => s.completedShows >= 50 },
    { id: 'ms_export',     cat: 'milestones', name: 'Sauvegardeur',    icon: '💾', desc: 'Exporter ses données',              check: s => s.hasExported },
];

// Total: 20+15+12+15+26+8+10+15+12 = 133 achievements

const ACH_CATEGORIES = [
    { key: 'episodes',   name: 'Épisodes', name_en: 'Episodes', icon: '📺' },
    { key: 'films',      name: 'Films', name_en: 'Movies', icon: '🎬' },
    { key: 'series',     name: 'Séries', name_en: 'Shows', icon: '📖' },
    { key: 'temps',      name: 'Temps', name_en: 'Watch Time', icon: '⏰' },
    { key: 'alphabet',   name: 'Alphabet', name_en: 'Alphabet', icon: '🔤' },
    { key: 'decades',    name: 'Décennies', name_en: 'Decades', icon: '📼' },
    { key: 'habitudes',  name: 'Habitudes', name_en: 'Habits', icon: '🌙' },
    { key: 'streaks',    name: 'Streaks', name_en: 'Streaks', icon: '🔥' },
    { key: 'milestones', name: 'Milestones', name_en: 'Milestones', icon: '🏆' },
];

const ACH_EN_MAP = {
    ep_1: ['First Episode', 'Watch 1 episode'],
    ep_10: ['Beginner', 'Watch 10 episodes'],
    ep_25: ['Viewer', 'Watch 25 episodes'],
    ep_50: ['Regular', 'Watch 50 episodes'],
    ep_100: ['Dedicated', 'Watch 100 episodes'],
    ep_250: ['Passionate', 'Watch 250 episodes'],
    ep_500: ['Binge Watcher', 'Watch 500 episodes'],
    ep_750: ['Series Addict', 'Watch 750 episodes'],
    ep_1000: ['Marathoner', 'Watch 1,000 episodes'],
    ep_1500: ['Ultra-Marathoner', 'Watch 1,500 episodes'],
    ep_2000: ['TV Junkie', 'Watch 2,000 episodes'],
    ep_2500: ['Legend', 'Watch 2,500 episodes'],
    ep_3000: ['Living Myth', 'Watch 3,000 episodes'],
    ep_4000: ['Couch Deity', 'Watch 4,000 episodes'],
    ep_5000: ['Absolute No-Life', 'Watch 5,000 episodes'],
    ep_6000: ['Beyond Reality', 'Watch 6,000 episodes'],
    ep_7500: ['Transcendence', 'Watch 7,500 episodes'],
    ep_10000: ['The Chosen One', 'Watch 10,000 episodes'],
    ep_15000: ['Parallel Dimension', 'Watch 15,000 episodes'],
    ep_20000: ['Omniscient', 'Watch 20,000 episodes'],
    mov_1: ['First Screening', 'Watch 1 movie'],
    mov_5: ['Curious Cinephile', 'Watch 5 movies'],
    mov_10: ['Movie Fan', 'Watch 10 movies'],
    mov_25: ['Cinephile', 'Watch 25 movies'],
    mov_50: ['Cinemaniac', 'Watch 50 movies'],
    mov_75: ['Amateur Critic', 'Watch 75 movies'],
    mov_100: ['Film Critic', 'Watch 100 movies'],
    mov_150: ['Connoisseur', 'Watch 150 movies'],
    mov_200: ['Projectionist', 'Watch 200 movies'],
    mov_250: ['People\'s Oscar', 'Watch 250 movies'],
    mov_300: ['Palme d\'Or', 'Watch 300 movies'],
    mov_400: ['Living Cinematheque', 'Watch 400 movies'],
    mov_500: ['Martin Scorsese', 'Watch 500 movies'],
    mov_750: ['Steven Spielberg', 'Watch 750 movies'],
    mov_1000: ['Stanley Kubrick', 'Watch 1,000 movies'],
    show_1: ['First Show', 'Follow 1 show'],
    show_5: ['Curious', 'Follow 5 shows'],
    show_10: ['Explorer', 'Follow 10 shows'],
    show_15: ['Collector', 'Follow 15 shows'],
    show_25: ['Librarian', 'Follow 25 shows'],
    show_35: ['Archivist', 'Follow 35 shows'],
    show_50: ['Encyclopedia', 'Follow 50 shows'],
    show_75: ['Living Memory', 'Follow 75 shows'],
    show_100: ['Centurion', 'Follow 100 shows'],
    show_125: ['Ultra-Fan', 'Follow 125 shows'],
    show_150: ['Insatiable', 'Follow 150 shows'],
    show_200: ['Infinite', 'Follow 200 shows'],
    time_1h: ['First Hour', '1h of cumulative watch time'],
    time_12h: ['Half-Day', '12h of watch time'],
    time_24h: ['Full Day', '24h of watch time'],
    time_48h: ['Full Weekend', '48h of watch time'],
    time_168h: ['Non-Stop Week', '168h (1 week)'],
    time_336h: ['Fortnight', '336h (2 weeks)'],
    time_720h: ['Streaming Month', '720h (1 month)'],
    time_1440h: ['Bimonthly', '1440h (2 months)'],
    time_2160h: ['Binge Quarter', '2160h (3 months)'],
    time_4320h: ['Half-Year', '4320h (6 months)'],
    time_6480h: ['Nine Months', '6480h (9 months)'],
    time_8760h: ['Streaming Year', '8760h (1 year)'],
    time_17520: ['Two Years', '17520h (2 years)'],
    time_26280: ['Three Years', '26280h (3 years)'],
    time_43800: ['Half-Decade', '43800h (5 years)'],
    dec_60s: ['The 60s', 'Watch content from the 1960s'],
    dec_70s: ['The 70s', 'Watch content from the 1970s'],
    dec_80s: ['The 80s', 'Watch content from the 1980s'],
    dec_90s: ['The 90s', 'Watch content from the 1990s'],
    dec_00s: ['The 2000s', 'Watch content from the 2000s'],
    dec_10s: ['The 2010s', 'Watch content from the 2010s'],
    dec_20s: ['The 2020s', 'Watch content from the 2020s'],
    dec_all: ['Time Traveler', 'Content from 5 different decades'],
    hab_night: ['Night Owl', 'Watch after midnight'],
    hab_early: ['Early Bird', 'Watch before 7 AM'],
    hab_weekend: ['Weekend Warrior', 'Watch on Saturday and Sunday'],
    hab_lunch: ['Lunch Break', 'Watch between 12 PM and 2 PM'],
    hab_alldays: ['Every Day', 'Watch on every day of the week'],
    hab_5shows: ['Multitasker', 'Watch 5 different shows in 1 week'],
    hab_10shows: ['Channel Hopper', 'Watch 10 different shows in 1 week'],
    hab_speed: ['Speed Runner', 'Watch 3+ episodes within 1 hour'],
    hab_variety: ['Eclectic', 'Watch 10+ different genres'],
    hab_world: ['Globe-Trotter', 'Watch content from 5+ countries'],
    streak_3: ['Mini-Streak', 'Watch 3 days in a row'],
    streak_7: ['Perfect Week', 'Watch 7 days in a row'],
    streak_14: ['Active Fortnight', 'Watch 14 days in a row'],
    streak_30: ['Full Month', 'Watch 30 days in a row'],
    streak_60: ['Two Months Non-Stop', 'Watch 60 days in a row'],
    streak_100: ['Streak Centurion', 'Watch 100 days in a row'],
    streak_365: ['Perfect Year', 'Watch 365 days in a row'],
    binge_5: ['Mini-Binge', '5 episodes in 1 day'],
    binge_10: ['Serious Binge', '10 episodes in 1 day'],
    binge_15: ['Extreme Binge', '15 episodes in 1 day'],
    binge_20: ['Ultimate Binge', '20 episodes in 1 day'],
    rewatch_1: ['First Rewatch', 'Rewatch an episode or movie'],
    rewatch_5: ['Nostalgic', '5 rewatches'],
    rewatch_25: ['Incorrigible', '25 rewatches'],
    rewatch_50: ['Permanent Deja-Vu', '50 rewatches'],
    ms_import: ['Migrant', 'Import your watch data'],
    ms_1st_follow: ['Subscriber', 'Follow your first show'],
    ms_1st_movie: ['Admission Ticket', 'Add your first movie'],
    ms_poster50: ['Gallery', '50 posters in your collection'],
    ms_poster100: ['Poster Museum', '100 posters in your collection'],
    ms_poster250: ['Royal Gallery', '250 posters in your collection'],
    ms_complete_1: ['End of an Era', 'Finish 1 full show'],
    ms_complete_5: ['Finisher', 'Finish 5 shows'],
    ms_complete_10: ['Completionist', 'Finish 10 shows'],
    ms_complete_25: ['Perfectionist', 'Finish 25 shows'],
    ms_complete_50: ['Ultimate Legend', 'Finish 50 shows'],
    ms_export: ['Archivist', 'Export a backup of your data'],
};

const Achievements = {
    _localDateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    _getLocalizedDef(def) {
        const isEn = window.I18n && window.I18n.lang === 'en';
        if (!isEn) return def;
        if (def.id.startsWith('alpha_')) {
            const letter = def.id.replace('alpha_', '');
            return { ...def, name: `Letter ${letter}`, desc: `Follow a show starting with "${letter}"` };
        }
        const en = ACH_EN_MAP[def.id];
        if (en) return { ...def, name: en[0], desc: en[1] };
        return def;
    },

    _getProgress(def, stats) {
        const id = def.id;
        const num = (v) => Math.max(0, Number(v) || 0);
        if (id.startsWith('ep_')) {
            const target = parseInt(id.slice(3), 10);
            return { current: Math.min(num(stats.episodes), target), target };
        }
        if (id.startsWith('mov_')) {
            const target = parseInt(id.slice(4), 10);
            return { current: Math.min(num(stats.movies), target), target };
        }
        if (id.startsWith('show_')) {
            const target = parseInt(id.slice(5), 10);
            return { current: Math.min(num(stats.shows), target), target };
        }
        if (id.startsWith('time_')) {
            const target = parseInt(id.replace('time_', '').replace('h', ''), 10);
            return { current: Math.min(num(stats.totalHours), target), target };
        }
        if (id.startsWith('streak_')) {
            const target = parseInt(id.slice(7), 10);
            return { current: Math.min(num(stats.maxStreak), target), target };
        }
        if (id.startsWith('binge_')) {
            const target = parseInt(id.slice(6), 10);
            return { current: Math.min(num(stats.maxDayEpisodes), target), target };
        }
        if (id.startsWith('rewatch_')) {
            const target = parseInt(id.slice(8), 10);
            return { current: Math.min(num(stats.totalRewatches), target), target };
        }
        if (id.startsWith('ms_poster')) {
            const target = parseInt(id.replace('ms_poster', ''), 10);
            return { current: Math.min(num(stats.postersCount), target), target };
        }
        if (id.startsWith('ms_complete_')) {
            const target = parseInt(id.replace('ms_complete_', ''), 10);
            return { current: Math.min(num(stats.completedShows), target), target };
        }
        if (id === 'dec_all') return { current: Math.min(stats.decades?.size || 0, 5), target: 5 };
        if (id === 'hab_alldays') return { current: Math.min(stats.watchDays?.size || 0, 7), target: 7 };
        if (id === 'hab_5shows') return { current: Math.min(num(stats.maxWeekShows), 5), target: 5 };
        if (id === 'hab_10shows') return { current: Math.min(num(stats.maxWeekShows), 10), target: 10 };
        if (id === 'hab_variety') return { current: Math.min(num(stats.uniqueGenres), 10), target: 10 };
        if (id === 'hab_world') return { current: Math.min(num(stats.uniqueCountries), 5), target: 5 };
        return null;
    },

    async evaluate() {
        // ---- Gather all stats ----
        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const allShows = await db.shows.where('is_followed').equals(1).toArray();
        const showCount = allShows.length;
        const seriesParts = DB.minutesToParts(seriesStats.totalMinutes);
        const movieParts = DB.minutesToParts(movieStats.totalMinutes);

        // Show first letters (normalized for French accents)
        const showFirstLetters = new Set();
        allShows.forEach(s => {
            if (s.name && s.name.trim().length > 0) {
                const first = s.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0]?.toUpperCase();
                if (first && first >= 'A' && first <= 'Z') showFirstLetters.add(first);
            }
        });

        const history = await db.watch_history.toArray();
        const movieWatches = await db.movie_watches.toArray();
        const showsWithWatches = new Set(history.map(h => h.show_name).filter(Boolean));
        const startedShows = allShows.filter(s => (s.nb_episodes_seen || 0) > 0 || showsWithWatches.has(s.name));

        const allMovies = await db.movies.toArray();
        const watchedMovies = allMovies.filter(m => m.status === 'watched');

        // Decades from started shows and watched movies
        const decades = new Set();
        startedShows.forEach(s => {
            const year = s.first_air_date?.substring(0, 3) || '';
            if (year) decades.add(year);
        });
        watchedMovies.forEach(m => {
            const year = (m.release_date || '').substring(0, 3);
            if (year) decades.add(year);
        });

        // Viewing habits & streaks from watch history (using local calendar dates)
        const allDates = [];
        let hasWatchedLateNight = false;
        let hasWatchedEarlyMorning = false;
        let hasWeekendWatch = false;
        let hasLunchWatch = false;
        let hasSpeedRun = false;
        const watchDays = new Set();
        const weekShowMap = {};
        const satSeen = new Set();
        const sunSeen = new Set();

        [...history, ...movieWatches].forEach(r => {
            if (!r.watched_at) return;
            try {
                const d = new Date(r.watched_at);
                if (isNaN(d.getTime())) return;
                allDates.push(d);
                const h = d.getHours();
                const day = d.getDay();
                watchDays.add(day);
                if (h >= 0 && h < 5) hasWatchedLateNight = true;
                if (h < 7) hasWatchedEarlyMorning = true;
                if (h >= 12 && h < 14) hasLunchWatch = true;
                const localKey = this._localDateStr(d);
                if (day === 6) satSeen.add(localKey);
                if (day === 0) sunSeen.add(localKey);
                if (r.show_name) {
                    const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
                    const weekKey = this._localDateStr(weekStart);
                    if (!weekShowMap[weekKey]) weekShowMap[weekKey] = new Set();
                    weekShowMap[weekKey].add(r.show_name);
                }
            } catch (e) {}
        });

        // Speed Run detection: 3+ episodes watched within a 1-hour window (excluding identical bulk timestamps)
        const sortedDates = [...history]
            .filter(r => r.watched_at)
            .map(r => { try { return new Date(r.watched_at); } catch(e) { return null; } })
            .filter(d => d && !isNaN(d.getTime()))
            .sort((a, b) => a - b);
        for (let i = 0; i <= sortedDates.length - 3 && !hasSpeedRun; i++) {
            const span = sortedDates[i + 2] - sortedDates[i];
            if (span > 1000 && span <= 3600000) {
                hasSpeedRun = true;
            }
        }

        // Weekend: watched on both sat and sun of the same weekend
        for (const sat of satSeen) {
            const [y, m, da] = sat.split('-').map(Number);
            const nextDay = new Date(y, m - 1, da + 1);
            if (sunSeen.has(this._localDateStr(nextDay))) hasWeekendWatch = true;
        }
        const maxWeekShows = Object.values(weekShowMap).reduce((mx, s) => (s.size > mx ? s.size : mx), 0);

        // Streaks
        const streakInfo = this.getStreaksFromDates(allDates);
        const maxStreak = streakInfo.maxStreak;

        // Max episodes in one local day
        const dayMap = {};
        history.forEach(r => {
            if (!r.watched_at) return;
            const d = new Date(r.watched_at);
            if (isNaN(d.getTime())) return;
            const day = this._localDateStr(d);
            dayMap[day] = (dayMap[day] || 0) + 1;
        });
        const maxDayEpisodes = Object.values(dayMap).reduce((mx, v) => (v > mx ? v : mx), 0);

        // Rewatches (sum rewatch_count)
        const totalRewatches = history.reduce((sum, r) => sum + (parseInt(r.rewatch_count, 10) || 0), 0)
            + movieWatches.reduce((sum, r) => sum + (parseInt(r.rewatch_count, 10) || 0), 0);

        // Poster count
        const postersCount = allShows.filter(s => s.poster_path).length + allMovies.filter(m => m.poster_path).length;

        // Completed followed shows
        const completedShows = allShows.filter(s => s.is_finished === 1 || s.status === 'completed').length;

        // Has exported / imported
        const hasExported = !!localStorage.getItem('dfwatch_has_exported');
        const hasImported = !!localStorage.getItem('dfwatch_has_imported');

        // Genre & country diversity (from started shows and watched movies)
        const uniqueGenres = new Set();
        const uniqueCountries = new Set();
        [...startedShows, ...watchedMovies].forEach(item => {
            if (item.genres && Array.isArray(item.genres)) {
                item.genres.forEach(g => {
                    const name = typeof g === 'string' ? g : (g ? g.name : null);
                    if (name && name !== 'null') uniqueGenres.add(name);
                });
            }
            if (item.origin_country && Array.isArray(item.origin_country)) {
                item.origin_country.forEach(c => { if (c) uniqueCountries.add(c); });
            } else if (typeof item.origin_country === 'string' && item.origin_country) {
                uniqueCountries.add(item.origin_country);
            }
            if (item.production_countries && Array.isArray(item.production_countries)) {
                item.production_countries.forEach(c => {
                    const code = typeof c === 'string' ? c : (c ? c.iso_3166_1 : null);
                    if (code) uniqueCountries.add(code);
                });
            }
        });

        const stats = {
            episodes: seriesStats.count,
            movies: watchedMovies.length || movieStats.count,
            totalMoviesLibrary: allMovies.length,
            shows: showCount,
            totalHours: seriesParts.totalHours + movieParts.totalHours,
            imported: hasImported,
            showFirstLetters,
            decades,
            hasWatchedLateNight,
            hasWatchedEarlyMorning,
            hasWeekendWatch,
            hasLunchWatch,
            hasSpeedRun,
            watchDays,
            maxWeekShows,
            uniqueGenres: uniqueGenres.size,
            uniqueCountries: uniqueCountries.size,
            maxStreak,
            maxDayEpisodes,
            totalRewatches,
            postersCount,
            completedShows,
            hasExported
        };

        // ---- Evaluate each achievement (batch optimized) ----
        const existingList = await db.achievements.toArray();
        const existingMap = new Map(existingList.map(a => [a.id, a]));
        const toPut = [];
        const results = [];
        const newlyUnlocked = [];

        for (const rawDef of ACHIEVEMENTS_DEFS) {
            const def = this._getLocalizedDef(rawDef);
            let unlocked = false;
            try { unlocked = Boolean(rawDef.check(stats)); } catch (e) {}

            const existing = existingMap.get(def.id);
            let finalUnlocked = existing ? existing.unlocked : 0;
            let finalUnlockedAt = existing ? existing.unlocked_at : null;

            if (unlocked && (!existing || !existing.unlocked)) {
                finalUnlocked = 1;
                finalUnlockedAt = new Date().toISOString();
                toPut.push({ id: def.id, unlocked: 1, unlocked_at: finalUnlockedAt });
                newlyUnlocked.push(def);
            } else if (!existing) {
                toPut.push({ id: def.id, unlocked: 0, unlocked_at: null });
            }

            const progress = this._getProgress(rawDef, stats);
            results.push({ ...def, unlocked: finalUnlocked, unlocked_at: finalUnlockedAt, progress });
        }

        if (toPut.length > 0) {
            await db.achievements.bulkPut(toPut);
        }

        if (newlyUnlocked.length > 3) {
            const isEn = window.I18n && window.I18n.lang === 'en';
            if (window.showAchievementToast) {
                window.showAchievementToast({
                    icon: '🏆',
                    name: isEn ? `+${newlyUnlocked.length} Achievements Unlocked!` : `+${newlyUnlocked.length} Succès débloqués !`,
                    desc: newlyUnlocked.slice(0, 3).map(a => a.name).join(', ') + '...'
                });
            }
        } else {
            newlyUnlocked.forEach(def => {
                if (window.showAchievementToast) window.showAchievementToast(def);
            });
        }

        return results;
    },

    getStreaksFromDates(dates) {
        if (!dates || dates.length === 0) return { currentStreak: 0, maxStreak: 0 };
        const days = new Set();
        dates.forEach(d => {
            if (d instanceof Date && !isNaN(d.getTime())) {
                days.add(this._localDateStr(d));
            }
        });
        const sorted = [...days].sort();
        if (sorted.length === 0) return { currentStreak: 0, maxStreak: 0 };
        let maxStreak = 1, run = 1;
        for (let i = 1; i < sorted.length; i++) {
            const [py, pm, pd] = sorted[i - 1].split('-').map(Number);
            const [cy, cm, cd] = sorted[i].split('-').map(Number);
            const prev = Date.UTC(py, pm - 1, pd);
            const curr = Date.UTC(cy, cm - 1, cd);
            const diff = Math.round((curr - prev) / 86400000);
            if (diff === 1) {
                run++;
                if (run > maxStreak) maxStreak = run;
            } else {
                run = 1;
            }
        }

        // Current streak (counting backward from today or yesterday)
        const now = new Date();
        const todayStr = this._localDateStr(now);
        const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yestStr = this._localDateStr(yest);
        let currentStreak = 0;
        let checkDate = days.has(todayStr) ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : (days.has(yestStr) ? yest : null);
        while (checkDate && days.has(this._localDateStr(checkDate))) {
            currentStreak++;
            checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - 1);
        }

        return { currentStreak, maxStreak };
    },

    _calcMaxStreak(dates) {
        return this.getStreaksFromDates(dates).maxStreak;
    },

    renderCard(ach) {
        const div = document.createElement('div');
        div.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
        const locale = (window.I18n && window.I18n.lang === 'en') ? 'en-US' : 'fr-FR';

        const iconEl = document.createElement('div');
        iconEl.className = 'ach-icon';
        iconEl.textContent = ach.icon;

        const nameEl = document.createElement('div');
        nameEl.className = 'ach-name';
        nameEl.textContent = ach.name;

        const descEl = document.createElement('div');
        descEl.className = 'ach-desc';
        descEl.textContent = ach.desc;

        div.append(iconEl, nameEl, descEl);

        if (ach.unlocked && ach.unlocked_at) {
            const dateEl = document.createElement('div');
            dateEl.className = 'ach-date';
            dateEl.textContent = new Date(ach.unlocked_at).toLocaleDateString(locale);
            div.appendChild(dateEl);
        } else if (!ach.unlocked && ach.progress && ach.progress.target > 1) {
            const pct = Math.min(100, Math.round((ach.progress.current / ach.progress.target) * 100));
            const progWrap = document.createElement('div');
            progWrap.className = 'ach-progress-wrap';
            progWrap.innerHTML = `
                <div class="ach-progress-track"><div class="ach-progress-bar" style="width:${pct}%"></div></div>
                <div class="ach-progress-label">${ach.progress.current} / ${ach.progress.target}</div>
            `;
            div.appendChild(progWrap);
        }
        return div;
    },

    getCategories() {
        const isEn = window.I18n && window.I18n.lang === 'en';
        return ACH_CATEGORIES.map(c => ({ ...c, displayName: isEn ? c.name_en : c.name }));
    },
    getTotal() { return ACHIEVEMENTS_DEFS.length; }
};
