// i18n.js - Simple Translation Engine

const TRANSLATIONS = {
    fr: {
        "nav.series": "Séries",
        "nav.movies": "Films",
        "nav.stats": "Stats",
        "nav.profile": "Profil",
        
        "series.watching": "À voir",
        "series.finished": "Terminées",
        "series.upcoming": "À venir",
        "series.search": "Chercher une série...",
        "series.empty_watching": "Aucune série en cours",
        "series.empty_finished": "Aucune série terminée",
        "series.empty_upcoming": "Rien à venir",
        
        "movies.watchlist": "À voir",
        "movies.watched": "Vus",
        "movies.upcoming": "À venir",
        "movies.search": "Chercher un film...",
        "movies.empty_watchlist": "Rien à voir",
        "movies.empty_watched": "Aucun film vu",
        "movies.empty_upcoming": "Rien à venir",
        
        "stats.title": "Stats & Succès",
        "stats.achievements": "Succès",
        "stats.all_achievements": "Tous les succès",
        
        "profile.title": "Mon Profil",
        "profile.top10": "Mon Top 10",
        "profile.theme": "Thème visuel",
        "profile.system": "Système & Données",
        "profile.format": "Format d'import",
        "profile.drop": "Glissez vos fichiers (CSV ou JSON) ici ou <strong>cliquez</strong>",
        "profile.import": "Importer",
        "profile.export": "Exporter",
        "profile.danger": "Zone Dangereuse",
        "profile.clear": "Effacer toutes les données",
        
        "profile.taste_title": "Tendances & Goûts",
        "profile.taste_desc": "Vous êtes un grand fan de <span style='color:var(--cyan-400)'>{top}</span>.",
        "profile.taste_empty": "Continuez à utiliser l'application pour découvrir vos genres favoris ! (Les genres sont mis à jour en tâche de fond)",
        "profile.titles_count": "{count} titre(s)",
        
        "modal.edit_profile": "Éditer mon profil",
        "modal.firstname": "Prénom",
        "modal.lastname": "Nom",
        "modal.age": "Âge",
        "modal.favorite_genres": "Genres Favoris (Hero)",
        "modal.top10": "Mon Top 10",
        "modal.save": "Enregistrer le Profil",
        
        "toast.seen": "{name} vu ✓",
        "toast.not_found": "Non trouvé sur TMDB",
        "toast.export": "Export téléchargé !",
        "toast.import": "Import réussi !",
        "toast.profile_saved": "Profil enregistré avec succès !"
    },
    en: {
        "nav.series": "Shows",
        "nav.movies": "Movies",
        "nav.stats": "Stats",
        "nav.profile": "Profile",
        
        "series.watching": "Watching",
        "series.finished": "Finished",
        "series.upcoming": "Upcoming",
        "series.search": "Search a show...",
        "series.empty_watching": "No shows currently",
        "series.empty_finished": "No finished shows",
        "series.empty_upcoming": "Nothing upcoming",
        
        "movies.watchlist": "Watchlist",
        "movies.watched": "Watched",
        "movies.upcoming": "Upcoming",
        "movies.search": "Search a movie...",
        "movies.empty_watchlist": "Watchlist empty",
        "movies.empty_watched": "No watched movies",
        "movies.empty_upcoming": "Nothing upcoming",
        
        "stats.title": "Stats & Achievements",
        "stats.achievements": "Achievements",
        "stats.all_achievements": "All achievements",
        
        "profile.title": "My Profile",
        "profile.top10": "My Top 10",
        "profile.series_followed": "Followed Shows",
        "profile.theme": "Visual Theme",
        "profile.system": "System & Data",
        "profile.format": "Import Format",
        "profile.drop": "Drop files (CSV or JSON) here or <strong>click</strong>",
        "profile.import": "Import",
        "profile.export": "Export",
        "profile.danger": "Danger Zone",
        "profile.clear": "Clear all data",
        
        "profile.taste_title": "Watching Tendency & Taste",
        "profile.taste_desc": "You are a huge fan of <span style='color:var(--cyan-400)'>{top}</span>.",
        "profile.taste_empty": "Keep using the app to discover your favorite genres! (Genres update in background)",
        "profile.titles_count": "{count} title(s)",
        
        "modal.edit_profile": "Edit my profile",
        "modal.firstname": "First Name",
        "modal.lastname": "Last Name",
        "modal.age": "Age",
        "modal.favorite_genres": "Favorite Genres (Hero)",
        "modal.top10": "My Top 10",
        "modal.save": "Save Profile",
        
        "toast.seen": "{name} watched ✓",
        "toast.not_found": "Not found on TMDB",
        "toast.export": "Export downloaded!",
        "toast.import": "Import successful!",
        "toast.profile_saved": "Profile saved successfully!"
    }
};

const I18n = {
    lang: 'fr',
    
    init() {
        this.lang = localStorage.getItem('dfwatch_lang') || 'fr';
        this.apply();
    },
    
    setLang(l) {
        if (TRANSLATIONS[l]) {
            this.lang = l;
            localStorage.setItem('dfwatch_lang', l);
            this.apply();
        }
    },
    
    get(key, params = {}) {
        let text = TRANSLATIONS[this.lang][key] || key;
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(`{${k}}`, v);
        }
        return text;
    },
    
    apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (TRANSLATIONS[this.lang][key]) {
                if (el.tagName === 'INPUT' && el.type === 'text') {
                    el.placeholder = TRANSLATIONS[this.lang][key];
                } else {
                    el.innerHTML = TRANSLATIONS[this.lang][key];
                }
            }
        });
        
        // Dispatch event for other scripts
        window.dispatchEvent(new Event('i18n_changed'));
    }
};

window.I18n = I18n;
