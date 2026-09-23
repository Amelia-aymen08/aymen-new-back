# Webhooks CRM — formulaires du site

À chaque soumission valide d'un formulaire (une fois l'enregistrement créé en base), le backend envoie un `POST` JSON à l'URL du CRM. L'envoi se fait en arrière-plan : il ne ralentit ni ne fait jamais échouer la réponse faite au visiteur.

## Configuration (backend/.env)

| Variable | Rôle |
|---|---|
| `CRM_WEBHOOK_URL` | URL qui reçoit les événements. **Vide = webhooks désactivés.** |
| `CRM_WEBHOOK_SECRET` | Secret partagé pour signer les requêtes (recommandé). |
| `CRM_WEBHOOK_TIMEOUT_MS` | Timeout par tentative, défaut `6500`. |

## Requête envoyée

En-têtes :

| En-tête | Valeur |
|---|---|
| `X-Webhook-Event` | `form.<form>` (ex. `form.quote`) |
| `X-Webhook-Id` | UUID unique de l'événement (à utiliser pour dédoublonner) |
| `X-Webhook-Timestamp` | Timestamp Unix en secondes |
| `X-Webhook-Signature` | `sha256=<hex>` — HMAC-SHA256 de `"<timestamp>.<corps brut>"` avec `CRM_WEBHOOK_SECRET` (présent si un secret est configuré) |

Corps :

```json
{
  "id": "95471c80-e0c5-49d4-8920-acaaa32c8130",
  "event": "form.contact",
  "form": "contact",
  "occurredAt": "2026-09-23T18:29:07.895Z",
  "source": "aymen-immobilier-website",
  "data": { "...": "l'enregistrement tel que stocké en base (id, champs du formulaire, createdAt…)" },
  "context": { "pageUri": "https://…", "pageName": "…", "ipAddress": "…", "userAgent": "…" }
}
```

## Événements

| `form` | Formulaire | Route d'origine |
|---|---|---|
| `contact` | Page Contact | `POST /api/contacts` |
| `home_contact` | Formulaire de la page d'accueil | `POST /api/home-contacts` |
| `quote` | Demande de devis (fiche projet) | `POST /api/quotes` |
| `terrain_request` | Proposer un terrain | `POST /api/terrain-leads` |
| `careers` | Candidature (page Carrières) | `POST /api/candidates` |
| `newsletter` | Inscription newsletter (footer, blog) — *uniquement pour une nouvelle adresse* | `POST /api/newsletter` |
| `offres_ete` | Offres Été | `POST /api/offres-ete` |
| `visite_virtuelle_rdv` | RDV visite virtuelle | `POST /api/visite-virtuelle-rdv` |
| `batimat_2026` | Préinscription BATIMAT | `POST /api/batimat` |
| `concours_batitec` | Candidature concours Batitec | `POST /api/concours-batitec/applications` |
| `batimatech_lead` | Prospect saisi par un commercial (portail Batimatech) | `POST /api/batimatech/leads` |

Notes sur `data` :
- `quote.locations` / `quote.contactDays`, `terrain_request.papers`, `visite_virtuelle_rdv.localisations` sont des **chaînes JSON** (tableaux sérialisés) : à `JSON.parse` côté CRM.
- Les pièces jointes (`contact.attachment`, `careers.cvPath`, `concours_batitec.studentCardPath`) sont des **chemins relatifs** ; le fichier est servi sur `<API_BASE_URL>/<chemin>` pour `/uploads/...`.

## Fiabilité

- Réponse attendue : n'importe quel `2xx`.
- Jusqu'à **3 tentatives** (immédiate, +2 s, +10 s) sur erreur réseau, timeout, `5xx`, `408` ou `429`. Les autres `4xx` ne sont pas réessayés.
- Les retries sont **en mémoire** : un redémarrage du serveur pendant un retry perd l'événement. Ce n'est pas une file durable — la base reste la source de vérité, le CRM peut rattraper via l'id.
- Livraison *au moins une fois* : dédoublonner sur `id`.

## Exemple de récepteur (Node/Express)

```js
const crypto = require('crypto');
app.post('/webhooks/site', express.raw({ type: 'application/json' }), (req, res) => {
  const ts = req.get('X-Webhook-Timestamp');
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(`${ts}.${req.body.toString('utf8')}`).digest('hex');
  const given = Buffer.from(req.get('X-Webhook-Signature') || '');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, Buffer.from(expected))) return res.sendStatus(401);
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.sendStatus(401); // anti-rejeu

  const event = JSON.parse(req.body);
  // event.form, event.data …
  res.sendStatus(200); // répondre vite, traiter ensuite
});
```

⚠️ La signature porte sur le **corps brut** : ne pas re-sérialiser le JSON avant de la vérifier.
