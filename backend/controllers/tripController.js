import { db } from '../config/db.js';
import { spawn } from 'child_process';
import path from 'path';

// @desc    Save a new trip/search
// @route   POST /api/trips
// @access  Public
const saveTrip = async (req, res) => {
    const { userEmail, source, destination, travelMode, routeMode } = req.body;

    if (!userEmail || !source || !destination || !travelMode) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        const tripData = {
            userEmail,
            source,
            destination,
            travelMode,
            routeMode: routeMode || 'safest',
            createdAt: new Date().toISOString(),
            status: 'planned',
            feedbackSubmitted: false
        };

        if (db) {
            const docRef = await db.collection('trips').add(tripData);
            res.status(201).json({ id: docRef.id, ...tripData });
        } else {
            console.warn("DB not ready, returning mock success");
            res.status(201).json({ id: 'local-mock-id', ...tripData });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit safety feedback & Train ML
// @route   POST /api/trips/feedback
// @access  Public
const submitFeedback = async (req, res) => {
    try {
        console.log("Feedback received payload:", req.body); // CHANGE: Debug incoming feedback payload
        const feedbackData = {
            ...req.body,
            createdAt: new Date().toISOString()
        };

        if (db) {
            await db.collection('safety_feedback').add(feedbackData);
        }

        // Trigger ML Training
        const pythonProcess = spawn('python', [path.join(process.cwd(), 'ml_engine.py')]);

        const trainPayload = {
            command: 'train',
            data_points: [req.body]
        };

        pythonProcess.stdin.write(JSON.stringify(trainPayload));
        pythonProcess.stdin.end();

        // Update Trip to show feedback submitted
        if (req.body.tripId && db) {
            await db.collection('trips').doc(req.body.tripId).update({ feedbackSubmitted: true });
        }

        res.status(201).json({ message: 'Feedback received and processing for AI training' });

    } catch (error) {
        console.error("Feedback error:", error);
        res.status(500).json({ message: 'Failed to submit feedback' });
    }
};

export { saveTrip, submitFeedback };
