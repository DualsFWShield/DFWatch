/**
 * notscare.js
 * Client API pour notscare.me (jump scares, avertissements de contenu & signalements)
 */
(function (root) {
    'use strict';

    const _cache = new Map();
    const CACHE_TTL = 10 * 60 * 1000;

    function safeStorageGet(key) {
        if (typeof localStorage === 'undefined') return '';
        try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
    }

    const NotScare = {
        get BASE_URL() {
            const raw = safeStorageGet('custom_notscare_api_url') || 'https://notscare.me/api/v1';
            return raw.replace(/\/+$/, '');
        },
        get API_KEY() {
            return safeStorageGet('custom_notscare_api_key');
        },

        async _fetch(endpoint, options = {}) {
            const method = (options.method || 'GET').toUpperCase();
            const headers = {
                'Accept': 'application/json',
                ...(options.headers || {})
            };
            if (method !== 'GET' && method !== 'HEAD') {
                headers['Content-Type'] = 'application/json';
            }
            if (this.API_KEY) {
                headers['Authorization'] = `Bearer ${this.API_KEY}`;
            }

            const url = `${this.BASE_URL}${endpoint}`;
            if (method === 'GET' && _cache.has(url)) {
                const hit = _cache.get(url);
                if (Date.now() - hit.ts < CACHE_TTL) return hit.data;
                _cache.delete(url);
            }

            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;

            try {
                const res = await fetch(url, {
                    ...options,
                    method,
                    headers,
                    signal: controller ? controller.signal : undefined
                });
                if (timer) clearTimeout(timer);
                if (res.status === 204) return {};
                if (!res.ok) return null;
                const data = await res.json();
                if (method === 'GET' && data) {
                    _cache.set(url, { data, ts: Date.now() });
                }
                return data;
            } catch (e) {
                if (timer) clearTimeout(timer);
                return null;
            }
        },

        async search(query) {
            if (!query || query.trim().length < 2) return [];
            const data = await this._fetch(`/search?q=${encodeURIComponent(query.trim())}`);
            return data && Array.isArray(data.results) ? data.results : [];
        },

        async getMediaDetails(tmdbId, type = 'movie') {
            if (!tmdbId) return null;
            const safeType = type === 'tv' ? 'tv' : 'movie';
            return this._fetch(`/media/tmdb/${encodeURIComponent(tmdbId)}?type=${encodeURIComponent(safeType)}`);
        },

        async getJumpscares(tmdbId, type = 'movie', season = null, episode = null) {
            if (!tmdbId) return [];
            const safeType = type === 'tv' ? 'tv' : 'movie';
            const idStr = encodeURIComponent(tmdbId);
            let endpoint = `/media/tmdb/${idStr}/jumpscares?type=${encodeURIComponent(safeType)}`;

            if (safeType === 'tv' && season !== null && season !== undefined && episode !== null && episode !== undefined) {
                endpoint = `/media/tmdb/${idStr}/season/${encodeURIComponent(season)}/episode/${encodeURIComponent(episode)}/jumpscares`;
            }

            const data = await this._fetch(endpoint);
            return data && Array.isArray(data.jumpscares) ? data.jumpscares : [];
        },

        async getTriggers(tmdbId, type = 'movie') {
            if (!tmdbId) return [];
            const safeType = type === 'tv' ? 'tv' : 'movie';
            const data = await this._fetch(`/media/tmdb/${encodeURIComponent(tmdbId)}/triggers?type=${encodeURIComponent(safeType)}`);
            return data && Array.isArray(data.triggers) ? data.triggers : [];
        },

        async reportJumpscare(reportData) {
            if (!reportData || !reportData.tmdbId || reportData.timestamp === undefined || reportData.timestamp === null || reportData.timestamp === '' || !reportData.intensity) {
                return null;
            }
            const validIntensities = ['minor', 'major'];
            if (!validIntensities.includes(reportData.intensity)) {
                return null;
            }
            const payload = {
                ...reportData,
                type: reportData.type === 'tv' ? 'tv' : 'movie'
            };
            return this._fetch('/jumpscares/report', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NotScare;
    } else {
        root.NotScare = NotScare;
        root.NoScare = NotScare;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
