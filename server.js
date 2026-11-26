require('dotenv').config();
require('dd-trace').init(); // Datadog: deve vir antes de express, mysql2 e demais requires

const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/tokenPreRoutes');
const userAuthRoutes = require('./routes/authRoutes');
const workoutRoutes = require('./routes/workoutRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api', authRoutes);
app.use('/api', userAuthRoutes);
app.use('/api', workoutRoutes);
app.use('/api', userRoutes);

app.get('/', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Backend microservice is up and running successfully.'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});