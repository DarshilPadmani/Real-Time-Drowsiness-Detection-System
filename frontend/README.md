# Enhanced Drowsiness Detection System - Frontend

A professional, real-time, and highly interactive React frontend for the Drowsiness Detection System with advanced map functionality.

## 🚀 Features

### 🗺️ Interactive Map Component
- **Real-time position tracking** with smooth animations
- **Multiple map themes** (Light, Dark, Satellite)
- **Custom animated markers** for driver, tollbooths, and alerts
- **Route visualization** between driver and nearest tollbooth
- **Pulsing alert circles** for visual impact
- **Driver movement trail** showing recent path
- **Responsive design** optimized for mobile and desktop

### 🚨 Advanced Alert System
- **Modern alert popup** with Material-UI components
- **Alert history modal** with filtering and search
- **Real-time notifications** with sound and visual effects
- **Severity-based styling** (Critical, Warning, Info)
- **Detailed alert metrics** (drowsiness score, eye aspect ratio, etc.)

### 📊 Status Panel
- **Live speed and altitude** tracking
- **GPS accuracy indicators** with progress bars
- **Connection quality** monitoring
- **Expandable details** with performance metrics
- **Location refresh** functionality

### 🎨 UI/UX Enhancements
- **Dark/Light theme toggle** with Material-UI theming
- **Smooth animations** and transitions
- **Mobile-responsive** design with drawer navigation
- **Professional styling** with gradients and shadows
- **Accessibility features** with proper ARIA labels

## 🛠️ Technical Stack

- **React 18** with functional components and hooks
- **Material-UI (MUI)** for modern UI components
- **React Leaflet** for interactive maps
- **Socket.IO** for real-time communication
- **Axios** for HTTP requests
- **Custom utilities** for location calculations

## 📦 Installation

1. Install dependencies:
```bash
npm install
```

2. Install additional map dependencies:
```bash
npm install react-leaflet-animated-marker leaflet-rotatedmarker leaflet-routing-machine react-leaflet-routing-machine @mui/material @emotion/react @emotion/styled @mui/icons-material
```

3. Start the development server:
```bash
npm start
```

## 🗂️ Project Structure

```
frontend/src/
├── components/
│   ├── MapView.jsx          # Enhanced map component with animations
│   ├── AlertPopup.jsx       # Modern alert popup with animations
│   ├── AlertLogModal.jsx    # Alert history modal with filtering
│   └── StatusPanel.jsx      # Status panel with metrics
├── utils/
│   └── locationUtils.js     # Location calculation utilities
├── App.js                   # Main application component
├── index.js                 # Application entry point
└── index.css               # Enhanced styling
```

## 🎯 Key Components

### MapView Component
- Real-time driver position tracking
- Animated markers with rotation based on movement direction
- Multiple map themes (Light, Dark, Satellite)
- Route visualization to nearest tollbooth
- Pulsing alert circles for visual impact
- Driver movement trail
- Map controls (zoom, center, theme toggle)

### AlertPopup Component
- Modern Material-UI design
- Severity-based styling
- Detailed alert information
- Smooth animations and transitions
- Action buttons for alert handling

### StatusPanel Component
- Live speed and altitude display
- GPS accuracy indicators
- Connection status monitoring
- Expandable details section
- Performance metrics visualization

### Location Utilities
- Haversine distance calculations
- Bearing calculations for marker rotation
- Speed calculations between positions
- Coordinate validation and formatting
- Geolocation API wrapper functions

## 🎨 Styling Features

- **Gradient backgrounds** for modern look
- **Smooth animations** with CSS keyframes
- **Responsive design** for all screen sizes
- **Dark mode support** with theme switching
- **Custom scrollbars** and hover effects
- **Professional shadows** and borders

## 📱 Mobile Optimization

- **Responsive layout** that adapts to screen size
- **Touch-friendly controls** for mobile devices
- **Drawer navigation** for better mobile UX
- **Floating action buttons** for quick actions
- **Optimized map controls** for touch interaction

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the frontend directory:
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

### Map Configuration
The map supports multiple tile providers:
- **OpenStreetMap** (default light theme)
- **CartoDB Dark** (dark theme)
- **Esri Satellite** (satellite theme)

### Alert Configuration
Alerts can be configured with different severity levels:
- **Critical** (red) - High drowsiness score or critical alerts
- **Warning** (orange) - Medium drowsiness score
- **Info** (blue) - Low drowsiness score or informational alerts

## 🚀 Performance Optimizations

- **Efficient re-renders** with React.memo and useCallback
- **Debounced location updates** to prevent excessive API calls
- **Limited history tracking** (last 50 positions) for performance
- **Lazy loading** of map components
- **Optimized animations** with CSS transforms

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## 📦 Building for Production

Build the application:
```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

## 🔄 Real-time Features

- **WebSocket connection** for real-time updates
- **Live location tracking** with GPS
- **Instant alert notifications** when drowsiness is detected
- **Real-time map updates** with smooth animations
- **Live status monitoring** of connection and tracking

## 🎯 Future Enhancements

- **3D map visualization** with Mapbox GL JS
- **Voice alerts** for hands-free operation
- **Offline map support** for areas with poor connectivity
- **Advanced analytics** dashboard
- **Multi-driver tracking** support
- **Custom map markers** and overlays

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions, please contact the development team or create an issue in the repository.
