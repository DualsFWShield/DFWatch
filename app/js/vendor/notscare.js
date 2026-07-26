/**
 * notscare.js
 * ------------------------------------------------------------------
 * Module Node.js (ESM) pour récupérer, depuis notscare.me, les données
 * complètes d'un film : jumpscares (timestamp, sévérité, description),
 * fear metrics (note, intensité, "watchability"), trigger warnings
 * détaillés, casting, et données pour reconstruire ta propre timeline.
 *
 * ⚠️ IMPORTANT — texte anti-scraping
 * Le HTML rendu de notscare.me injecte volontairement un fragment
 * base64 aléatoire dans le texte visible des descriptions de jumpscare
 * (ex: "A bird c3RvbG flies into the room" au lieu de "A bird flies
 * into the room"). Ce module ne touche jamais à ce texte affiché :
 * il lit exclusivement les données JSON embarquées pour l'hydratation
 * React (self.__next_f.push), qui sont propres.
 *
 * ⚠️ CORS — à utiliser côté serveur (API route, endpoint...), jamais
 * depuis le navigateur du visiteur : notscare.me n'expose pas
 * d'en-têtes CORS pour les requêtes cross-origin.
 *
 * ⚠️ FRAGILITÉ — parsing de structures internes non documentées.
 * Un changement de bundler/mise en page peut casser l'extraction.
 *
 * ⚠️ PAS DE RÉSOLUTION PAR TMDB ID
 * Contrairement à whenjumpscare.com, l'URL notscare.me utilise un
 * slug texte (/movies/jump-scares-in-backrooms-2026) qui n'est pas
 * déductible du seul TMDB id. Utilise l'URL ou le slug complet
 * (trouvable via leur recherche, un lien partagé, ou ta propre base
 * si tu stockes déjà movie.tmdbId <-> slug après un premier fetch).
 *
 * Node >= 18 requis (fetch natif). Aucune dépendance externe.
 * ------------------------------------------------------------------
 */

const BASE_URL = "https://notscare.me";

/**
 * Récupère toutes les données d'un film à partir de son slug ou de
 * son URL complète notscare.me.
 *
 * @param {string} slugOrUrl  ex: "jump-scares-in-backrooms-2026"
 *   ou "https://notscare.me/movies/jump-scares-in-backrooms-2026"
 * @returns {Promise<MovieJumpscareData>}
 */
export async function getMovieData(slugOrUrl) {
  const url = slugOrUrl.startsWith("http")
    ? slugOrUrl
    : `${BASE_URL}/movies/${slugOrUrl}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MyApp/1.0; +https://example.com)",
      Accept: "text/html",
    },
  });

  if (res.status === 404) {
    throw new Error(`NotScare: page introuvable (${url}).`);
  }
  if (!res.ok) {
    throw new Error(`NotScare: HTTP ${res.status} pour ${url}`);
  }

  const html = await res.text();
  return parseMovieHtml(html);
}

/**
 * Parse le HTML brut d'une page film notscare.me.
 * @param {string} html
 * @returns {MovieJumpscareData}
 */
export function parseMovieHtml(html) {
  const full = extractNextFlightText(html);

  const anchor = '{"initialMovie":';
  const startIdx = full.indexOf(anchor);
  if (startIdx === -1) {
    throw new Error(
      "NotScare: impossible de trouver le bloc de données du film (structure du site a peut-être changé)."
    );
  }

  const jsonText = extractBalancedJson(full, startIdx);
  const raw = JSON.parse(jsonText);

  return buildResult(raw);
}

// ------------------------------------------------------------------
// Construction du résultat structuré
// ------------------------------------------------------------------

function buildResult(raw) {
  const m = raw.initialMovie ?? {};
  const fm = raw.fearMetrics ?? {};

  const jumpscares = (raw.initialJumpscares ?? [])
    .map((j) => ({
      seconds: j.timestamp,
      time: secondsToHms(j.timestamp),
      severity: (j.type || "").toLowerCase(), // "major" | "minor"
      description: (j.descriptionEn || j.description || "").trim() || null,
      contributor: j.user?.name || null,
      approved: !!j.approved,
    }))
    .sort((a, b) => a.seconds - b.seconds);

  const runtimeMinutes = m.runtime ?? null;
  const runtimeSeconds = runtimeMinutes ? runtimeMinutes * 60 : null;

  return {
    movie: {
      title: m.titleEn || m.title || null,
      year: m.year ?? null,
      overview: m.descriptionEn || m.overview || null,
      genres: m.genres ?? [],
      runtimeMinutes,
      mpaaRating: m.mpaaRating ?? null,
      imdbId: m.imdbId ?? null,
      imdbRating: m.imdbRating ?? null,
      tmdbId: m.tmdbId ?? null,
      posterUrl: m.posterurl ?? null,
      backdropUrl: m.backdropurl ?? null,
      releaseDate: cleanDate(m.releaseDate),
      trailerUrl: m.youtubeTrailerUrl ?? null,
    },
    summary: {
      total: fm.totalScares ?? jumpscares.length,
      major: fm.majorScares ?? jumpscares.filter((j) => j.severity === "major").length,
      minor:
        (fm.totalScares ?? jumpscares.length) -
        (fm.majorScares ?? jumpscares.filter((j) => j.severity === "major").length),
      classicRating: fm.classicRating ?? null, // ex: "D"
      intensityLevel: fm.intensityLevel ?? null, // ex: 3.1
      watchabilityIndex: fm.watchabilityIndex ?? null, // ex: "Gateway"
      avgSecondsBetweenScares: fm.timeBetweenScares ?? null,
      firstScare: jumpscares[0]?.time ?? null,
      lastScare: jumpscares[jumpscares.length - 1]?.time ?? null,
      summaryText: raw.seoText ?? null,
    },
    jumpscares,
    contentWarnings: m.contentWarnings ?? [],
    triggerWarnings: groupTriggerWarnings(m.triggerWarnings ?? []),
    cast: {
      directors: (raw.directors ?? []).map((d) => ({
        name: d.name,
        photoUrl: d.imageUrl ?? null,
      })),
      actors: (raw.actors ?? []).map((a) => ({
        name: a.name,
        character: a.character || null,
        photoUrl: a.imageUrl ?? null,
      })),
    },
    // Données prêtes à consommer pour dessiner ta propre timeline/graphique.
    timeline: runtimeSeconds
      ? buildTimeline(jumpscares, runtimeSeconds)
      : null,
  };
}

/**
 * Regroupe les triggerWarnings individuels par catégorie (ex: "Abuse",
 * "Addiction"...) et calcule un niveau de sévérité approximatif.
 *
 * ⚠️ Le seuil "Moderate" (>= 3 items) vs "Mild" est une DÉDUCTION faite
 * en observant le rendu du site (barres à 100%/66%/33% de 3 items max),
 * pas une valeur fournie explicitement par les données. À vérifier si
 * tu observes un film avec beaucoup plus d'items dans une catégorie.
 */
function groupTriggerWarnings(items) {
  const byCategory = new Map();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push({
      question: item.question,
      answer: item.answer,
      yesVotes: item.yesVotes ?? 0,
      noVotes: item.noVotes ?? 0,
      confidence: item.confidence ?? null,
      comments: item.comments ?? [],
    });
  }
  return Array.from(byCategory.entries()).map(([category, entries]) => ({
    category,
    itemCount: entries.length,
    severity: entries.length >= 3 ? "moderate" : "mild", // voir avertissement ci-dessus
    items: entries,
  }));
}

/**
 * Construit des données de timeline utilisables pour un graphique :
 * - position en % de chaque jumpscare sur la durée du film
 * - zones "safe" (gaps sans jumpscare) au-delà d'un seuil configurable
 *
 * @param {Array} jumpscares
 * @param {number} runtimeSeconds
 * @param {number} [safeZoneMinSeconds=90] durée minimale pour qu'un
 *   intervalle sans scare soit considéré comme une "safe zone"
 *   (seuil déduit de l'observation du site, ajustable).
 */
function buildTimeline(jumpscares, runtimeSeconds, safeZoneMinSeconds = 90) {
  const markers = jumpscares.map((j) => ({
    seconds: j.seconds,
    percent: round2((j.seconds / runtimeSeconds) * 100),
    severity: j.severity,
  }));

  const safeZones = [];
  let cursor = 0;
  for (const j of jumpscares) {
    const gap = j.seconds - cursor;
    if (gap >= safeZoneMinSeconds) {
      safeZones.push({
        startSeconds: cursor,
        endSeconds: j.seconds,
        startPercent: round2((cursor / runtimeSeconds) * 100),
        endPercent: round2((j.seconds / runtimeSeconds) * 100),
      });
    }
    cursor = j.seconds;
  }
  if (runtimeSeconds - cursor >= safeZoneMinSeconds) {
    safeZones.push({
      startSeconds: cursor,
      endSeconds: runtimeSeconds,
      startPercent: round2((cursor / runtimeSeconds) * 100),
      endPercent: 100,
    });
  }

  return { runtimeSeconds, markers, safeZones };
}

// ------------------------------------------------------------------
// Internes : extraction du texte Flight + parsing JSON équilibré
// ------------------------------------------------------------------

function extractNextFlightText(html) {
  // Capture stricte d'une chaîne JSON valide (gère les guillemets échappés).
  const pushRe = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/gs;
  const parts = [];
  let m;
  while ((m = pushRe.exec(html)) !== null) {
    try {
      parts.push(JSON.parse(m[1]));
    } catch {
      // chunk malformé/non pertinent : ignoré
    }
  }
  return parts.join("");
}

/**
 * Extrait un objet JSON équilibré (accolades) à partir de l'index où
 * commence le "{" d'ouverture, en respectant les chaînes de
 * caractères (guillemets échappés, etc.). Nécessaire ici car les
 * regex non-gourmandes échouent sur des structures aussi imbriquées.
 */
function extractBalancedJson(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  throw new Error("NotScare: JSON non équilibré, extraction impossible.");
}

function secondsToHms(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Les dates sont sérialisées par React Flight avec un préfixe "$D"
 * (ex: "$D2026-05-29T00:00:00.000Z"). On le retire pour obtenir une
 * chaîne ISO standard.
 */
function cleanDate(value) {
  if (typeof value !== "string") return null;
  return value.startsWith("$D") ? value.slice(2) : value;
}
