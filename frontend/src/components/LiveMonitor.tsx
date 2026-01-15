import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Navigation, RefreshCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface LiveMonitorProps {
  isActive: boolean;
  onStop: () => void;
  progress?: number; // optional, visual only
  // CHANGE: Optional navigation metrics fed from NavigatePage for real-time updates
  etaMinutes?: number | null;
  totalDurationMinutes?: number | null;
  distanceTraveledMeters?: number | null;
  remainingDistanceMeters?: number | null;
  activeSegmentName?: string | null;
}

export function LiveMonitor({
  isActive,
  onStop,
  progress = 0,
  etaMinutes,
  totalDurationMinutes,
  distanceTraveledMeters,
  remainingDistanceMeters,
  activeSegmentName,
}: LiveMonitorProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [showRerouteAlert, setShowRerouteAlert] = useState(false);
  const [safetyStatus, setSafetyStatus] = useState<"safe" | "warning" | "rerouting">("safe");

  useEffect(() => {
    if (!isActive) {
      setInternalProgress(0);
      setShowRerouteAlert(false);
      setSafetyStatus("safe");
      return;
    }

    setInternalProgress(progress);

    // CHANGE: Log navigation metrics for temporary debugging
    console.log("[LiveMonitor] Progress (%)", progress);
    if (typeof distanceTraveledMeters === "number") {
      console.log("[LiveMonitor] Distance traveled (m)", distanceTraveledMeters);
    }
    if (typeof remainingDistanceMeters === "number") {
      console.log("[LiveMonitor] Remaining distance (m)", remainingDistanceMeters);
    }
    if (typeof etaMinutes === "number") {
      console.log("[LiveMonitor] ETA (min)", etaMinutes);
    }
    if (activeSegmentName) {
      console.log("[LiveMonitor] Active segment", activeSegmentName);
    }

    // Optional: show warning based on real progress if wired later
    if (progress >= 45 && progress < 50 && !showRerouteAlert) {
      setSafetyStatus("warning");
      setShowRerouteAlert(true);
    }

    if (progress >= 55 && showRerouteAlert) {
      setSafetyStatus("safe");
      setShowRerouteAlert(false);
    }
  }, [isActive, progress, showRerouteAlert]);

  const handleAcceptReroute = () => {
    setSafetyStatus("rerouting");
    setTimeout(() => {
      setSafetyStatus("safe");
      setShowRerouteAlert(false);
    }, 1500);
  };

  const getStatusColor = () => {
    switch (safetyStatus) {
      case "safe":
        return "bg-safety-high";
      case "warning":
        return "bg-safety-medium";
      case "rerouting":
        return "bg-primary";
      default:
        return "bg-safety-high";
    }
  };

  const getStatusText = () => {
    switch (safetyStatus) {
      case "safe":
        return "Route Safe";
      case "warning":
        return "Safety Alert";
      case "rerouting":
        return "Rerouting...";
      default:
        return "Route Safe";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6 z-20 max-w-md md:max-w-none mx-auto md:mx-0"
    >
      <Card variant="glass" className="overflow-hidden">
        <CardContent className="p-4">
          {/* Status Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
              <span className="font-semibold">{getStatusText()}</span>
              <Badge variant="outline" className="text-xs">
                Live Monitoring
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onStop}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Journey Progress</span>
              <span className="font-medium">{Math.round(internalProgress)}%</span>
            </div>
            <Progress value={internalProgress} className="h-2" />
          </div>

          {/* Current Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Navigation className="w-4 h-4 text-primary" />
              {/* CHANGE: Prefer real ETA from navigation state, fall back to duration-based estimate then simple heuristic */}
              <span>
                ETA:{" "}
                {typeof etaMinutes === "number"
                  ? `${Math.max(0, Math.round(etaMinutes))} min`
                  : typeof totalDurationMinutes === "number"
                  ? `${Math.max(
                      0,
                      Math.round(totalDurationMinutes * (1 - internalProgress / 100))
                    )} min`
                  : `${Math.round((100 - internalProgress) / 5)} min`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              {/* CHANGE: Use dynamic segment name from route data when available */}
              <span>
                Next segment:{" "}
                {activeSegmentName ||
                  (progress < 33
                    ? "Brigade Road"
                    : progress < 66
                    ? "Church Street"
                    : "Destination")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reroute Alert */}
      <AnimatePresence>
        {showRerouteAlert && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute bottom-full left-0 right-0 mb-4"
          >
            <Card variant="elevated" className="border-safety-medium/50 bg-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-safety-medium/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-safety-medium" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-safety-medium mb-1">
                      Safer Alternative Found
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Reduced crowd detected ahead on Church Street. A safer alternate route via 
                      Rest House Crescent is available (+2 min).
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="safety"
                        size="sm"
                        onClick={handleAcceptReroute}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Accept Safer Route
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRerouteAlert(false)}
                      >
                        Continue Current
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
