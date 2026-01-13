
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mapRoutes from './routes/mapRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import connectDB from './config/db.js';

dotenv.config();


connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/maps', mapRoutes);
app.use('/api/trips', tripRoutes);

app.get('/', (req, res) => {
    res.send('SafeRoute AI Backend is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
