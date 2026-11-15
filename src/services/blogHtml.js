'use strict';
const sanitizeHtml = require('sanitize-html');

// Balises autorisées dans le contenu d'un article (produit par l'éditeur du dashboard).
// Tout le reste (script, style, attributs on*, etc.) est supprimé à l'enregistrement.
const SANITIZE_OPTIONS = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's',
    'a', 'ul', 'ol', 'li', 'blockquote', 'img', 'figure', 'figcaption', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'title', 'allow', 'allowfullscreen'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  // Vidéos : YouTube uniquement.
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
  // Iframe dont la source a été refusée, ou image sans source : supprimées.
  exclusiveFilter: (frame) => (frame.tag === 'iframe' || frame.tag === 'img') && !frame.attribs.src,
  transformTags: {
    // Un éventuel h1 dans le contenu devient h2 : le h1 de la page est le titre de l'article.
    h1: 'h2',
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href || '') && !/aymenpromotion-dz\.com/i.test(attribs.href);
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' }
          : { href: attribs.href },
      };
    },
  },
};

function sanitizeArticleHtml(html) {
  return sanitizeHtml(String(html || ''), SANITIZE_OPTIONS).trim();
}

function stripHtml(html) {
  return sanitizeHtml(String(html || ''), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

/** « Résidence Agate : un joyau » -> « residence-agate-un-joyau » */
function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Import de l'ancien Strapi (format « Blocks ») ----------

function inlineToHtml(children = []) {
  return children.map((c) => {
    if (c.type === 'link') {
      return `<a href="${escapeHtml(c.url || '')}">${inlineToHtml(c.children)}</a>`;
    }
    if (c.type !== 'text') return '';
    let out = escapeHtml(c.text || '').replace(/\n/g, '<br>');
    if (c.bold) out = `<strong>${out}</strong>`;
    if (c.italic) out = `<em>${out}</em>`;
    if (c.underline) out = `<u>${out}</u>`;
    if (c.strikethrough) out = `<s>${out}</s>`;
    return out;
  }).join('');
}

/**
 * Convertit le contenu « Blocks » de Strapi 4 en HTML.
 * Les images hébergées sur l'ancien Strapi sont perdues : elles sont ignorées
 * (`droppedImages` permet de les signaler).
 */
function strapiBlocksToHtml(blocks = []) {
  const parts = [];
  let droppedImages = 0;
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph': {
        const inner = inlineToHtml(b.children);
        if (inner.replace(/<br>/g, '').trim()) parts.push(`<p>${inner}</p>`);
        break;
      }
      case 'heading': {
        const level = Math.min(Math.max(Number(b.level) || 2, 2), 4);
        parts.push(`<h${level}>${inlineToHtml(b.children)}</h${level}>`);
        break;
      }
      case 'quote':
        parts.push(`<blockquote>${inlineToHtml(b.children)}</blockquote>`);
        break;
      case 'list': {
        const tag = b.format === 'ordered' ? 'ol' : 'ul';
        const items = (b.children || []).map((li) => `<li>${inlineToHtml(li.children)}</li>`).join('');
        parts.push(`<${tag}>${items}</${tag}>`);
        break;
      }
      case 'code': {
        // Utilisé dans Strapi pour intégrer une vidéo YouTube (l'URL est le texte du bloc).
        const url = (b.children || []).map((c) => c.text || '').join('').trim();
        const m = url.match(/(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        // Stocké comme un lien seul dans son paragraphe (format de l'éditeur du dashboard) ;
        // le site le transforme en lecteur vidéo à l'affichage.
        if (m) parts.push(`<p><a href="https://www.youtube.com/watch?v=${m[1]}">Vidéo YouTube</a></p>`);
        break;
      }
      case 'image':
        droppedImages += 1;
        break;
      default:
        break;
    }
  }
  return { html: sanitizeArticleHtml(parts.join('\n')), droppedImages };
}

module.exports = { sanitizeArticleHtml, stripHtml, slugify, escapeHtml, strapiBlocksToHtml };
