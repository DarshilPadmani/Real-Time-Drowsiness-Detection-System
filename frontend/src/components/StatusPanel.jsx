import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    LinearProgress,
    IconButton,
    Tooltip,
    Fade,
    Collapse,
    Grid,
    Divider
} from '@mui/material';
import {
    Speed,
    TrendingUp,
    AccessTime,
    LocationOn,
    DirectionsCar,
    Route,
    SignalCellular4Bar,
    SignalCellularOff,
    ExpandMore,
    ExpandLess,
    Refresh,
    GpsFixed,
    GpsOff
} from '@mui/icons-material';
import { formatDistance, formatCoordinates } from '../utils/locationUtils';

const StatusPanel = ({
    currentLocation,
    nearestTollbooth,
    speed,
    altitude,
    isTracking,
    connectionStatus,
    onRefreshLocation,
    className = ''
}) => {
    const [expanded, setExpanded] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);

    useEffect(() => {
        if (currentLocation) {
            setLastUpdate(new Date());
        }
    }, [currentLocation]);

    const getConnectionStatus = () => {
        if (connectionStatus === 'connected') return { color: 'success', icon: <SignalCellular4Bar />, text: 'Connected' };
        if (connectionStatus === 'connecting') return { color: 'warning', icon: <SignalCellular4Bar />, text: 'Connecting' };
        return { color: 'error', icon: <SignalCellularOff />, text: 'Disconnected' };
    };

    const getTrackingStatus = () => {
        if (isTracking) return { color: 'success', icon: <GpsFixed />, text: 'Tracking' };
        return { color: 'error', icon: <GpsOff />, text: 'Not Tracking' };
    };

    const formatSpeed = (speedValue) => {
        if (speedValue === null || speedValue === undefined) return 'N/A';
        return `${speedValue.toFixed(1)} km/h`;
    };

    const formatAltitude = (altitudeValue) => {
        if (altitudeValue === null || altitudeValue === undefined) return 'N/A';
        return `${altitudeValue.toFixed(0)} m`;
    };

    const getSpeedColor = (speedValue) => {
        if (speedValue === null || speedValue === undefined) return 'default';
        if (speedValue > 100) return 'error';
        if (speedValue > 60) return 'warning';
        return 'success';
    };

    const connectionStatusInfo = getConnectionStatus();
    const trackingStatusInfo = getTrackingStatus();

    return (
        <Card className={className} sx={{
            position: 'relative',
            overflow: 'visible',
            '&:hover': {
                boxShadow: 3
            }
        }}>
            {/* Header */}
            <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" component="h3" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DirectionsCar color="primary" />
                        Driver Status
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Refresh Location">
                            <IconButton
                                size="small"
                                onClick={onRefreshLocation}
                                disabled={!isTracking}
                            >
                                <Refresh />
                            </IconButton>
                        </Tooltip>
                        <IconButton
                            size="small"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                    </Box>
                </Box>

                {/* Status Indicators */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                        icon={connectionStatusInfo.icon}
                        label={connectionStatusInfo.text}
                        color={connectionStatusInfo.color}
                        size="small"
                        variant="outlined"
                    />
                    <Chip
                        icon={trackingStatusInfo.icon}
                        label={trackingStatusInfo.text}
                        color={trackingStatusInfo.color}
                        size="small"
                        variant="outlined"
                    />
                </Box>

                {/* Main Status Grid */}
                <Grid container spacing={2}>
                    {/* Speed */}
                    <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Speed color="primary" sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" fontWeight="bold" color={`${getSpeedColor(speed)}.main`}>
                                {formatSpeed(speed)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Current Speed
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Altitude */}
                    <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                            <TrendingUp color="primary" sx={{ fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" fontWeight="bold">
                                {formatAltitude(altitude)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Altitude
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                {/* Last Update Time */}
                {lastUpdate && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <AccessTime fontSize="small" />
                            Last updated: {lastUpdate.toLocaleTimeString()}
                        </Typography>
                    </Box>
                )}
            </CardContent>

            {/* Expandable Details */}
            <Collapse in={expanded} timeout="auto">
                <Divider />
                <CardContent sx={{ pt: 2 }}>
                    {/* Location Details */}
                    {currentLocation && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <LocationOn color="primary" />
                                Current Location
                            </Typography>
                            <Box sx={{
                                p: 2,
                                backgroundColor: 'primary.light',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'primary.main'
                            }}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                                    {formatCoordinates(currentLocation.lat, currentLocation.lng)}
                                </Typography>
                                {currentLocation.accuracy && (
                                    <Typography variant="body2" color="text.secondary">
                                        Accuracy: ±{Math.round(currentLocation.accuracy)}m
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Nearest Tollbooth */}
                    {nearestTollbooth && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Route color="warning" />
                                Nearest Tollbooth
                            </Typography>
                            <Box sx={{
                                p: 2,
                                backgroundColor: 'warning.light',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'warning.main'
                            }}>
                                <Typography variant="body1" fontWeight="bold" sx={{ mb: 1 }}>
                                    {nearestTollbooth.name || nearestTollbooth.tollbooth?.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    ID: {nearestTollbooth.id || nearestTollbooth.tollbooth?.id}
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Distance:
                                    </Typography>
                                    <Chip
                                        label={formatDistance(nearestTollbooth.distance_km)}
                                        color="warning"
                                        size="small"
                                    />
                                </Box>
                                {nearestTollbooth.lat && nearestTollbooth.lon && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontFamily: 'monospace' }}>
                                        {formatCoordinates(nearestTollbooth.lat, nearestTollbooth.lon)}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Performance Metrics */}
                    <Box>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                            Performance Metrics
                        </Typography>

                        {/* GPS Accuracy */}
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2">GPS Accuracy</Typography>
                                <Typography variant="body2">
                                    {currentLocation?.accuracy ? `${Math.round(currentLocation.accuracy)}m` : 'N/A'}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={currentLocation?.accuracy ? Math.max(0, 100 - (currentLocation.accuracy / 10)) : 0}
                                color={currentLocation?.accuracy < 10 ? 'success' : currentLocation?.accuracy < 50 ? 'warning' : 'error'}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>

                        {/* Connection Quality */}
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2">Connection Quality</Typography>
                                <Typography variant="body2">
                                    {connectionStatus === 'connected' ? 'Excellent' : 'Poor'}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={connectionStatus === 'connected' ? 100 : connectionStatus === 'connecting' ? 50 : 0}
                                color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'connecting' ? 'warning' : 'error'}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>

                        {/* Tracking Status */}
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2">Location Tracking</Typography>
                                <Typography variant="body2">
                                    {isTracking ? 'Active' : 'Inactive'}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={isTracking ? 100 : 0}
                                color={isTracking ? 'success' : 'error'}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                        </Box>
                    </Box>
                </CardContent>
            </Collapse>
        </Card>
    );
};

export default StatusPanel;
