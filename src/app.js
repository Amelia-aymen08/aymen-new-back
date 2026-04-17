// app.js
const express = require('express');
const cors = require('cors');
const db = require('./models');
const contactRoutes = require('./routes/contactRoutes');
const homeContactRoutes = require('./routes/homeContactRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const batimatechRoutes = require('./routes/batimatechRoutes');
const terrainRequestRoutes = require('./routes/terrainRequestRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ limit: '1024mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Database synchronization with error handling
db.sequelize.sync({ alter: false }) // Utilisez { force: true } seulement en développement
  .then(() => {
    console.log('✅ Database synced successfully.');
    console.log('📊 Available models:', Object.keys(db));
  })
  .catch((err) => {
    console.error('❌ Failed to sync database:', err.message);
    console.error('Full error:', err);
  });

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Aymen Immobilier Backend API.' });
});

require('./routes/candidateRoutes')(app);
require('./routes/projectRoutes')(app);

app.use('/api/contacts', contactRoutes);
app.use('/api/home-contacts', homeContactRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/batimatech', batimatechRoutes);
app.use('/api/terrain-leads', terrainRequestRoutes);

module.exports = app;
