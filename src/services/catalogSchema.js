'use strict';
// Mise à niveau automatique des tables du catalogue (Projects, ProjectImages, Localities).
//
// sequelize.sync({ alter: false }) crée les tables absentes mais n'ajoute jamais une colonne
// à une table existante. Ce module compare chaque modèle à la table réelle et ajoute les
// colonnes manquantes (jamais de suppression ni de modification). Idempotent : appelé à
// chaque démarrage, il ne fait rien quand tout est déjà en place.

const db = require('../models');

const CATALOG_MODELS = ['Locality', 'Project', 'ProjectImage'];

async function ensureColumns(model) {
  const qi = db.sequelize.getQueryInterface();
  const table = model.getTableName();
  let existing;
  try {
    existing = await qi.describeTable(table);
  } catch {
    return []; // table absente : sync() la crée avec toutes ses colonnes
  }
  const added = [];
  for (const attr of Object.values(model.rawAttributes)) {
    const column = attr.field || attr.fieldName;
    if (existing[column] || attr.primaryKey) continue;
    const definition = { type: attr.type, allowNull: attr.allowNull !== false };
    if (attr.defaultValue !== undefined && typeof attr.defaultValue !== 'function' && !attr.defaultValue?.fn) {
      definition.defaultValue = attr.defaultValue;
    }
    // Une colonne NOT NULL sans valeur par défaut ne peut pas être ajoutée à une table remplie.
    if (!definition.allowNull && definition.defaultValue === undefined) definition.allowNull = true;
    await qi.addColumn(table, column, definition);
    added.push(column);
  }
  return added;
}

async function ensureCatalogSchema() {
  for (const name of CATALOG_MODELS) {
    const model = db[name];
    if (!model) continue;
    try {
      const added = await ensureColumns(model);
      if (added.length) console.log(`🛠️  [catalogue] ${model.getTableName()} : colonnes ajoutées -> ${added.join(', ')}`);
    } catch (err) {
      console.error(`❌ [catalogue] Mise à niveau de ${name} impossible :`, err.message);
    }
  }
}

module.exports = { ensureCatalogSchema };
