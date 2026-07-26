/**
 * notscare.js
 * Client API pour exploiter la future API de notscare.me (ou noscare.me)
 * Permet de récupérer les jump scares, les avertissements de contenu (triggers) et d'envoyer des signalements.
 */

const NotScare = {
    // Configurable via localStorage pour correspondre aux besoins de développement local ou production
    get BASE_URL() { 
        return localStorage.getItem('custom_notscare_api_url') || 'https://notscare.me/api/v1'; 
    },
    get API_KEY() { 
        return localStorage.getItem('custom_notscare_api_key') || ''; 
    },

    /**
     * Effectue une requête HTTP vers l'API de NotScare
     * @private
     */
    async _fetch(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };
        
        if (this.API_KEY) {
            headers['Authorization'] = `Bearer ${this.API_KEY}`;
        }

        const url = `${this.BASE_URL}${endpoint}`;
        try {
            const res = await fetch(url, { ...options, headers });
            if (!res.ok) {
                console.warn(`[NotScare API] Erreur ${res.status}: ${res.statusText}`);
                return null;
            }
            return await res.json();
        } catch (e) {
            console.error('[NotScare API] Erreur réseau ou de parsing:', e);
            return null;
        }
    },

    /**
     * Recherche une œuvre (film ou série) dans la base NotScare
     * @param {string} query - Titre de l'œuvre recherchée
     * @returns {Promise<Array>} Liste des résultats trouvés
     */
    async search(query) {
        if (!query || query.trim().length < 2) return [];
        const data = await this._fetch(`/search?q=${encodeURIComponent(query.trim())}`);
        return data ? data.results || [] : [];
    },

    /**
     * Récupère la fiche NotScare complète d'une œuvre par son ID TMDB
     * Inclut le score de peur général, le nombre de jumpscares, etc.
     * @param {string|number} tmdbId - ID unique TMDB
     * @param {'movie'|'tv'} type - Type d'œuvre ('movie' ou 'tv')
     * @returns {Promise<Object|null>} Fiche de l'œuvre
     */
    async getMediaDetails(tmdbId, type) {
        if (!tmdbId) return null;
        return this._fetch(`/media/tmdb/${tmdbId}?type=${type}`);
    },

    /**
     * Récupère la liste chronologique des jump scares d'un film ou d'un épisode spécifique
     * @param {string|number} tmdbId - ID unique TMDB de l'œuvre
     * @param {'movie'|'tv'} type - Type d'œuvre
     * @param {number} [season] - Numéro de la saison (si TV)
     * @param {number} [episode] - Numéro de l'épisode (si TV)
     * @returns {Promise<Array>} Liste des jump scares avec minutages
     */
    async getJumpscares(tmdbId, type, season = null, episode = null) {
        if (!tmdbId) return [];
        let endpoint = `/media/tmdb/${tmdbId}/jumpscares?type=${type}`;
        
        if (type === 'tv' && season !== null && episode !== null) {
            endpoint = `/media/tmdb/${tmdbId}/season/${season}/episode/${episode}/jumpscares`;
        }
        
        const data = await this._fetch(endpoint);
        return data ? data.jumpscares || [] : [];
    },

    /**
     * Récupère les avertissements de contenu (flashing lights, gore, violence...)
     * @param {string|number} tmdbId - ID TMDB de l'œuvre
     * @param {'movie'|'tv'} type - Type d'œuvre
     * @returns {Promise<Array>} Liste des avertissements (triggers)
     */
    async getTriggers(tmdbId, type) {
        if (!tmdbId) return [];
        const data = await this._fetch(`/media/tmdb/${tmdbId}/triggers?type=${type}`);
        return data ? data.triggers || [] : [];
    },

    /**
     * Signale un nouveau jump scare (ou trigger) pour une œuvre
     * @param {Object} reportData - Données du signalement
     * @param {string|number} reportData.tmdbId - ID TMDB de l'œuvre
     * @param {'movie'|'tv'} reportData.type - Type d'œuvre
     * @param {number} [reportData.season] - Saison (si TV)
     * @param {number} [reportData.episode] - Épisode (si TV)
     * @param {string|number} reportData.timestamp - Minutage du jump scare (ex: "01:23:45" ou secondes)
     * @param {'minor'|'major'} reportData.intensity - Intensité du sursaut ('minor' ou 'major')
     * @param {string} [reportData.description] - Description contextuelle (ex: "Le monstre surgit du placard")
     * @returns {Promise<Object|null>} Réponse du serveur NotScare
     */
    async reportJumpscare(reportData) {
        if (!reportData || !reportData.tmdbId || !reportData.timestamp || !reportData.intensity) {
            console.error('[NotScare API] Paramètres de signalement manquants.');
            return null;
        }
        return this._fetch('/jumpscares/report', {
            method: 'POST',
            body: JSON.stringify(reportData)
        });
    }
};

// Exportation globale pour y accéder dans l'application principale
window.NotScare = NotScare;
window.NoScare = NotScare; // Alias pratique si écrit "noscare" ou "notscare"
