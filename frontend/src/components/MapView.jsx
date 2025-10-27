import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMapEvents,
    useMap,
    Polyline,
    Circle
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-rotatedmarker';
import {
    Box,
    IconButton,
    Tooltip,
    Fade,
    Chip,
    Typography,
    Fab
} from '@mui/material';
import {
    ZoomIn,
    ZoomOut,
    MyLocation,
    Layers,
    Route
} from '@mui/icons-material';
import {
    calculateDistance,
    calculateBearing,
    findNearestTollbooth,
    formatDistance,
    formatCoordinates,
    interpolateCoordinates,
    isValidCoordinates
} from '../utils/locationUtils';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icons with better styling
const createCustomIcon = (color, iconType, size = 25) => {
    const iconSvg = {
        car: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
            <path d="M8 9h8v6H8z" fill="white"/>
            <circle cx="10" cy="15" r="1" fill="white"/>
            <circle cx="14" cy="15" r="1" fill="white"/>
        </svg>`,
        tollbooth: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="${color}" stroke="white" stroke-width="2"/>
            <rect x="7" y="7" width="10" height="10" fill="white"/>
            <path d="M9 9h6v6H9z" fill="${color}"/>
        </svg>`,
        alert: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>`
    };

    return new L.Icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(iconSvg[iconType]),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
};

// Map themes
const mapThemes = {
    light: {
        name: 'Light',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    dark: {
        name: 'Dark',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    satellite: {
        name: 'Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
    }
};

// Animated marker component
const AnimatedMarker = ({ position, icon, rotation = 0, children }) => {
    const markerRef = useRef();
    const map = useMap();

    useEffect(() => {
        if (markerRef.current) {
            markerRef.current.setLatLng(position);
            if (rotation !== undefined && markerRef.current.setRotationAngle) {
                markerRef.current.setRotationAngle(rotation);
            }
        }
    }, [position, rotation]);

    useEffect(() => {
        if (markerRef.current) {
            markerRef.current.setIcon(icon);
        }
    }, [icon]);

    return (
        <Marker
            ref={markerRef}
            position={position}
            icon={icon}
        >
            {children}
        </Marker>
    );
};

// Pulsing circle for alerts
const PulsingCircle = ({ center, radius, color = '#ff0000' }) => {
    const map = useMap();
    const circleRef = useRef();

    useEffect(() => {
        if (circleRef.current) {
            circleRef.current.setLatLng(center);
            circleRef.current.setRadius(radius);
        }
    }, [center, radius]);

    return (
        <Circle
            ref={circleRef}
            center={center}
            radius={radius}
            pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.8
            }}
        />
    );
};

// Map controls component
const MapControls = ({
    onZoomIn,
    onZoomOut,
    onCenterOnLocation,
    onThemeChange,
    currentTheme,
    onShowRoute,
    showRoute,
    isTracking
}) => {
    const [showThemes, setShowThemes] = useState(false);

    return (
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1000 }}>
            {/* Theme selector */}
            <Box sx={{ position: 'relative', mb: 1 }}>
                <Tooltip title="Map Theme">
                    <IconButton
                        onClick={() => setShowThemes(!showThemes)}
                        sx={{
                            backgroundColor: 'white',
                            boxShadow: 2,
                            '&:hover': { backgroundColor: 'grey.100' }
                        }}
                    >
                        <Layers />
                    </IconButton>
                </Tooltip>

                <Fade in={showThemes}>
                    <Box sx={{
                        position: 'absolute',
                        top: 48,
                        right: 0,
                        backgroundColor: 'white',
                        borderRadius: 1,
                        boxShadow: 3,
                        p: 1,
                        minWidth: 120
                    }}>
                        {Object.entries(mapThemes).map(([key, theme]) => (
                            <Chip
                                key={key}
                                label={theme.name}
                                onClick={() => {
                                    onThemeChange(key);
                                    setShowThemes(false);
                                }}
                                color={currentTheme === key ? 'primary' : 'default'}
                                size="small"
                                sx={{ m: 0.5, display: 'block' }}
                            />
                        ))}
                    </Box>
                </Fade>
            </Box>

            {/* Route toggle */}
            <Tooltip title={showRoute ? "Hide Route" : "Show Route"}>
                <IconButton
                    onClick={onShowRoute}
                    sx={{
                        backgroundColor: 'white',
                        boxShadow: 2,
                        mb: 1,
                        color: showRoute ? 'primary.main' : 'text.primary',
                        '&:hover': { backgroundColor: 'grey.100' }
                    }}
                >
                    <Route />
                </IconButton>
            </Tooltip>

            {/* Zoom controls */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Tooltip title="Zoom In">
                    <IconButton
                        onClick={onZoomIn}
                        sx={{
                            backgroundColor: 'white',
                            boxShadow: 2,
                            '&:hover': { backgroundColor: 'grey.100' }
                        }}
                    >
                        <ZoomIn />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Zoom Out">
                    <IconButton
                        onClick={onZoomOut}
                        sx={{
                            backgroundColor: 'white',
                            boxShadow: 2,
                            '&:hover': { backgroundColor: 'grey.100' }
                        }}
                    >
                        <ZoomOut />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Center on location */}
            <Tooltip title="Center on Location">
                <Fab
                    size="small"
                    onClick={onCenterOnLocation}
                    disabled={!isTracking}
                    sx={{
                        position: 'absolute',
                        bottom: -60,
                        right: 0,
                        backgroundColor: isTracking ? 'primary.main' : 'grey.400',
                        '&:hover': {
                            backgroundColor: isTracking ? 'primary.dark' : 'grey.500'
                        }
                    }}
                >
                    <MyLocation />
                </Fab>
            </Tooltip>
        </Box>
    );
};

// Main MapView component
const MapView = ({
    currentLocation,
    tollbooths = [],
    alerts = [],
    nearestTollbooth,
    onLocationUpdate,
    onNearestTollboothChange,
    isTracking = false,
    className = ''
}) => {
    const [mapTheme, setMapTheme] = useState('light');
    const [showRoute, setShowRoute] = useState(false);
    const [driverHistory, setDriverHistory] = useState([]);
    const [mapRef, setMapRef] = useState(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [alertCircles, setAlertCircles] = useState([]);

    // Create custom icons
    const driverIcon = createCustomIcon('#1976d2', 'car', 30);
    const tollboothIcon = createCustomIcon('#ff9800', 'tollbooth', 25);
    const alertIcon = createCustomIcon('#d32f2f', 'alert', 35);

    // Update driver history for trail
    useEffect(() => {
        if (currentLocation && isTracking) {
            setDriverHistory(prev => {
                const newHistory = [...prev, { ...currentLocation, timestamp: Date.now() }];
                // Keep only last 50 positions for performance
                return newHistory.slice(-50);
            });
        }
    }, [currentLocation, isTracking]);

    // Update nearest tollbooth when location changes
    useEffect(() => {
        if (currentLocation && tollbooths.length > 0) {
            const nearest = findNearestTollbooth(currentLocation, tollbooths);
            if (nearest && onNearestTollboothChange) {
                onNearestTollboothChange(nearest);
            }
        }
    }, [currentLocation, tollbooths, onNearestTollboothChange]);

    // Create alert circles for visual effects
    useEffect(() => {
        const circles = alerts
            .filter(alert => alert.location && isValidCoordinates(alert.location.lat, alert.location.lon))
            .map(alert => ({
                center: [alert.location.lat, alert.location.lon],
                radius: 500, // 500m radius
                color: '#d32f2f'
            }));
        setAlertCircles(circles);
    }, [alerts]);

    // Map event handlers
    const handleMapClick = useCallback((e) => {
        const { lat, lng } = e.latlng;
        if (onLocationUpdate) {
            onLocationUpdate(lat, lng);
        }
    }, [onLocationUpdate]);

    const handleZoomIn = useCallback(() => {
        if (mapRef) {
            mapRef.zoomIn();
        }
    }, [mapRef]);

    const handleZoomOut = useCallback(() => {
        if (mapRef) {
            mapRef.zoomOut();
        }
    }, [mapRef]);

    const handleCenterOnLocation = useCallback(() => {
        if (mapRef && currentLocation) {
            mapRef.setView([currentLocation.lat, currentLocation.lng], 15);
        }
    }, [mapRef, currentLocation]);

    const handleThemeChange = useCallback((theme) => {
        setMapTheme(theme);
    }, []);

    const handleShowRoute = useCallback(() => {
        setShowRoute(prev => !prev);
    }, []);

    // Calculate driver rotation based on movement
    const getDriverRotation = useCallback(() => {
        if (driverHistory.length < 2) return 0;

        const current = driverHistory[driverHistory.length - 1];
        const previous = driverHistory[driverHistory.length - 2];

        return calculateBearing(
            previous.lat,
            previous.lng,
            current.lat,
            current.lng
        );
    }, [driverHistory]);

    // Create route polyline
    const getRoutePolyline = useCallback(() => {
        if (!showRoute || !currentLocation || !nearestTollbooth) return null;

        const tollboothCoords = nearestTollbooth.lat && nearestTollbooth.lon
            ? [nearestTollbooth.lat, nearestTollbooth.lon]
            : nearestTollbooth.tollbooth
                ? [nearestTollbooth.tollbooth.lat, nearestTollbooth.tollbooth.lon]
                : null;

        if (!tollboothCoords) return null;

        return [
            [currentLocation.lat, currentLocation.lng],
            tollboothCoords
        ];
    }, [showRoute, currentLocation, nearestTollbooth]);

    const routePolyline = getRoutePolyline();

    return (
        <Box className={className} sx={{ position: 'relative', height: '100%', width: '100%' }}>
            <MapContainer
                center={currentLocation || [28.6139, 77.2090]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                ref={setMapRef}
            >
                <TileLayer
                    attribution={mapThemes[mapTheme].attribution}
                    url={mapThemes[mapTheme].url}
                />

                {/* Map click handler */}
                <MapClickHandler onMapClick={handleMapClick} />

                {/* Driver location with animation */}
                {currentLocation && (
                    <AnimatedMarker
                        position={[currentLocation.lat, currentLocation.lng]}
                        icon={driverIcon}
                        rotation={getDriverRotation()}
                    >
                        <Popup>
                            <Box sx={{ minWidth: 200 }}>
                                <Typography variant="h6" gutterBottom>
                                    🚗 Driver Location
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    {formatCoordinates(currentLocation.lat, currentLocation.lng)}
                                </Typography>
                                {currentLocation.accuracy && (
                                    <Typography variant="body2" color="text.secondary">
                                        Accuracy: ±{Math.round(currentLocation.accuracy)}m
                                    </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                    Last updated: {new Date().toLocaleTimeString()}
                                </Typography>
                            </Box>
                        </Popup>
                    </AnimatedMarker>
                )}

                {/* Driver trail */}
                {driverHistory.length > 1 && (
                    <Polyline
                        positions={driverHistory.map(pos => [pos.lat, pos.lng])}
                        pathOptions={{
                            color: '#1976d2',
                            weight: 3,
                            opacity: 0.6
                        }}
                    />
                )}

                {/* Tollbooth markers */}
                {tollbooths.map((tollbooth) => (
                    <Marker
                        key={tollbooth.id}
                        position={[tollbooth.lat, tollbooth.lon]}
                        icon={tollboothIcon}
                    >
                        <Popup>
                            <Box sx={{ minWidth: 200 }}>
                                <Typography variant="h6" gutterBottom>
                                    🏢 {tollbooth.name}
                                </Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    {formatCoordinates(tollbooth.lat, tollbooth.lon)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    ID: {tollbooth.id}
                                </Typography>
                                {currentLocation && (
                                    <Typography variant="body2" color="primary.main" fontWeight="bold">
                                        Distance: {formatDistance(
                                            calculateDistance(
                                                currentLocation.lat,
                                                currentLocation.lng,
                                                tollbooth.lat,
                                                tollbooth.lon
                                            )
                                        )}
                                    </Typography>
                                )}
                            </Box>
                        </Popup>
                    </Marker>
                ))}

                {/* Alert markers with pulsing circles */}
                {alerts.map((alert, index) => {
                    if (!alert.location || !isValidCoordinates(alert.location.lat, alert.location.lon)) {
                        return null;
                    }

                    return (
                        <React.Fragment key={alert.id || index}>
                            <Marker
                                position={[alert.location.lat, alert.location.lon]}
                                icon={alertIcon}
                            >
                                <Popup>
                                    <Box sx={{ minWidth: 250 }}>
                                        <Typography variant="h6" color="error.main" gutterBottom>
                                            🚨 Drowsiness Alert
                                        </Typography>
                                        <Typography variant="body2">
                                            Driver: {alert.driver_id}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                            {formatCoordinates(alert.location.lat, alert.location.lon)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Time: {new Date(alert.timestamp * 1000).toLocaleString()}
                                        </Typography>
                                        {alert.nearest_tollbooth && (
                                            <Typography variant="body2" color="warning.main">
                                                Nearest: {alert.nearest_tollbooth.name}
                                            </Typography>
                                        )}
                                    </Box>
                                </Popup>
                            </Marker>
                            <PulsingCircle
                                center={[alert.location.lat, alert.location.lon]}
                                radius={500}
                                color="#d32f2f"
                            />
                        </React.Fragment>
                    );
                })}

                {/* Route to nearest tollbooth */}
                {routePolyline && (
                    <Polyline
                        positions={routePolyline}
                        pathOptions={{
                            color: '#ff9800',
                            weight: 4,
                            opacity: 0.8,
                            dashArray: '10, 10'
                        }}
                    />
                )}
            </MapContainer>

            {/* Map controls */}
            <MapControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onCenterOnLocation={handleCenterOnLocation}
                onThemeChange={handleThemeChange}
                currentTheme={mapTheme}
                onShowRoute={handleShowRoute}
                showRoute={showRoute}
                isTracking={isTracking}
            />

            {/* Status overlay */}
            <Box sx={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                zIndex: 1000,
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap'
            }}>
                {isTracking && (
                    <Chip
                        icon={<MyLocation />}
                        label="Tracking Active"
                        color="success"
                        variant="filled"
                    />
                )}
                {showRoute && nearestTollbooth && (
                    <Chip
                        icon={<Route />}
                        label={`Route to ${nearestTollbooth.name || nearestTollbooth.tollbooth?.name}`}
                        color="warning"
                        variant="filled"
                    />
                )}
                {alerts.length > 0 && (
                    <Chip
                        label={`${alerts.length} Alert${alerts.length !== 1 ? 's' : ''}`}
                        color="error"
                        variant="filled"
                    />
                )}
            </Box>
        </Box>
    );
};

// Map click handler component
const MapClickHandler = ({ onMapClick }) => {
    useMapEvents({
        click: onMapClick
    });
    return null;
};

export default MapView;
