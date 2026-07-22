// profile-card.js — DFWatch Social Profile Card Engine
// Generates beautiful shareable profile cards for Instagram, TikTok, X, etc.

const ProfileCard = (() => {
    // ═══════════════════════════════════════════════════════════════
    // XP SYSTEM
    // ═══════════════════════════════════════════════════════════════
    const XP_RANKS = [
        { minLevel: 0,   name_fr: 'Noob',                  name_en: 'Noob',                  icon: '🌱', cssClass: 'ring-noob' },
        { minLevel: 5,   name_fr: 'Amateur',               name_en: 'Amateur',               icon: '👀', cssClass: 'ring-amateur' },
        { minLevel: 10,  name_fr: 'Passionné',             name_en: 'Enthusiast',            icon: '🔥', cssClass: 'ring-passionne' },
        { minLevel: 15,  name_fr: 'Cinéphile',             name_en: 'Cinephile',             icon: '🍿', cssClass: 'ring-cinephile' },
        { minLevel: 20,  name_fr: 'Expert',                name_en: 'Expert',                icon: '⭐', cssClass: 'ring-expert' },
        { minLevel: 25,  name_fr: 'Maître',                name_en: 'Master',                icon: '🏅', cssClass: 'ring-maitre' },
        { minLevel: 30,  name_fr: 'Légende',               name_en: 'Legend',                icon: '👑', cssClass: 'ring-legende' },
        { minLevel: 35,  name_fr: 'Mythe',                 name_en: 'Myth',                  icon: '🌟', cssClass: 'ring-mythe' },
        { minLevel: 40,  name_fr: 'Hacker',                name_en: 'Hacker',                icon: '💻', cssClass: 'ring-hacker' },
    ];

    function calculateXP(stats) {
        const episodes = stats.episodes || 0;
        const movies = stats.movies || 0;
        const totalMinutes = stats.totalMinutes || 0;
        const achievements = stats.achievements || 0;
        return Math.floor((episodes * 10) + (movies * 45) + (totalMinutes / 10) + (achievements * 100));
    }

    function getLevel(xp) {
        return Math.floor(Math.sqrt(xp / 100));
    }

    function getXPForLevel(level) {
        return level * level * 100;
    }

    function getRank(level) {
        let rank = XP_RANKS[0];
        for (const r of XP_RANKS) {
            if (level >= r.minLevel) rank = r;
        }
        return rank;
    }

    function getRankName(level, lang = 'fr', xp = 0) {
        const rank = getRank(level);
        let name = lang === 'en' ? rank.name_en : rank.name_fr;
        
        // Hacker prestige infinite scaling (Base Hacker is minLevel 40, which is 160k XP)
        if (level >= 40) {
            const hackerBaseXP = 160000;
            const extraXP = Math.max(0, xp - hackerBaseXP);
            const prestigeLevel = Math.floor(extraXP / 10000) + 1;
            if (prestigeLevel > 1) {
                name = `${name} #${prestigeLevel}`;
            }
        }
        return name;
    }

    // (Removed duplicate getGenreCategory and translateGenre here)

    // ═══════════════════════════════════════════════════════════════
    // 200+ PERSONALITY TITLES (family-friendly, no inappropriate content)
    // ═══════════════════════════════════════════════════════════════
    const PERSONALITY_TITLES = {
        // ── GENERAL / TIME-BASED (30) ──
        general: [
            { fr: 'Binge-Watcher Invétéré', en: 'Hardcore Binge-Watcher', icon: '📺', check: s => s.episodes >= 500 },
            { fr: 'Marathonien du Canapé', en: 'Couch Marathoner', icon: '🛋️', check: s => s.totalHours >= 200 },
            { fr: 'Noctambule des Écrans', en: 'Screen Night Owl', icon: '🦉', check: s => s.totalHours >= 100 },
            { fr: 'Dévoreur de Contenus', en: 'Content Devourer', icon: '🍽️', check: s => (s.episodes + s.movies) >= 300 },
            { fr: 'Explorateur Culturel', en: 'Culture Explorer', icon: '🧭', check: s => s.genreCount >= 6 },
            { fr: 'Critique Avisé', en: 'Savvy Critic', icon: '🎭', check: s => s.movies >= 50 && s.shows >= 10 },
            { fr: 'Collectionneur d\'Histoires', en: 'Story Collector', icon: '📚', check: s => s.shows >= 30 },
            { fr: 'Spectateur Passionné', en: 'Passionate Viewer', icon: '❤️', check: s => s.totalHours >= 50 },
            { fr: 'Accro aux Séries', en: 'Series Addict', icon: '🔄', check: s => s.episodes >= 1000 },
            { fr: 'L\'Insatiable', en: 'The Insatiable', icon: '♾️', check: s => s.episodes >= 2000 },
            { fr: 'Gardien du Binge', en: 'Binge Guardian', icon: '🛡️', check: s => s.episodes >= 750 },
            { fr: 'Architecte de Soirées', en: 'Evening Architect', icon: '🌙', check: s => s.totalHours >= 300 },
            { fr: 'Nomade des Écrans', en: 'Screen Nomad', icon: '🗺️', check: s => s.genreCount >= 5 },
            { fr: 'Chroniqueur du Streaming', en: 'Streaming Chronicler', icon: '📝', check: s => s.shows >= 20 },
            { fr: 'Maître du Suspense', en: 'Suspense Master', icon: '😱', check: s => s.totalHours >= 150 },
            { fr: 'Champion du Replay', en: 'Replay Champion', icon: '🔁', check: s => s.episodes >= 1500 },
            { fr: 'Épicurien du Cinéma', en: 'Cinema Epicurean', icon: '🎩', check: s => s.movies >= 100 },
            { fr: 'Sentinelle du Streaming', en: 'Streaming Sentinel', icon: '🔭', check: s => s.shows >= 40 },
            { fr: 'Pilier de Canapé', en: 'Couch Pillar', icon: '🏛️', check: s => s.totalHours >= 500 },
            { fr: 'Encyclopédie Vivante', en: 'Living Encyclopedia', icon: '📖', check: s => s.shows >= 50 },
            { fr: 'Légende du Streaming', en: 'Streaming Legend', icon: '👑', check: s => s.totalHours >= 1000 },
            { fr: 'Virtuose de la Télécommande', en: 'Remote Virtuoso', icon: '🎮', check: s => s.episodes >= 3000 },
            { fr: 'Chasseur de Pépites', en: 'Gem Hunter', icon: '💎', check: s => s.genreCount >= 7 },
            { fr: 'Voyageur des Univers', en: 'Universe Traveler', icon: '🚀', check: s => s.genreCount >= 8 },
            { fr: 'Stratège du Temps Libre', en: 'Leisure Strategist', icon: '⏰', check: s => s.totalHours >= 400 },
            { fr: 'Connaisseur Éclairé', en: 'Enlightened Connoisseur', icon: '🌟', check: s => s.movies >= 200 },
            { fr: 'Esthète des Écrans', en: 'Screen Aesthete', icon: '🎨', check: s => s.totalHours >= 250 },
            { fr: 'Aventurier du Catalogue', en: 'Catalog Adventurer', icon: '🗂️', check: s => s.shows >= 25 },
            { fr: 'Bâtisseur de Watchlist', en: 'Watchlist Builder', icon: '🏗️', check: s => (s.shows + s.movies) >= 100 },
            { fr: 'Artisan du Week-End', en: 'Weekend Artisan', icon: '🎪', check: s => s.totalHours >= 80 },
        ],

        // ── DRAMA (20) ──
        drama: [
            { fr: 'Âme Sensible', en: 'Sensitive Soul', icon: '💧', genre: 'Drama' },
            { fr: 'Poète du Drame', en: 'Drama Poet', icon: '🎭', genre: 'Drama' },
            { fr: 'Amoureux des Belles Histoires', en: 'Beautiful Story Lover', icon: '💝', genre: 'Drama' },
            { fr: 'Connaisseur d\'Émotions', en: 'Emotion Connoisseur', icon: '🌹', genre: 'Drama' },
            { fr: 'Artiste du Ressenti', en: 'Feeling Artist', icon: '🎶', genre: 'Drama' },
            { fr: 'Observateur de Vies', en: 'Life Observer', icon: '👁️', genre: 'Drama' },
            { fr: 'Philosophe du Petit Écran', en: 'Screen Philosopher', icon: '🤔', genre: 'Drama' },
            { fr: 'Collectionneur de Larmes', en: 'Tear Collector', icon: '😢', genre: 'Drama' },
            { fr: 'Narrateur d\'Âmes', en: 'Soul Narrator', icon: '📜', genre: 'Drama' },
            { fr: 'Mélomane Dramatique', en: 'Dramatic Melomaniac', icon: '🎻', genre: 'Drama' },
            { fr: 'Expert en Frissons', en: 'Chills Expert', icon: '❄️', genre: 'Drama' },
            { fr: 'Témoin des Destins', en: 'Destiny Witness', icon: '🌅', genre: 'Drama' },
            { fr: 'Chroniqueur de Vies', en: 'Lives Chronicler', icon: '📔', genre: 'Drama' },
            { fr: 'Sensibilité à Fleur de Peau', en: 'Heightened Sensitivity', icon: '🌸', genre: 'Drama' },
            { fr: 'Architecte d\'Émotions', en: 'Emotion Architect', icon: '🏛️', genre: 'Drama' },
            { fr: 'Maître des Nuances', en: 'Nuance Master', icon: '🎨', genre: 'Drama' },
            { fr: 'Explorateur de l\'Âme', en: 'Soul Explorer', icon: '🧠', genre: 'Drama' },
            { fr: 'Fin Observateur', en: 'Keen Observer', icon: '🔍', genre: 'Drama' },
            { fr: 'Capteur d\'Instants', en: 'Moment Catcher', icon: '📸', genre: 'Drama' },
            { fr: 'Virtuose Émotionnel', en: 'Emotional Virtuoso', icon: '🎼', genre: 'Drama' },
        ],

        // ── COMEDY (20) ──
        comedy: [
            { fr: 'Roi du Rire', en: 'Laughter King', icon: '😂', genre: 'Comedy' },
            { fr: 'Chasseur de Fous Rires', en: 'Belly Laugh Hunter', icon: '🤣', genre: 'Comedy' },
            { fr: 'Artisan de la Bonne Humeur', en: 'Good Mood Artisan', icon: '😄', genre: 'Comedy' },
            { fr: 'Spécialiste du Sourire', en: 'Smile Specialist', icon: '😊', genre: 'Comedy' },
            { fr: 'Ambassadeur de la Joie', en: 'Joy Ambassador', icon: '🎉', genre: 'Comedy' },
            { fr: 'Épicurien du Rire', en: 'Laughter Epicurean', icon: '🍷', genre: 'Comedy' },
            { fr: 'Expert en Sitcoms', en: 'Sitcom Expert', icon: '📺', genre: 'Comedy' },
            { fr: 'Optimiste Invétéré', en: 'Incurable Optimist', icon: '☀️', genre: 'Comedy' },
            { fr: 'Collectionneur de Gags', en: 'Gag Collector', icon: '🤹', genre: 'Comedy' },
            { fr: 'Philosophe du Rire', en: 'Laughter Philosopher', icon: '🧐', genre: 'Comedy' },
            { fr: 'Connaisseur de Punchlines', en: 'Punchline Connoisseur', icon: '🎤', genre: 'Comedy' },
            { fr: 'Joyeux Luron', en: 'Merry Fellow', icon: '🎊', genre: 'Comedy' },
            { fr: 'Champion du LOL', en: 'LOL Champion', icon: '🏆', genre: 'Comedy' },
            { fr: 'Maître du Timing', en: 'Timing Master', icon: '⏱️', genre: 'Comedy' },
            { fr: 'Gardien de la Légèreté', en: 'Lightness Guardian', icon: '🎈', genre: 'Comedy' },
            { fr: 'Découvreur de Perles', en: 'Pearl Discoverer', icon: '🫧', genre: 'Comedy' },
            { fr: 'Expert Feel-Good', en: 'Feel-Good Expert', icon: '🌈', genre: 'Comedy' },
            { fr: 'Amoureux de la Comédie', en: 'Comedy Lover', icon: '💛', genre: 'Comedy' },
            { fr: 'Artiste du Fun', en: 'Fun Artist', icon: '🎪', genre: 'Comedy' },
            { fr: 'Bonne Vibration', en: 'Good Vibes', icon: '✌️', genre: 'Comedy' },
        ],

        // ── SCI-FI (20) ──
        scifi: [
            { fr: 'Voyageur Interstellaire', en: 'Interstellar Traveler', icon: '🚀', genre: 'Science Fiction' },
            { fr: 'Explorateur du Futur', en: 'Future Explorer', icon: '🔮', genre: 'Science Fiction' },
            { fr: 'Citoyen de la Galaxie', en: 'Galaxy Citizen', icon: '🌌', genre: 'Science Fiction' },
            { fr: 'Navigateur Temporel', en: 'Time Navigator', icon: '⏳', genre: 'Science Fiction' },
            { fr: 'Architecte du Futur', en: 'Future Architect', icon: '🏗️', genre: 'Science Fiction' },
            { fr: 'Pionnier des Étoiles', en: 'Star Pioneer', icon: '⭐', genre: 'Science Fiction' },
            { fr: 'Rêveur Technologique', en: 'Tech Dreamer', icon: '💻', genre: 'Science Fiction' },
            { fr: 'Génie Galactique', en: 'Galactic Genius', icon: '🧪', genre: 'Science Fiction' },
            { fr: 'Inventeur de Demain', en: 'Tomorrow\'s Inventor', icon: '⚡', genre: 'Science Fiction' },
            { fr: 'Explorateur de Dimensions', en: 'Dimension Explorer', icon: '🪐', genre: 'Science Fiction' },
            { fr: 'Astronaute du Canapé', en: 'Couch Astronaut', icon: '👨‍🚀', genre: 'Science Fiction' },
            { fr: 'Visionnaire Cosmique', en: 'Cosmic Visionary', icon: '🌠', genre: 'Science Fiction' },
            { fr: 'Chasseur d\'Aliens', en: 'Alien Hunter', icon: '👽', genre: 'Science Fiction' },
            { fr: 'Sentinelle Spatiale', en: 'Space Sentinel', icon: '🛸', genre: 'Science Fiction' },
            { fr: 'Héros du Cosmos', en: 'Cosmos Hero', icon: '🌍', genre: 'Science Fiction' },
            { fr: 'Cartographe des Étoiles', en: 'Star Cartographer', icon: '🗺️', genre: 'Science Fiction' },
            { fr: 'Ingénieur du Possible', en: 'Possibility Engineer', icon: '🔧', genre: 'Science Fiction' },
            { fr: 'Philosophe du Futur', en: 'Future Philosopher', icon: '🤖', genre: 'Science Fiction' },
            { fr: 'Chrononaute', en: 'Chrononaut', icon: '⌛', genre: 'Science Fiction' },
            { fr: 'Passionné d\'Odyssées', en: 'Odyssey Enthusiast', icon: '🛰️', genre: 'Science Fiction' },
        ],

        // ── ACTION / ADVENTURE (20) ──
        action: [
            { fr: 'Chercheur d\'Adrénaline', en: 'Adrenaline Seeker', icon: '⚡', genre: 'Action' },
            { fr: 'Héros du Dimanche', en: 'Sunday Hero', icon: '🦸', genre: 'Action' },
            { fr: 'Aventurier Sans Limites', en: 'Limitless Adventurer', icon: '🏔️', genre: 'Action' },
            { fr: 'Cascadeur de Salon', en: 'Living Room Stuntman', icon: '💥', genre: 'Action' },
            { fr: 'Accro à l\'Action', en: 'Action Junkie', icon: '🎬', genre: 'Action' },
            { fr: 'Explorateur de Mondes', en: 'World Explorer', icon: '🌍', genre: 'Action' },
            { fr: 'Champion des Blockbusters', en: 'Blockbuster Champion', icon: '🏆', genre: 'Action' },
            { fr: 'Voyageur Intrépide', en: 'Intrepid Traveler', icon: '🧗', genre: 'Action' },
            { fr: 'Maître de l\'Épopée', en: 'Epic Master', icon: '⚔️', genre: 'Action' },
            { fr: 'Découvreur d\'Aventures', en: 'Adventure Discoverer', icon: '🗺️', genre: 'Action' },
            { fr: 'Pilote de Courses', en: 'Race Pilot', icon: '🏎️', genre: 'Action' },
            { fr: 'Navigateur Courageux', en: 'Brave Navigator', icon: '⛵', genre: 'Action' },
            { fr: 'Marcheur du Tonnerre', en: 'Thunder Walker', icon: '⛈️', genre: 'Action' },
            { fr: 'Résistant Ultime', en: 'Ultimate Resilient', icon: '💪', genre: 'Action' },
            { fr: 'Sprinteur d\'Épisodes', en: 'Episode Sprinter', icon: '🏃', genre: 'Action' },
            { fr: 'Expert en Rebondissements', en: 'Plot Twist Expert', icon: '🔄', genre: 'Action' },
            { fr: 'Tacticien du Récit', en: 'Narrative Tactician', icon: '🧩', genre: 'Action' },
            { fr: 'Titan du Divertissement', en: 'Entertainment Titan', icon: '🏛️', genre: 'Action' },
            { fr: 'Légende de l\'Aventure', en: 'Adventure Legend', icon: '🌟', genre: 'Action' },
            { fr: 'Surfeur d\'Émotions Fortes', en: 'Thrill Surfer', icon: '🏄', genre: 'Action' },
        ],

        // ── THRILLER / MYSTERY (20) ──
        thriller: [
            { fr: 'Détective en Herbe', en: 'Budding Detective', icon: '🕵️', genre: 'Thriller' },
            { fr: 'Chasseur d\'Indices', en: 'Clue Hunter', icon: '🔍', genre: 'Thriller' },
            { fr: 'Esprit Aiguisé', en: 'Sharp Mind', icon: '🧠', genre: 'Thriller' },
            { fr: 'Expert en Suspense', en: 'Suspense Expert', icon: '😰', genre: 'Thriller' },
            { fr: 'Inspecteur du Canapé', en: 'Couch Inspector', icon: '🛋️', genre: 'Thriller' },
            { fr: 'Chercheur de Vérité', en: 'Truth Seeker', icon: '🔎', genre: 'Thriller' },
            { fr: 'Maître du Plot Twist', en: 'Plot Twist Master', icon: '🔀', genre: 'Thriller' },
            { fr: 'Analyste de l\'Ombre', en: 'Shadow Analyst', icon: '🌑', genre: 'Thriller' },
            { fr: 'Enquêteur Méthodique', en: 'Methodical Investigator', icon: '📋', genre: 'Thriller' },
            { fr: 'Captivé par l\'Intrigue', en: 'Intrigue Captive', icon: '🎯', genre: 'Thriller' },
            { fr: 'Stratège de l\'Ombre', en: 'Shadow Strategist', icon: '♟️', genre: 'Thriller' },
            { fr: 'Observateur Nocturne', en: 'Nighttime Observer', icon: '🌙', genre: 'Thriller' },
            { fr: 'Expert en Énigmes', en: 'Enigma Expert', icon: '❓', genre: 'Thriller' },
            { fr: 'Archiviste du Mystère', en: 'Mystery Archivist', icon: '🗃️', genre: 'Thriller' },
            { fr: 'Connaisseur de Complots', en: 'Plot Connoisseur', icon: '🕸️', genre: 'Thriller' },
            { fr: 'Éclaireur des Ténèbres', en: 'Darkness Scout', icon: '🔦', genre: 'Thriller' },
            { fr: 'Perspicace Invétéré', en: 'Incurable Sleuth', icon: '🎩', genre: 'Thriller' },
            { fr: 'Fin Limier', en: 'Keen Sleuth', icon: '🐕', genre: 'Thriller' },
            { fr: 'Tacticien de l\'Intrigue', en: 'Intrigue Tactician', icon: '🗡️', genre: 'Thriller' },
            { fr: 'Profiler Amateur', en: 'Amateur Profiler', icon: '👤', genre: 'Thriller' },
        ],

        // ── ROMANCE (20) ──
        romance: [
            { fr: 'Cœur Romantique', en: 'Romantic Heart', icon: '💕', genre: 'Romance' },
            { fr: 'Rêveur Éternel', en: 'Eternal Dreamer', icon: '💭', genre: 'Romance' },
            { fr: 'Expert en Love Stories', en: 'Love Story Expert', icon: '💘', genre: 'Romance' },
            { fr: 'Amoureux Transi', en: 'Starry-Eyed Lover', icon: '🌹', genre: 'Romance' },
            { fr: 'Conteur de Romances', en: 'Romance Storyteller', icon: '📖', genre: 'Romance' },
            { fr: 'Optimiste du Cœur', en: 'Heart Optimist', icon: '💗', genre: 'Romance' },
            { fr: 'Fan de Happy Endings', en: 'Happy Ending Fan', icon: '🌅', genre: 'Romance' },
            { fr: 'Dénicheur de Romcoms', en: 'Romcom Finder', icon: '🎬', genre: 'Romance' },
            { fr: 'Sensible du Grand Écran', en: 'Big Screen Sensitive', icon: '🎞️', genre: 'Romance' },
            { fr: 'Collectionneur de Papillons', en: 'Butterfly Collector', icon: '🦋', genre: 'Romance' },
            { fr: 'Ambassadeur du Cœur', en: 'Heart Ambassador', icon: '❤️', genre: 'Romance' },
            { fr: 'Poète des Sentiments', en: 'Feelings Poet', icon: '🖊️', genre: 'Romance' },
            { fr: 'Âme Fleur Bleue', en: 'Blue Flower Soul', icon: '💐', genre: 'Romance' },
            { fr: 'Explorateur Sentimental', en: 'Sentimental Explorer', icon: '🧭', genre: 'Romance' },
            { fr: 'Maître du Slow Burn', en: 'Slow Burn Master', icon: '🕯️', genre: 'Romance' },
            { fr: 'Champion des Feels', en: 'Feels Champion', icon: '🥰', genre: 'Romance' },
            { fr: 'Architecte d\'Histoires d\'Amour', en: 'Love Story Architect', icon: '🏰', genre: 'Romance' },
            { fr: 'Curateur Romantique', en: 'Romantic Curator', icon: '🌷', genre: 'Romance' },
            { fr: 'Gardien des Beaux Moments', en: 'Beautiful Moments Guardian', icon: '✨', genre: 'Romance' },
            { fr: 'Mélomane Romantique', en: 'Romantic Melomaniac', icon: '🎵', genre: 'Romance' },
        ],

        // ── ANIMATION (15) ──
        animation: [
            { fr: 'Fan d\'Animation', en: 'Animation Fan', icon: '🎨', genre: 'Animation' },
            { fr: 'Explorateur de Mondes Animés', en: 'Animated World Explorer', icon: '🌈', genre: 'Animation' },
            { fr: 'Connaisseur d\'Animation', en: 'Animation Connoisseur', icon: '✏️', genre: 'Animation' },
            { fr: 'Collectionneur de Dessins Animés', en: 'Cartoon Collector', icon: '📺', genre: 'Animation' },
            { fr: 'Rêveur en Couleurs', en: 'Color Dreamer', icon: '🎪', genre: 'Animation' },
            { fr: 'Aventurier Animé', en: 'Animated Adventurer', icon: '🗺️', genre: 'Animation' },
            { fr: 'Maître Otaku', en: 'Otaku Master', icon: '🎌', genre: 'Animation' },
            { fr: 'Esthète de l\'Animation', en: 'Animation Aesthete', icon: '🖌️', genre: 'Animation' },
            { fr: 'Virtuose du Pixel', en: 'Pixel Virtuoso', icon: '🎮', genre: 'Animation' },
            { fr: 'Gardien des Trésors Animés', en: 'Animated Treasure Guardian', icon: '💎', genre: 'Animation' },
            { fr: 'Passionné de Studios', en: 'Studio Enthusiast', icon: '🏠', genre: 'Animation' },
            { fr: 'Artiste du Regard', en: 'Gazing Artist', icon: '👀', genre: 'Animation' },
            { fr: 'Conteur Visuel', en: 'Visual Storyteller', icon: '🎞️', genre: 'Animation' },
            { fr: 'Architecte de Rêves', en: 'Dream Architect', icon: '🏰', genre: 'Animation' },
            { fr: 'Curateur de Merveilles', en: 'Wonder Curator', icon: '⭐', genre: 'Animation' },
        ],

        // ── HORROR / SUSPENSE (15) ──
        horror: [
            { fr: 'Amateur de Frissons', en: 'Thrill Seeker', icon: '😱', genre: 'Horror' },
            { fr: 'Explorateur de l\'Étrange', en: 'Strange Explorer', icon: '👁️', genre: 'Horror' },
            { fr: 'Intrépide des Ténèbres', en: 'Darkness Daredevil', icon: '🌑', genre: 'Horror' },
            { fr: 'Chasseur de Mystères', en: 'Mystery Chaser', icon: '🔦', genre: 'Horror' },
            { fr: 'Gardien de la Nuit', en: 'Night Guardian', icon: '🌙', genre: 'Horror' },
            { fr: 'Découvreur de l\'Inconnu', en: 'Unknown Discoverer', icon: '❓', genre: 'Horror' },
            { fr: 'Résistant aux Jump Scares', en: 'Jump Scare Resistant', icon: '💪', genre: 'Horror' },
            { fr: 'Nerfs d\'Acier', en: 'Nerves of Steel', icon: '🔩', genre: 'Horror' },
            { fr: 'Collectionneur d\'Atmosphères', en: 'Atmosphere Collector', icon: '🌫️', genre: 'Horror' },
            { fr: 'Expert en Tension', en: 'Tension Expert', icon: '⚡', genre: 'Horror' },
            { fr: 'Veilleur Nocturne', en: 'Night Watchman', icon: '🦉', genre: 'Horror' },
            { fr: 'Architecte du Frisson', en: 'Thrill Architect', icon: '🏚️', genre: 'Horror' },
            { fr: 'Courageux des Ombres', en: 'Brave of Shadows', icon: '🕯️', genre: 'Horror' },
            { fr: 'Pionnier de l\'Angoisse', en: 'Anxiety Pioneer', icon: '😰', genre: 'Horror' },
            { fr: 'Passionné de l\'Inexpliqué', en: 'Unexplained Enthusiast', icon: '🌌', genre: 'Horror' },
        ],

        // ── FANTASY (15) ──
        fantasy: [
            { fr: 'Rêveur d\'Ailleurs', en: 'Elsewhere Dreamer', icon: '🌙', genre: 'Fantasy' },
            { fr: 'Explorateur de Royaumes', en: 'Kingdom Explorer', icon: '🏰', genre: 'Fantasy' },
            { fr: 'Citoyen des Légendes', en: 'Legend Citizen', icon: '📜', genre: 'Fantasy' },
            { fr: 'Conteur Fantastique', en: 'Fantastic Storyteller', icon: '📖', genre: 'Fantasy' },
            { fr: 'Architecte de Mondes', en: 'World Architect', icon: '🌍', genre: 'Fantasy' },
            { fr: 'Gardien des Légendes', en: 'Legend Guardian', icon: '🛡️', genre: 'Fantasy' },
            { fr: 'Voyageur de Royaumes', en: 'Kingdom Voyager', icon: '👑', genre: 'Fantasy' },
            { fr: 'Héritier des Mythes', en: 'Myth Inheritor', icon: '🏛️', genre: 'Fantasy' },
            { fr: 'Collectionneur d\'Épopées', en: 'Epic Collector', icon: '⚔️', genre: 'Fantasy' },
            { fr: 'Chroniqueur des Terres', en: 'Lands Chronicler', icon: '🗺️', genre: 'Fantasy' },
            { fr: 'Érudit des Mythes', en: 'Myth Scholar', icon: '📚', genre: 'Fantasy' },
            { fr: 'Arpenteur de Légendes', en: 'Legend Surveyor', icon: '🧭', genre: 'Fantasy' },
            { fr: 'Passionné d\'Univers', en: 'Universe Enthusiast', icon: '🌠', genre: 'Fantasy' },
            { fr: 'Pionnier des Récits', en: 'Tale Pioneer', icon: '🗝️', genre: 'Fantasy' },
            { fr: 'Gardien du Folklore', en: 'Folklore Guardian', icon: '🎭', genre: 'Fantasy' },
        ],

        // ── DOCUMENTARY / REALITY (15) ──
        documentary: [
            { fr: 'Assoiffé de Savoir', en: 'Knowledge Thirsty', icon: '🧠', genre: 'Documentary' },
            { fr: 'Explorateur du Réel', en: 'Reality Explorer', icon: '🔍', genre: 'Documentary' },
            { fr: 'Citoyen du Monde', en: 'World Citizen', icon: '🌍', genre: 'Documentary' },
            { fr: 'Curieux de Nature', en: 'Naturally Curious', icon: '🌿', genre: 'Documentary' },
            { fr: 'Philosophe des Images', en: 'Image Philosopher', icon: '📷', genre: 'Documentary' },
            { fr: 'Voyageur du Réel', en: 'Reality Voyager', icon: '✈️', genre: 'Documentary' },
            { fr: 'Archiviste de la Planète', en: 'Planet Archivist', icon: '📁', genre: 'Documentary' },
            { fr: 'Témoin de l\'Histoire', en: 'History Witness', icon: '📰', genre: 'Documentary' },
            { fr: 'Expert en Savoir', en: 'Knowledge Expert', icon: '🎓', genre: 'Documentary' },
            { fr: 'Cartographe du Savoir', en: 'Knowledge Cartographer', icon: '🗺️', genre: 'Documentary' },
            { fr: 'Analyste du Monde', en: 'World Analyst', icon: '📊', genre: 'Documentary' },
            { fr: 'Observateur Planétaire', en: 'Planetary Observer', icon: '🔭', genre: 'Documentary' },
            { fr: 'Collectionneur de Faits', en: 'Fact Collector', icon: '📋', genre: 'Documentary' },
            { fr: 'Reporter d\'Univers', en: 'Universe Reporter', icon: '🎙️', genre: 'Documentary' },
            { fr: 'Penseur Éclairé', en: 'Enlightened Thinker', icon: '💡', genre: 'Documentary' },
        ],

        // ── NEWCOMER / LOW STATS (10) ──
        newcomer: [
            { fr: 'Jeune Padawan', en: 'Young Padawan', icon: '🌱', check: s => s.totalHours < 10 },
            { fr: 'Premier Pas', en: 'First Step', icon: '👣', check: s => s.totalHours < 5 },
            { fr: 'Curieux Débutant', en: 'Curious Beginner', icon: '🔰', check: s => s.totalHours < 20 },
            { fr: 'Apprenti Cinéphile', en: 'Apprentice Cinephile', icon: '🎓', check: s => s.episodes < 50 },
            { fr: 'Explorateur Timide', en: 'Shy Explorer', icon: '🐣', check: s => s.shows < 5 },
            { fr: 'Première Saison', en: 'First Season', icon: '1️⃣', check: s => s.shows >= 1 && s.shows < 3 },
            { fr: 'Graine de Cinéphile', en: 'Cinephile Seedling', icon: '🌿', check: s => s.totalHours < 15 },
            { fr: 'Spectateur en Devenir', en: 'Viewer in the Making', icon: '📡', check: s => s.totalHours < 25 },
            { fr: 'Éclaireur', en: 'Scout', icon: '🏕️', check: s => s.totalHours < 30 },
            { fr: 'Découvreur', en: 'Discoverer', icon: '🧭', check: s => s.totalHours < 40 },
        ],

        // ── MOVIES FOCUSED (20) ──
        movies: [
            { fr: 'Cinéphile Pur', en: 'Pure Cinephile', icon: '🎬', check: s => s.movies >= 30 && s.movies > s.shows * 3 },
            { fr: 'Critique de Cinéma', en: 'Film Critic', icon: '⭐', check: s => s.movies >= 50 },
            { fr: 'Collectionneur de Films', en: 'Film Collector', icon: '🎞️', check: s => s.movies >= 75 },
            { fr: 'Projectionniste', en: 'Projectionist', icon: '📽️', check: s => s.movies >= 100 },
            { fr: 'Critique d\'Art', en: 'Art Critic', icon: '🎨', check: s => s.movies >= 150 },
            { fr: 'Oscar du Public', en: 'People\'s Oscar', icon: '🏆', check: s => s.movies >= 200 },
            { fr: 'Maître du 7ème Art', en: '7th Art Master', icon: '🎭', check: s => s.movies >= 250 },
            { fr: 'Cinémathèque Vivante', en: 'Living Cinematheque', icon: '🏛️', check: s => s.movies >= 300 },
            { fr: 'Grand Réalisateur', en: 'Great Director', icon: '🎬', check: s => s.movies >= 400 },
            { fr: 'Légende du Grand Écran', en: 'Big Screen Legend', icon: '🌟', check: s => s.movies >= 500 },
            { fr: 'Passionné de Courts', en: 'Short Film Fan', icon: '⏱️', check: s => s.movies >= 20 },
            { fr: 'Épicurien du Grand Écran', en: 'Big Screen Epicurean', icon: '🍷', check: s => s.movies >= 40 },
            { fr: 'Archéologue du Cinéma', en: 'Cinema Archaeologist', icon: '🏺', check: s => s.movies >= 60 },
            { fr: 'Curateur Ciné', en: 'Movie Curator', icon: '🗂️', check: s => s.movies >= 80 },
            { fr: 'Voyageur du Grand Écran', en: 'Big Screen Traveler', icon: '✈️', check: s => s.movies >= 90 },
            { fr: 'Maître des Premières', en: 'Premiere Master', icon: '🎪', check: s => s.movies >= 120 },
            { fr: 'Connaisseur Filmique', en: 'Film Connoisseur', icon: '🎥', check: s => s.movies >= 130 },
            { fr: 'Génie du Montage', en: 'Editing Genius', icon: '✂️', check: s => s.movies >= 170 },
            { fr: 'Visionnaire du Cinéma', en: 'Cinema Visionary', icon: '🔮', check: s => s.movies >= 180 },
            { fr: 'Artisan du 7ème Art', en: '7th Art Artisan', icon: '🛠️', check: s => s.movies >= 35 },
        ],
        // ── CRIME (10) ──
        crime: [
            { fr: 'Détective Privé', en: 'Private Eye', icon: '🕵️', genre: 'Crime' },
            { fr: 'Expert en Criminologie', en: 'Criminology Expert', icon: '🔬', genre: 'Crime' },
            { fr: 'Chasseur de Mafieux', en: 'Mob Hunter', icon: '🕴️', genre: 'Crime' },
            { fr: 'Baron de la Pègre', en: 'Underworld Baron', icon: '💰', genre: 'Crime' },
            { fr: 'Cerveau Criminel', en: 'Criminal Mastermind', icon: '🧠', genre: 'Crime' },
            { fr: 'Limier Incorruptible', en: 'Untouchable Sleuth', icon: '👮', genre: 'Crime' },
            { fr: 'As du Braquage', en: 'Heist Ace', icon: '🏦', genre: 'Crime' },
            { fr: 'Justicier de la Nuit', en: 'Night Vigilante', icon: '🦇', genre: 'Crime' },
            { fr: 'Analyseur de Scènes', en: 'Scene Analyzer', icon: '🔍', genre: 'Crime' },
            { fr: 'Roi de l\'Évasion', en: 'Escape King', icon: '⛓️', genre: 'Crime' },
        ],
    };

    // ── Get a genre key from genre name ──
    function getGenreCategory(genreName) {
        const map = {
            'Drama': 'drama', 'Drame': 'drama',
            'Comedy': 'comedy', 'Comédie': 'comedy',
            'Science Fiction': 'scifi', 'Science-Fiction': 'scifi', 'Science-Fiction & Fantastique': 'scifi', 'Sci-Fi & Fantasy': 'scifi',
            'Action': 'action', 'Action & Adventure': 'action', 'Aventure': 'action', 'Adventure': 'action',
            'Thriller': 'thriller', 'Mystery': 'thriller', 'Mystère': 'thriller',
            'Crime': 'crime', 'Crime & Investigation': 'crime',
            'Romance': 'romance',
            'Animation': 'animation',
            'Horror': 'horror', 'Horreur': 'horror',
            'Fantasy': 'fantasy', 'Fantastique': 'fantasy', 'Sci-Fi & Fantasy': 'fantasy',
            'Documentary': 'documentary', 'Documentaire': 'documentary', 'Reality': 'documentary',
            'Kids': 'kids', 'Enfants': 'kids',
            'Family': 'family', 'Familial': 'family'
        };
        return map[genreName] || genreName;
    }

    function translateGenre(genreName) {
        const baseKey = getGenreCategory(genreName);
        if (baseKey && window.I18n && window.I18n.get(`genres.${baseKey}`)) {
            return window.I18n.get(`genres.${baseKey}`);
        }
        return genreName;
    }

    function generatePersonalityDescription(t, lang) {
        if (t.genre) {
            return lang === 'en' ? `Fan of ${t.genre}` : `Amateur de ${translateGenre(t.genre).toLowerCase()}`;
        }
        if (t.check) {
            const str = t.check.toString();
            let match = str.match(/episodes\s*>=\s*(\d+)/);
            if (match) return lang === 'en' ? `Watched over ${match[1]} episodes` : `A dévoré plus de ${match[1]} épisodes`;
            match = str.match(/totalHours\s*>=\s*(\d+)/);
            if (match) return lang === 'en' ? `Watched over ${match[1]} hours` : `Plus de ${match[1]} heures de visionnage`;
            match = str.match(/genreCount\s*>=\s*(\d+)/);
            if (match) return lang === 'en' ? `Explored over ${match[1]} genres` : `A exploré plus de ${match[1]} genres`;
            match = str.match(/movies\s*>=\s*(\d+)/);
            if (match) return lang === 'en' ? `Watched over ${match[1]} movies` : `A regardé plus de ${match[1]} films`;
            match = str.match(/shows\s*>=\s*(\d+)/);
            if (match) return lang === 'en' ? `Watched over ${match[1]} series` : `A suivi plus de ${match[1]} séries`;
        }
        return lang === 'en' ? 'Passionate viewer' : 'Spectateur passionné';
    }

    function generatePersonalitySuggestions(stats, lang = 'fr') {
        const key = lang === 'en' ? 'en' : 'fr';
        const suggestions = [];

        // 1. Genre-based titles (from top genres)
        if (stats.topGenres && stats.topGenres.length > 0) {
            for (const genre of stats.topGenres.slice(0, 3)) {
                const cat = getGenreCategory(genre);
                if (cat && PERSONALITY_TITLES[cat]) {
                    const catTitles = PERSONALITY_TITLES[cat];
                    // Shuffle & pick up to 3 from each genre
                    const shuffled = [...catTitles].sort(() => Math.random() - 0.5);
                    shuffled.slice(0, 3).forEach(t => {
                        suggestions.push({ text: `${t.icon} ${t[key]}`, id: `${cat}_${t[key]}`, desc: generatePersonalityDescription(t, lang) });
                    });
                }
            }
        }

        // 2. General stat-based
        const general = PERSONALITY_TITLES.general.filter(t => !t.check || t.check(stats));
        general.sort(() => Math.random() - 0.5);
        general.slice(0, 5).forEach(t => {
            suggestions.push({ text: `${t.icon} ${t[key]}`, id: `general_${t[key]}`, desc: generatePersonalityDescription(t, lang) });
        });

        // 3. Movies-focused
        const movieTitles = PERSONALITY_TITLES.movies ? PERSONALITY_TITLES.movies.filter(t => !t.check || t.check(stats)) : [];
        movieTitles.sort(() => Math.random() - 0.5);
        movieTitles.slice(0, 3).forEach(t => {
            suggestions.push({ text: `${t.icon} ${t[key]}`, id: `movies_${t[key]}`, desc: generatePersonalityDescription(t, lang) });
        });

        // 4. Newcomer if relevant
        if (stats.totalHours < 40 && PERSONALITY_TITLES.newcomer) {
            const newcomer = PERSONALITY_TITLES.newcomer.filter(t => !t.check || t.check(stats));
            newcomer.slice(0, 2).forEach(t => {
                suggestions.push({ text: `${t.icon} ${t[key]}`, id: `newcomer_${t[key]}`, desc: generatePersonalityDescription(t, lang) });
            });
        }

        // Deduplicate
        const seen = new Set();
        return suggestions.filter(s => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
        });
    }

    function getBestPersonality(stats, lang = 'fr') {
        const key = lang === 'en' ? 'en' : 'fr';

        // Check if newcomer
        if (stats.totalHours < 10) {
            const t = PERSONALITY_TITLES.newcomer[0];
            return `${t.icon} ${t[key]}`;
        }

        // Check top genre
        if (stats.topGenres && stats.topGenres.length > 0) {
            const topGenre = stats.topGenres[0];
            const cat = getGenreCategory(topGenre);
            if (cat && PERSONALITY_TITLES[cat] && PERSONALITY_TITLES[cat].length > 0) {
                const t = PERSONALITY_TITLES[cat][0];
                return `${t.icon} ${t[key]}`;
            }
        }

        // Fallback to best general
        const matching = PERSONALITY_TITLES.general.filter(t => t.check && t.check(stats));
        if (matching.length > 0) {
            const best = matching[matching.length - 1]; // last match = highest threshold
            return `${best.icon} ${best[key]}`;
        }

        return lang === 'en' ? '🌱 Novice Viewer' : '🌱 Spectateur Novice';
    }

    // ═══════════════════════════════════════════════════════════════
    // CARD THEMES
    // ═══════════════════════════════════════════════════════════════
    const CARD_THEMES = {
        void_neon: {
            name_fr: 'Void Neon', name_en: 'Void Neon',
            bg: '#08080f',
            gradient1: '#7c3aed', gradient2: '#06b6d4',
            accent: '#8b5cf6', accent2: '#22d3ee',
            text: '#f0f0f5', textSub: '#8b8ba3', textMuted: '#4a4a62',
        surface: 'rgba(14, 14, 24, 0.88)',
            border: 'rgba(139, 92, 246, 0.3)',
            glowColor: 'rgba(139, 92, 246, 0.15)',
        },
        sunset_gold: {
            name_fr: 'Sunset Gold', name_en: 'Sunset Gold',
            bg: '#1a0a00',
            gradient1: '#f59e0b', gradient2: '#ef4444',
            accent: '#fbbf24', accent2: '#fb923c',
            text: '#fef3c7', textSub: '#d97706', textMuted: '#92400e',
            surface: 'rgba(30, 15, 0, 0.88)',
            border: 'rgba(251, 191, 36, 0.3)',
            glowColor: 'rgba(245, 158, 11, 0.15)',
        },
        midnight_glass: {
            name_fr: 'Midnight Glass', name_en: 'Midnight Glass',
            bg: '#0a0a1a',
            gradient1: '#3b82f6', gradient2: '#8b5cf6',
            accent: '#60a5fa', accent2: '#a78bfa',
            text: '#e2e8f0', textSub: '#94a3b8', textMuted: '#475569',
            surface: 'rgba(15, 15, 30, 0.85)',
            border: 'rgba(59, 130, 246, 0.25)',
            glowColor: 'rgba(59, 130, 246, 0.12)',
        },
        emerald_cinema: {
            name_fr: 'Emerald Cinema', name_en: 'Emerald Cinema',
            bg: '#021a0e',
            gradient1: '#10b981', gradient2: '#06b6d4',
            accent: '#34d399', accent2: '#67e8f9',
            text: '#d1fae5', textSub: '#6ee7b7', textMuted: '#065f46',
            surface: 'rgba(2, 26, 14, 0.88)',
            border: 'rgba(16, 185, 129, 0.3)',
            glowColor: 'rgba(16, 185, 129, 0.12)',
        },
    };

    // ═══════════════════════════════════════════════════════════════
    // CARD FORMATS
    // ═══════════════════════════════════════════════════════════════
    const CARD_FORMATS = {
        '1:1':  { width: 1080, height: 1080, label: '1:1 Post' },
    };

    // ═══════════════════════════════════════════════════════════════
    // CANVAS RENDERER
    // ═══════════════════════════════════════════════════════════════

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load: ${src}`));
            img.src = src;
        });
    }

    function drawRoundedRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawGlowCircle(ctx, cx, cy, radius, color) {
        const grd = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 2);
        grd.addColorStop(0, color);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(cx - radius * 2, cy - radius * 2, radius * 4, radius * 4);
    }

    async function renderCard(data) {
        const format = CARD_FORMATS[data.format] || CARD_FORMATS['9:16'];
        const theme = CARD_THEMES[data.theme] || CARD_THEMES.void_neon;
        const { width, height } = format;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const isPortrait = data.format === '9:16';
        const isSquare = data.format === '1:1';
        const isLandscape = data.format === '16:9';

        const scale = width / 1080; 

        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        drawGlowCircle(ctx, width * 0.2, height * 0.15, width * 0.4, theme.glowColor);
        drawGlowCircle(ctx, width * 0.8, height * 0.6, width * 0.35, theme.glowColor.replace('0.15', '0.08').replace('0.12', '0.06'));

        ctx.strokeStyle = theme.border.replace('0.3', '0.05').replace('0.25', '0.04');
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 60 * scale) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 60 * scale) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        const pad = 60 * scale;
        let curY = pad;

        /* if (isPortrait) {
            const avatarSize = 240 * scale;
            const avatarX = width / 2;
            curY += 80 * scale;
            const avatarY = curY + avatarSize / 2;

            const ringRadius = avatarSize / 2 + 12 * scale;
            const xpProgress = data.xpProgress || 0;
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 6 * scale;
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, ringRadius, 0, Math.PI * 2);
            ctx.stroke();

            const ringColors = getRingColors(data.ringClass);
            const color1 = ringColors ? ringColors[0] : theme.gradient1;
            const color2 = ringColors ? ringColors[1] : theme.gradient2;
            const grd = ctx.createLinearGradient(avatarX - ringRadius, avatarY, avatarX + ringRadius, avatarY);
            grd.addColorStop(0, color1);
            grd.addColorStop(1, color2);
            ctx.strokeStyle = grd;
            ctx.lineWidth = 8 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * xpProgress);
            ctx.stroke();
            ctx.lineCap = 'butt';

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
            ctx.clip();

            if (data.avatarImg) {
                ctx.drawImage(data.avatarImg, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
            } else {
                const bgGrd = ctx.createLinearGradient(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
                bgGrd.addColorStop(0, theme.gradient1);
                bgGrd.addColorStop(1, theme.gradient2);
                ctx.fillStyle = bgGrd;
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${avatarSize * 0.4}px 'Inter', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(data.initials || '?', avatarX, avatarY);
            }
            ctx.restore();

            curY += avatarSize + 40 * scale;

            ctx.font = `bold ${24 * scale}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            const lvlText = `LVL ${data.level || 1}`;
            const lvlW = ctx.measureText(lvlText).width + 32 * scale;
            drawRoundedRect(ctx, avatarX - lvlW / 2, curY, lvlW, 40 * scale, 20 * scale);
            const lvlGrd = ctx.createLinearGradient(avatarX - lvlW / 2, curY, avatarX + lvlW / 2, curY);
            lvlGrd.addColorStop(0, theme.gradient1);
            lvlGrd.addColorStop(1, theme.gradient2);
            ctx.fillStyle = lvlGrd;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(lvlText, avatarX, curY + 20 * scale);
            curY += 70 * scale;

            ctx.textAlign = 'center';
            ctx.fillStyle = theme.text;
            ctx.font = `800 ${64 * scale}px 'Space Grotesk', 'Inter', sans-serif`;
            ctx.fillText(data.name || 'User', width / 2, curY);
            curY += 20 * scale;

            if (data.rankName) {
                const badgeText = `${data.rankIcon || ''} ${data.rankName}`.trim();
                ctx.font = `800 ${20 * scale}px 'Inter', sans-serif`;
                const badgeTextWidth = ctx.measureText(badgeText).width;
                
                const badgeW = badgeTextWidth + 40 * scale;
                const badgeH = 44 * scale;
                const badgeX = (width - badgeW) / 2;
                const badgeY = curY + 10 * scale;
                
                let badgeColors = getRingColors(data.ringClass);
                if (data.customBadge && data.customBadge.colors && data.customBadge.colors[0]) {
                    badgeColors = data.customBadge.colors.filter(c => c);
                }
                const bColor1 = badgeColors && badgeColors.length > 0 ? badgeColors[0] : theme.gradient1;
                const bColor2 = badgeColors && badgeColors.length > 1 ? badgeColors[1] : (badgeColors && badgeColors.length > 0 ? badgeColors[0] : theme.gradient2);
                
                const bGrd = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
                bGrd.addColorStop(0, bColor1);
                bGrd.addColorStop(1, bColor2);
                
                // Outer rect (Gradient border)
                drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 22 * scale);
                ctx.fillStyle = bGrd;
                ctx.fill();
                
                // Inner rect (Dark background)
                drawRoundedRect(ctx, badgeX + 2 * scale, badgeY + 2 * scale, badgeW - 4 * scale, badgeH - 4 * scale, 20 * scale);
                ctx.fillStyle = '#0f172a';
                ctx.fill();
                
                // Text
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, width / 2, badgeY + badgeH / 2 + 2 * scale);
                ctx.textBaseline = 'alphabetic';
                
                curY += badgeH + 40 * scale;
            } else {
                curY += 20 * scale;
            }

            if (data.showPersonality !== false) {
                ctx.fillStyle = theme.accent;
                ctx.font = `700 ${38 * scale}px 'Space Grotesk', 'Inter', sans-serif`;
                ctx.fillText(data.personalityTitle || '', width / 2, curY);
                if (data.personalityDesc) {
                    ctx.fillStyle = theme.textMuted;
                    ctx.font = `500 ${24 * scale}px 'Inter', sans-serif`;
                    ctx.fillText(data.personalityDesc, width / 2, curY + 40 * scale);
                    curY += 86 * scale;
                } else {
                    curY += 70 * scale;
                }
            } else {
                curY += 30 * scale;
            }

            const statsData = [
                { icon: '⏱️', value: data.totalTime || '0h', label: data.lang === 'en' ? 'Screen Time' : 'Temps d\'écran' },
                { icon: '📺', value: String(data.episodes || 0), label: data.lang === 'en' ? 'Episodes' : 'Épisodes' },
                { icon: '🎬', value: String(data.moviesCount || 0), label: data.lang === 'en' ? 'Movies' : 'Films' },
                { icon: '🏆', value: String(data.seriesFinished || 0), label: data.lang === 'en' ? 'Finished' : 'Terminées' },
            ];

            const cardW = (width - pad * 2 - 20 * scale) / 2;
            const cardH = 140 * scale;
            for (let i = 0; i < 4; i++) {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const cx = pad + col * (cardW + 20 * scale);
                const cy = curY + row * (cardH + 20 * scale);

                drawRoundedRect(ctx, cx, cy, cardW, cardH, 20 * scale);
                ctx.fillStyle = theme.surface;
                ctx.fill();
                ctx.strokeStyle = theme.border;
                ctx.lineWidth = 2 * scale;
                ctx.stroke();

                ctx.font = `${36 * scale}px sans-serif`;
                ctx.textAlign = 'left';
                ctx.fillText(statsData[i].icon, cx + 24 * scale, cy + 50 * scale);

                ctx.fillStyle = theme.text;
                ctx.font = `800 ${44 * scale}px 'Space Grotesk', 'Inter', sans-serif`;
                ctx.fillText(statsData[i].value, cx + 76 * scale, cy + 54 * scale);

                ctx.fillStyle = theme.textMuted;
                ctx.font = `600 ${22 * scale}px 'Inter', sans-serif`;
                ctx.fillText(statsData[i].label, cx + 24 * scale, cy + 100 * scale);
            }

            curY += 2 * (cardH + 20 * scale) + 40 * scale;

            if (data.topGenres && data.topGenres.length > 0) {
                const genresStr = data.topGenres.slice(0, 4).map(translateGenre).join('  •  ');
                ctx.textAlign = 'center';
                ctx.fillStyle = theme.textSub;
                ctx.font = `700 ${22 * scale}px 'Inter', sans-serif`;
                ctx.fillText(genresStr, width / 2, curY);
                curY += 50 * scale;
            }

            if (data.posterImages && data.posterImages.length > 0) {
                const maxPosters = Math.min(data.posterImages.length, 10);
                const isTwoRows = maxPosters > 5;
                const postersPerRow = isTwoRows ? Math.ceil(maxPosters / 2) : maxPosters;
                
                const posterH = isTwoRows ? 210 * scale : 260 * scale;
                const posterW = posterH * 0.667;
                const posterGap = 16 * scale;
                
                for (let r = 0; r < (isTwoRows ? 2 : 1); r++) {
                    const rowPosters = r === 0 ? postersPerRow : maxPosters - postersPerRow;
                    if (rowPosters <= 0) continue;
                    
                    const totalW = rowPosters * posterW + (rowPosters - 1) * posterGap;
                    const startX = (width - totalW) / 2;
                    
                    for (let c = 0; c < rowPosters; c++) {
                        const i = r * postersPerRow + c;
                        const img = data.posterImages[i];
                        if (img) {
                            const px = startX + c * (posterW + posterGap);
                            const py = curY + r * (posterH + posterGap);

                            ctx.save();
                            drawRoundedRect(ctx, px, py, posterW, posterH, 16 * scale);
                            ctx.clip();
                            ctx.drawImage(img, px, py, posterW, posterH);
                            ctx.restore();

                            drawRoundedRect(ctx, px, py, posterW, posterH, 16 * scale);
                            ctx.strokeStyle = theme.border;
                            ctx.lineWidth = 3 * scale;
                            ctx.stroke();
                        }
                    }
                }
                curY += (isTwoRows ? posterH * 2 + posterGap : posterH) + 40 * scale;
            }

            ctx.textAlign = 'center';
            ctx.fillStyle = theme.textMuted;
            ctx.font = `500 ${14 * scale}px 'Inter', sans-serif`;
            ctx.fillText('dfwatch.dualsfwshield.be', width / 2, height - 30 * scale);

        } else if (isLandscape) {
            const leftCenterX = width * 0.28;
            const rightCenterX = width * 0.68;
            
            let leftY = 160 * scale;
            const avatarSize = 280 * scale;
            const avatarY = leftY + avatarSize / 2;

            const ringRadius = avatarSize / 2 + 16 * scale;
            const xpProgress = data.xpProgress || 0;
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 6 * scale;
            ctx.beginPath();
            ctx.arc(leftCenterX, avatarY, ringRadius, 0, Math.PI * 2);
            ctx.stroke();

            const ringColors = getRingColors(data.ringClass);
            const color1 = ringColors ? ringColors[0] : theme.gradient1;
            const color2 = ringColors ? ringColors[1] : theme.gradient2;
            const grd = ctx.createLinearGradient(leftCenterX - ringRadius, avatarY, leftCenterX + ringRadius, avatarY);
            grd.addColorStop(0, color1);
            grd.addColorStop(1, color2);
            ctx.strokeStyle = grd;
            ctx.lineWidth = 10 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(leftCenterX, avatarY, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * xpProgress);
            ctx.stroke();
            ctx.lineCap = 'butt';

            ctx.save();
            ctx.beginPath();
            ctx.arc(leftCenterX, avatarY, avatarSize / 2, 0, Math.PI * 2);
            ctx.clip();
            if (data.avatarImg) {
                ctx.drawImage(data.avatarImg, leftCenterX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
            } else {
                const bgGrd = ctx.createLinearGradient(leftCenterX - avatarSize / 2, avatarY - avatarSize / 2, leftCenterX + avatarSize / 2, avatarY + avatarSize / 2);
                bgGrd.addColorStop(0, theme.gradient1);
                bgGrd.addColorStop(1, theme.gradient2);
                ctx.fillStyle = bgGrd;
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${avatarSize * 0.4}px 'Inter', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(data.initials || '?', leftCenterX, avatarY);
            }
            ctx.restore();

            leftY += avatarSize + 60 * scale;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = theme.text;
            ctx.font = `800 ${72 * scale}px 'Space Grotesk', 'Inter', sans-serif`;
            ctx.fillText(data.name || 'User', leftCenterX, leftY);
            leftY += 90 * scale;

            ctx.fillStyle = theme.textSub;
            ctx.font = `600 ${32 * scale}px 'Inter', sans-serif`;
            ctx.fillText(data.rankName || '', leftCenterX, leftY);
            leftY += 80 * scale;

            if (data.showPersonality !== false) {
                ctx.fillStyle = theme.accent;
                ctx.font = `700 ${42 * scale}px 'Space Grotesk', 'Inter', sans-serif`;
                ctx.fillText(data.personalityTitle || '', leftCenterX, leftY);
                leftY += 90 * scale;
            }

            if (data.topGenres && data.topGenres.length > 0) {
                const genresStr = data.topGenres.slice(0, 3).map(translateGenre).join(' • ');
                ctx.fillStyle = theme.textMuted;
                ctx.font = `700 ${24 * scale}px 'Inter', sans-serif`;
                ctx.fillText(genresStr, leftCenterX, leftY);
            }

            const hasPosters = data.posterImages && data.posterImages.length > 0;
            const statsData = [
                { icon: '⏱️', value: data.totalTime || '0h', label: data.lang === 'en' ? 'Screen Time' : 'Temps d\'écran' },
                { icon: '📺', value: String(data.episodes || 0), label: data.lang === 'en' ? 'Episodes' : 'Épisodes' },
                { icon: '🎬', value: String(data.moviesCount || 0), label: data.lang === 'en' ? 'Movies' : 'Films' },
                { icon: '🏆', value: String(data.seriesFinished || 0), label: data.lang === 'en' ? 'Finished' : 'Terminées' },
            ];

            const cardW = hasPosters ? 380 * scale : 450 * scale;
            const cardH = hasPosters ? 150 * scale : 200 * scale;
            const gap = hasPosters ? 24 * scale : 40 * scale;
            const rightStartX = rightCenterX - cardW - gap / 2;
            let rightY = hasPosters ? 160 * scale : (height - (cardH * 2 + gap)) / 2;

            for (let i = 0; i < 4; i++) {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const cx = rightStartX + col * (cardW + gap);
                const cy = rightY + row * (cardH + gap);

                drawRoundedRect(ctx, cx, cy, cardW, cardH, 24 * scale);
                ctx.fillStyle = theme.surface;
                ctx.fill();
                ctx.strokeStyle = theme.border;
                ctx.lineWidth = 2 * scale;
                ctx.stroke();

                ctx.font = `${hasPosters ? 42 : 56}px sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(statsData[i].icon, cx + 32 * scale, cy + (hasPosters ? 24 : 40) * scale);

                ctx.fillStyle = theme.text;
                ctx.font = `800 ${hasPosters ? 48 : 64}px 'Space Grotesk', 'Inter', sans-serif`;
                ctx.fillText(statsData[i].value, cx + (hasPosters ? 90 : 120) * scale, cy + (hasPosters ? 24 : 36) * scale);

                ctx.fillStyle = theme.textMuted;
                ctx.font = `600 ${hasPosters ? 22 : 28}px 'Inter', sans-serif`;
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(statsData[i].label, cx + 32 * scale, cy + cardH - (hasPosters ? 22 : 36) * scale);
            }

            // Posters (up to 10)
            if (hasPosters) {
                rightY += 2 * (cardH + gap) + 60 * scale;
                const maxPosters = Math.min(data.posterImages.length, 10);
                const isTwoRows = maxPosters > 5;
                const postersPerRow = isTwoRows ? Math.ceil(maxPosters / 2) : maxPosters; // For up to 5 per row
                
                const posterH = isTwoRows ? 250 * scale : 320 * scale;
                const posterW = posterH * 0.667;
                const posterGap = 20 * scale;
                
                // To properly center each row:
                for (let r = 0; r < (isTwoRows ? 2 : 1); r++) {
                    const rowPosters = r === 0 ? postersPerRow : maxPosters - postersPerRow;
                    if (rowPosters <= 0) continue;
                    
                    const totalW = rowPosters * posterW + (rowPosters - 1) * posterGap;
                    const startX = rightCenterX - totalW / 2;
                    
                    for (let c = 0; c < rowPosters; c++) {
                        const i = r * postersPerRow + c;
                        const img = data.posterImages[i];
                        if (img) {
                            const px = startX + c * (posterW + posterGap);
                            const py = rightY + r * (posterH + posterGap);

                            ctx.save();
                            drawRoundedRect(ctx, px, py, posterW, posterH, 16 * scale);
                            ctx.clip();
                            ctx.drawImage(img, px, py, posterW, posterH);
                            ctx.restore();

                            // Border
                            drawRoundedRect(ctx, px, py, posterW, posterH, 16 * scale);
                            ctx.strokeStyle = theme.border;
                            ctx.lineWidth = 3 * scale;
                            ctx.stroke();
                        }
                    }
                }
            }

            // ── WATERMARK ──
            ctx.textAlign = 'right';
            ctx.fillStyle = theme.textMuted;
            ctx.font = `500 ${18 * scale}px 'Inter', sans-serif`;
            ctx.textBaseline = 'alphabetic'; // Reset textBaseline from earlier
            ctx.fillText('dfwatch.dualsfwshield.be', width - 40 * scale, height - 30 * scale);

        */
        if (true) {
            // ═══ SQUARE 1:1 LAYOUT ═══

            // Left part: Avatar + Name
            const avatarSize = 160 * scale;
            curY = pad + 40 * scale;

            // Avatar
            const avatarX = pad + avatarSize / 2 + 20 * scale;
            const avatarY = curY + avatarSize / 2;

            // XP ring
            const ringRadius = avatarSize / 2 + 8 * scale;
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 4 * scale;
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            let ringColors = getRingColors(data.ringClass);
            if (data.customRing && data.customRing.colors && data.customRing.colors[0]) {
                ringColors = data.customRing.colors.filter(c => c);
            }
            const color1 = ringColors && ringColors.length > 0 ? ringColors[0] : theme.gradient1;
            const color2 = ringColors && ringColors.length > 1 ? ringColors[1] : (ringColors && ringColors.length > 0 ? ringColors[0] : theme.gradient2);
            
            const grd = ctx.createLinearGradient(avatarX - ringRadius, avatarY, avatarX + ringRadius, avatarY);
            grd.addColorStop(0, color1);
            grd.addColorStop(1, color2);
            ctx.strokeStyle = grd;
            ctx.lineWidth = 6 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (data.xpProgress || 0));
            ctx.stroke();
            ctx.lineCap = 'butt';

            // Avatar
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
            ctx.clip();
            if (data.avatarImg) {
                ctx.drawImage(data.avatarImg, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
            } else {
                const bgGrd = ctx.createLinearGradient(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
                bgGrd.addColorStop(0, theme.gradient1);
                bgGrd.addColorStop(1, theme.gradient2);
                ctx.fillStyle = bgGrd;
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${avatarSize * 0.4}px 'Inter', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(data.initials || '?', avatarX, avatarY);
            }
            ctx.restore();

            // Name + title next to avatar
            const textX = avatarX + avatarSize / 2 + 40 * scale;
            ctx.textAlign = 'left';
            ctx.fillStyle = theme.text;
            ctx.font = `800 ${52 * scale}px 'Space Grotesk', 'Inter', sans-serif`;
            ctx.fillText(data.name || 'User', textX, avatarY - 20 * scale);

            let lvlY = avatarY + 30 * scale;
            if (data.showPersonality !== false) {
                ctx.fillStyle = theme.accent;
                ctx.font = `700 ${28 * scale}px 'Space Grotesk', 'Inter', sans-serif`;
                ctx.fillText(data.personalityTitle || '', textX, avatarY + 24 * scale);
                lvlY = avatarY + 64 * scale;

                if (data.personalityDesc) {
                    ctx.fillStyle = theme.textMuted;
                    ctx.font = `500 ${18 * scale}px 'Inter', sans-serif`;
                    ctx.fillText(data.personalityDesc, textX, avatarY + 54 * scale);
                    lvlY = avatarY + 94 * scale;
                }
            }

            // Level badge
            const formattedXp = (data.xp || 0).toLocaleString(data.lang === 'en' ? 'en-US' : 'fr-FR');
            const badgeH = 28 * scale;
            const badgeY = lvlY - 20 * scale;
            
            // Draw XP Badge
            const xpText = `${formattedXp} XP`;
            ctx.font = `800 ${14 * scale}px 'Inter', sans-serif`;
            const xpTextWidth = ctx.measureText(xpText).width;
            const xpBadgeW = xpTextWidth + 24 * scale;
            
            const xpGrd = ctx.createLinearGradient(textX, badgeY, textX + xpBadgeW, badgeY);
            xpGrd.addColorStop(0, '#8b5cf6');
            xpGrd.addColorStop(1, '#7c3aed');
            
            ctx.fillStyle = xpGrd;
            ctx.beginPath();
            ctx.roundRect(textX, badgeY, xpBadgeW, badgeH, 14 * scale);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.fillText(xpText, textX + 12 * scale, badgeY + 19 * scale);
            
            // Draw Rank Badge
            if (data.rankName) {
                const badgeText = `${data.rankIcon || ''} ${data.rankName}`.trim();
                const badgeTextWidth = ctx.measureText(badgeText).width;
                
                const badgeX = textX + xpBadgeW + 12 * scale;
                const badgeW = badgeTextWidth + 24 * scale;
                
                let badgeColors = getRingColors(data.ringClass);
                if (data.customBadge && data.customBadge.colors && data.customBadge.colors[0]) {
                    badgeColors = data.customBadge.colors.filter(c => c);
                }
                const bColor1 = badgeColors && badgeColors.length > 0 ? badgeColors[0] : theme.gradient1;
                const bColor2 = badgeColors && badgeColors.length > 1 ? badgeColors[1] : (badgeColors && badgeColors.length > 0 ? badgeColors[0] : theme.gradient2);
                
                const bGrd = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
                bGrd.addColorStop(0, bColor1);
                bGrd.addColorStop(1, bColor2);
                
                // Outer rect (Gradient border)
                ctx.fillStyle = bGrd;
                ctx.beginPath();
                ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14 * scale);
                ctx.fill();
                
                // Inner rect (Dark background)
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.roundRect(badgeX + 2 * scale, badgeY + 2 * scale, badgeW - 4 * scale, badgeH - 4 * scale, 12 * scale);
                ctx.fill();
                
                // Text
                ctx.fillStyle = '#fff';
                ctx.fillText(badgeText, badgeX + 12 * scale, badgeY + 19 * scale);
            }

            curY += avatarSize + 80 * scale;

            // Stats row
            const statsData = [
                { icon: '⏱️', value: data.totalTime || '0h', label: data.lang === 'en' ? 'Watch Time' : 'Heures de visionnage' },
                { icon: '📺', value: String(data.episodes || 0), label: data.lang === 'en' ? 'Episodes Watched' : 'Épisodes vus' },
                { icon: '🎬', value: String(data.moviesCount || 0), label: data.lang === 'en' ? 'Movies Watched' : 'Films vus' },
                { icon: '🏆', value: String(data.seriesFinished || 0), label: data.lang === 'en' ? 'Series Completed' : 'Séries terminées' },
            ];

            const statW = (width - pad * 2 - 20 * scale) / 2;
            const statH = 120 * scale;
            for (let i = 0; i < 4; i++) {
                const col = i % 2;
                const row = Math.floor(i / 2);
                const sx = pad + col * (statW + 20 * scale);
                const sy = curY + row * (statH + 20 * scale);
                
                drawRoundedRect(ctx, sx, sy, statW, statH, 16 * scale);
                ctx.fillStyle = theme.surface;
                ctx.fill();
                ctx.strokeStyle = theme.border;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Calculate center positions
                ctx.font = `800 ${40 * scale}px 'Space Grotesk', sans-serif`;
                const valWidth = ctx.measureText(statsData[i].value).width;
                const iconWidth = 52 * scale; // Increased to give a nice space after emoji
                const totalW = iconWidth + valWidth;
                
                const startX = sx + statW / 2 - totalW / 2;
                const centerY = sy + 56 * scale;

                ctx.textAlign = 'left';
                ctx.font = `${32 * scale}px sans-serif`;
                // Adjust emoji baseline slightly
                ctx.fillText(statsData[i].icon, startX, centerY - 2 * scale);
                
                ctx.fillStyle = theme.text;
                ctx.font = `800 ${40 * scale}px 'Space Grotesk', sans-serif`;
                ctx.fillText(statsData[i].value, startX + iconWidth, centerY);
                
                ctx.textAlign = 'center';
                ctx.fillStyle = theme.textMuted;
                ctx.font = `600 ${20 * scale}px 'Inter', sans-serif`;
                ctx.fillText(statsData[i].label, sx + statW / 2, sy + 96 * scale);
            }
            curY += 2 * (statH + 20 * scale) + 20 * scale;

            // Genres
            if (data.topGenres && data.topGenres.length > 0) {
                ctx.textAlign = 'center';
                ctx.fillStyle = theme.textSub;
                ctx.font = `600 ${20 * scale}px 'Inter', sans-serif`;
                ctx.fillText(data.topGenres.slice(0, 5).map(translateGenre).join('  •  '), width / 2, curY);
                curY += 40 * scale;
            }

            // Posters
            if (data.posterImages && data.posterImages.length > 0) {
                const maxPosters = Math.min(data.posterImages.length, 10);
                const isTwoRows = maxPosters > 5;
                const postersPerRow = isTwoRows ? Math.ceil(maxPosters / 2) : maxPosters;
                
                const availableW = width - pad * 2;
                const posterGap = 16 * scale;
                let posterW = (availableW - (postersPerRow - 1) * posterGap) / postersPerRow;
                let posterH = posterW / 0.667;
                
                const maxAvailableH = height - curY - 60 * scale; // room for watermark
                const totalH = isTwoRows ? posterH * 2 + posterGap : posterH;
                if (totalH > maxAvailableH) {
                    posterH = isTwoRows ? (maxAvailableH - posterGap) / 2 : maxAvailableH;
                    posterW = posterH * 0.667;
                }
                
                for (let r = 0; r < (isTwoRows ? 2 : 1); r++) {
                    const rowPosters = r === 0 ? postersPerRow : maxPosters - postersPerRow;
                    if (rowPosters <= 0) continue;
                    
                    const totalW = rowPosters * posterW + (rowPosters - 1) * posterGap;
                    const startX = (width - totalW) / 2;
                    
                    for (let c = 0; c < rowPosters; c++) {
                        const i = r * postersPerRow + c;
                        const img = data.posterImages[i];
                        if (img) {
                            const px = startX + c * (posterW + posterGap);
                            const py = curY + r * (posterH + posterGap);

                            ctx.save();
                            drawRoundedRect(ctx, px, py, posterW, posterH, 10 * scale);
                            ctx.clip();
                            ctx.drawImage(img, px, py, posterW, posterH);
                            ctx.restore();
                            
                            drawRoundedRect(ctx, px, py, posterW, posterH, 10 * scale);
                            ctx.strokeStyle = theme.border;
                            ctx.lineWidth = 1.5;
                            ctx.stroke();
                        }
                    }
                }
            }

            // Watermark
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.textMuted;
            ctx.font = `500 ${13 * scale}px 'Inter', sans-serif`;
            ctx.fillText('dfwatch.dualsfwshield.be', width / 2, height - 24 * scale);

        }

        return canvas;
    }

    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════

    async function collectProfileData() {
        const firstName = localStorage.getItem('dfwatch_firstname') || '';
        const lastName = localStorage.getItem('dfwatch_lastname') || '';
        const name = (firstName + ' ' + lastName).trim() || 'User';
        const initials = (firstName ? firstName[0].toUpperCase() : '') + (lastName ? lastName[0].toUpperCase() : '');

        const seriesStats = await DB.getSeriesStats();
        const movieStats = await DB.getMovieStats();
        const totalMinutes = seriesStats.totalMinutes + movieStats.totalMinutes;
        const hours = Math.floor(totalMinutes / 60);

        const shows = await db.shows.where('is_followed').equals(1).toArray();
        const completedSeries = shows.filter(s => s.is_finished === 1).length;
        const movies = await db.movies.toArray();
        const watchedMovies = movies.filter(m => m.status === 'watched').length;

        // Flatten genres and consolidate using getGenreCategory
        const allShows = await db.shows.toArray();
        const allMovies = await db.movies.toArray();
        const allGenres = [...allShows, ...allMovies].flatMap(item => (item.genres || []).map(g => typeof g === 'string' ? g : (g ? g.name : null))).filter(Boolean);
        const genreTally = {};
        allGenres.forEach(g => {
            if (g === 'null') return;
            const baseCategory = getGenreCategory(g);
            if (baseCategory && baseCategory !== 'null') {
                genreTally[baseCategory] = (genreTally[baseCategory] || 0) + 1;
            }
        });
        const topGenres = Object.entries(genreTally)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        // Achievements
        let achievementCount = 0;
        try {
            const achievements = await db.achievements.toArray();
            achievementCount = achievements.filter(a => a.unlocked).length;
        } catch(e) {}

        const stats = {
            episodes: seriesStats.count,
            movies: watchedMovies,
            totalMinutes,
            totalHours: hours,
            achievements: achievementCount,
            shows: allShows.length,
            genreCount: topGenres.length,
            topGenres,
        };

        const xp = calculateXP(stats);
        const level = getLevel(xp);
        const xpForCurrent = getXPForLevel(level);
        const xpForNext = getXPForLevel(level + 1);
        const xpProgress = xpForNext > xpForCurrent ? (xp - xpForCurrent) / (xpForNext - xpForCurrent) : 1;
        const lang = (window.I18n && window.I18n.lang) || 'fr';
        const rankName = getRankName(level, lang, xp);
        const rank = getRank(level);
        let ringClass = localStorage.getItem('dfwatch_avatar_ring');
        if (!ringClass) {
            ringClass = rank.cssClass;
        }

        // Avatar
        let avatarImg = null;
        const customAvatar = localStorage.getItem('dfwatch_avatar_custom');
        if (customAvatar) {
            try {
                avatarImg = await loadImage(customAvatar);
            } catch(e) {}
        }

        // Top 10 posters
        const savedTop10 = JSON.parse(localStorage.getItem('dfwatch_top10') || '[]');
        const posterImages = [];
        for (const item of savedTop10.slice(0, 10)) {
            const isMovie = item.type === 'movie';
            const dbTable = isMovie ? db.movies : db.shows;
            const dbItem = await dbTable.where('tmdb_id').equals(item.tmdb_id).first();
            if (dbItem && dbItem.poster_path) {
                try {
                    const img = await loadImage(TMDB.imgUrl(dbItem.poster_path, 'w342'));
                    posterImages.push(img);
                } catch(e) {}
            }
        }

        return {
            name, initials,
            totalTime: hours > 0 ? `${hours}h` : '0h',
            episodes: seriesStats.count,
            moviesCount: watchedMovies,
            seriesFinished: completedSeries,
            level, xp, xpProgress,
            rankName,
            rankIcon: getRank(level).icon,
            topGenres: topGenres.slice(0, 5),
            posterImages,
            personalityTitle: getBestPersonality(stats, lang),
            lang,
            ringClass,
            customRing: JSON.parse(localStorage.getItem('dfwatch_custom_ring') || 'null'),
            customBadge: JSON.parse(localStorage.getItem('dfwatch_custom_badge') || 'null'),
            stats,
            avatarImg
        };
    }

    function getRingColors(ringClass) {
        switch (ringClass) {
            case 'ring-noob': return ['#9ca3af', '#6b7280'];
            case 'ring-amateur': return ['#10b981', '#059669'];
            case 'ring-passionne': return ['#3b82f6', '#2563eb'];
            case 'ring-cinephile': return ['#8b5cf6', '#7c3aed'];
            case 'ring-expert': return ['#ec4899', '#be185d'];
            case 'ring-maitre': return ['#ef4444', '#f97316'];
            case 'ring-legende': return ['#fbbf24', '#d97706'];
            case 'ring-mythe': return ['#ff0080', '#00dfd8'];
            case 'ring-hacker': return ['#00ff00', '#003300'];
            default: return null;
        }
    }

    async function generate(options = {}) {
        const data = await collectProfileData(options.personalityTitle, options.selectedPosters);
        if (options.showPersonality !== undefined) {
            data.showPersonality = options.showPersonality;
        }
        
        // Format and theme setup
        data.format = options.format || '9:16';
        data.theme = options.theme || 'void_neon';
        if (options.personalityTitle) data.personalityTitle = options.personalityTitle;
        if (options.personalityDesc !== undefined) data.personalityDesc = options.personalityDesc;
        if (options.selectedPosters) data.posterImages = options.selectedPosters;
        return renderCard(data);
    }

    function download(canvas, format) {
        const date = new Date().toISOString().slice(0, 10);
        const link = document.createElement('a');
        link.download = `dfwatch-profile-${format.replace(':', 'x')}-${date}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async function share(canvas) {
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'dfwatch-profile.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Mon profil DFWatch',
                    text: 'Découvrez mon profil de visionnage sur DFWatch !',
                });
                return true;
            }
        } catch(e) {
            if (e.name !== 'AbortError') console.warn('Share failed:', e);
        }
        return false;
    }

    return {
        calculateXP, getLevel, getXPForLevel, getRank, getRankName, XP_RANKS,
        generatePersonalitySuggestions, getBestPersonality,
        CARD_THEMES, CARD_FORMATS,
        collectProfileData, generate, download, share, loadImage,
        getGenreCategory, translateGenre
    };
})();

window.ProfileCard = ProfileCard;
