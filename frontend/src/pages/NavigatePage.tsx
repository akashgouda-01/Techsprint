
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Flag, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RealMap } from "@/components/RealMap";
import { RoutePlanner } from "@/components/RoutePlanner";
import { SafetyPanel } from "@/components/SafetyPanel";
import { LiveMonitor } from "@/components/LiveMonitor";
import { FeedbackForm } from "@/components/FeedbackForm";
import { APIProvider } from "@vis.gl/react-google-maps";
import { getRoutes, SelectedPlace } from "@/services/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import AuthButton from "@/components/AuthButton";

type AppState = "planning" | "searching" | "routes" | "navigating" | "completed";

// Haversine distance in meters for GPS-based arrival detection
const distanceMeters = (
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral
) => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export default function NavigatePage() {
  const { user } = useAuth();
  const [appState, setAppState] = useState<AppState>("planning");
  const [navigationProgress, setNavigationProgress] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Routes from backend
  const [routes, setRoutes] = useState<any[]>([]);
  const [currentPosition, setCurrentPosition] = useState<google.maps.LatLngLiteral | undefined>(undefined);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const [selectedPlaces, setSelectedPlaces] = useState<{
    source: SelectedPlace | null;
    destination: SelectedPlace | null;
  }>({
    source: null,
    destination: null,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Login Required</h1>
          <p className="text-muted-foreground text-lg">
            To plan safe routes and access personalized navigation features, please sign in with your Google account.
          </p>
          <div className="flex justify-center pt-4">
            <AuthButton />
          </div>
          <p className="text-sm text-muted-foreground pt-8">
            <Link to="/" className="underline hover:text-foreground">Return to Home</Link>
          </p>
        </div>
      </div>
    );
  }

  const handleSearch = async (source: SelectedPlace, destination: SelectedPlace, mode: string) => {
    setAppState("searching");
    try {
      setSelectedPlaces({ source, destination });
      const data = await getRoutes(
        { lat: source.lat, lng: source.lng },
        { lat: destination.lat, lng: destination.lng },
        mode
      );

      // Transform backend routes to frontend structure
      // Backend returns: { routes: [{ id, overview_polyline: { points }, route_safety_score, active_users, segments, safety_breakdown }] }
      if (data.routes && data.routes.length > 0) {
        const formattedRoutes = data.routes.map((r: any, idx: number) => ({
          id: r.id || `route-${idx}`,
          encodedPolyline: r.overview_polyline?.points,
          safetyScore: r.route_safety_score || r.safetyScore || 75,
          selected: idx === 0, // Select first by default
          summary: r.summary,
          activeUsers: r.active_users || r.activeUsers || 0,
          legs: r.legs,
          duration: r.duration,
          distance: r.distance,
          // Use real segments from backend with safety breakdown
          segments: (r.segments || []).map((seg: any) => ({
            name: seg.name || "Path Segment",
            safetyLevel: seg.safetyLevel || (seg.score > 80 ? 'high' : (seg.score > 60 ? 'medium' : 'low')),
            factors: seg.factors || ["Analyzed Path"],
            score: seg.score,
          })),
          safety_breakdown: r.safety_breakdown || [],
        }));

        setRoutes(formattedRoutes);
        setSelectedRoute(formattedRoutes[0].id);
        setAppState("routes");
      } else {
        toast.error("No routes found");
        setAppState("planning");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch routes. Please try again.");
      setAppState("planning");
    }
  };

  const handleRouteSelect = (routeId: string) => {
    setSelectedRoute(routeId);
    setRoutes(routes.map((r) => ({ ...r, selected: r.id === routeId })));
  };

  const handleStartNavigation = () => {
    const activeRoute = routes.find((r) => r.selected);
    if (!activeRoute) {
      toast.error("Please select a route first.");
      return;
    }

    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }

    console.log("[Navigation] Starting navigation");

    // Clear any previous watcher
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        console.log("[Navigation] GPS update", coords);
        setCurrentPosition(coords);
        setAppState((prev) => (prev === "navigating" ? prev : "navigating"));
      },
      (error) => {
        console.error("[Navigation] Geolocation watch error", error);
        toast.error("Unable to access your location. Please check permissions.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    setGeoWatchId(watchId as number);
  };

  const handleStopNavigation = () => {
    console.log("[Navigation] Navigation stopped by user");
    setAppState("routes");
    setNavigationProgress(0);

    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
    setCurrentPosition(undefined);
  };

  // GPS-based arrival detection: only this can mark journey as completed / show feedback
  useEffect(() => {
    if (appState !== "navigating" || !currentPosition || !selectedPlaces.destination) {
      return;
    }

    const dest = {
      lat: selectedPlaces.destination.lat,
      lng: selectedPlaces.destination.lng,
    };

    const dist = distanceMeters(currentPosition, dest);
    console.log("[Navigation] Distance to destination (m)", dist);

    if (dist <= 20) {
      console.log("[Navigation] Arrival detected");
      if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
        setGeoWatchId(null);
      }
      setNavigationProgress(100);
      setAppState("completed");
      setShowFeedback(true);
    }
  }, [appState, currentPosition, selectedPlaces.destination, geoWatchId]);

  const activeRoute = routes.find(r => r.selected);

  // Cleanup any active geolocation watcher on unmount
  useEffect(() => {
    return () => {
      if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
    };
  }, [geoWatchId]);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  // Warn if API key is missing
  useEffect(() => {
    if (!googleMapsApiKey) {
      console.warn(
        "VITE_GOOGLE_MAPS_API_KEY is not set. Please add it to frontend/.env.local file."
      );
    }
  }, [googleMapsApiKey]);

  return (
    <APIProvider apiKey={googleMapsApiKey || ""} libraries={['places', 'geometry']}>
      <div className="min-h-screen bg-background flex">
        {/* Left Sidebar */}
        <motion.aside
          initial={{ x: -320 }}
          animate={{ x: 0 }}
          className="w-80 border-r border-border bg-card flex flex-col flex-shrink-0"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold">SafeRoute AI</h1>
              <p className="text-xs text-muted-foreground">Navigation Dashboard</p>
            </div>
          </div>

          {/* Route Planner */}
          <RoutePlanner onSearch={handleSearch} isSearching={appState === "searching"} />
        </motion.aside>

        {/* Main Map Area */}
        <main className="flex-1 relative overflow-hidden">
          {/* Map - Keep mounted at all times to prevent blank screen */}
          <div className="absolute inset-0">
            <RealMap
              routes={routes}
              onRouteSelect={handleRouteSelect}
              showNavigation={appState === "navigating"}
              currentPosition={currentPosition}
              center={selectedPlaces.source ? { lat: selectedPlaces.source.lat, lng: selectedPlaces.source.lng } : undefined}
            />
          </div>

          {/* Action Buttons */}
          <AnimatePresence>
            {appState === "routes" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
              >
                <Button variant="hero" size="lg" onClick={handleStartNavigation}>
                  <Play className="w-4 h-4" />
                  Start Navigation
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live Monitor (visual only; completion is GPS-based) */}
          <AnimatePresence>
            {appState === "navigating" && (
              <LiveMonitor
                isActive={true}
                onStop={handleStopNavigation}
                progress={navigationProgress}
              />
            )}
          </AnimatePresence>

          {/* Completed State */}
          <AnimatePresence>
            {appState === "completed" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-30"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-20 h-20 rounded-full bg-safety-high/20 flex items-center justify-center mx-auto mb-4"
                  >
                    <Flag className="w-10 h-10 text-safety-high" />
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-2">You've Arrived!</h2>
                  <p className="text-muted-foreground">Journey completed safely</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Panel */}
        <AnimatePresence>
          {(appState === "routes" || appState === "navigating" || appState === "completed") && activeRoute && (
            <motion.aside
              initial={{ x: 360 }}
              animate={{ x: 0 }}
              exit={{ x: 360 }}
              className="w-[360px] border-l border-border bg-card flex-shrink-0"
            >
              <SafetyPanel
                routeData={{
                  name: activeRoute.summary || "Selected Route",
                  safetyScore: activeRoute.safetyScore,
                  duration: activeRoute.duration || activeRoute.legs[0]?.duration?.text || "N/A",
                  distance: activeRoute.distance || activeRoute.legs[0]?.distance?.text || "N/A",
                  activeUsers: activeRoute.activeUsers,
                  segments: activeRoute.segments || []
                }}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Feedback Form - only shown after GPS-based arrival */}
        <AnimatePresence>
          {showFeedback && activeRoute && (
            <FeedbackForm
              routeId={activeRoute.id}
              finalSafetyScore={activeRoute.safetyScore}
              onClose={() => setShowFeedback(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </APIProvider>
  );
}
