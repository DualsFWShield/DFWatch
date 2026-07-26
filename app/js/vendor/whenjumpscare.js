/**
 * whenjumpscare.js
 * ------------------------------------------------------------------
 * Module Node.js (ESM) pour récupérer, pour n'importe quel film TMDB,
 * la liste complète des jumpscares (timestamp, sévérité, description,
 * contributeur) depuis whenjumpscare.com.
 *
 * ⚠️ IMPORTANT — CORS
 * whenjumpscare.com ne renvoie pas d'en-têtes CORS pour les requêtes
 * cross-origin. Ce module doit donc être appelé côté SERVEUR
 * (route API Next.js, endpoint Express, fonction serverless...),
 * jamais directement depuis le JS exécuté dans le navigateur.
 * Ton frontend appelle ton backend, qui appelle ce module.
 *
 * ⚠️ FRAGILITÉ
 * Ce module parse du HTML/des internals Next.js non documentés.
 * Un changement de mise en page côté whenjumpscare.com peut casser
 * l'extraction. Le fallback JSON-LD (moins riche mais très stable,
 * car pensé pour le SEO) sert de filet de sécurité.
 *
 * Node >= 18 requis (fetch natif). Aucune dépendance externe.
 * ------------------------------------------------------------------
 */

const BASE_URL = "https://www.whenjumpscare.com";

/**
 * @typedef {Object} Jumpscare
 * @property {string} time         "HH:MM:SS"
 * @property {number} seconds      timestamp en secondes
 * @property {"major"|"minor"} severity
 * @property {string|null} description
 * @property {string|null} contributor
 *
 * @typedef {Object} JumpscareData
 * @property {number} movieId      TMDB id
 * @property {string|null} movieTitle
 * @property {number} total
 * @property {number} major
 * @property {number} minor
 * @property {Jumpscare[]} jumpscares
 * @property {"full"|"fallback"} source  "full" = données riches, "fallback" = JSON-LD seul
 */

/**
 * Récupère les jumpscares d'un film à partir de son TMDB id.
 *
 * @param {number|string} tmdbId
 * @param {Object} [options]
 * @param {string} [options.slug] Slug SEO optionnel (ex: "backrooms-2026").
 *   Pas obligatoire : whenjumpscare.com route uniquement sur l'id numérique
 *   en préfixe de l'URL, le reste du slug n'est que cosmétique/SEO.
 *   Le fournir quand tu l'as (ex: retrouvé via un lien) rend l'URL "propre"
 *   mais n'est pas nécessaire au fonctionnement.
 * @returns {Promise<JumpscareData>}
 */
export async function getJumpscares(tmdbId, options = {}) {
  const { slug = "" } = options;
  const path = slug ? `/movie/${tmdbId}-${slug}` : `/movie/${tmdbId}`;
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      // Un User-Agent "normal" évite d'être traité comme un bot basique.
      "User-Agent":
        "Mozilla/5.0 (compatible; MyApp/1.0; +https://example.com)",
      Accept: "text/html",
    },
  });

  if (res.status === 404) {
    throw new Error(
      `WhenJumpScare: aucune page trouvée pour le TMDB id ${tmdbId} (${url}). ` +
        `Le film n'est peut-être pas encore référencé sur le site.`
    );
  }
  if (!res.ok) {
    throw new Error(`WhenJumpScare: HTTP ${res.status} pour ${url}`);
  }

  const html = await res.text();
  return parseJumpscareHtml(html, Number(tmdbId));
}

/**
 * Parse le HTML brut d'une page film whenjumpscare.com.
 * Exposé séparément pour pouvoir être testé/réutilisé si tu as déjà le HTML
 * (ex: récupéré via un cache, un proxy, etc.)
 *
 * @param {string} html
 * @param {number} tmdbId
 * @returns {JumpscareData}
 */
export function parseJumpscareHtml(html, tmdbId) {
  const full = extractNextFlightText(html);

  // Le payload riche ressemble à:
  // "jumpscares":[{...}],"movieTitle":"Backrooms","movieId":1083381
  const dataRe =
    /"jumpscares":(\[.*?\]),"movieTitle":"((?:[^"\\]|\\.)*)","movieId":(\d+)/s;
  const match = dataRe.exec(full);

  if (match) {
    const jumpscares = JSON.parse(match[1]);
    const movieTitle = JSON.parse(`"${match[2]}"`);
    const movieId = Number(match[3]);
    return summarize(jumpscares, movieTitle, movieId, "full");
  }

  // Fallback: JSON-LD ItemList (toujours présent pour le SEO, mais
  // sans description ni contributeur — juste timestamp + sévérité).
  return parseFromJsonLd(html, tmdbId);
}

// ------------------------------------------------------------------
// Internes
// ------------------------------------------------------------------

/**
 * Extrait et recolle tout le texte des chunks Next.js React Flight
 * (`self.__next_f.push([1, "..."])`) embarqués dans le HTML SSR.
 * C'est là que vivent les données réellement utilisées pour hydrater
 * les composants React (donc les données "riches").
 */
function extractNextFlightText(html) {
  const pushRe = /self\.__next_f\.push\(\[1,\s*(".*?")\]\)/gs;
  const parts = [];
  let m;
  while ((m = pushRe.exec(html)) !== null) {
    try {
      parts.push(JSON.parse(m[1]));
    } catch {
      // chunk malformé ou non pertinent : on l'ignore
    }
  }
  return parts.join("");
}

function parseFromJsonLd(html, tmdbId) {
  const ldRe =
    /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs;
  let m;
  while ((m = ldRe.exec(html)) !== null) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (data && data["@type"] === "ItemList" && Array.isArray(data.itemListElement)) {
      const itemRe = /(Minor|Major)\s+jumpscare\s+at\s+(\d{2}:\d{2}:\d{2})/i;
      const jumpscares = data.itemListElement
        .map((item) => {
          const im = itemRe.exec(item.name || "");
          if (!im) return null;
          return {
            t: im[2],
            severity: im[1].toLowerCase(),
            desc: null,
            contributor: null,
          };
        })
        .filter(Boolean);
      return summarize(jumpscares, null, Number(tmdbId), "fallback");
    }
  }
  throw new Error(
    `WhenJumpScare: impossible de trouver des données de jumpscares dans la page (id ${tmdbId}).`
  );
}

function summarize(rawJumpscares, movieTitle, movieId, source) {
  const jumpscares = rawJumpscares
    .map((j) => ({
      time: j.t,
      seconds: hmsToSeconds(j.t),
      severity: j.severity,
      description: (j.desc ?? "").trim() || null,
      contributor: j.contributor || null,
    }))
    .sort((a, b) => a.seconds - b.seconds);

  const major = jumpscares.filter((j) => j.severity === "major").length;
  const minor = jumpscares.filter((j) => j.severity === "minor").length;

  return {
    movieId,
    movieTitle,
    total: jumpscares.length,
    major,
    minor,
    jumpscares,
    source,
  };
}

function hmsToSeconds(hms) {
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

// ------------------------------------------------------------------
// Bonus : génération d'un fichier .srt d'avertissement à partir du
// résultat de getJumpscares(), même format que le générateur .srt
// officiel du site (avertissement 5s avant, jusqu'à 1s avant).
// ------------------------------------------------------------------

/**
 * @param {JumpscareData} data
 * @param {Object} [options]
 * @param {number} [options.lead=5]
 * @param {number} [options.endGap=1]
 * @returns {string} contenu .srt
 */
export function toSrt(data, options = {}) {
  const { lead = 5, endGap = 1 } = options;
  const lines = [];
  data.jumpscares.forEach((j, i) => {
    const start = Math.max(0, j.seconds - lead);
    const end = Math.max(0, j.seconds - endGap);
    const label =
      j.severity === "major"
        ? `🛑 MAJOR jumpscare approaching at ${j.time}`
        : `⚠️ Minor jumpscare approaching at ${j.time}`;
    lines.push(String(i + 1));
    lines.push(`${secondsToSrtTime(start)} --> ${secondsToSrtTime(end)}`);
    lines.push(label);
    lines.push("");
  });
  return lines.join("\n");
}

function secondsToSrtTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},000`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}
