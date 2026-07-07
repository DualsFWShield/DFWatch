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
    { id: 'ms_1st_movie',  cat: 'milestones', name: 'Ticket d\'Entrée',icon: '🎟️', desc: 'Ajouter un premier film',           check: s => s.movies >= 1 },
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
    { key: 'episodes',   name: 'Épisodes',       icon: '📺' },
    { key: 'films',      name: 'Films',           icon: '🎬' },
    { key: 'series',     name: 'Séries',          icon: '📖' },
    { key: 'temps',      name: 'Temps',           icon: '⏰' },
    { key: 'alphabet',   name: 'Alphabet',        icon: '🔤' },
    { key: 'decades',    name: 'Décennies',       icon: '📼' },
    { key: 'habitudes',  name: 'Habitudes',        icon: '🌙' },
    { key: 'streaks',    name: 'Streaks',         icon: '🔥' },
    { key: 'milestones', name: 'Milestones',      icon: '🏆' },
];

const Achievements = {
    async evaluate() {
        // ---- Gather all stats ----
        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const showCount = await db.shows.where('is_followed').equals(1).count();
        const seriesParts = DB.minutesToParts(seriesStats.totalMinutes);
        const movieParts = DB.minutesToParts(movieStats.totalMinutes);

        // Show first letters
        const allShows = await db.shows.where('is_followed').equals(1).toArray();
        const showFirstLetters = new Set();
        allShows.forEach(s => {
            if (s.name && s.name.length > 0) {
                const first = s.name[0].toUpperCase();
                if (first >= 'A' && first <= 'Z') showFirstLetters.add(first);
            }
        });

        // Decades from shows first_air_date or year
        const decades = new Set();
        allShows.forEach(s => {
            const year = s.first_air_date?.substring(0, 3) || '';
            if (year) decades.add(year);
        });
        const allMovies = await db.movies.toArray();
        allMovies.forEach(m => {
            const year = (m.release_date || '').substring(0, 3);
            if (year) decades.add(year);
        });

        // Viewing habits & streaks from watch history
        const history = await db.watch_history.toArray();
        const movieWatches = await db.movie_watches.toArray();
        const allDates = [];
        let hasWatchedLateNight = false;
        let hasWatchedEarlyMorning = false;
        let hasWeekendWatch = false;
        let hasLunchWatch = false;
        let hasSpeedRun = false;
        const watchDays = new Set(); // 0=Sun..6=Sat
        const weekShowMap = {}; // 'YYYY-WW' => Set of show names
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
                if (h >= 5 && h < 7) hasWatchedEarlyMorning = true;
                if (h >= 12 && h < 14) hasLunchWatch = true;
                if (day === 6) satSeen.add(d.toISOString().substring(0, 10));
                if (day === 0) sunSeen.add(d.toISOString().substring(0, 10));
                // Weekly show variety
                if (r.show_name) {
                    const weekStart = new Date(d);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    const weekKey = weekStart.toISOString().substring(0, 10);
                    if (!weekShowMap[weekKey]) weekShowMap[weekKey] = new Set();
                    weekShowMap[weekKey].add(r.show_name);
                }
            } catch (e) {}
        });
        // Weekend: watched on both sat and sun of the same weekend
        for (const sat of satSeen) {
            const nextDay = new Date(sat);
            nextDay.setDate(nextDay.getDate() + 1);
            if (sunSeen.has(nextDay.toISOString().substring(0, 10))) hasWeekendWatch = true;
        }
        const maxWeekShows = Math.max(0, ...Object.values(weekShowMap).map(s => s.size));

        // Max streak
        const maxStreak = this._calcMaxStreak(allDates);

        // Max episodes in one day
        const dayMap = {};
        history.forEach(r => {
            if (!r.watched_at) return;
            const day = r.watched_at.substring(0, 10);
            dayMap[day] = (dayMap[day] || 0) + 1;
        });
        const maxDayEpisodes = Math.max(0, ...Object.values(dayMap));

        // Rewatches
        const totalRewatches = history.filter(r => (r.rewatch_count || 0) > 0).length 
            + movieWatches.filter(r => (r.rewatch_count || 0) > 0).length;

        // Poster count
        const postersCount = allShows.filter(s => s.poster_path).length + allMovies.filter(m => m.poster_path).length;

        // Completed shows (nb_episodes_seen > 0 and marked as such)
        const completedShows = allShows.filter(s => s.status === 'completed' || (s.nb_episodes_seen && s.nb_episodes_seen > 0 && s.is_followed === 0)).length;

        // Has exported
        const hasExported = !!localStorage.getItem('dfwatch_has_exported');

        // Genre & country diversity (from stored TMDB data)
        const uniqueGenres = new Set();
        const uniqueCountries = new Set();
        // These would be populated if we store genre/country info from TMDB
        // For now, count distinct genre names we might have stored

        const stats = {
            episodes: seriesStats.count,
            movies: movieStats.count,
            shows: showCount,
            totalHours: seriesParts.totalHours + movieParts.totalHours,
            imported: (seriesStats.count + movieStats.count) > 0,
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

        // ---- Evaluate each achievement ----
        const results = [];
        for (const def of ACHIEVEMENTS_DEFS) {
            let unlocked = false;
            try { unlocked = def.check(stats); } catch (e) {}

            const existing = await db.achievements.get(def.id);
            if (unlocked && (!existing || !existing.unlocked)) {
                await db.achievements.put({ id: def.id, unlocked: 1, unlocked_at: new Date().toISOString() });
            } else if (!existing) {
                await db.achievements.put({ id: def.id, unlocked: 0, unlocked_at: null });
            }
            const stored = await db.achievements.get(def.id);
            results.push({ ...def, unlocked: stored ? stored.unlocked : 0, unlocked_at: stored?.unlocked_at });
        }
        return results;
    },

    _calcMaxStreak(dates) {
        if (dates.length === 0) return 0;
        const days = new Set();
        dates.forEach(d => {
            days.add(d.toISOString().substring(0, 10));
        });
        const sorted = [...days].sort();
        let maxStreak = 1, current = 1;
        for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1]);
            const curr = new Date(sorted[i]);
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
                current++;
                if (current > maxStreak) maxStreak = current;
            } else {
                current = 1;
            }
        }
        return maxStreak;
    },

    renderCard(ach) {
        const div = document.createElement('div');
        div.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
        div.innerHTML = `
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-name">${ach.name}</div>
            <div class="ach-desc">${ach.desc}</div>
            ${ach.unlocked && ach.unlocked_at ? `<div class="ach-date">${new Date(ach.unlocked_at).toLocaleDateString('fr-FR')}</div>` : ''}
        `;
        return div;
    },

    getCategories() { return ACH_CATEGORIES; },
    getTotal() { return ACHIEVEMENTS_DEFS.length; }
};
