
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Clock, Bike, Footprints, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectedPlace, geocodeAddress, API_URL } from "@/services/api";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import axios from "axios";

interface RoutePlannerProps {
  onSearch: (source: SelectedPlace, destination: SelectedPlace, mode: string) => void;
  isSearching?: boolean;
}

export function RoutePlanner({ onSearch, isSearching }: RoutePlannerProps) {
  const [sourceInput, setSourceInput] = useState("");
  const [destinationInput, setDestinationInput] = useState("");
  const [travelMode, setTravelMode] = useState<"walking" | "two-wheeler">("walking");

  const [selectedSource, setSelectedSource] = useState<SelectedPlace | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<SelectedPlace | null>(null);
  
  const [sourceSuggestions, setSourceSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [placesLibraryAvailable, setPlacesLibraryAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);

  // Refs for input elements to attach Autocomplete
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const sourceAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Access Google Places library
  const places = useMapsLibrary("places");

  // Check if Places library is available
  useEffect(() => {
    if (places && typeof places.Autocomplete !== 'undefined') {
      setPlacesLibraryAvailable(true);
      setError(null);
    } else {
      setPlacesLibraryAvailable(false);
    }
  }, [places]);

  // Initialize Autocomplete for source input (frontend Google Places)
  useEffect(() => {
    if (!placesLibraryAvailable || !sourceInputRef.current) {
      // Cleanup if library becomes unavailable
      if (sourceAutocompleteRef.current) {
        sourceAutocompleteRef.current = null;
      }
      return;
    }

    try {
      // Cleanup previous instance
      if (sourceAutocompleteRef.current) {
        google.maps.event.clearInstanceListeners(sourceAutocompleteRef.current);
      }

      const autocomplete = new places.Autocomplete(sourceInputRef.current, {
        componentRestrictions: { country: "in" },
        fields: ["place_id", "formatted_address", "geometry"],
      });

      sourceAutocompleteRef.current = autocomplete;

      const listener = autocomplete.addListener("place_changed", () => {
        try {
          const place = autocomplete.getPlace();
          
          if (!place.place_id || !place.geometry?.location) {
            setSelectedSource(null);
            return;
          }

          const location = place.geometry.location;
          // CHANGE: Normalize lat/lng to plain numbers for TypeScript and downstream usage
          const lat =
            typeof location.lat === "function" ? location.lat() : Number(location.lat);
          const lng =
            typeof location.lng === "function" ? location.lng() : Number(location.lng);

          // CHANGE: On mobile, rely on the actual input DOM value (what user tapped) as fallback
          const resolvedDescription =
            sourceInputRef.current?.value || place.formatted_address || "";
          setSourceInput(resolvedDescription);
          setSelectedSource({
            placeId: place.place_id,
            description: resolvedDescription,
            lat,
            lng,
          });
          setError(null);
        } catch (err) {
          console.error("Error processing place selection:", err);
          setError("Failed to process location. Please try again.");
        }
      });

      return () => {
        if (listener) {
          google.maps.event.removeListener(listener);
        }
        if (sourceAutocompleteRef.current) {
          google.maps.event.clearInstanceListeners(sourceAutocompleteRef.current);
          sourceAutocompleteRef.current = null;
        }
      };
    } catch (err) {
      console.error("Failed to initialize Places Autocomplete:", err);
      setPlacesLibraryAvailable(false);
    }
  }, [placesLibraryAvailable, places]);

  // Initialize Autocomplete for destination input (frontend Google Places)
  useEffect(() => {
    if (!placesLibraryAvailable || !destinationInputRef.current) {
      // Cleanup if library becomes unavailable
      if (destAutocompleteRef.current) {
        destAutocompleteRef.current = null;
      }
      return;
    }

    try {
      // Cleanup previous instance
      if (destAutocompleteRef.current) {
        google.maps.event.clearInstanceListeners(destAutocompleteRef.current);
      }

      const autocomplete = new places.Autocomplete(destinationInputRef.current, {
        componentRestrictions: { country: "in" },
        fields: ["place_id", "formatted_address", "geometry"],
      });

      destAutocompleteRef.current = autocomplete;

      const listener = autocomplete.addListener("place_changed", () => {
        try {
          const place = autocomplete.getPlace();
          
          if (!place.place_id || !place.geometry?.location) {
            setSelectedDestination(null);
            return;
          }

          const location = place.geometry.location;
          // CHANGE: Normalize lat/lng to plain numbers for TypeScript and downstream usage
          const lat =
            typeof location.lat === "function" ? location.lat() : Number(location.lat);
          const lng =
            typeof location.lng === "function" ? location.lng() : Number(location.lng);

          // CHANGE: On mobile, rely on the actual input DOM value (what user tapped) as fallback
          const resolvedDescription =
            destinationInputRef.current?.value || place.formatted_address || "";
          setDestinationInput(resolvedDescription);
          setSelectedDestination({
            placeId: place.place_id,
            description: resolvedDescription,
            lat,
            lng,
          });
          setError(null);
        } catch (err) {
          console.error("Error processing place selection:", err);
          setError("Failed to process location. Please try again.");
        }
      });

      return () => {
        if (listener) {
          google.maps.event.removeListener(listener);
        }
        if (destAutocompleteRef.current) {
          google.maps.event.clearInstanceListeners(destAutocompleteRef.current);
          destAutocompleteRef.current = null;
        }
      };
    } catch (err) {
      console.error("Failed to initialize Places Autocomplete:", err);
      setPlacesLibraryAvailable(false);
    }
  }, [placesLibraryAvailable, places]);

  // Fallback: Backend autocomplete when frontend Places library is unavailable
  const fetchBackendAutocomplete = async (query: string, setSuggestions: (s: any[]) => void) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/maps/places/autocomplete`, {
        params: { input: query }
      });
      if (response.data?.predictions) {
        setSuggestions(response.data.predictions);
      }
    } catch (err) {
      console.error("Backend autocomplete error:", err);
      setSuggestions([]);
    }
  };

  const handleBackendSuggestionClick = async (
    prediction: any,
    setInput: (v: string) => void,
    setSuggestions: (s: any[]) => void,
    setSelected: (p: SelectedPlace) => void
  ) => {
    setInput(prediction.description);
    setSuggestions([]);

    try {
      const detailsResponse = await axios.get(`${API_URL}/maps/places/details`, {
        params: { placeId: prediction.place_id }
      });
      
      const result = detailsResponse.data?.result;
      const location = result?.geometry?.location;
      
      if (location?.lat != null && location?.lng != null) {
        setSelected({
          placeId: prediction.place_id,
          description: prediction.description,
          lat: location.lat,
          lng: location.lng,
        });
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch place details:", err);
      setError("Failed to load location details. Please try again.");
    }
  };

  // Debounced backend autocomplete for source
  useEffect(() => {
    if (placesLibraryAvailable || sourceInput.length < 2) {
      setSourceSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchBackendAutocomplete(sourceInput, setSourceSuggestions);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [sourceInput, placesLibraryAvailable]);

  // Debounced backend autocomplete for destination
  useEffect(() => {
    if (placesLibraryAvailable || destinationInput.length < 2) {
      setDestSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchBackendAutocomplete(destinationInput, setDestSuggestions);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [destinationInput, placesLibraryAvailable]);

  // Handle input changes
  const handleSourceInputChange = (value: string) => {
    setSourceInput(value);
    if (value !== selectedSource?.description) {
      setSelectedSource(null);
    }
  };

  const handleDestinationInputChange = (value: string) => {
    setDestinationInput(value);
    if (value !== selectedDestination?.description) {
      setSelectedDestination(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoutePlanner.tsx:276',message:'handleSubmit entry',data:{sourceInput:sourceInput.trim(),destInput:destinationInput.trim(),hasSelectedSource:!!selectedSource?.placeId,hasSelectedDest:!!selectedDestination?.placeId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // If places are already selected, use them directly
    if (selectedSource?.placeId && selectedDestination?.placeId) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoutePlanner.tsx:282',message:'Using pre-selected places',data:{sourcePlaceId:selectedSource.placeId,destPlaceId:selectedDestination.placeId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      onSearch(selectedSource, selectedDestination, travelMode);
      return;
    }

    // Otherwise, geocode the text inputs
    if (!sourceInput.trim() || !destinationInput.trim()) {
      setError("Please enter both source and destination locations.");
      return;
    }

    try {
      setError(null);
      setIsResolvingPlace(true);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoutePlanner.tsx:295',message:'Before geocode calls',data:{sourceAddress:sourceInput.trim(),destAddress:destinationInput.trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Geocode both addresses
      const [sourceGeocode, destGeocode] = await Promise.all([
        geocodeAddress(sourceInput.trim()),
        geocodeAddress(destinationInput.trim()),
      ]);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoutePlanner.tsx:300',message:'After geocode calls success',data:{sourceGeocode,destGeocode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Update selected places
      setSelectedSource(sourceGeocode);
      setSelectedDestination(destGeocode);

      // Trigger search with geocoded locations
      onSearch(sourceGeocode, destGeocode, travelMode);
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/22cdeccf-1178-4d9c-8ddc-13e134790f1c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RoutePlanner.tsx:308',message:'Geocoding error caught',data:{errorMessage:err?.message,errorResponse:err?.response?.data,errorStatus:err?.response?.status,errorStack:err?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,E'})}).catch(()=>{});
      // #endregion
      console.error("Geocoding error:", err);
      setError(
        err.response?.data?.error || 
        "Failed to find locations. Please select from suggestions or check your input."
      );
    } finally {
      setIsResolvingPlace(false);
    }
  };

  const currentTime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const travelModes = [
    { id: "walking", label: "Walking", icon: Footprints },
    { id: "two-wheeler", label: "Two-Wheeler", icon: Bike },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col"
    >
      <div className="p-4 md:p-6 border-b border-border">
        <h2 className="text-lg font-semibold mb-1">Plan Your Route</h2>
        <p className="text-sm text-muted-foreground">Find the safest path to your destination</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Source Input */}
        <div className="space-y-2 relative">
          <label className="text-sm font-medium text-muted-foreground">From</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-safety-high z-10" />
            <Input
              ref={sourceInputRef}
              placeholder="Enter starting point"
              value={sourceInput}
              onChange={(e) => handleSourceInputChange(e.target.value)}
              className="pl-10"
              disabled={false}
            />
          </div>
          {/* Backend autocomplete suggestions fallback */}
          {!placesLibraryAvailable && sourceSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {sourceSuggestions.map((prediction) => (
                <div
                  key={prediction.place_id}
                  className="p-2 hover:bg-muted cursor-pointer text-sm"
                  onClick={() =>
                    handleBackendSuggestionClick(
                      prediction,
                      setSourceInput,
                      setSourceSuggestions,
                      setSelectedSource
                    )
                  }
                >
                  {prediction.description}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Destination Input */}
        <div className="space-y-2 relative">
          <label className="text-sm font-medium text-muted-foreground">To</label>
          <div className="relative">
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-destructive z-10" />
            <Input
              ref={destinationInputRef}
              placeholder="Enter destination"
              value={destinationInput}
              onChange={(e) => handleDestinationInputChange(e.target.value)}
              className="pl-10"
              disabled={false}
            />
          </div>
          {/* Backend autocomplete suggestions fallback */}
          {!placesLibraryAvailable && destSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {destSuggestions.map((prediction) => (
                <div
                  key={prediction.place_id}
                  className="p-2 hover:bg-muted cursor-pointer text-sm"
                  onClick={() =>
                    handleBackendSuggestionClick(
                      prediction,
                      setDestinationInput,
                      setDestSuggestions,
                      setSelectedDestination
                    )
                  }
                >
                  {prediction.description}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Travel Mode */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Travel Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {travelModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTravelMode(mode.id as "walking" | "two-wheeler")}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${travelMode === mode.id
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                  }`}
              >
                <mode.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current Time */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30 border border-border">
          <Clock className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium">Current Time</p>
            <p className="text-xs text-muted-foreground">{currentTime} — Safety adjusted for time of day</p>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="w-full"
          disabled={!sourceInput.trim() || !destinationInput.trim() || isSearching || isResolvingPlace}
        >
          {isSearching || isResolvingPlace ? (
            <>
              <span className="animate-spin">◌</span>
              {isResolvingPlace ? "Resolving locations..." : "Analyzing Routes..."}
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              Find Safest Route
            </>
          )}
        </Button>
      </form>

      {/* Quick Tips */}
      <div className="p-4 md:p-6 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          💡 <span className="font-medium">Tip:</span> Routes are analyzed for lighting, crowd presence,
          nearby public places, and historical safety data.
        </p>
      </div>
    </motion.div>
  );
}
