const db = require('./src/models');

const projectsData = [
  // --- CURRENT PROJECTS (Cube Style - isNightMode: false) ---
  {
    title: "RÉSIDENCE CYANITE",
    location: "Cheraga, Alger",
    description: "Fort du succès de notre première résidence Pyrite, nous repoussons encore les limites du raffinement...",
    image: "uploads/cyanite.png",
    status: "en_cours",
    slug: "residence-cyanite"
  },
  {
    title: "RÉSIDENCE AZURITE",
    location: "Kouba, Alger",
    description: "La résidence Azurite, située dans le quartier mythique de Kouba, offre un cadre de vie privilégié...",
    image: "uploads/azurite.png",
    status: "en_cours",
    slug: "residence-azurite"
  },
  {
    title: "RÉSIDENCE AGATE",
    location: "Oued Romane, Alger",
    description: "Située à Oued Romane (El Achour), un quartier calme et verdoyant, la résidence offre un cadre de vie paisible...",
    image: "uploads/agate.png",
    status: "en_cours",
    slug: "residence-agate"
  },
  {
    title: "RÉSIDENCE AMÉTRINE",
    location: "Said Hamdine, Alger",
    description: "Résidence Amétrine, le récent chef-d'œuvre d'Aymen Promotion Immobilière, se distingue par...",
    image: "uploads/ametrine.png",
    status: "en_cours",
    slug: "residence-ametrine"
  },
  {
    title: "RÉSIDENCE CORNALINE",
    location: "Hydra, Alger",
    description: "Érigée au cœur de la commune de Hydra, la résidence Cornaline dévoile ses atouts de caractère...",
    image: "uploads/cornaline.png",
    status: "en_cours",
    slug: "residence-cornaline"
  },
  {
    title: "RÉSIDENCE SÉRAPHINITE",
    location: "Ruisseau, Alger",
    description: "C'est à Ruisseau, quartier prisé des Algérois, qu'Aymen Promotion Immobilière a choisi d'implanter son nouveau...",
    image: "uploads/seraphinite.png",
    status: "en_cours",
    slug: "residence-seraphinite"
  },
  {
    title: "RÉSIDENCE CÉLESTINE",
    location: "Bab Ezzouar, Alger",
    description: "Aymen Promotion Immobilière lance son premier projet dans la commune dynamique de Bab Ezzouar...",
    image: "uploads/celestine.png",
    status: "en_cours",
    slug: "residence-celestine"
  },
  {
    title: "RÉSIDENCE LARIMAR",
    location: "Birkhadem, Alger",
    description: "Idéalement située à Tixeraïne, Birkhadem, la résidence Larimar est une perle rare qui émerge en réponse...",
    image: "uploads/larimar.png",
    status: "en_cours",
    slug: "residence-larimar"
  },
  {
    title: "RÉSIDENCE SELENITE",
    location: "Birkhadem, Alger",
    description: "Conçue pour allier esthétisme et fonctionnalité, la résidence one building Sélenite incarne le summum de la modernité...",
    image: "uploads/selenite.png",
    status: "en_cours",
    slug: "residence-selenite"
  },

  // --- FINISHED PROJECTS (Cube Style - isNightMode: false) ---
  {
    title: "RÉSIDENCE DIAR EL AMANE",
    location: "Birkhadem, Alger",
    description: "Connue autrefois pour ses champs d'arbres fruitiers à perte de vue, la région des Vergers a...",
    image: "uploads/diar-el-amane.png",
    status: "livre",
    slug: "residence-diar-el-amane"
  },
  {
    title: "RÉSIDENCE PYRITE",
    location: "Cheraga, Alger",
    description: "Située à Dar Diaf, au cœur de la commune de Chéraga, la résidence Haut Standing Pyrite s'étend sur...",
    image: "uploads/pyrite.png",
    status: "livre",
    slug: "residence-pyrite"
  },
  {
    title: "RÉSIDENCE JAIS",
    location: "Draria, Alger",
    description: "La résidence Jais, véritable joyau d'Aymen Promotion Immobilière, incarne le calme et la sophistication à l'état...",
    image: "uploads/jais.png",
    status: "livre",
    slug: "residence-jais"
  },
  {
    title: "RÉSIDENCE LES CRÊTES",
    location: "Draria, Alger",
    description: "Au cœur d'un des quartiers les plus prestigieux de la commune de Draria, se dévoile la somptueuse Résidence...",
    image: "uploads/les-cretes.png",
    status: "livre",
    slug: "residence-les-cretes"
  },

  // --- FINISHED PROJECTS (Night Mode - isNightMode: true) ---
  {
    title: "RÉSIDENCE TURQUOISE",
    location: "Les Sources, Alger",
    description: "Aymen Promotion Immobilière détient l'art subtil de créer des résidences raffinées et intimistes. Parmi...",
    image: "uploads/turquoise.png",
    status: "livre",
    slug: "residence-turquoise",
    features: JSON.stringify(["night_mode"]) // Tagging for frontend
  },
  {
    title: "RÉSIDENCE SPINELLE",
    location: "Les Sources, Alger",
    description: "Nous vous présentons la Résidence Spinelle d'Aymen Promotion Immobilière, un havre de tranquillité niché au cœur de la paisible localité...",
    image: "uploads/spinelle.png",
    status: "livre",
    slug: "residence-spinelle",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE BERYL",
    location: "Dely Ibrahim, Alger",
    description: "Idéalement nichée au cœur de la charmante commune de Dely Ibrahim, la résidence Béryl se dresse dans...",
    image: "uploads/beryl.png",
    status: "livre",
    slug: "residence-beryl",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE BOIS DES CARS",
    location: "Dely Ibrahim, Alger",
    description: "La résidence Bois des Cars, sise à Dely Ibrahim, représente un projet exclusif et sophistiqué de la société Aymen Promotion...",
    image: "uploads/bois-des-cars.png",
    status: "livre",
    slug: "residence-bois-des-cars",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE PÉRIDOT",
    location: "Hydra, Alger",
    description: "Raffinée et discrète, la résidence Péridot d'Aymen Promotion Immobilière représente un...",
    image: "uploads/peridot.png",
    status: "livre",
    slug: "residence-peridot",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE CORAIL",
    location: "Hydra, Alger",
    description: "Raffinée et discrète, la résidence Péridot d'Aymen Promotion Immobilière représente un...",
    image: "uploads/corail.png",
    status: "livre",
    slug: "residence-corail",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE OPALE",
    location: "El Achour, Alger",
    description: "Raffinée et discrète, la résidence Péridot d'Aymen Promotion Immobilière représente...",
    image: "uploads/opale.png",
    status: "livre",
    slug: "residence-opale",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE CITRINE",
    location: "Birkhadem, Alger",
    description: "Nous vous présentons la Résidence Spinelle d'Aymen Promotion Immobilière, un havre...",
    image: "uploads/citrine.png",
    status: "livre",
    slug: "residence-citrine",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE ANGÉLITE",
    location: "Dar El Beïda, Alger",
    description: "Idéalement nichée au coeur de la charmante commune de Dély Ibrahim...",
    image: "uploads/angelite.png",
    status: "livre",
    slug: "residence-angelite",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE RUBIS",
    location: "El Achour, Alger",
    description: "Véritable bijou de la promotion immobilière Aymen, la résidence Rubis se d...",
    image: "uploads/rubis.png",
    status: "livre",
    slug: "residence-rubis",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE ONYX",
    location: "Oued Romane, Alger",
    description: "Aymen Promotion Immobilière, reconnue pour ses résidences haut standing, tient une fois ...",
    image: "uploads/onyx.png",
    status: "livre",
    slug: "residence-onyx",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE EL MORDJANE",
    location: "Said Hamdine, Alger",
    description: "Au cœur d'Alger, dans le quartier de Said Hamdine, à quelques pas de la prestigieuse...",
    image: "uploads/el-mordjane.png",
    status: "livre",
    slug: "residence-el-mordjane",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE 136",
    location: "Birkhadem, Alger",
    description: "Située à proximité de la petite ville Birkhadem, plus précisément à Tixeraïne, la résidence...",
    image: "uploads/136.png",
    status: "livre",
    slug: "residence-136",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE COQUELICOT",
    location: "Hydra, Alger",
    description: "Découvrez le nouvel opus urbain exceptionnel d'Aymen Promotion Immobilière...",
    image: "uploads/coquelicot.png",
    status: "livre",
    slug: "residence-coquelicot",
    features: JSON.stringify(["night_mode"])
  },
  {
    title: "RÉSIDENCE PERLA",
    location: "Dal El Beïda, Alger",
    description: "Aymen Promotion Immobilière, reconnue pour ses résidences haut standing, tient une...",
    image: "uploads/perla.png",
    status: "livre",
    slug: "residence-perla",
    features: JSON.stringify(["night_mode"])
  }
];

async function seed() {
  try {
    await db.sequelize.sync({ force: true }); // WARNING: This drops existing tables!
    console.log('Database synced. Seeding projects...');

    for (const project of projectsData) {
      await db.Project.create({
        title: project.title,
        slug: project.slug,
        description: project.description,
        address: project.location, // Mapping location to address for now
        status: project.status,
        type: 'residentiel',
        coverImage: project.image,
        features: project.features ? JSON.parse(project.features) : null
      });
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
