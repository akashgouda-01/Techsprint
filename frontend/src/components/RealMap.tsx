
import { useEffect, useState, useCallback, useMemo } from "react";
import { Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

interface RealMapProps {
  routes?: {
    id: string;
    points?: google.maps.LatLngLiteral[]; // Optional decoded points
    encodedPolyline?: string;
    safetyScore: number;
    selected?: boolean;
    color?: string;
  }[];
  onRouteSelect?: (routeId: string) => void;
  showNavigation?: boolean;
  currentPosition?: google.maps.LatLngLiteral;
  center?: google.maps.LatLngLiteral;
}

type MapState = "idle" | "place_selected" | "route_shown" | "navigating";

export function RealMap({
  routes = [],
  onRouteSelect,
  showNavigation,
  currentPosition,
  center = { lat: 13.0843, lng: 80.2705 }, // Default to Chennai
}: RealMapProps) {
  const map = useMap();
  const maps = useMapsLibrary("maps");
  const [polylines, setPolylines] = useState<google.maps.Polyline[]>([]);
  const [userMarker, setUserMarker] = useState<google.maps.Marker | null>(null);
  const [mapState, setMapState] = useState<MapState>("idle");

  const selectedRoute = useMemo(
    () => routes.find((r) => r.selected) || routes[0],
    [routes]
  );

  // Draw / update route polylines
  useEffect(() => {
    if (!map || !maps) return;

    polylines.forEach((p) => p.setMap(null));
    const newPolylines: google.maps.Polyline[] = [];

    routes.forEach((route) => {
      const isSelected = route.selected;

      let path: google.maps.LatLngLiteral[] = route.points || [];
      if ((!path || path.length === 0) && route.encodedPolyline && google.maps.geometry) {
        const decoded = google.maps.geometry.encoding.decodePath(route.encodedPolyline);
        path = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
      }

      if (!path || path.length === 0) return;

      // CHANGE: When navigating, split the selected route into completed vs remaining for visual trimming
      if (showNavigation && currentPosition && isSelected && google.maps.geometry) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        // Find the closest vertex on the route to the current user position
        path.forEach((pt, idx) => {
          const d = google.maps.geometry!.spherical.computeDistanceBetween(
            new google.maps.LatLng(currentPosition),
            new google.maps.LatLng(pt)
          );
          if (d < nearestDistance) {
            nearestDistance = d;
            nearestIndex = idx;
          }
        });

        console.log("[RealMap] Split route at index", nearestIndex, "distance to route (m)", nearestDistance);

        const completedPath = path.slice(0, Math.max(nearestIndex, 1));
        const remainingPath = path.slice(Math.max(nearestIndex - 1, 0));

        if (completedPath.length > 1) {
          const completedPolyline = new maps.Polyline({
            path: completedPath,
            geodesic: true,
            strokeColor: "#9ca3af", // greyed-out completed segment
            strokeOpacity: 0.4,
            strokeWeight: 4,
            map,
            zIndex: 5,
            clickable: true,
          });
          completedPolyline.addListener("click", () => {
            if (onRouteSelect) onRouteSelect(route.id);
          });
          newPolylines.push(completedPolyline);
        }

        if (remainingPath.length > 1) {
          const remainingPolyline = new maps.Polyline({
            path: remainingPath,
            geodesic: true,
            strokeColor: "#0f766e", // highlighted remaining path
            strokeOpacity: 1.0,
            strokeWeight: 5,
            map,
            zIndex: 10,
            clickable: true,
          });
          remainingPolyline.addListener("click", () => {
            if (onRouteSelect) onRouteSelect(route.id);
          });
          newPolylines.push(remainingPolyline);
        }
      } else {
        // Existing behavior for non-navigating or non-selected routes
        const polyline = new maps.Polyline({
          path,
          geodesic: true,
          strokeColor: isSelected ? "#0f766e" : "#9ca3af",
          strokeOpacity: isSelected ? 1.0 : 0.6,
          strokeWeight: isSelected ? 5 : 4,
          map,
          zIndex: isSelected ? 10 : 1,
          clickable: true,
        });

        polyline.addListener("click", () => {
          if (onRouteSelect) onRouteSelect(route.id);
        });

        newPolylines.push(polyline);
      }
    });

    setPolylines(newPolylines);

    return () => {
      newPolylines.forEach((p) => p.setMap(null));
    };
  }, [map, maps, routes, onRouteSelect]);

  // Manage map camera based on state machine
  useEffect(() => {
    if (!map) return;

    // Priority 1: Navigation mode - lock camera to user location
    if (showNavigation && currentPosition) {
      setMapState("navigating");
      const currentZoom = map.getZoom() || 13;
      if (currentZoom < 17) {
        map.setZoom(17);
      }
      map.panTo(currentPosition);
      return;
    }

    // Priority 2: Show routes if available (but not in navigation mode)
    if (routes.length > 0 && selectedRoute && !showNavigation) {
      setMapState("route_shown");

      const bounds = new google.maps.LatLngBounds();
      let hasPoints = false;

      const pathFromRoute =
        selectedRoute.points ||
        (selectedRoute.encodedPolyline && google.maps.geometry
          ? google.maps.geometry.encoding
              .decodePath(selectedRoute.encodedPolyline)
              .map((p) => ({ lat: p.lat(), lng: p.lng() }))
          : []);

      if (pathFromRoute && pathFromRoute.length > 0) {
        pathFromRoute.forEach((p) => bounds.extend(p));
        hasPoints = true;
      }

      if (hasPoints) {
        map.fitBounds(bounds, 64);
      }
      return;
    }

    // Priority 3: Center on selected place
    if (center && routes.length === 0) {
      setMapState("place_selected");
      map.setCenter(center);
      map.setZoom(15);
      return;
    }

    // Default: idle state
    if (!showNavigation && routes.length === 0 && !center) {
      setMapState("idle");
    }
  }, [map, routes, selectedRoute, center, showNavigation, currentPosition]);

  // Track and render user location marker while navigating
  useEffect(() => {
    if (!map || !maps) return;

    if (showNavigation && currentPosition) {
      if (!userMarker) {
        // @ts-ignore - Marker does exist, but Typescript type may be incomplete
        const marker = new (window.google.maps.Marker)({
          position: currentPosition,
          map,
          zIndex: 20,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#2dd4bf",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        setUserMarker(marker);
      } else {
        userMarker.setPosition(currentPosition);
        userMarker.setMap(map);
        // Keep camera locked to user position during navigation
        map.panTo(currentPosition);
        const currentZoom = map.getZoom() || 13;
        if (currentZoom < 17) {
          map.setZoom(17);
        }
      }
    } else if (userMarker && !showNavigation) {
      // Only hide marker when navigation stops, not when position updates
      userMarker.setMap(null);
    }
  }, [currentPosition, map, maps, userMarker, showNavigation]);

  return (
    <div className="w-full h-full rounded-xl md:rounded-xl rounded-none overflow-hidden relative">
      <Map
        defaultCenter={center}
        defaultZoom={13}
        gestureHandling={"greedy"}
        disableDefaultUI={true}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
        mapId={null}
      />
      {/* Map state debug hook if needed in future: {mapState} */}
    </div>
  );
}
