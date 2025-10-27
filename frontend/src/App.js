import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Box,
    Typography,
    AppBar,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Fab,
    useMediaQuery,
    useTheme,
    CssBaseline,
    ThemeProvider,
    createTheme,
    Switch,
    FormControlLabel,
    Snackbar,
    Alert
} from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard,
    History,
    Settings,
    Notifications,
    Close,
    Refresh
} from '@mui/icons-material';
import io from 'socket.io-client';
import axios from 'axios';

// Import custom components
import MapView from './components/MapView.jsx';
import AlertPopup from './components/AlertPopup.jsx';
import AlertLogModal from './components/AlertLogModal.jsx';
import StatusPanel from './components/StatusPanel.jsx';

// Import utilities
import {
    getCurrentPosition,
    watchPosition,
    clearWatch,
    calculateSpeed,
    isGeolocationSupported
} from './utils/locationUtils';

// Create theme
const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#90caf9',
        },
        secondary: {
            main: '#f48fb1',
        },
    },
});

// Memoized drawer items to prevent unnecessary re-renders
const drawerItems = [
    { text: 'Dashboard', icon: <Dashboard />, action: 'dashboard' },
    { text: 'Alert History', icon: <History />, action: 'alerts' },
    { text: 'Settings', icon: <Settings />, action: 'settings' },
];

function App() {
    // State management
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [driverId, setDriverId] = useState('driver_001');
    const [currentLocation, setCurrentLocation] = useState(null);
    const [tollbooths, setTollbooths] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [currentAlert, setCurrentAlert] = useState(null);
    const [nearestTollbooth, setNearestTollbooth] = useState(null);
    const [locationPermission, setLocationPermission] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [speed, setSpeed] = useState(0);
    const [altitude, setAltitude] = useState(0);
    const [previousLocation, setPreviousLocation] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [alertLogOpen, setAlertLogOpen] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    // Refs
    const watchId = useRef(null);
    const socketRef = useRef(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Memoized tollbooths data
    const tollboothsData = useMemo(() => [
        { id: 1, name: "Tollbooth A - Delhi Gate", lat: 28.7041, lon: 77.1025 },
        { id: 2, name: "Tollbooth B - Gurgaon Expressway", lat: 28.5355, lon: 77.3910 },
        { id: 3, name: "Tollbooth C - Noida Sector 18", lat: 28.4595, lon: 77.0266 },
        { id: 4, name: "Tollbooth D - Faridabad", lat: 28.4089, lon: 77.3178 },
        { id: 5, name: "Tollbooth E - Ghaziabad", lat: 28.6692, lon: 77.4538 }
    ], []);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io('http://localhost:5000', {
            transports: ['websocket'],
            timeout: 20000,
            forceNew: true
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to server');
            setConnected(true);
            showSnackbar('Connected to server');
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from server');
            setConnected(false);
            showSnackbar('Disconnected from server');
        });

        newSocket.on('drowsiness_alert', (alert) => {
            console.log('Drowsiness alert received:', alert);
            setAlerts(prev => [alert, ...prev.slice(0, 99)]); // Keep only last 100 alerts
            setCurrentAlert(alert);
            showSnackbar('Drowsiness alert detected!');
        });

        newSocket.on('driver_alert', (alert) => {
            console.log('Driver-specific alert received:', alert);
            setAlerts(prev => [alert, ...prev.slice(0, 99)]);
            setCurrentAlert(alert);
            showSnackbar('Driver alert received!');
        });

        newSocket.on('location_update', (data) => {
            console.log('Location update received:', data);
            if (data.driver_id === driverId) {
                setCurrentLocation({
                    lat: data.lat,
                    lng: data.lon,
                    timestamp: data.timestamp,
                    accuracy: data.accuracy
                });
            }
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            showSnackbar('Connection error: ' + error.message);
        });

        return () => {
            if (newSocket) {
                newSocket.close();
            }
        };
    }, [driverId]);

    // Load tollbooths on component mount
    useEffect(() => {
        setTollbooths(tollboothsData);
    }, [tollboothsData]);

    // Request location permission and start tracking
    useEffect(() => {
        if (isGeolocationSupported()) {
            getCurrentPosition()
                .then((position) => {
                    setLocationPermission('granted');
                    const { latitude, longitude, altitude: alt } = position.coords;
                    setCurrentLocation({
                        lat: latitude,
                        lng: longitude,
                        timestamp: Date.now(),
                        accuracy: position.coords.accuracy
                    });
                    setAltitude(alt || 0);
                    updateLocationOnServer(latitude, longitude);
                })
                .catch((error) => {
                    setLocationPermission('denied');
                    setLocationError(error.message);
                    showSnackbar('Location access denied: ' + error.message);
                });
        } else {
            setLocationPermission('not-supported');
            setLocationError('Geolocation is not supported by this browser');
            showSnackbar('Geolocation not supported');
        }
    }, []);

    // Calculate speed when location changes
    useEffect(() => {
        if (currentLocation && previousLocation) {
            const calculatedSpeed = calculateSpeed(previousLocation, currentLocation);
            setSpeed(calculatedSpeed);
        }
        setPreviousLocation(currentLocation);
    }, [currentLocation, previousLocation]);

    // Utility functions
    const showSnackbar = useCallback((message) => {
        setSnackbarMessage(message);
        setSnackbarOpen(true);
    }, []);

    const updateLocationOnServer = useCallback(async (lat, lng) => {
        try {
            await axios.post('/api/location/update', {
                driver_id: driverId,
                lat: lat,
                lon: lng,
                timestamp: Date.now() / 1000
            });
        } catch (error) {
            console.error('Error updating location:', error);
        }
    }, [driverId]);

    const startLocationTracking = useCallback(() => {
        if (isGeolocationSupported()) {
            watchId.current = watchPosition(
                (position) => {
                    const { latitude, longitude, altitude: alt } = position.coords;
                    setCurrentLocation({
                        lat: latitude,
                        lng: longitude,
                        timestamp: Date.now(),
                        accuracy: position.coords.accuracy
                    });
                    setAltitude(alt || 0);
                    updateLocationOnServer(latitude, longitude);
                },
                (error) => {
                    console.error('Location tracking error:', error);
                    setLocationError(error.message);
                    showSnackbar('Location tracking error: ' + error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
    }, [updateLocationOnServer, showSnackbar]);

    const stopLocationTracking = useCallback(() => {
        if (watchId.current) {
            clearWatch(watchId.current);
            watchId.current = null;
        }
    }, []);

    const startDetection = useCallback(async () => {
        try {
            await axios.post('/api/detection/start', {
                driver_id: driverId,
                webcam_index: 0
            });
            setDetecting(true);
            startLocationTracking();
            showSnackbar('Detection started');
        } catch (error) {
            console.error('Error starting detection:', error);
            showSnackbar('Failed to start detection: ' + error.message);
        }
    }, [driverId, startLocationTracking, showSnackbar]);

    const stopDetection = useCallback(async () => {
        try {
            await axios.post('/api/detection/stop');
            setDetecting(false);
            stopLocationTracking();
            showSnackbar('Detection stopped');
        } catch (error) {
            console.error('Error stopping detection:', error);
            showSnackbar('Error stopping detection: ' + error.message);
        }
    }, [stopLocationTracking, showSnackbar]);

    const testAlert = useCallback(async () => {
        try {
            await axios.post('/api/test/alert', { driver_id: driverId });
            showSnackbar('Test alert sent');
        } catch (error) {
            console.error('Error testing alert:', error);
            showSnackbar('Error sending test alert: ' + error.message);
        }
    }, [driverId, showSnackbar]);

    const handleLocationUpdate = useCallback((lat, lng) => {
        setCurrentLocation({ lat, lng, timestamp: Date.now() });
        updateLocationOnServer(lat, lng);
    }, [updateLocationOnServer]);

    const handleAlertClose = useCallback(() => {
        setCurrentAlert(null);
    }, []);

    const handleNearestTollboothChange = useCallback((tollbooth) => {
        setNearestTollbooth(tollbooth);
    }, []);

    const handleRefreshLocation = useCallback(() => {
        if (isGeolocationSupported()) {
            getCurrentPosition()
                .then((position) => {
                    const { latitude, longitude, altitude: alt } = position.coords;
                    setCurrentLocation({
                        lat: latitude,
                        lng: longitude,
                        timestamp: Date.now(),
                        accuracy: position.coords.accuracy
                    });
                    setAltitude(alt || 0);
                    updateLocationOnServer(latitude, longitude);
                    showSnackbar('Location refreshed');
                })
                .catch((error) => {
                    setLocationError(error.message);
                    showSnackbar('Error refreshing location: ' + error.message);
                });
        }
    }, [updateLocationOnServer, showSnackbar]);

    const toggleDrawer = useCallback(() => {
        setDrawerOpen(prev => !prev);
    }, []);

    const handleDrawerAction = useCallback((action) => {
        setDrawerOpen(false);
        switch (action) {
            case 'alerts':
                setAlertLogOpen(true);
                break;
            case 'dashboard':
            case 'settings':
            default:
                // Handle other actions
                break;
        }
    }, []);

    const handleSnackbarClose = useCallback(() => {
        setSnackbarOpen(false);
    }, []);

    // Memoized components
    const drawerContent = useMemo(() => (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Menu</Typography>
                <IconButton onClick={toggleDrawer}>
                    <Close />
                </IconButton>
            </Box>
            <List>
                {drawerItems.map((item, index) => (
                    <ListItem key={index} disablePadding>
                        <ListItemButton onClick={() => handleDrawerAction(item.action)}>
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    ), [toggleDrawer, handleDrawerAction]);

    return (
        <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
                {/* App Bar */}
                <AppBar position="static" elevation={2}>
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={toggleDrawer}
                            sx={{ mr: 2 }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            🚗 Real-Time Drowsiness Detection System
                        </Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={isDarkMode}
                                    onChange={(e) => setIsDarkMode(e.target.checked)}
                                    color="default"
                                />
                            }
                            label="Dark Mode"
                            sx={{ color: 'white' }}
                        />
                        <IconButton color="inherit" onClick={() => setAlertLogOpen(true)}>
                            <Notifications />
                        </IconButton>
                    </Toolbar>
                </AppBar>

                {/* Main Content */}
                <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar Drawer */}
                    <Drawer
                        anchor="left"
                        open={drawerOpen}
                        onClose={toggleDrawer}
                        sx={{
                            '& .MuiDrawer-paper': {
                                width: 250,
                                boxSizing: 'border-box',
                            },
                        }}
                    >
                        {drawerContent}
                    </Drawer>

                    {/* Main Content Area */}
                    <Box sx={{ display: 'flex', flex: 1, flexDirection: isMobile ? 'column' : 'row' }}>
                        {/* Control Panel */}
                        <Box sx={{
                            width: isMobile ? '100%' : 350,
                            minHeight: isMobile ? 'auto' : '100%',
                            p: 2,
                            backgroundColor: 'background.paper',
                            borderRight: isMobile ? 'none' : 1,
                            borderBottom: isMobile ? 1 : 'none',
                            borderColor: 'divider',
                            overflow: 'auto'
                        }}>
                            <StatusPanel
                                currentLocation={currentLocation}
                                nearestTollbooth={nearestTollbooth}
                                speed={speed}
                                altitude={altitude}
                                isTracking={detecting}
                                connectionStatus={connected ? 'connected' : 'disconnected'}
                                onRefreshLocation={handleRefreshLocation}
                            />

                            {/* Control Buttons */}
                            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <input
                                    type="text"
                                    value={driverId}
                                    onChange={(e) => setDriverId(e.target.value)}
                                    disabled={detecting}
                                    placeholder="Driver ID"
                                    style={{
                                        padding: '8px 12px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                />

                                <button
                                    onClick={detecting ? stopDetection : startDetection}
                                    disabled={!connected}
                                    style={{
                                        padding: '12px',
                                        backgroundColor: detecting ? '#d32f2f' : '#1976d2',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: connected ? 'pointer' : 'not-allowed',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {detecting ? 'Stop Detection' : 'Start Detection'}
                                </button>

                                <button
                                    onClick={testAlert}
                                    disabled={!connected}
                                    style={{
                                        padding: '12px',
                                        backgroundColor: '#ff9800',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: connected ? 'pointer' : 'not-allowed',
                                        fontSize: '14px'
                                    }}
                                >
                                    Test Alert
                                </button>

                                {locationError && (
                                    <Box sx={{
                                        p: 2,
                                        backgroundColor: 'error.light',
                                        borderRadius: 1,
                                        color: 'error.dark'
                                    }}>
                                        <Typography variant="body2">
                                            Location Error: {locationError}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        {/* Map Area */}
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            <MapView
                                currentLocation={currentLocation}
                                tollbooths={tollbooths}
                                alerts={alerts}
                                nearestTollbooth={nearestTollbooth}
                                onLocationUpdate={handleLocationUpdate}
                                onNearestTollboothChange={handleNearestTollboothChange}
                                isTracking={detecting}
                                sx={{ height: '100%', width: '100%' }}
                            />
                        </Box>
                    </Box>
                </Box>

                {/* Alert Popup */}
                {currentAlert && (
                    <AlertPopup
                        alert={currentAlert}
                        onClose={handleAlertClose}
                        isOpen={!!currentAlert}
                    />
                )}

                {/* Alert Log Modal */}
                <AlertLogModal
                    isOpen={alertLogOpen}
                    onClose={() => setAlertLogOpen(false)}
                    alerts={alerts}
                />

                {/* Floating Action Button for Mobile */}
                {isMobile && (
                    <Fab
                        color="primary"
                        sx={{
                            position: 'fixed',
                            bottom: 16,
                            right: 16,
                            zIndex: 1000
                        }}
                        onClick={handleRefreshLocation}
                    >
                        <Refresh />
                    </Fab>
                )}

                {/* Snackbar for notifications */}
                <Snackbar
                    open={snackbarOpen}
                    autoHideDuration={4000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                >
                    <Alert onClose={handleSnackbarClose} severity="info" sx={{ width: '100%' }}>
                        {snackbarMessage}
                    </Alert>
                </Snackbar>
            </Box>
        </ThemeProvider>
    );
}

export default App;