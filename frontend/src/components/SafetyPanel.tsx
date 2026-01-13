import { motion } from "framer-motion";
import { Shield, AlertTriangle, Lightbulb, Users, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SafetyPanelProps {
  routeData?: {
    name: string;
    safetyScore: number;
    duration: string;
    distance: string;
    activeUsers?: number;
    segments: {
      name: string;
      safetyLevel: "high" | "medium" | "low";
      factors: string[];
    }[];
  };
}

export function SafetyPanel({ routeData }: SafetyPanelProps) {
  // Use routeData if provided, otherwise show empty state
  if (!routeData) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="h-full flex flex-col items-center justify-center p-6 text-muted-foreground"
      >
        <p className="text-sm">Select a route to view safety analysis</p>
      </motion.div>
    );
  }

  const data = routeData;

  const getSafetyColor = (score: number) => {
    if (score >= 75) return "text-safety-high";
    if (score >= 50) return "text-safety-medium";
    return "text-safety-low";
  };

  const getSafetyBadge = (level: "high" | "medium" | "low") => {
    switch (level) {
      case "high":
        return <Badge variant="safetyHigh">Safe</Badge>;
      case "medium":
        return <Badge variant="safetyMedium">Caution</Badge>;
      case "low":
        return <Badge variant="safetyLow">Risk</Badge>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col overflow-hidden"
    >
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold mb-1">Safety Analysis</h2>
        <p className="text-sm text-muted-foreground">{data.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Overall Safety Score */}
        <Card variant="glow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-safety flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Safety Score</p>
                  <p className={`text-3xl font-bold ${getSafetyColor(data.safetyScore)}`}>
                    {data.safetyScore}
                    <span className="text-lg text-muted-foreground">/100</span>
                  </p>
                </div>
              </div>
            </div>
            <Progress value={data.safetyScore} className="h-2" />
          </CardContent>
        </Card>

        {/* Live Activity */}
        <Card variant="default" className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Active Nearby</p>
                <p className="text-xs text-muted-foreground">Travelers on this route</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">{data.activeUsers || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Route Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card variant="gradient">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-semibold">{data.duration}</p>
              </div>
            </CardContent>
          </Card>
          <Card variant="gradient">
            <CardContent className="p-4 flex items-center gap-3">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="font-semibold">{data.distance}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Segment Breakdown */}
        <div>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Segment Analysis
          </h3>
          <div className="space-y-3">
            {data.segments.map((segment, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="gradient">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium">{segment.name}</p>
                      {getSafetyBadge(segment.safetyLevel)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {segment.factors.map((factor, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground"
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Safety Confidence */}
        <Card variant="gradient">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">Confidence Signals</p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-safety-high" />
                <span>Based on {data.activeUsers || 0} active travelers</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-safety-high" />
                <span>Real-time safety analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-safety-high" />
                <span>Time-adjusted for current hour</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
