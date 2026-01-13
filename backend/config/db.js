import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

// Note: For production, you should use a service account key file
// For this dev environment, we will check if we can init with existing credentials or mock it
// if the user hasn't provided SERVICE_ACCOUNT data yet.

let db;

const connectDB = async () => {
    try {
        if (!getApps().length) {
            // Check if we have service account in env or file
            // If running locally with Firebase CLI login, applicationDefault() might work
            // For now we will try generic init
            initializeApp({
                projectId: "safe-route-ai-db"
            });
        }
        db = getFirestore();
        console.log("Firebase Firestore Connected");
    } catch (error) {
        console.error("Firebase Init Error:", error.message);
    }
};

export { db };
export default connectDB;
