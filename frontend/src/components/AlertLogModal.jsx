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
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    TextField,
    InputAdornment,
    Tabs,
    Tab,
    Badge,
    Tooltip,
    Fade,
    Collapse
} from '@mui/material';
import {
    History,
    Search,
    FilterList,
    Close,
    Warning,
    Error,
    Info,
    LocationOn,
    AccessTime,
    DirectionsCar,
    Route,
    Speed,
    ExpandMore,
    ExpandLess
} from '@mui/icons-material';
import { formatDistance, formatCoordinates } from '../utils/locationUtils';

const AlertLogModal = ({ isOpen, onClose, alerts = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [sortBy, setSortBy] = useState('timestamp');
    const [expandedAlert, setExpandedAlert] = useState(null);
    const [filteredAlerts, setFilteredAlerts] = useState([]);

    useEffect(() => {
        let filtered = [...alerts];

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(alert =>
                alert.driver_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                alert.nearest_tollbooth?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                alert.location?.lat?.toString().includes(searchTerm) ||
                alert.location?.lon?.toString().includes(searchTerm)
            );
        }

        // Filter by severity
        if (filterSeverity !== 'all') {
            filtered = filtered.filter(alert => {
                const severity = getSeverityLevel(alert);
                return severity === filterSeverity;
            });
        }

        // Sort alerts
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'timestamp':
                    return b.timestamp - a.timestamp;
                case 'driver':
                    return (a.driver_id || '').localeCompare(b.driver_id || '');
                case 'distance':
                    return (a.distance_km || 0) - (b.distance_km || 0);
                default:
                    return 0;
            }
        });

        setFilteredAlerts(filtered);
    }, [alerts, searchTerm, filterSeverity, sortBy]);

    const getSeverityLevel = (alert) => {
        if (alert.severity === 'high' || alert.drowsiness_score > 0.8) return 'error';
        if (alert.severity === 'medium' || alert.drowsiness_score > 0.6) return 'warning';
        return 'info';
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'error': return 'error';
            case 'warning': return 'warning';
            default: return 'info';
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'error': return <Error />;
            case 'warning': return <Warning />;
            default: return <Info />;
        }
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const toggleExpanded = (alertId) => {
        setExpandedAlert(expandedAlert === alertId ? null : alertId);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterSeverity('all');
        setSortBy('timestamp');
    };

    const getAlertCountBySeverity = (severity) => {
        return alerts.filter(alert => getSeverityLevel(alert) === severity).length;
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { height: '80vh' }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'primary.main',
                color: 'white'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <History />
                    <Typography variant="h6" component="div">
                        Alert History
                    </Typography>
                    <Badge badgeContent={alerts.length} color="secondary" />
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'white' }}>
                    <Close />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Filters and Search */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <TextField
                        fullWidth
                        placeholder="Search alerts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ mb: 2 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Tabs
                            value={filterSeverity}
                            onChange={(e, value) => setFilterSeverity(value)}
                            sx={{ minHeight: 'auto' }}
                        >
                            <Tab
                                label={`All (${alerts.length})`}
                                value="all"
                                sx={{ minHeight: 'auto', py: 1 }}
                            />
                            <Tab
                                label={
                                    <Badge badgeContent={getAlertCountBySeverity('error')} color="error">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Error fontSize="small" />
                                            Critical
                                        </Box>
                                    </Badge>
                                }
                                value="error"
                                sx={{ minHeight: 'auto', py: 1 }}
                            />
                            <Tab
                                label={
                                    <Badge badgeContent={getAlertCountBySeverity('warning')} color="warning">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Warning fontSize="small" />
                                            Warning
                                        </Box>
                                    </Badge>
                                }
                                value="warning"
                                sx={{ minHeight: 'auto', py: 1 }}
                            />
                            <Tab
                                label={
                                    <Badge badgeContent={getAlertCountBySeverity('info')} color="info">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Info fontSize="small" />
                                            Info
                                        </Box>
                                    </Badge>
                                }
                                value="info"
                                sx={{ minHeight: 'auto', py: 1 }}
                            />
                        </Tabs>

                        <TextField
                            select
                            label="Sort by"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            size="small"
                            sx={{ minWidth: 120 }}
                            SelectProps={{ native: true }}
                        >
                            <option value="timestamp">Time</option>
                            <option value="driver">Driver</option>
                            <option value="distance">Distance</option>
                        </TextField>

                        <Button
                            startIcon={<FilterList />}
                            onClick={clearFilters}
                            size="small"
                            variant="outlined"
                        >
                            Clear Filters
                        </Button>
                    </Box>
                </Box>

                {/* Alert List */}
                <Box sx={{ height: 'calc(80vh - 200px)', overflow: 'auto' }}>
                    {filteredAlerts.length === 0 ? (
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            p: 4
                        }}>
                            <History sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                No alerts found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {searchTerm || filterSeverity !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'No alerts have been recorded yet'}
                            </Typography>
                        </Box>
                    ) : (
                        <List>
                            {filteredAlerts.map((alert, index) => {
                                const severity = getSeverityLevel(alert);
                                const isExpanded = expandedAlert === alert.id || expandedAlert === index;

                                return (
                                    <React.Fragment key={alert.id || index}>
                                        <ListItem
                                            button
                                            onClick={() => toggleExpanded(alert.id || index)}
                                            sx={{
                                                backgroundColor: isExpanded ? 'action.hover' : 'transparent',
                                                '&:hover': {
                                                    backgroundColor: 'action.hover'
                                                }
                                            }}
                                        >
                                            <ListItemIcon>
                                                {getSeverityIcon(severity)}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                            Driver {alert.driver_id}
                                                        </Typography>
                                                        <Chip
                                                            label={severity.toUpperCase()}
                                                            color={getSeverityColor(severity)}
                                                            size="small"
                                                        />
                                                        {alert.distance_km && (
                                                            <Chip
                                                                label={formatDistance(alert.distance_km)}
                                                                variant="outlined"
                                                                size="small"
                                                            />
                                                        )}
                                                    </Box>
                                                }
                                                secondary={
                                                    <Box>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {formatTimestamp(alert.timestamp)}
                                                        </Typography>
                                                        {alert.nearest_tollbooth && (
                                                            <Typography variant="body2" color="text.secondary">
                                                                Near: {alert.nearest_tollbooth.name}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                }
                                            />
                                            <IconButton size="small">
                                                {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                            </IconButton>
                                        </ListItem>

                                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                            <Card variant="outlined" sx={{ mx: 2, mb: 1 }}>
                                                <CardContent sx={{ pt: 1 }}>
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                                        {alert.location && (
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                                    <LocationOn fontSize="small" sx={{ mr: 0.5 }} />
                                                                    Location
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                                    {formatCoordinates(alert.location.lat, alert.location.lon)}
                                                                </Typography>
                                                            </Box>
                                                        )}

                                                        <Box>
                                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                                <AccessTime fontSize="small" sx={{ mr: 0.5 }} />
                                                                Time
                                                            </Typography>
                                                            <Typography variant="body2">
                                                                {new Date(alert.timestamp * 1000).toLocaleString()}
                                                            </Typography>
                                                        </Box>

                                                        {alert.speed && (
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                                    <Speed fontSize="small" sx={{ mr: 0.5 }} />
                                                                    Speed
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {alert.speed.toFixed(1)} km/h
                                                                </Typography>
                                                            </Box>
                                                        )}

                                                        {alert.drowsiness_score && (
                                                            <Box>
                                                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                                    Drowsiness Score
                                                                </Typography>
                                                                <Typography variant="body2" color="error.main" fontWeight="bold">
                                                                    {(alert.drowsiness_score * 100).toFixed(1)}%
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>

                                                    {alert.nearest_tollbooth && (
                                                        <Box sx={{ mt: 2, p: 2, backgroundColor: 'warning.light', borderRadius: 1 }}>
                                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                                <Route fontSize="small" sx={{ mr: 0.5 }} />
                                                                Nearest Tollbooth
                                                            </Typography>
                                                            <Typography variant="body1" fontWeight="bold">
                                                                {alert.nearest_tollbooth.name}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                ID: {alert.nearest_tollbooth.id} |
                                                                Distance: {formatDistance(alert.distance_km)}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Collapse>

                                        {index < filteredAlerts.length - 1 && <Divider />}
                                    </React.Fragment>
                                );
                            })}
                        </List>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Button onClick={onClose} variant="outlined">
                    Close
                </Button>
                <Button
                    onClick={() => {
                        // Export functionality could be added here
                        console.log('Export alerts:', filteredAlerts);
                    }}
                    variant="contained"
                >
                    Export Data
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AlertLogModal;
