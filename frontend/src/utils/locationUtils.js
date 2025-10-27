/**
 * Location utilities for distance calculations, geolocation handling, and coordinate operations
 */

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Convert degrees to radians
 * @param {number} degrees - Degrees to convert
 * @returns {number} Radians
 */
const toRadians = (degrees) => {
    return degrees * (Math.PI / 180);
};

/**
 * Find the nearest tollbooth to a given location
 * @param {Object} location - {lat, lng} coordinates
 * @param {Array} tollbooths - Array of tollbooth objects with lat, lon properties
 * @returns {Object} Nearest tollbooth with distance
 */
export const findNearestTollbooth = (location, tollbooths) => {
    if (!location || !tollbooths || tollbooths.length === 0) {
        return null;
    }

    let nearest = null;
    let minDistance = Infinity;

    tollbooths.forEach(tollbooth => {
        const distance = calculateDistance(
            location.lat,
            location.lng,
            tollbooth.lat,
            tollbooth.lon
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearest = {
                ...tollbooth,
                distance_km: distance
            };
        }
    });

    return nearest;
};

/**
 * Calculate bearing between two coordinates
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Bearing in degrees
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const dLon = toRadians(lon2 - lon1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = Math.atan2(y, x);
    bearing = toDegrees(bearing);
    bearing = (bearing + 360) % 360;

    return bearing;
};

/**
 * Convert radians to degrees
 * @param {number} radians - Radians to convert
 * @returns {number} Degrees
 */
const toDegrees = (radians) => {
    return radians * (180 / Math.PI);
};

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(2)}km`;
};

/**
 * Format coordinates for display
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} precision - Decimal places (default: 6)
 * @returns {string} Formatted coordinates
 */
export const formatCoordinates = (lat, lng, precision = 6) => {
    return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
};

/**
 * Check if geolocation is supported by the browser
 * @returns {boolean} True if geolocation is supported
 */
export const isGeolocationSupported = () => {
    return 'geolocation' in navigator;
};

/**
 * Get current position with error handling
 * @param {Object} options - Geolocation options
 * @returns {Promise} Promise that resolves with position or rejects with error
 */
export const getCurrentPosition = (options = {}) => {
    const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
    };

    return new Promise((resolve, reject) => {
        if (!isGeolocationSupported()) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { ...defaultOptions, ...options }
        );
    });
};

/**
 * Watch position with error handling
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 * @param {Object} options - Geolocation options
 * @returns {number} Watch ID
 */
export const watchPosition = (onSuccess, onError, options = {}) => {
    const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    if (!isGeolocationSupported()) {
        onError(new Error('Geolocation is not supported by this browser'));
        return null;
    }

    return navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        { ...defaultOptions, ...options }
    );
};

/**
 * Clear position watch
 * @param {number} watchId - Watch ID to clear
 */
export const clearWatch = (watchId) => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
    }
};

/**
 * Calculate speed between two positions
 * @param {Object} pos1 - First position {lat, lng, timestamp}
 * @param {Object} pos2 - Second position {lat, lng, timestamp}
 * @returns {number} Speed in km/h
 */
export const calculateSpeed = (pos1, pos2) => {
    if (!pos1 || !pos2 || !pos1.timestamp || !pos2.timestamp) {
        return 0;
    }

    const distance = calculateDistance(pos1.lat, pos1.lng, pos2.lat, pos2.lng);
    const timeDiff = (pos2.timestamp - pos1.timestamp) / 1000; // Convert to seconds

    if (timeDiff <= 0) {
        return 0;
    }

    const speedKmh = (distance / timeDiff) * 3600; // Convert to km/h
    return Math.max(0, speedKmh);
};

/**
 * Smooth coordinate interpolation for animations
 * @param {Object} from - Starting position {lat, lng}
 * @param {Object} to - Target position {lat, lng}
 * @param {number} progress - Progress from 0 to 1
 * @returns {Object} Interpolated position {lat, lng}
 */
export const interpolateCoordinates = (from, to, progress) => {
    const clampedProgress = Math.max(0, Math.min(1, progress));

    return {
        lat: from.lat + (to.lat - from.lat) * clampedProgress,
        lng: from.lng + (to.lng - from.lng) * clampedProgress
    };
};

/**
 * Validate coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are valid
 */
export const isValidCoordinates = (lat, lng) => {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !isNaN(lat) && !isNaN(lng)
    );
};

/**
 * Create a bounding box around a point
 * @param {Object} center - Center point {lat, lng}
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} Bounding box {north, south, east, west}
 */
export const createBoundingBox = (center, radiusKm) => {
    const latDelta = radiusKm / 111; // Approximate degrees per km
    const lngDelta = radiusKm / (111 * Math.cos(toRadians(center.lat)));

    return {
        north: center.lat + latDelta,
        south: center.lat - latDelta,
        east: center.lng + lngDelta,
        west: center.lng - lngDelta
    };
};
