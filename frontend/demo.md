# Enhanced Map Component Demo

## 🎯 Quick Start Guide

### 1. Starting the Application
```bash
cd frontend
npm install
npm start
```

The application will open at `http://localhost:3000`

### 2. Basic Usage

#### Enable Location Tracking
1. Click "Start Detection" button
2. Allow location access when prompted
3. Watch your position appear on the map with a blue car marker

#### Test Alert System
1. Click "Test Alert" button
2. See the dramatic alert popup with animations
3. Notice the red pulsing circle around the alert location

#### Explore Map Features
1. **Theme Toggle**: Click the layers icon (top-right) to switch between Light, Dark, and Satellite themes
2. **Route Visualization**: Click the route icon to show/hide the path to the nearest tollbooth
3. **Zoom Controls**: Use the +/- buttons or mouse wheel to zoom
4. **Center on Location**: Click the GPS icon to center the map on your current position

### 3. Advanced Features

#### Alert History
1. Click the notifications icon in the header
2. View all previous alerts with filtering options
3. Search alerts by driver ID, location, or tollbooth
4. Filter by severity level (Critical, Warning, Info)

#### Status Panel
1. View real-time speed and altitude
2. Click the expand arrow to see detailed metrics
3. Monitor GPS accuracy and connection quality
4. Refresh location data manually

#### Mobile Experience
1. Open on mobile device or resize browser window
2. Use the drawer menu (hamburger icon) for navigation
3. Touch and drag to pan the map
4. Pinch to zoom on touch devices

### 4. Visual Effects

#### Driver Marker
- **Blue pulsing circle** indicates active tracking
- **Rotation** based on movement direction
- **Smooth animations** when position updates

#### Alert Markers
- **Red pulsing circles** around alert locations
- **Animated popup** with shake effect
- **Severity-based colors** (red for critical, orange for warning)

#### Map Themes
- **Light Theme**: Clean, professional look with OpenStreetMap
- **Dark Theme**: Modern dark interface with CartoDB tiles
- **Satellite Theme**: Real satellite imagery from Esri

### 5. Real-time Updates

#### Location Tracking
- **Continuous GPS updates** every few seconds
- **Speed calculation** based on position changes
- **Movement trail** showing recent path
- **Automatic tollbooth detection** for nearest location

#### Alert Notifications
- **Instant popup** when drowsiness is detected
- **Sound alerts** (if enabled)
- **Visual indicators** on the map
- **Status updates** in the control panel

### 6. Performance Tips

#### For Best Performance
- **Close unused browser tabs** to free up memory
- **Use Chrome or Firefox** for optimal performance
- **Enable hardware acceleration** in browser settings
- **Keep the map zoomed out** when not actively tracking

#### For Mobile Devices
- **Use landscape mode** for better map visibility
- **Close other apps** to free up resources
- **Enable location services** for accurate tracking
- **Use Wi-Fi** when possible for better connectivity

### 7. Troubleshooting

#### Common Issues

**Map not loading:**
- Check internet connection
- Try refreshing the page
- Clear browser cache

**Location not updating:**
- Check location permissions
- Ensure GPS is enabled
- Try refreshing the page

**Alerts not showing:**
- Check WebSocket connection status
- Verify backend is running
- Check browser console for errors

**Performance issues:**
- Close other browser tabs
- Reduce map zoom level
- Disable unnecessary browser extensions

### 8. Keyboard Shortcuts

- **Space**: Toggle detection on/off
- **R**: Refresh location
- **T**: Toggle theme
- **H**: Show/hide alert history
- **Esc**: Close modals and popups

### 9. Customization

#### Changing Map Themes
Edit `MapView.jsx` and modify the `mapThemes` object:
```javascript
const mapThemes = {
    light: { /* light theme config */ },
    dark: { /* dark theme config */ },
    satellite: { /* satellite theme config */ },
    custom: { /* your custom theme */ }
};
```

#### Modifying Alert Styling
Edit `AlertPopup.jsx` to customize:
- Alert colors and animations
- Popup layout and content
- Button styles and actions

#### Adjusting Map Controls
Edit `MapView.jsx` to modify:
- Control button positions
- Icon styles and colors
- Animation speeds and effects

### 10. Integration with Backend

The frontend expects the backend to provide:
- **WebSocket events**: `drowsiness_alert`, `driver_alert`, `location_update`
- **REST API endpoints**: `/api/detection/start`, `/api/detection/stop`, `/api/location/update`
- **Alert data structure** with location, timestamp, and driver information

For full integration, ensure your backend is running on `http://localhost:5000` and implements the required API endpoints.
