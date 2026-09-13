// Outil ponctuel exécuté localement (pas en production) : importe
// directement frontend/src/data/mockData.ts (via le strip-types natif de
// Node 24) pour produire un JSON stable, indépendant de la présence du
// dépôt frontend sur le serveur — cf. docs/decisions.md D14.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_DATA_PATH = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'mockData.ts');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'seed_catalog.json');

const mod = await import(`${'file://' + MOCK_DATA_PATH.replace(/\\/g, '/')}`);
const { PROJECTS, LOCALITIES } = mod;

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ projects: PROJECTS, localities: LOCALITIES }, null, 2), 'utf8');

console.log(`Extrait ${PROJECTS.length} projets et ${LOCALITIES.length} localités depuis mockData.ts`);
console.log(`Écrit dans ${OUTPUT_PATH}`);
