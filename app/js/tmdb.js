// tmdb.js — Dual API Service: TMDB (primary) + TheTVDB (fallback)

// ========== TMDB API v3 ==========
const _TMDB = {
    API_KEY: '0c634de3bcc68012ef07b6be118b1d8a',
    BASE: 'https://api.themoviedb.org/3',
    IMG: 'https://image.tmdb.org/t/p',
    LANG: 'fr-FR',

    imgUrl(path, size = 'w500') {
        if (!path) return null;
        if (path.startsWith('http')) return path; // already a full URL (from TVDB)
        return `${this.IMG}/${size}${path}`;
    },

    backdropUrl(path) {
        return this.imgUrl(path, 'w1280');
    },

    async _fetch(endpoint) {
        const sep = endpoint.includes('?') ? '&' : '?';
        const url = `${this.BASE}${endpoint}${sep}api_key=${this.API_KEY}&language=${this.LANG}`;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            return res.json();
        } catch (e) { return null; }
    },

    async search(query, type = 'multi') {
        if (!query || query.length < 2) return [];
        const data = await this._fetch(`/search/${type}?query=${encodeURIComponent(query)}&page=1`);
        return data ? (data.results || []).slice(0, 20) : [];
    },

    async getTrending(type = 'all', window = 'week') {
        const data = await this._fetch(`/trending/${type}/${window}`);
        return data ? (data.results || []).slice(0, 20) : [];
    },

    async getShowDetails(id) { return this._fetch(`/tv/${id}?append_to_response=credits,videos`); },
    async getMovieDetails(id) { return this._fetch(`/movie/${id}?append_to_response=credits,videos`); },
    async getSeasonDetails(id, season) { return this._fetch(`/tv/${id}/season/${season}`); },

    async getRecommendations(id, type = 'movie') {
        const data = await this._fetch(`/${type}/${id}/recommendations`);
        return data ? (data.results || []).slice(0, 10) : [];
    },

    async findShowByName(name) {
        const r = await this.search(name, 'tv');
        return r.length > 0 ? r[0] : null;
    },
    async findMovieByName(name) {
        const r = await this.search(name, 'movie');
        return r.length > 0 ? r[0] : null;
    }
};

// ========== TheTVDB API v4 ==========
const _TVDB = {
    API_KEY: '3774d8ec-9644-493a-921a-648f3400d655',
    BASE: 'https://api4.thetvdb.com/v4',
    _token: null,
    _tokenExpiry: 0,

    async _ensureToken() {
        if (this._token && Date.now() < this._tokenExpiry) return this._token;
        const cached = localStorage.getItem('tvdb_token');
        const cachedExp = parseInt(localStorage.getItem('tvdb_token_exp') || '0');
        if (cached && Date.now() < cachedExp) {
            this._token = cached;
            this._tokenExpiry = cachedExp;
            return this._token;
        }
        try {
            const res = await fetch(`${this.BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apikey: this.API_KEY })
            });
            if (!res.ok) return null;
            const data = await res.json();
            this._token = data.data.token;
            this._tokenExpiry = Date.now() + 25 * 24 * 3600 * 1000;
            localStorage.setItem('tvdb_token', this._token);
            localStorage.setItem('tvdb_token_exp', String(this._tokenExpiry));
            return this._token;
        } catch (e) { return null; }
    },

    async _fetch(path) {
        const token = await this._ensureToken();
        if (!token) return null;
        try {
            const res = await fetch(`${this.BASE}${path}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                this._token = null;
                localStorage.removeItem('tvdb_token');
                return null;
            }
            if (!res.ok) return null;
            return res.json();
        } catch (e) { return null; }
    },

    // Normalize TVDB search result → same shape as TMDB
    _norm(item) {
        return {
            id: parseInt(item.tvdb_id || item.id) || 0,
            name: item.name || '',
            title: item.name || '',
            overview: item.overview || item.overviews?.fra || item.overviews?.eng || '',
            poster_path: item.image_url || item.thumbnail || null,
            backdrop_path: null,
            first_air_date: item.year ? `${item.year}-01-01` : '',
            release_date: item.year ? `${item.year}-01-01` : '',
            media_type: item.type === 'series' ? 'tv' : (item.type === 'movie' ? 'movie' : item.type),
            _source: 'tvdb'
        };
    },

    async search(query, type = null) {
        if (!query || query.length < 2) return [];
        let path = `/search?query=${encodeURIComponent(query)}&limit=20`;
        if (type) path += `&type=${type}`;
        const data = await this._fetch(path);
        return data?.data ? data.data.map(i => this._norm(i)) : [];
    },

    async getShowDetails(id) {
        const data = await this._fetch(`/series/${id}/extended?meta=episodes&short=true`);
        if (!data?.data) return null;
        const s = data.data;
        return {
            id: s.id, name: s.name, overview: s.overview || '',
            poster_path: s.image || null,
            backdrop_path: s.artworks?.find(a => a.type === 3)?.image || null,
            first_air_date: s.firstAired || '',
            genres: (s.genres || []).map(g => ({ name: g.name })),
            number_of_episodes: s.episodes?.length || 0,
            seasons: (s.seasons || []).filter(se => se.type?.type === 'official').map(se => ({
                season_number: se.number, name: se.name || `Saison ${se.number}`, id: se.id
            })),
            _episodes: s.episodes || [], _source: 'tvdb'
        };
    },

    async getSeasonDetails(id, seasonNum) {
        const data = await this._fetch(`/series/${id}/episodes/official?season=${seasonNum}`);
        if (data?.data?.episodes) {
            return {
                episodes: data.data.episodes.map(ep => ({
                    episode_number: ep.number, name: ep.name || `Épisode ${ep.number}`,
                    runtime: ep.runtime || 0, id: ep.id
                }))
            };
        }
        // Fallback: get from extended
        const show = await this.getShowDetails(id);
        if (!show?._episodes) return { episodes: [] };
        return {
            episodes: show._episodes
                .filter(ep => ep.seasonNumber === seasonNum)
                .sort((a, b) => a.number - b.number)
                .map(ep => ({
                    episode_number: ep.number, name: ep.name || `Épisode ${ep.number}`,
                    runtime: ep.runtime || 0, id: ep.id
                }))
        };
    },

    async getMovieDetails(id) {
        const data = await this._fetch(`/movies/${id}/extended`);
        if (!data?.data) return null;
        const m = data.data;
        return {
            id: m.id, title: m.name, name: m.name, overview: m.overview || '',
            poster_path: m.image || null, backdrop_path: null,
            release_date: m.firstRelease?.date || '',
            runtime: m.runtime || 0,
            genres: (m.genres || []).map(g => ({ name: g.name })),
            _source: 'tvdb'
        };
    },

    async findShowByName(name) {
        const r = await this.search(name, 'series');
        return r.length > 0 ? r[0] : null;
    },
    async findMovieByName(name) {
        const r = await this.search(name, 'movie');
        return r.length > 0 ? r[0] : null;
    }
};

// ========== UNIFIED API — TMDB first, TheTVDB fallback ==========
const TMDB = {
    imgUrl(path, size) {
        return _TMDB.imgUrl(path, size);
    },

    backdropUrl(path) {
        return _TMDB.backdropUrl(path);
    },

    async getTrending(type = 'all') {
        return _TMDB.getTrending(type);
    },

    async search(query, type = 'multi') {
        // Try TMDB first
        let results = await _TMDB.search(query, type);
        if (results && results.length > 0) return results;
        // Fallback to TheTVDB
        console.log('TMDB returned nothing, falling back to TheTVDB');
        const tvdbType = type === 'tv' ? 'series' : (type === 'movie' ? 'movie' : null);
        return _TVDB.search(query, tvdbType);
    },

    async getShowDetails(id) {
        if (!id || id === 'null') return null;
        const tmdb = await _TMDB.getShowDetails(id);
        if (tmdb) return tmdb;
        console.log('TMDB show details failed, trying TheTVDB');
        return _TVDB.getShowDetails(id);
    },

    async getMovieDetails(id) {
        if (!id || id === 'null') return null;
        const tmdb = await _TMDB.getMovieDetails(id);
        if (tmdb) return tmdb;
        console.log('TMDB movie details failed, trying TheTVDB');
        return _TVDB.getMovieDetails(id);
    },

    async getSeasonDetails(showId, seasonNumber) {
        if (!showId || showId === 'null') return null;
        const tmdb = await _TMDB.getSeasonDetails(showId, seasonNumber);
        if (tmdb) return tmdb;
        console.log('TMDB season details failed, trying TheTVDB');
        return _TVDB.getSeasonDetails(showId, seasonNumber);
    },

    async getRecommendations(id, type = 'movie') {
        return _TMDB.getRecommendations(id, type);
    },

    async findShowByName(name) {
        const tmdb = await _TMDB.findShowByName(name);
        if (tmdb) return tmdb;
        return _TVDB.findShowByName(name);
    },

    async findMovieByName(name) {
        const tmdb = await _TMDB.findMovieByName(name);
        if (tmdb) return tmdb;
        return _TVDB.findMovieByName(name);
    }
};
