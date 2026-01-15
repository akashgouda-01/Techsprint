
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Flag, Lock, Menu, Info } from "lucide-react";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  // CHANGE: Track ETA, distance, and segment details for real-time monitor updates
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [totalDurationMinutes, setTotalDurationMinutes] = useState<number | null>(null); // CHANGE: Baseline route duration for ETA fallback
  const [distanceTraveledMeters, setDistanceTraveledMeters] = useState(0);
  const [remainingDistanceMeters, setRemainingDistanceMeters] = useState<number | null>(null);
  const [activeSegmentName, setActiveSegmentName] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [showRoutePlannerSheet, setShowRoutePlannerSheet] = useState(false);
  const [showSafetySheet, setShowSafetySheet] = useState(false);

  // Routes from backend
  const [routes, setRoutes] = useState<any[]>([]);
  const [currentPosition, setCurrentPosition] = useState<google.maps.LatLngLiteral | undefined>(undefined);
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  // CHANGE: Track route geometry and speed metrics for progress/ETA
  const [routePath, setRoutePath] = useState<google.maps.LatLngLiteral[]>([]);
  const [totalRouteDistanceMeters, setTotalRouteDistanceMeters] = useState<number | null>(null);
  const [lastPosition, setLastPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [lastPositionTimestamp, setLastPositionTimestamp] = useState<number | null>(null);
  const [currentSpeedMps, setCurrentSpeedMps] = useState<number | null>(null);
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
            // CHANGE: Preserve distance if backend provides it for better segment selection
            distanceMeters: seg.distanceMeters ?? seg.distance ?? null,
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
        // CHANGE: Track speed and movement deltas for ETA calculation
        const now = Date.now();
        let speedFromSensor = typeof pos.coords.speed === "number" ? pos.coords.speed : null;

        if (lastPosition && lastPositionTimestamp) {
          const elapsedSec = (now - lastPositionTimestamp) / 1000;
          if (elapsedSec > 0) {
            const deltaDist = distanceMeters(lastPosition, coords);
            const derivedSpeed = deltaDist / elapsedSec;
            if (!speedFromSensor || speedFromSensor <= 0) {
              speedFromSensor = derivedSpeed;
            }
            console.log("[Navigation] Δdist (m)", deltaDist.toFixed(2), "Δt (s)", elapsedSec.toFixed(2), "derived speed (m/s)", derivedSpeed.toFixed(2));
          }
        }

        if (speedFromSensor && speedFromSensor > 0) {
          console.log("[Navigation] Using speed (m/s)", speedFromSensor);
          setCurrentSpeedMps(speedFromSensor);
        }

        setLastPosition(coords);
        setLastPositionTimestamp(now);

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
    // CHANGE: Reset navigation metrics when user stops
    setEtaMinutes(null);
    setDistanceTraveledMeters(0);
    setRemainingDistanceMeters(null);
    setActiveSegmentName(null);
    setRoutePath([]);
    setTotalRouteDistanceMeters(null);

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
      setEtaMinutes(0); // CHANGE: Mark ETA as zero on arrival
      setAppState("completed");
      setShowFeedback(true);
    }
  }, [appState, currentPosition, selectedPlaces.destination, geoWatchId]);

  const activeRoute = routes.find(r => r.selected);

  // CHANGE: Derive full route path and total distance from the active route polyline
  useEffect(() => {
    if (!activeRoute) {
      setRoutePath([]);
      setTotalRouteDistanceMeters(null);
      setTotalDurationMinutes(null); // CHANGE: Reset baseline duration when no active route
      return;
    }

    let path: google.maps.LatLngLiteral[] = activeRoute.points || [];

    // Decode encoded polyline if points are not already present
    if ((!path || path.length === 0) && activeRoute.encodedPolyline && (window as any)?.google?.maps?.geometry) {
      try {
        const decoded = (window as any).google.maps.geometry.encoding.decodePath(activeRoute.encodedPolyline);
        path = decoded.map((p: google.maps.LatLng) => ({ lat: p.lat(), lng: p.lng() }));
      } catch (e) {
        console.warn("[Navigation] Failed to decode polyline for active route", e);
      }
    }

    if (!path || path.length < 2) {
      setRoutePath([]);
      setTotalRouteDistanceMeters(null);
      setTotalDurationMinutes(null);
      return;
    }

    setRoutePath(path);

    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      total += distanceMeters(path[i], path[i + 1]);
    }
    console.log("[Navigation] Total route distance (m)", total);
    setTotalRouteDistanceMeters(total);

    // CHANGE: Derive total duration in minutes from route metadata for initial ETA
    let durationMinutes: number | null = null;
    // Prefer Google Directions-style duration in seconds if available
    const legDurationValue = activeRoute.legs?.[0]?.duration?.value;
    if (typeof legDurationValue === "number") {
      durationMinutes = legDurationValue / 60;
    } else if (typeof activeRoute.duration?.value === "number") {
      durationMinutes = activeRoute.duration.value / 60;
    }
    if (durationMinutes !== null) {
      console.log("[Navigation] Total route duration (min)", durationMinutes);
      setTotalDurationMinutes(durationMinutes);
    } else {
      setTotalDurationMinutes(null);
    }
  }, [activeRoute]);

  // CHANGE: Update distance traveled, remaining distance, progress %, ETA, and active segment on GPS updates
  useEffect(() => {
    if (appState !== "navigating" || !currentPosition || routePath.length < 2 || !totalRouteDistanceMeters || totalRouteDistanceMeters <= 0) {
      return;
    }

    // Find closest vertex on path to current position
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    routePath.forEach((pt, idx) => {
      const d = distanceMeters(currentPosition, pt);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearestIndex = idx;
      }
    });

    let traveled = 0;
    for (let i = 0; i < nearestIndex; i++) {
      traveled += distanceMeters(routePath[i], routePath[i + 1]);
    }

    const remaining = Math.max(totalRouteDistanceMeters - traveled, 0);

    setDistanceTraveledMeters(traveled);
    setRemainingDistanceMeters(remaining);

    const progress = Math.max(0, Math.min(100, (traveled / totalRouteDistanceMeters) * 100));
    setNavigationProgress(progress);

    // ETA calculation using current speed if available
    let etaMins: number | null = null;
    if (currentSpeedMps && currentSpeedMps > 0.5 && remaining > 0) {
      const etaSeconds = remaining / currentSpeedMps;
      etaMins = etaSeconds / 60;
    }
    setEtaMinutes(etaMins);

    // Choose active segment based on traveled distance and segment distances if provided
    if (activeRoute && Array.isArray(activeRoute.segments) && activeRoute.segments.length > 0) {
      const segments = activeRoute.segments;
      const totalSegDistance = segments.reduce((sum: number, seg: any) => {
        const d = typeof seg.distanceMeters === "number" ? seg.distanceMeters : 0;
        return sum + d;
      }, 0);

      let segmentName = segments[0].name || "Route segment";

      if (totalSegDistance > 0) {
        let accumulated = 0;
        for (const seg of segments) {
          const d = typeof seg.distanceMeters === "number" ? seg.distanceMeters : 0;
          if (traveled <= accumulated + d) {
            segmentName = seg.name || segmentName;
            break;
          }
          accumulated += d;
        }
      } else {
        // Fallback: approximate by index based on progress along route
        const idx = Math.min(
          segments.length - 1,
          Math.floor((progress / 100) * segments.length)
        );
        segmentName = segments[idx]?.name || segmentName;
      }

      setActiveSegmentName(segmentName);
    }

    console.log("[Navigation] Distance traveled (m)", traveled);
    console.log("[Navigation] Remaining distance (m)", remaining);
    console.log("[Navigation] Progress (%)", progress);
    console.log("[Navigation] ETA (min)", etaMins);
    console.log("[Navigation] Active segment", activeSegmentName);
  }, [
    appState,
    currentPosition,
    routePath,
    totalRouteDistanceMeters,
    currentSpeedMps,
    activeRoute,
    activeSegmentName,
  ]);

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

  // Auto-open route planner sheet on mobile when in planning state
  useEffect(() => {
    // Only on mobile (check window width)
    const checkMobile = () => window.innerWidth < 768;
    const isMobile = checkMobile();
    
    // Auto-open sheet on mobile when:
    // 1. In planning state
    // 2. No routes have been found yet
    // This ensures users see the input screen first on mobile
    if (isMobile && appState === "planning" && routes.length === 0) {
      // Small delay to ensure smooth transition from landing page
      const timer = setTimeout(() => {
        setShowRoutePlannerSheet(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [appState, routes.length]);

  return (
    <APIProvider apiKey={googleMapsApiKey || ""} libraries={['places', 'geometry']}>
      <div className="h-screen md:min-h-screen bg-background flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar - Desktop Only */}
        <motion.aside
          initial={{ x: -320 }}
          animate={{ x: 0 }}
          className="hidden md:flex w-80 border-r border-border bg-card flex-col flex-shrink-0"
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

        {/* Mobile Route Planner Sheet */}
        <Sheet open={showRoutePlannerSheet} onOpenChange={setShowRoutePlannerSheet}>
          <SheetContent side="bottom" className="h-[90vh] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div>
                <h1 className="font-semibold">SafeRoute AI</h1>
                <p className="text-xs text-muted-foreground">Plan Your Route</p>
              </div>
            </div>
            <RoutePlanner onSearch={(source, dest, mode) => {
              handleSearch(source, dest, mode);
              setShowRoutePlannerSheet(false);
            }} isSearching={appState === "searching"} />
          </SheetContent>
        </Sheet>

        {/* Main Map Area */}
        <main className="flex-1 relative overflow-hidden min-h-0">
          {/* Mobile Header */}
          <div className="md:hidden absolute top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border p-3 flex items-center justify-between h-12">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <h1 className="font-semibold text-sm">SafeRoute AI</h1>
            <div className="flex gap-2">
              {appState === "routes" || appState === "navigating" || appState === "completed" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSafetySheet(true)}
                  className="relative"
                >
                  <Info className="w-4 h-4" />
                </Button>
              ) : null}
              {/* Menu button to open route planner - always available on mobile */}
              <Sheet open={showRoutePlannerSheet} onOpenChange={setShowRoutePlannerSheet}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
              </Sheet>
            </div>
          </div>

          {/* Map - Keep mounted at all times to prevent blank screen */}
          {/* On mobile, hide map when in planning state to prioritize route input */}
          <div className={`absolute inset-0 md:inset-0 top-12 md:top-0 ${appState === "planning" && routes.length === 0 ? "hidden md:block" : ""}`}>
            <RealMap
              routes={routes}
              onRouteSelect={handleRouteSelect}
              showNavigation={appState === "navigating"}
              currentPosition={currentPosition}
              center={selectedPlaces.source ? { lat: selectedPlaces.source.lat, lng: selectedPlaces.source.lng } : undefined}
            />
          </div>
          
          {/* Mobile placeholder when map is hidden during planning */}
          {appState === "planning" && routes.length === 0 && (
            <div className="md:hidden absolute inset-0 top-12 bg-gradient-to-br from-background via-background/95 to-background/90 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Menu className="w-8 h-8 text-primary/50" />
                </div>
                <p className="text-muted-foreground text-sm">Enter your route details above</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <AnimatePresence>
            {appState === "routes" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xs md:max-w-none"
              >
                <Button variant="hero" size="lg" onClick={handleStartNavigation} className="w-full md:w-auto">
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
                // CHANGE: Feed real navigation metrics into live monitor
                progress={navigationProgress}
                etaMinutes={etaMinutes}
                totalDurationMinutes={totalDurationMinutes ?? undefined}
                distanceTraveledMeters={distanceTraveledMeters}
                remainingDistanceMeters={remainingDistanceMeters}
                activeSegmentName={activeSegmentName || undefined}
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
                className="absolute inset-0 md:inset-0 top-12 md:top-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-30"
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

        {/* Right Panel - Desktop Only */}
        <AnimatePresence>
          {(appState === "routes" || appState === "navigating" || appState === "completed") && activeRoute && (
            <>
              {/* Desktop Sidebar */}
              <motion.aside
                initial={{ x: 360 }}
                animate={{ x: 0 }}
                exit={{ x: 360 }}
                className="hidden md:flex w-[360px] border-l border-border bg-card flex-shrink-0"
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

              {/* Mobile Safety Sheet */}
              <Sheet open={showSafetySheet} onOpenChange={setShowSafetySheet}>
                <SheetContent side="bottom" className="h-[90vh] max-h-[90vh] overflow-y-auto">
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
                </SheetContent>
              </Sheet>
            </>
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
