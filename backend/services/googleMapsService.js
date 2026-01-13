
import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

// Fail fast if API key is missing
const getApiKey = () => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is not set in environment variables. Please add it to backend/.env"
    );
  }
  return key;
};

export const fetchRoutes = async (origin, destination, mode = "walking") => {
  try {
    // Map UI-friendly mode to Google Directions-supported modes
    const googleMode = mode === "two-wheeler" ? "driving" : "walking";

    const response = await client.directions({
      params: {
        origin,
        destination,
        mode: googleMode,
        alternatives: true,
        key: getApiKey(),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching routes from Google:", error);
    if (error.response?.data?.error_message?.includes("REQUEST_DENIED")) {
      throw new Error("Google Maps API authentication failed. Check API key configuration.");
    }
    throw error;
  }
};

export const fetchPlaceAutocomplete = async (input) => {
  try {
    const response = await client.placeAutocomplete({
      params: {
        input,
        // Restrict suggestions to India
        components: ["country:in"],
        key: getApiKey(),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching autocomplete:", error);
    if (error.response?.data?.error_message?.includes("REQUEST_DENIED")) {
      throw new Error("Google Places API authentication failed. Check API key configuration.");
    }
    throw error;
  }
};

export const fetchPlaceDetails = async (placeId) => {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: getApiKey(),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching place details:", error);
    if (error.response?.data?.error_message?.includes("REQUEST_DENIED")) {
      throw new Error("Google Places API authentication failed. Check API key configuration.");
    }
    throw error;
  }
};

export const fetchNearbyPlaces = async (location, radius, openNow = false) => {
  try {
    const response = await client.placesNearby({
      params: {
        location,
        radius,
        opennow: openNow || undefined,
        key: getApiKey(),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching nearby places:", error);
    if (error.response?.data?.error_message?.includes("REQUEST_DENIED")) {
      throw new Error("Google Places API authentication failed. Check API key configuration.");
    }
    throw error;
  }
};

// Fallback coordinates for common Chennai locations (when billing not enabled)
const FALLBACK_LOCATIONS = {
  'avadi': { lat: 13.1157, lng: 80.1018, address: 'Avadi, Chennai, Tamil Nadu, India' },
  'ambattur': { lat: 13.0982, lng: 80.1614, address: 'Ambattur, Chennai, Tamil Nadu, India' },
  'chennai': { lat: 13.0827, lng: 80.2707, address: 'Chennai, Tamil Nadu, India' },
  'bangalore': { lat: 12.9716, lng: 77.5946, address: 'Bangalore, Karnataka, India' },
};

export const geocodeAddress = async (address) => {
  // #region agent log
  const fs = await import('fs');
  const logPath = 'd:\\safety\\.cursor\\debug.log';
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const logEntry = JSON.stringify({location:'googleMapsService.js:99',message:'geocodeAddress entry - using Places Autocomplete+Details',data:{address,hasApiKey:!!apiKey,apiKeyLength:apiKey?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})+'\n';
  fs.appendFileSync(logPath, logEntry, 'utf8');
  // #endregion
  
  try {
    const apiKeyValue = getApiKey();
    // #region agent log
    const logEntry2 = JSON.stringify({location:'googleMapsService.js:105',message:'Step 1: Places Autocomplete',data:{address,apiKeyExists:!!apiKeyValue},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})+'\n';
    fs.appendFileSync(logPath, logEntry2, 'utf8');
    // #endregion
    
    // Use Places Autocomplete (which we know works) + Place Details instead of Geocoding API
    // Step 1: Get predictions from Autocomplete
    const autocompleteResponse = await client.placeAutocomplete({
      params: {
        input: address,
        components: ["country:in"],
        key: apiKeyValue,
      },
    });
    
    // #region agent log
    const logEntry3 = JSON.stringify({location:'googleMapsService.js:118',message:'Autocomplete response received',data:{hasPredictions:!!autocompleteResponse.data?.predictions,predictionsCount:autocompleteResponse.data?.predictions?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,D'})+'\n';
    fs.appendFileSync(logPath, logEntry3, 'utf8');
    // #endregion
    
    if (!autocompleteResponse.data?.predictions || autocompleteResponse.data.predictions.length === 0) {
      return { results: [], status: 'ZERO_RESULTS' };
    }
    
    // Step 2: Get details for the first prediction
    const firstPrediction = autocompleteResponse.data.predictions[0];
    // #region agent log
    const logEntry4 = JSON.stringify({location:'googleMapsService.js:127',message:'Step 2: Fetching place details',data:{placeId:firstPrediction.place_id},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})+'\n';
    fs.appendFileSync(logPath, logEntry4, 'utf8');
    // #endregion
    
    const detailsResponse = await client.placeDetails({
      params: {
        place_id: firstPrediction.place_id,
        key: apiKeyValue,
      },
    });
    
    // #region agent log
    const logEntry5 = JSON.stringify({location:'googleMapsService.js:135',message:'Place details received',data:{hasResult:!!detailsResponse.data?.result,hasGeometry:!!detailsResponse.data?.result?.geometry},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,D'})+'\n';
    fs.appendFileSync(logPath, logEntry5, 'utf8');
    // #endregion
    
    // Transform to match Geocoding API format
    const result = detailsResponse.data?.result;
    if (result && result.geometry?.location) {
      return {
        results: [{
          place_id: result.place_id,
          formatted_address: result.formatted_address || firstPrediction.description,
          geometry: {
            location: {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
            },
          },
        }],
        status: 'OK',
      };
    }
    
    return { results: [], status: 'ZERO_RESULTS' };
  } catch (error) {
    // #region agent log
    const logEntry6 = JSON.stringify({location:'googleMapsService.js:155',message:'Places API error - checking for billing error',data:{errorMessage:error?.message,errorCode:error?.response?.data?.error_message,errorStatus:error?.response?.status,isBillingError:error?.response?.data?.error_message?.includes('Billing')},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,E'})+'\n';
    fs.appendFileSync(logPath, logEntry6, 'utf8');
    // #endregion
    console.error("Error geocoding address with Places API:", error);
    
    // If billing error, try fallback for common locations
    if (error.response?.data?.error_message?.includes("Billing")) {
      const addressLower = address.toLowerCase().trim();
      const fallback = FALLBACK_LOCATIONS[addressLower];
      
      if (fallback) {
        // #region agent log
        const logEntry7 = JSON.stringify({location:'googleMapsService.js:165',message:'Using fallback coordinates',data:{address,fallback},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})+'\n';
        fs.appendFileSync(logPath, logEntry7, 'utf8');
        // #endregion
        console.warn(`Billing not enabled. Using fallback coordinates for: ${address}`);
        return {
          results: [{
            place_id: `fallback_${addressLower}_${Date.now()}`,
            formatted_address: fallback.address,
            geometry: {
              location: {
                lat: fallback.lat,
                lng: fallback.lng,
              },
            },
          }],
          status: 'OK',
        };
      }
      
      throw new Error(
        "Google Maps API requires billing to be enabled. " +
        "Please enable billing at: https://console.cloud.google.com/project/_/billing/enable\n" +
        "Or use a location with fallback support (avadi, ambattur, chennai, bangalore)."
      );
    }
    
    if (error.response?.data?.error_message?.includes("REQUEST_DENIED")) {
      throw new Error("Google Places API authentication failed. Check API key configuration and ensure Places API is enabled.");
    }
    throw error;
  }
};
