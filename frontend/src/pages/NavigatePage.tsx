
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
    const activeRoute = routes.find(r => r.selected);
    if (!activeRoute) {
      toast.error("Please select a route first.");
      return;
    }

    if (!("geolocation" in navigator)) {
      // Fallback: Use simulated movement along route if GPS unavailable
      console.warn("Geolocation not available, using simulated movement");
      toast.info("Using simulated navigation (GPS unavailable)");
      
      // Simulate position along route polyline
      const startSimulation = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 0.02; // Increment progress
          if (progress >= 1) {
            progress = 1;
            clearInterval(interval);
          }
          
          // Calculate position along route (simplified - use start position for now)
          if (activeRoute.legs?.[0]?.start_location) {
            setCurrentPosition({
              lat: activeRoute.legs[0].start_location.lat,
              lng: activeRoute.legs[0].start_location.lng,
            });
          }
        }, 500);
        
        setAppState("navigating");
        return interval;
      };
      
      startSimulation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentPosition(coords);

        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setCurrentPosition({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          },
          (error) => {
            console.error("Geolocation watch error", error);
            // Fallback to simulated movement if GPS fails during navigation
            toast.warning("GPS unavailable, using route simulation");
          },
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000,
          }
        );

        setGeoWatchId(watchId as number);
        setAppState("navigating");
      },
      (error) => {
        console.error("Geolocation error", error);
        // Fallback: Use route start position if GPS fails
        if (activeRoute.legs?.[0]?.start_location) {
          toast.warning("GPS unavailable, using route start position");
          setCurrentPosition({
            lat: activeRoute.legs[0].start_location.lat,
            lng: activeRoute.legs[0].start_location.lng,
          });
          setAppState("navigating");
        } else {
          toast.error("Unable to access your location. Please check permissions.");
        }
      }
    );
  };

  const handleStopNavigation = () => {
    if (navigationProgress >= 100) {
      setShowFeedback(true);
    }
    setAppState("routes");
    setNavigationProgress(0);

    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
    setCurrentPosition(undefined);
  };

  const handleNavigationProgress = (progress: number) => {
    setNavigationProgress(progress);
    if (progress >= 100) {
      setAppState("completed");
      setTimeout(() => setShowFeedback(true), 1000);
    }
  };

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

          {/* Live Monitor */}
          <AnimatePresence>
            {appState === "navigating" && (
              <LiveMonitor
                isActive={true}
                onStop={handleStopNavigation}
                onProgress={handleNavigationProgress}
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

        {/* Feedback Form */}
        <AnimatePresence>
          {showFeedback && <FeedbackForm onClose={() => setShowFeedback(false)} />}
        </AnimatePresence>
      </div>
    </APIProvider>
  );
}
