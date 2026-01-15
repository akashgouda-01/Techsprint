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
        console.log("Feedback received payload:", JSON.stringify(req.body, null, 2));

        // Validate required fields
        if (!req.body.userEmail || !req.body.routeId || typeof req.body.safetyScore !== 'number') {
            console.error("Missing required fields:", {
                hasUserEmail: !!req.body.userEmail,
                hasRouteId: !!req.body.routeId,
                hasSafetyScore: typeof req.body.safetyScore === 'number'
            });
            return res.status(400).json({
                success: false,
                message: "Missing required fields: userEmail, routeId, or safetyScore"
            });
        }

        const feedbackData = {
            ...req.body,
            createdAt: new Date().toISOString()
        };

        // 1️⃣ Save feedback to database
        let dbSaveSuccess = false;
        if (db) {
            try {
                await db.collection('safety_feedback').add(feedbackData);
                dbSaveSuccess = true;
                console.log("Feedback saved to Firestore successfully");
            } catch (dbError) {
                console.error("Firestore save error:", dbError.message);
                // Continue even if DB save fails - we'll still return success for now
            }
        } else {
            console.warn("Firebase DB not initialized - skipping database save");
        }

        // 2️⃣ Fire-and-forget ML training (NON-BLOCKING)
        try {
            const pythonPath = path.join(process.cwd(), 'ml_engine.py');
            console.log("ML file path:", pythonPath);

            const pythonProcess = spawn('python', [pythonPath], {
                stdio: ['pipe', 'ignore', 'ignore']
            });

            pythonProcess.on('error', (err) => {
                console.warn("ML spawn failed:", err.message);
            });

            pythonProcess.stdin.write(JSON.stringify({
                command: 'train',
                data_points: [req.body]
            }));
            pythonProcess.stdin.end();
            console.log("ML training process started");
        } catch (mlError) {
            console.warn("ML training setup failed:", mlError.message);
            // Don't fail the request if ML training fails
        }

        // 3️⃣ Update trip status (optional)
        if (req.body.tripId && db) {
            try {
                await db
                  .collection('trips')
                  .doc(req.body.tripId)
                  .update({ feedbackSubmitted: true });
                console.log("Trip status updated");
            } catch (tripUpdateError) {
                console.warn("Trip status update failed:", tripUpdateError.message);
                // Don't fail the request if trip update fails
            }
        }

        // ✅ RETURN SUCCESS - feedback is accepted even if DB/ML fails
        return res.status(201).json({
            success: true,
            message: "Feedback received successfully",
            saved: dbSaveSuccess
        });

    } catch (error) {
        console.error("Feedback submission error:", error);
        console.error("Error stack:", error.stack);
        return res.status(500).json({
            success: false,
            message: "Failed to submit feedback",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


export { saveTrip, submitFeedback };