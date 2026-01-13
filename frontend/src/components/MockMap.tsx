import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface RoutePoint {
  x: number;
  y: number;
  safety: "high" | "medium" | "low";
}

interface MockMapProps {
  routes?: {
    id: string;
    name: string;
    points: RoutePoint[];
    safetyScore: number;
    selected?: boolean;
  }[];
  onRouteSelect?: (routeId: string) => void;
  showNavigation?: boolean;
  currentPosition?: number;
}

export function MockMap({ routes, onRouteSelect, showNavigation, currentPosition = 0 }: MockMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);

  // Default mock routes if none provided
  const defaultRoutes = [
    {
      id: "route1",
      name: "Safest Route",
      safetyScore: 87,
      selected: true,
      points: [
        { x: 80, y: 350, safety: "high" as const },
        { x: 150, y: 320, safety: "high" as const },
        { x: 220, y: 280, safety: "high" as const },
        { x: 300, y: 250, safety: "high" as const },
        { x: 380, y: 220, safety: "high" as const },
        { x: 450, y: 180, safety: "medium" as const },
        { x: 520, y: 140, safety: "high" as const },
        { x: 600, y: 100, safety: "high" as const },
        { x: 680, y: 80, safety: "high" as const },
      ],
    },
    {
      id: "route2",
      name: "Faster Route",
      safetyScore: 62,
      selected: false,
      points: [
        { x: 80, y: 350, safety: "high" as const },
        { x: 180, y: 300, safety: "medium" as const },
        { x: 280, y: 240, safety: "low" as const },
        { x: 380, y: 180, safety: "low" as const },
        { x: 480, y: 130, safety: "medium" as const },
        { x: 580, y: 100, safety: "medium" as const },
        { x: 680, y: 80, safety: "high" as const },
      ],
    },
    {
      id: "route3",
      name: "Alternative Route",
      safetyScore: 74,
      selected: false,
      points: [
        { x: 80, y: 350, safety: "high" as const },
        { x: 120, y: 280, safety: "high" as const },
        { x: 180, y: 220, safety: "medium" as const },
        { x: 260, y: 180, safety: "high" as const },
        { x: 360, y: 160, safety: "high" as const },
        { x: 460, y: 140, safety: "medium" as const },
        { x: 560, y: 110, safety: "high" as const },
        { x: 680, y: 80, safety: "high" as const },
      ],
    },
  ];

  const displayRoutes = routes || defaultRoutes;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw mock city blocks
    const blocks = [
      { x: 100, y: 100, w: 80, h: 60 },
      { x: 220, y: 80, w: 100, h: 80 },
      { x: 400, y: 120, w: 70, h: 90 },
      { x: 550, y: 60, w: 90, h: 70 },
      { x: 150, y: 200, w: 60, h: 50 },
      { x: 350, y: 280, w: 80, h: 60 },
      { x: 500, y: 220, w: 100, h: 80 },
      { x: 100, y: 380, w: 120, h: 70 },
      { x: 280, y: 350, w: 90, h: 60 },
      { x: 450, y: 320, w: 70, h: 80 },
      { x: 600, y: 280, w: 100, h: 70 },
    ];

    blocks.forEach((block) => {
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.strokeRect(block.x, block.y, block.w, block.h);
    });

    // Draw routes
    displayRoutes.forEach((route) => {
      const isSelected = route.selected;
      const isHovered = hoveredRoute === route.id;
      const opacity = isSelected ? 1 : isHovered ? 0.8 : 0.4;

      // Draw route path
      ctx.beginPath();
      ctx.moveTo(route.points[0].x, route.points[0].y);

      for (let i = 1; i < route.points.length; i++) {
        const point = route.points[i];
        ctx.lineTo(point.x, point.y);
      }

      ctx.strokeStyle = isSelected
        ? `rgba(45, 212, 191, ${opacity})`
        : `rgba(156, 163, 175, ${opacity})`;
      ctx.lineWidth = isSelected ? 4 : 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // Draw safety indicators on selected route
      if (isSelected || isHovered) {
        route.points.forEach((point, index) => {
          if (index === 0 || index === route.points.length - 1) return;

          const colors = {
            high: "rgba(34, 197, 94, 0.8)",
            medium: "rgba(234, 179, 8, 0.8)",
            low: "rgba(239, 68, 68, 0.8)",
          };

          ctx.beginPath();
          ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = colors[point.safety];
          ctx.fill();
        });
      }
    });

    // Draw start and end markers
    const startPoint = displayRoutes[0].points[0];
    const endPoint = displayRoutes[0].points[displayRoutes[0].points.length - 1];

    // Start marker
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(45, 212, 191, 0.3)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(startPoint.x, startPoint.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#2dd4bf";
    ctx.fill();

    // End marker
    ctx.beginPath();
    ctx.arc(endPoint.x, endPoint.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(endPoint.x, endPoint.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // Draw current position if navigating
    if (showNavigation && currentPosition > 0) {
      const selectedRoute = displayRoutes.find((r) => r.selected);
      if (selectedRoute) {
        const pointIndex = Math.min(
          Math.floor((currentPosition / 100) * selectedRoute.points.length),
          selectedRoute.points.length - 1
        );
        const currentPoint = selectedRoute.points[pointIndex];

        // Pulsing effect
        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(45, 212, 191, 0.2)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#2dd4bf";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(currentPoint.x, currentPoint.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    }
  }, [displayRoutes, hoveredRoute, showNavigation, currentPosition]);

  return (
    <div className="relative w-full h-full map-container rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="w-full h-full"
        style={{ imageRendering: "crisp-edges" }}
      />

      {/* Route Legend */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {displayRoutes.map((route) => (
          <motion.button
            key={route.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => setHoveredRoute(route.id)}
            onMouseLeave={() => setHoveredRoute(null)}
            onClick={() => onRouteSelect?.(route.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              route.selected
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-secondary/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            {route.name}
          </motion.button>
        ))}
      </div>

      {/* Safety Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-safety-high" />
          <span className="text-muted-foreground">Safe</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-safety-medium" />
          <span className="text-muted-foreground">Caution</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-safety-low" />
          <span className="text-muted-foreground">Avoid</span>
        </div>
      </div>

      {/* Coordinates Display */}
      <div className="absolute bottom-4 right-4 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-sm">
        <span className="text-xs text-muted-foreground font-mono">
          12.9716° N, 77.5946° E
        </span>
      </div>
    </div>
  );
}
