import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Card,
    CardContent,
    Chip,
    IconButton,
    Fade,
    Slide,
    Alert as MuiAlert,
    AlertTitle
} from '@mui/material';
import {
    Warning,
    LocationOn,
    AccessTime,
    DirectionsCar,
    Close,
    NotificationsActive,
    Speed,
    Route
} from '@mui/icons-material';
import { formatDistance, formatCoordinates } from '../utils/locationUtils';

const AlertPopup = ({ alert, onClose, isOpen }) => {
    const [showAnimation, setShowAnimation] = useState(false);
    const [pulseAnimation, setPulseAnimation] = useState(true);

    useEffect(() => {
        if (isOpen && alert) {
            setShowAnimation(true);
            setPulseAnimation(true);

            // Stop pulsing after 10 seconds
            const pulseTimer = setTimeout(() => {
                setPulseAnimation(false);
            }, 10000);

            return () => clearTimeout(pulseTimer);
        }
    }, [isOpen, alert]);

    if (!alert || !isOpen) return null;

    const handleClose = () => {
        setShowAnimation(false);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    const getSeverityLevel = (alert) => {
        // Determine severity based on alert data
        if (alert.severity === 'high' || alert.drowsiness_score > 0.8) return 'error';
        if (alert.severity === 'medium' || alert.drowsiness_score > 0.6) return 'warning';
        return 'info';
    };

    const severityLevel = getSeverityLevel(alert);

    return (
        <>
            {/* Full screen alert overlay */}
            <Fade in={showAnimation} timeout={500}>
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(211, 47, 47, 0.8)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999,
                        animation: pulseAnimation ? 'pulse 1s infinite' : 'none',
                        '@keyframes pulse': {
                            '0%': { opacity: 0.8 },
                            '50%': { opacity: 1 },
                            '100%': { opacity: 0.8 }
                        }
                    }}
                >
                    <Slide direction="up" in={showAnimation} timeout={500}>
                        <Card
                            sx={{
                                maxWidth: 600,
                                width: '90%',
                                maxHeight: '80vh',
                                overflow: 'auto',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                                borderRadius: 3,
                                position: 'relative'
                            }}
                        >
                            {/* Header with close button */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    p: 2,
                                    backgroundColor: 'error.main',
                                    color: 'white',
                                    borderRadius: '12px 12px 0 0'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <NotificationsActive sx={{ fontSize: 32, animation: 'shake 0.5s infinite' }} />
                                    <Typography variant="h4" component="h2" fontWeight="bold">
                                        DROWSINESS ALERT
                                    </Typography>
                                </Box>
                                <IconButton
                                    onClick={handleClose}
                                    sx={{ color: 'white' }}
                                    size="large"
                                >
                                    <Close />
                                </IconButton>
                            </Box>

                            <CardContent sx={{ p: 3 }}>
                                {/* Alert severity indicator */}
                                <MuiAlert
                                    severity={severityLevel}
                                    sx={{ mb: 3 }}
                                    icon={<Warning />}
                                >
                                    <AlertTitle>
                                        {severityLevel === 'error' ? 'CRITICAL ALERT' :
                                            severityLevel === 'warning' ? 'WARNING ALERT' : 'INFO ALERT'}
                                    </AlertTitle>
                                    Driver drowsiness detected! Immediate attention required.
                                </MuiAlert>

                                {/* Driver information */}
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <DirectionsCar color="primary" />
                                        Driver Information
                                    </Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                        <Box>
                                            <Typography variant="body2" color="text.secondary">
                                                Driver ID
                                            </Typography>
                                            <Typography variant="body1" fontWeight="bold">
                                                {alert.driver_id || 'Unknown'}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="body2" color="text.secondary">
                                                Alert Time
                                            </Typography>
                                            <Typography variant="body1" fontWeight="bold">
                                                {new Date(alert.timestamp * 1000).toLocaleString()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Location information */}
                                {alert.location && (
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LocationOn color="primary" />
                                            Location Details
                                        </Typography>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    Coordinates
                                                </Typography>
                                                <Typography variant="body1" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                                                    {formatCoordinates(alert.location.lat, alert.location.lon)}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    Accuracy
                                                </Typography>
                                                <Typography variant="body1" fontWeight="bold">
                                                    {alert.location.accuracy ? `${Math.round(alert.location.accuracy)}m` : 'Unknown'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                )}

                                {/* Nearest tollbooth information */}
                                {alert.nearest_tollbooth && (
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Route color="primary" />
                                            Nearest Tollbooth
                                        </Typography>
                                        <Card variant="outlined" sx={{ p: 2, backgroundColor: 'warning.light', border: '2px solid', borderColor: 'warning.main' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="h6" fontWeight="bold">
                                                    {alert.nearest_tollbooth.name}
                                                </Typography>
                                                <Chip
                                                    label={formatDistance(alert.distance_km)}
                                                    color="warning"
                                                    variant="filled"
                                                    size="small"
                                                />
                                            </Box>
                                            <Typography variant="body2" color="text.secondary">
                                                ID: {alert.nearest_tollbooth.id}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Coordinates: {formatCoordinates(alert.nearest_tollbooth.lat, alert.nearest_tollbooth.lon)}
                                            </Typography>
                                        </Card>
                                    </Box>
                                )}

                                {/* Additional alert data */}
                                {(alert.drowsiness_score || alert.eye_aspect_ratio || alert.blink_frequency) && (
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h6" gutterBottom>
                                            Detection Metrics
                                        </Typography>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                                            {alert.drowsiness_score && (
                                                <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'grey.100', borderRadius: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Drowsiness Score
                                                    </Typography>
                                                    <Typography variant="h6" color="error.main" fontWeight="bold">
                                                        {(alert.drowsiness_score * 100).toFixed(1)}%
                                                    </Typography>
                                                </Box>
                                            )}
                                            {alert.eye_aspect_ratio && (
                                                <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'grey.100', borderRadius: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Eye Aspect Ratio
                                                    </Typography>
                                                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                                                        {alert.eye_aspect_ratio.toFixed(3)}
                                                    </Typography>
                                                </Box>
                                            )}
                                            {alert.blink_frequency && (
                                                <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'grey.100', borderRadius: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Blink Frequency
                                                    </Typography>
                                                    <Typography variant="h6" color="info.main" fontWeight="bold">
                                                        {alert.blink_frequency.toFixed(1)}/min
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                )}

                                {/* Speed information if available */}
                                {alert.speed && (
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Speed color="primary" />
                                            Vehicle Speed
                                        </Typography>
                                        <Typography variant="h4" color="primary.main" fontWeight="bold">
                                            {alert.speed.toFixed(1)} km/h
                                        </Typography>
                                    </Box>
                                )}
                            </CardContent>

                            {/* Action buttons */}
                            <DialogActions sx={{ p: 3, pt: 0 }}>
                                <Button
                                    onClick={handleClose}
                                    variant="outlined"
                                    size="large"
                                    sx={{ mr: 1 }}
                                >
                                    Acknowledge
                                </Button>
                                <Button
                                    onClick={handleClose}
                                    variant="contained"
                                    color="error"
                                    size="large"
                                    startIcon={<NotificationsActive />}
                                >
                                    Send Alert to Tollbooth
                                </Button>
                            </DialogActions>
                        </Card>
                    </Slide>
                </Box>
            </Fade>

            {/* CSS for shake animation */}
            <style>
                {`
                    @keyframes shake {
                        0%, 100% { transform: translateX(0); }
                        25% { transform: translateX(-5px); }
                        75% { transform: translateX(5px); }
                    }
                `}
            </style>
        </>
    );
};

export default AlertPopup;
