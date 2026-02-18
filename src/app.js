const express = require('express');
const cors = require('cors');
const db = require('./models');
const contactRoutes = require('./routes/contactRoutes');
const quoteRoutes = require('./routes/quoteRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
