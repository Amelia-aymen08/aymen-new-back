const express = require('express');
const cors = require('cors');
const db = require('./models');
const contactRoutes = require('./routes/contactRoutes');
const quoteRoutes = require('./routes/quoteRoutes');

const app = express();

// Middleware
app.use(cors());
// Augmenter la limite de taille pour accepter les fichiers Base64 (images/pdf)
// Le Base64 grossit le fichier de 33%, donc 50mb n'était pas suffisant pour un fichier de 5Mo
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ limit: '1024mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Database synchronization
// force: false ensures we don't drop tables on restart
// alter: true updates tables if models change (useful for development)
db.sequelize.sync({ force: false, alter: true }).then(() => {
  console.log('Database synced successfully.');
}).catch((err) => {
  console.error('Failed to sync database:', err.message);
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Aymen Immobilier Backend API.' });
});

require('./routes/candidateRoutes')(app);
require('./routes/projectRoutes')(app);

app.use('/api/contacts', contactRoutes);
app.use('/api/quotes', quoteRoutes);

module.exports = app;
