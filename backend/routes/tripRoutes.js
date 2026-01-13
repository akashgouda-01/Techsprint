import express from 'express';
import { saveTrip, submitFeedback } from '../controllers/tripController.js';

const router = express.Router();

router.post('/', saveTrip);
router.post('/feedback', submitFeedback);

export default router;
