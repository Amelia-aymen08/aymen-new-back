'use strict';
// Traduction automatique pour le dashboard blog (bouton « Traduire depuis le français »).
//
// Fournisseurs, choisis par TRANSLATE_PROVIDER (sinon : deepl si DEEPL_API_KEY existe, sinon mymemory) :
//  - mymemory : gratuit, sans clé. Limite : ~5 000 caractères/jour, ou ~50 000 avec MYMEMORY_EMAIL.
//               Qualité correcte en anglais, plus inégale en arabe.
//  - deepl    : DeepL API Free (500 000 caractères/mois gratuits, clé DEEPL_API_KEY). Bien meilleure qualité,
//               gère le HTML nativement.
// Dans tous les cas, la traduction est un BROUILLON : elle doit être relue avant publication.

const { escapeHtml } = require('./blogHtml');

const TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS || 20000);

function providerName() {
  const forced = (process.env.TRANSLATE_PROVIDER || '').toLowerCase();
  if (forced) return forced;
  return process.env.DEEPL_API_KEY ? 'deepl' : 'mymemory';
}

async function fetchJson(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`Service de traduction : HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- DeepL ----------------

const DEEPL_TARGET = { en: 'EN-GB', ar: 'AR', fr: 'FR' };

async function deeplTranslate(texts, from, to, { html = false } = {}) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error('DEEPL_API_KEY manquant.');
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const body = {
    text: texts,
    source_lang: from.toUpperCase(),
    target_lang: DEEPL_TARGET[to] || to.toUpperCase(),
    ...(html ? { tag_handling: 'html' } : {}),
  };
  const data = await fetchJson(`${host}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (data.translations || []).map((t) => t.text);
}

// ---------------- MyMemory ----------------

const MYMEMORY_MAX_BYTES = 450; // limite du service : 500 octets par requête

/** Découpe un texte en morceaux <= 450 octets, de préférence sur les fins de phrase. */
function chunkText(text) {
  if (Buffer.byteLength(text) <= MYMEMORY_MAX_BYTES) return [text];
  const sentences = text.match(/[^.!?;:]+[.!?;:]*\s*/g) || [text];
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if (Buffer.byteLength(current + s) <= MYMEMORY_MAX_BYTES) {
      current += s;
      continue;
    }
    if (current) chunks.push(current);
    if (Buffer.byteLength(s) <= MYMEMORY_MAX_BYTES) {
      current = s;
    } else {
      // Phrase trop longue : coupe sur les espaces.
      current = '';
      for (const word of s.split(/(\s+)/)) {
        if (Buffer.byteLength(current + word) > MYMEMORY_MAX_BYTES && current) {
          chunks.push(current);
          current = '';
        }
        current += word;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function myMemoryOne(text, from, to) {
  const params = new URLSearchParams({ q: text, langpair: `${from}|${to}` });
  if (process.env.MYMEMORY_EMAIL) params.set('de', process.env.MYMEMORY_EMAIL);
  const data = await fetchJson(`https://api.mymemory.translated.net/get?${params}`);
  if (data.responseStatus && Number(data.responseStatus) !== 200) {
    const err = new Error(`MyMemory : ${data.responseDetails || 'erreur'}`);
    err.status = Number(data.responseStatus);
    throw err;
  }
  // On privilégie la traduction automatique (« MT! ») : la mémoire collaborative
  // renvoie parfois des phrases sans rapport.
  const mt = (data.matches || []).find((m) => m['created-by'] === 'MT!' && m.translation);
  return mt?.translation ?? data.responseData?.translatedText ?? text;
}

async function myMemoryTranslate(text, from, to) {
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  const core = text.trim();
  if (!core || !/\p{L}/u.test(core)) return text; // rien à traduire (espaces, chiffres, ponctuation)
  const out = [];
  for (const chunk of chunkText(core)) {
    // séquentiel : le service gratuit limite le débit
    out.push(await myMemoryOne(chunk.trim(), from, to));
  }
  return lead + out.join(' ') + trail;
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decodeEntities = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m]);

const BLOCK_RE = /<(p|h2|h3|h4|li|blockquote|figcaption)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

/**
 * Découpe le HTML interne d'un bloc en morceaux <= 450 octets, aux fins de phrase,
 * sans jamais couper à l'intérieur d'une balise <strong>/<a>/... (profondeur 0).
 */
function chunkInlineHtml(inner) {
  if (Buffer.byteLength(inner) <= MYMEMORY_MAX_BYTES) return [inner];
  const tokens = inner.split(/(<[^>]+>)/g).filter(Boolean);
  const chunks = [];
  let current = '';
  let depth = 0;
  for (const tok of tokens) {
    if (tok.startsWith('</')) depth = Math.max(0, depth - 1);
    else if (tok.startsWith('<') && !tok.endsWith('/>') && !/^<br/i.test(tok)) depth += 1;

    if (tok.startsWith('<') || depth > 0) {
      current += tok;
      continue;
    }
    // Texte hors balise : coupe aux fins de phrase si le morceau devient trop long.
    for (const sentence of tok.match(/[^.!?;]+[.!?;]*\s*|\s+/g) || [tok]) {
      if (Buffer.byteLength(current + sentence) > MYMEMORY_MAX_BYTES && current.trim()) {
        chunks.push(current);
        current = '';
      }
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

async function myMemoryTranslateInline(inner, from, to) {
  if (!/\p{L}/u.test(inner.replace(/<[^>]+>/g, ''))) return inner;
  const out = [];
  for (const chunk of chunkInlineHtml(inner)) {
    if (Buffer.byteLength(chunk) > MYMEMORY_MAX_BYTES * 2) {
      // Morceau encore trop long (lien ou gras géant) : on sacrifie la mise en forme de ce morceau.
      out.push(escapeHtml(await myMemoryTranslate(decodeEntities(chunk.replace(/<[^>]+>/g, '')), from, to)));
    } else {
      out.push((await myMemoryOne(chunk.trim(), from, to)).trim());
    }
  }
  return out.join(' ');
}

/**
 * Traduit un HTML bloc par bloc (paragraphe, titre, élément de liste...).
 * Le bloc entier est envoyé avec ses balises <strong>/<a> : la phrase garde son sens
 * et la mise en forme est conservée.
 */
async function myMemoryTranslateHtml(html, from, to) {
  const source = String(html);
  let result = '';
  let last = 0;
  for (const m of source.matchAll(BLOCK_RE)) {
    const [whole, tag, attrs = '', inner] = m;
    result += source.slice(last, m.index);
    result += `<${tag}${attrs}>${await myMemoryTranslateInline(inner, from, to)}</${tag}>`;
    last = m.index + whole.length;
  }
  return result + source.slice(last);
}

// ---------------- API commune ----------------

/**
 * Traduit les champs d'un article.
 * fields : { title, excerpt, metaTitle, metaDescription } (texte) + contentHtml (HTML)
 */
async function translateFields({ from = 'fr', to, fields }) {
  const provider = providerName();
  const textKeys = ['title', 'excerpt', 'metaTitle', 'metaDescription'].filter((k) => fields[k]);
  const result = {};

  if (provider === 'deepl') {
    if (textKeys.length) {
      const out = await deeplTranslate(textKeys.map((k) => fields[k]), from, to);
      textKeys.forEach((k, i) => { result[k] = out[i]; });
    }
    if (fields.contentHtml) {
      [result.contentHtml] = await deeplTranslate([fields.contentHtml], from, to, { html: true });
    }
  } else if (provider === 'mymemory') {
    for (const k of textKeys) result[k] = await myMemoryTranslate(fields[k], from, to);
    if (fields.contentHtml) result.contentHtml = await myMemoryTranslateHtml(fields.contentHtml, from, to);
  } else {
    throw new Error(`Fournisseur de traduction inconnu : ${provider}`);
  }

  return { provider, fields: result };
}

module.exports = { translateFields, providerName, chunkText };
