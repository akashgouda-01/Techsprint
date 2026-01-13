
import {
    fetchRoutes,
    fetchPlaceAutocomplete,
    fetchPlaceDetails,
    fetchNearbyPlaces,
    geocodeAddress,
} from '../services/googleMapsService.js';

// Helper to simulate safety score calculation based on route data
// In a real app, this would query a crime database or similar
import { spawn } from 'child_process';
import path from 'path';

// Helper to call Python ML Engine
const getSafetyScoresFromML = async (segments) => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [path.join(process.cwd(), 'ml_engine.py')]);

        const payload = {
            command: 'predict',
            segments: segments.map((s, i) => ({
                index: i,
                context: s.context // { lighting, activity, timestamp }
            }))
        };

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error('ML Engine Error:', errorString);
                // Fallback if python fails
                resolve(segments.map(s => ({ segment_index: s.index, safety_score: 75 })));
            } else {
                try {
                    const result = JSON.parse(dataString);
                    resolve(result.results);
                } catch (e) {
                    console.error('Failed to parse ML output', e);
                    resolve(segments.map(s => ({ segment_index: s.index, safety_score: 75 })));
                }
            }
        });

        // Send data to python script
        pythonProcess.stdin.write(JSON.stringify(payload));
        pythonProcess.stdin.end();
    });
};

const extractSegmentContext = (step) => {
    // Determine context based on available data (simulated for now)
    // In real app, query Google Places / Firestore here

    const text = (step.html_instructions || "").toLowerCase();

    // Default context
    let context = {
        lighting: 'partial',
        activity: 'moderate',
        timestamp: new Date().toISOString(),
        roadType: 'street',
        roadTypeFactor: 1.0,
    };

    // Heuristic based on keywords - extract road type and factor
    if (text.includes("highway") || text.includes("freeway") || text.includes("expressway")) {
        context.lighting = 'well-lit';
        context.activity = 'busy';
        context.roadType = 'highway';
        context.roadTypeFactor = 1.2; // Highways are generally safer
    } else if (text.includes("alley") || text.includes("path") || text.includes("lane")) {
        context.lighting = 'poor';
        context.activity = 'isolated';
        context.roadType = 'alley';
        context.roadTypeFactor = 0.7; // Alleys are riskier
    } else if (text.includes("main road") || text.includes("road")) {
        context.roadType = 'main_road';
        context.roadTypeFactor = 1.0; // Standard factor
    } else if (text.includes("street")) {
        context.roadType = 'street';
        context.roadTypeFactor = 0.9; // Slightly less safe than main roads
    }

    return context;
};

const getTimeFactor = () => {
    const now = new Date();
    const hour = now.getHours();

    if (hour >= 6 && hour < 18) return 1.0; // day
    if (hour >= 18 && hour < 22) return 0.7; // evening
    return 0.4; // night
};

const computeSegmentSafety = ({ timeFactor, poiCount, activeUsers, mlProbability, roadTypeFactor = 1.0 }) => {
    // Step 1: Normalize scores
    const poi_score = Math.min(poiCount / 20, 1);
    const presence_score = Math.min(activeUsers / 10, 1);
    const ml_score = mlProbability; // 0 -> 1

    // Step 2: Base safety score (EXACT formula as specified)
    const base_safety =
        0.40 * timeFactor +
        0.30 * poi_score +
        0.20 * presence_score +
        0.10 * ml_score;

    // Step 3: Apply road type factor
    const final_segment_score = base_safety * roadTypeFactor;

    // Step 4: Convert to percentage
    const segment_safety_percentage = final_segment_score * 100;

    return {
        base_safety,
        final_segment_score,
        segment_safety_percentage,
        breakdown: {
            time_factor: timeFactor,
            poi_count: poiCount,
            poi_score,
            active_users: activeUsers,
            presence_score,
            ml_score,
            road_type_factor: roadTypeFactor,
        },
    };
};

export const getRoutes = async (req, res) => {
    const { origin, destination, mode } = req.body;

    if (
        !origin ||
        !destination ||
        typeof origin.lat !== "number" ||
        typeof origin.lng !== "number" ||
        typeof destination.lat !== "number" ||
        typeof destination.lng !== "number"
    ) {
        return res.status(400).json({
            error: "Origin and destination lat/lng are required",
        });
    }

    try {
        const googleData = await fetchRoutes(origin, destination, mode);

        if (!googleData.routes || googleData.routes.length === 0) {
            return res.status(404).json({ error: "No routes found" });
        }

        const timeFactor = getTimeFactor();

        const processedRoutes = await Promise.all(
            googleData.routes.map(async (route, routeIdx) => {
                const legs = route.legs[0];

                // Build raw segments with context and Places-derived safety signals
                const rawSegments = await Promise.all(
                    legs.steps.map(async (step, stepIdx) => {
                        const context = extractSegmentContext(step);
                        const distanceMeters = step.distance?.value || 0;

                        // Radius based on segment length (clamped)
                        const radius = Math.max(50, Math.min(Math.round(distanceMeters / 2) || 100, 300));

                        const location = {
                            lat: step.start_location.lat,
                            lng: step.start_location.lng,
                        };

                        let poiCount = 0;
                        let openPlaces = 0;

                        try {
                            const nearbyAll = await fetchNearbyPlaces(location, radius, false);
                            poiCount = Array.isArray(nearbyAll.results) ? nearbyAll.results.length : 0;

                            const nearbyOpen = await fetchNearbyPlaces(location, radius, true);
                            openPlaces = Array.isArray(nearbyOpen.results) ? nearbyOpen.results.length : 0;
                        } catch (placesError) {
                            console.error("Places lookup failed for segment", placesError);
                        }

                        // Approximate presence using open places as a proxy for active users
                        // Fallback: active_users = min(poi_count / 2, 10) if no Firebase data
                        const activeUsers = 0;

                        return {
                            step_data: step,
                            context,
                            index: stepIdx,
                            distanceMeters,
                            poiCount,
                            openPlaces,
                            activeUsers,
                        };
                    })
                );

                // Get ML Scores as probabilities (0 -> 1)
                const mlResults = await getSafetyScoresFromML(
                    rawSegments.map((s) => ({
                        index: s.index,
                        context: s.context,
                    }))
                );

                const safetySegments = rawSegments.map((seg, idx) => {
                    const mlEntry = mlResults.find((r) => r.segment_index === idx) || {
                        safety_score: 75,
                    };
                    const mlProbability = Math.max(0, Math.min(1, (mlEntry.safety_score || 75) / 100));

                    const roadTypeFactor = seg.context?.roadTypeFactor || 1.0;
                    const roadType = seg.context?.roadType || 'street';

                    const { base_safety, segment_safety_percentage, breakdown } = computeSegmentSafety({
                        timeFactor,
                        poiCount: seg.poiCount,
                        activeUsers: seg.activeUsers,
                        mlProbability,
                        roadTypeFactor,
                    });

                    const safetyLevel =
                        segment_safety_percentage > 80
                            ? "high"
                            : segment_safety_percentage > 60
                            ? "medium"
                            : "low";

                    const factors = [];
                    const ctx = seg.context;

                    if (ctx.lighting === "well-lit") factors.push("Well Lit");
                    else if (ctx.lighting === "poor") factors.push("Dim Lighting");

                    if (ctx.activity === "busy") factors.push("Active Area");
                    else if (ctx.activity === "isolated") factors.push("Quiet Area");

                    if (seg.poiCount > 0) factors.push("Nearby public places");
                    if (seg.openPlaces > 0) factors.push("Open businesses");

                    return {
                        segment_index: idx,
                        name:
                            seg.step_data.html_instructions?.replace(/<[^>]*>/g, "") ||
                            "Path Segment",
                        start_location: seg.step_data.start_location,
                        end_location: seg.step_data.end_location,
                        distance: seg.step_data.distance,
                        duration: seg.step_data.duration,
                        score: Math.round(segment_safety_percentage),
                        safetyLevel,
                        factors: factors.length > 0 ? factors : ["Standard Route"],
                        breakdown: {
                            ...breakdown,
                            road_type: roadType,
                            base_safety,
                            final_safety_percentage: segment_safety_percentage,
                        },
                    };
                });

                const totalScore = safetySegments.reduce(
                    (acc, seg) => acc + seg.score,
                    0
                );
                const avgScore =
                    safetySegments.length > 0
                        ? totalScore / safetySegments.length
                        : 75;

                const avgPresence =
                    safetySegments.length > 0
                        ? Math.round(
                              safetySegments.reduce(
                                  (acc, seg) => acc + (seg.breakdown?.active_users || 0),
                                  0
                              ) / safetySegments.length
                          )
                        : 0;

                // Find safest and riskiest segments
                const segmentScores = safetySegments.map(s => s.score);
                const safestScore = Math.max(...segmentScores);
                const riskiestScore = Math.min(...segmentScores);

                // ============================================
                // COMPREHENSIVE SAFETY SCORE LOGGING
                // ============================================
                console.log('\n' + '='.repeat(50));
                console.log(`[ROUTE ${routeIdx + 1} SAFETY ANALYSIS]`);
                console.log('='.repeat(50));
                console.log(`Route Summary: ${route.summary || 'N/A'}`);
                console.log(`Total Segments: ${safetySegments.length}`);
                console.log(`Average Safety Score: ${Math.round(avgScore)}%`);
                console.log(`Safest Segment Score: ${safestScore}%`);
                console.log(`Riskiest Segment Score: ${riskiestScore}%`);
                console.log(`Active Users (avg): ${avgPresence}`);
                console.log('\n' + '-'.repeat(50));
                console.log('[SEGMENT BREAKDOWN]');
                console.log('-'.repeat(50));

                safetySegments.forEach((seg, segIdx) => {
                    const bd = seg.breakdown;
                    console.log(`\nSegment ${segIdx + 1}:`);
                    console.log(`  Name: ${seg.name.substring(0, 50)}...`);
                    console.log(`  Coordinates: ${seg.start_location.lat.toFixed(6)}, ${seg.start_location.lng.toFixed(6)}`);
                    console.log(`  Time of day factor: ${bd.time_factor}`);
                    console.log(`  POI count: ${bd.poi_count}`);
                    console.log(`  POI score: ${bd.poi_score.toFixed(3)}`);
                    console.log(`  Active users: ${bd.active_users}`);
                    console.log(`  Presence score: ${bd.presence_score.toFixed(3)}`);
                    console.log(`  ML score: ${bd.ml_score.toFixed(3)}`);
                    console.log(`  Road type: ${bd.road_type || 'street'}`);
                    console.log(`  Road type factor: ${bd.road_type_factor}`);
                    console.log(`  Base safety score = 0.40 × ${bd.time_factor} + 0.30 × ${bd.poi_score.toFixed(3)} + 0.20 × ${bd.presence_score.toFixed(3)} + 0.10 × ${bd.ml_score.toFixed(3)} = ${bd.base_safety.toFixed(3)}`);
                    console.log(`  Final segment safety = ${bd.base_safety.toFixed(3)} × ${bd.road_type_factor} = ${bd.final_safety_percentage.toFixed(2)}%`);
                });

                console.log('\n' + '='.repeat(50));
                console.log(`[ROUTE SAFETY SUMMARY]`);
                console.log('='.repeat(50));
                console.log(`Total segments: ${safetySegments.length}`);
                console.log(`Average safety score: ${Math.round(avgScore)}%`);
                console.log(`Safest segment score: ${safestScore}%`);
                console.log(`Riskiest segment score: ${riskiestScore}%`);
                console.log('='.repeat(50) + '\n');

                return {
                    ...route,
                    id: `route-${routeIdx}`,
                    route_safety_score: Math.round(avgScore),
                    safetyScore: Math.round(avgScore), // Keep for backward compatibility
                    active_users: avgPresence,
                    activeUsers: avgPresence, // Keep for backward compatibility
                    duration: legs.duration?.text || 'N/A',
                    distance: legs.distance?.text || 'N/A',
                    segments: safetySegments,
                    safety_breakdown: safetySegments.map(seg => ({
                        segment_index: seg.segment_index,
                        time_factor: seg.breakdown.time_factor,
                        poi_count: seg.breakdown.poi_count,
                        poi_score: seg.breakdown.poi_score,
                        active_users: seg.breakdown.active_users,
                        presence_score: seg.breakdown.presence_score,
                        ml_score: seg.breakdown.ml_score,
                        road_type: seg.breakdown.road_type,
                        road_type_factor: seg.breakdown.road_type_factor,
                        base_safety: seg.breakdown.base_safety,
                        final_safety_percentage: seg.breakdown.final_safety_percentage,
                    })),
                };
            })
        );

        processedRoutes.sort((a, b) => b.route_safety_score - a.route_safety_score);

        res.json({ routes: processedRoutes });
    } catch (error) {
        console.error("Route processing error:", error);
        res.status(500).json({
            error: "Failed to fetch routes. Please try again in a moment.",
        });
    }
};

export const getPlaceAutocomplete = async (req, res) => {
    const { input } = req.query;

    if (!input) {
        return res.status(400).json({ error: 'Input is required' });
    }

    try {
        const data = await fetchPlaceAutocomplete(input);
        res.json(data);
    } catch (error) {
        console.error("Autocomplete error:", error);
        const message = error.message?.includes("authentication") 
            ? "Google Places API authentication failed. Please check backend configuration."
            : "Failed to fetch autocomplete suggestions";
        res.status(500).json({ error: message });
    }
};

export const getPlaceDetails = async (req, res) => {
    const { placeId } = req.query;
    if (!placeId) {
        return res.status(400).json({ error: 'Place ID is required' });
    }

    try {
        const data = await fetchPlaceDetails(placeId);
        res.json(data);
    } catch (error) {
        console.error("Place details error:", error);
        const message = error.message?.includes("authentication")
            ? "Google Places API authentication failed. Please check backend configuration."
            : "Failed to fetch place details";
        res.status(500).json({ error: message });
    }
};

export const geocodeLocation = async (req, res) => {
    // #region agent log
    const fs = await import('fs');
    const logPath = 'd:\\safety\\.cursor\\debug.log';
    const logEntry = JSON.stringify({location:'mapController.js:327',message:'geocodeLocation entry',data:{address:req.query.address,queryParams:req.query},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
    fs.appendFileSync(logPath, logEntry, 'utf8');
    // #endregion
    
    const { address } = req.query;
    if (!address) {
        // #region agent log
        const logEntry2 = JSON.stringify({location:'mapController.js:332',message:'Missing address param',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
        fs.appendFileSync(logPath, logEntry2, 'utf8');
        // #endregion
        return res.status(400).json({ error: 'Address is required' });
    }

    try {
        // #region agent log
        const logEntry3 = JSON.stringify({location:'mapController.js:337',message:'Before geocodeAddress call',data:{address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})+'\n';
        fs.appendFileSync(logPath, logEntry3, 'utf8');
        // #endregion
        
        const data = await geocodeAddress(address);
        
        // #region agent log
        const logEntry4 = JSON.stringify({location:'mapController.js:340',message:'After geocodeAddress call',data:{hasResults:!!data.results,resultsCount:data.results?.length,firstResult:data.results?.[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D'})+'\n';
        fs.appendFileSync(logPath, logEntry4, 'utf8');
        // #endregion
        
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const location = result.geometry.location;
            const responseData = {
                placeId: result.place_id || `geocoded_${Date.now()}`,
                description: result.formatted_address,
                lat: location.lat,
                lng: location.lng,
            };
            // #region agent log
            const logEntry5 = JSON.stringify({location:'mapController.js:349',message:'Sending success response',data:responseData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})+'\n';
            fs.appendFileSync(logPath, logEntry5, 'utf8');
            // #endregion
            res.json(responseData);
        } else {
            // #region agent log
            const logEntry6 = JSON.stringify({location:'mapController.js:353',message:'No results from geocoding',data:{address,resultsCount:data.results?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n';
            fs.appendFileSync(logPath, logEntry6, 'utf8');
            // #endregion
            res.status(404).json({ error: 'Location not found' });
        }
    } catch (error) {
        // #region agent log
        const logEntry7 = JSON.stringify({location:'mapController.js:357',message:'Geocoding error caught',data:{errorMessage:error?.message,errorStack:error?.stack?.substring(0,300),errorResponse:error?.response?.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})+'\n';
        fs.appendFileSync(logPath, logEntry7, 'utf8');
        // #endregion
        console.error("Geocoding error:", error);
        const message = error.message?.includes("authentication")
            ? "Google Geocoding API authentication failed. Please check backend configuration."
            : "Failed to geocode address";
        res.status(500).json({ error: message });
    }
};
