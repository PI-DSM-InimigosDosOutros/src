require('dotenv').config();

const express = require('express');
const app = express();

app.use(express.json());

const authRoutes = require('./routes/tokenPreRoutes');
const workoutRoutes = require('./routes/workoutRoutes');

app.use('/api', authRoutes);
app.use('/api', workoutRoutes);

app.get('/', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Backend microservice is up and running successfully.'
    });
});


const PORT = process.env.PORT;
app.listen(PORT, () => {});