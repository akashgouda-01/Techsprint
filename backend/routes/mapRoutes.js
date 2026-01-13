
import express from 'express';
import { getRoutes, getPlaceAutocomplete, getPlaceDetails, geocodeLocation } from '../controllers/mapController.js';

const router = express.Router();

router.post('/routes', getRoutes);
router.get('/places/autocomplete', getPlaceAutocomplete);
router.get('/places/details', getPlaceDetails);
router.get('/geocode', geocodeLocation);

export default router;
