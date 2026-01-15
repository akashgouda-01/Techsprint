
import axios from 'axios';

// Get API base URL from environment variable, fallback to localhost for development
// In production, set VITE_API_BASE_URL environment variable (e.g., https://your-backend.onrender.com)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const API_URL = `${API_BASE_URL}/api`;

// Export API_URL for use in other components
export { API_URL };

export interface LatLng {
    lat: number;
    lng: number;
}

export interface SelectedPlace {
    placeId: string;
    description: string;
    lat: number;
    lng: number;
}

export const getRoutes = async (origin: LatLng, destination: LatLng, mode: string = 'walking') => {
    const response = await axios.post(`${API_URL}/maps/routes`, {
        origin,
        destination,
        mode
    });
    return response.data;
};

export const geocodeAddress = async (address: string): Promise<SelectedPlace> => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:25',message:'geocodeAddress call start',data:{address,apiUrl:`${API_URL}/maps/geocode`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    try {
        const response = await axios.get(`${API_URL}/maps/geocode`, {
            params: { address }
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:30',message:'geocodeAddress success',data:{status:response.status,data:response.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return response.data;
    } catch (err: any) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:35',message:'geocodeAddress axios error',data:{errorMessage:err?.message,responseStatus:err?.response?.status,responseData:err?.response?.data,requestUrl:err?.config?.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,F'})}).catch(()=>{});
        // #endregion
        throw err;
    }
};

export const saveTrip = async (tripData: {
    userEmail: string;
    source: string;
    destination: string;
    travelMode: string;
    routeMode?: string;
}) => {
    const response = await axios.post(`${API_URL}/trips`, tripData);
    return response.data;
};

export const submitFeedback = async (feedbackData: any) => {
    try {
        console.log("[API] Submitting feedback to:", `${API_URL}/trips/feedback`);
        console.log("[API] Payload:", JSON.stringify(feedbackData, null, 2));
        
        const response = await axios.post(`${API_URL}/trips/feedback`, feedbackData, {
            timeout: 10000, // 10 second timeout
        });
        
        console.log("[API] Feedback response:", response.status, response.data);
        return response.data;
    } catch (error: any) {
        console.error("[API] Feedback submission error:", error);
        console.error("[API] Error response:", error.response?.data);
        console.error("[API] Error status:", error.response?.status);
        
        // Re-throw with more context
        if (error.response) {
            // Server responded with error status
            throw new Error(error.response.data?.message || `Server error: ${error.response.status}`);
        } else if (error.request) {
            // Request made but no response
            throw new Error("Network error: Could not reach server. Please check your connection.");
        } else {
            // Something else happened
            throw new Error(error.message || "Failed to submit feedback");
        }
    }
};
