/**
 * Leaflet implementation of the Map Interface
 * @module gnss/survey/map/LeafletAdapter
 */
import { MapInterface } from './MapInterface.js';
import { Coordinate } from '../core/Coordinate.js';

export class LeafletAdapter extends MapInterface {
  /**
     * Initialize the Leaflet adapter
     * @param {Object} options - Configuration options for Leaflet
     * @param {Object} [options.mapOptions] - Leaflet initialization options
     * @param {string} [options.tileLayerUrl] - URL for the tile layer
     * @param {Object} [options.tileLayerOptions] - Options for the tile layer
     */
  constructor(options = {}) {
    super(options);
        
    this.map = null;
    this.apiLoaded = false;
    this.mapOptions = options.mapOptions || {
      center: [0, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
    };
        
    this.tileLayerUrl = options.tileLayerUrl || 
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
    // Keep track of event listeners for cleanup
    // Structure: Map<eventType, Map<listenerFunction, handle>>
    this.eventListeners = new Map();
        
    this.tileLayerOptions = options.tileLayerOptions || {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };
        
    // Keep track of event listeners for cleanup
    this.eventListeners = new Map();
  }
    
  /**
     * Set the cursor style for the map
     * @param {string} cursorType - CSS cursor value (e.g., 'default', 'pointer', 'crosshair')
     * @returns {void}
     */
  setCursor(cursorType) {
    if (!this.map) {
      return;
    }
    this.map.getContainer().style.cursor = cursorType;
  }
    
  /**
     * Load the Leaflet API if not already loaded
     * @returns {Promise<void>} - Promise that resolves when the API is loaded
     * @private
     */
  async _loadLeafletAPI() {
    if (window.L) {
      this.apiLoaded = true;
      return Promise.resolve();
    }
        
    const loadCSS = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      link.onload = resolve;
      link.onerror = () => reject(new Error('Failed to load Leaflet CSS'));
      document.head.appendChild(link);
    });
        
    const loadJS = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.async = true;
      script.onload = () => {
        this.apiLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Leaflet JS'));
      document.head.appendChild(script);
    });
        
    return Promise.all([loadCSS, loadJS]);
  }
    
  /**
     * Initialize the map with the specified container
     * @param {string|HTMLElement} container - The HTML element or element ID to contain the map
     * @returns {Promise<void>} - Promise that resolves when the map is initialized
     */
  async initialize(container) {
    await this._loadLeafletAPI();
        
    const element = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
            
    if (!element) {
      throw new Error(`Map container element not found: ${container}`);
    }
        
    this.map = L.map(element, this.mapOptions);
        
    // Add the base tile layer
    L.tileLayer(this.tileLayerUrl, this.tileLayerOptions).addTo(this.map);
        
    return Promise.resolve();
  }
    
  /**
     * Convert a Coordinate to a Leaflet LatLng
     * @param {Coordinate} coordinate - The coordinate to convert
     * @returns {L.LatLng} - Leaflet LatLng object
     * @private
     */
  _toLatLng(coordinate) {
    return L.latLng(coordinate.latitude, coordinate.longitude);
  }
    
  /**
     * Convert a Leaflet LatLng to a Coordinate
     * @param {L.LatLng} latLng - The Leaflet LatLng to convert
     * @param {number} [elevation] - Optional elevation value
     * @returns {Coordinate} - Coordinate instance
     * @private
     */
  _toCoordinate(latLng, elevation = null) {
    return new Coordinate(latLng.lat, latLng.lng, elevation);
  }
    
  /**
     * Set the center of the map to the specified coordinate
     * @param {Coordinate} coordinate - The coordinate to center the map on
     * @returns {Promise<void>} - Promise that resolves when the map is centered
     */
  async setCenter(coordinate) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    this.map.setView(this._toLatLng(coordinate), this.map.getZoom());
    return Promise.resolve();
  }
    
  /**
     * Set the zoom level of the map
     * @param {number} zoomLevel - The zoom level to set
     * @returns {Promise<void>} - Promise that resolves when the zoom is set
     */
  async setZoom(zoomLevel) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    this.map.setZoom(zoomLevel);
    return Promise.resolve();
  }
    
  /**
     * Add a marker to the map
     * @param {Coordinate} coordinate - The coordinate to place the marker
     * @param {Object} options - Configuration options for the marker
     * @returns {Promise<Object>} - Promise that resolves with the created marker instance
     */
  async addMarker(coordinate, options = {}) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    const markerOptions = {
      title: options.title || '',
      alt: options.label || '',
      draggable: options.draggable || false,
      ...options.markerOptions,
    };
        
    // Handle custom icon if provided
    if (options.icon) {
      if (typeof options.icon === 'string') {
        // Simple URL icon
        markerOptions.icon = L.icon({
          iconUrl: options.icon,
          iconSize: options.iconSize || [25, 41],
          iconAnchor: options.iconAnchor || [12, 41],
          popupAnchor: options.popupAnchor || [1, -34],
        });
      } else if (options.icon.options) {
        // Already a Leaflet icon
        markerOptions.icon = options.icon;
      }
    }
        
    const marker = L.marker(
      [coordinate.latitude, coordinate.longitude], 
      markerOptions,
    ).addTo(this.map);
        
    // Store elevation in marker object for future reference
    marker.elevation = coordinate.elevation;
        
    return Promise.resolve(marker);
  }
    
  /**
     * Remove a marker from the map
     * @param {Object} marker - The marker instance to remove
     * @returns {Promise<void>} - Promise that resolves when the marker is removed
     */
  async removeMarker(marker) {
    if (!marker) {
      return Promise.resolve();
    }
        
    this.map.removeLayer(marker);
    return Promise.resolve();
  }
    
  /**
     * Add a polyline to the map
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the polyline
     * @param {Object} options - Configuration options for the polyline
     * @returns {Promise<Object>} - Promise that resolves with the created polyline instance
     */
  async addPolyline(coordinates, options = {}) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    const latLngs = coordinates.map(coord => [coord.latitude, coord.longitude]);
        
    const polylineOptions = {
      color: options.strokeColor || '#FF0000',
      opacity: options.strokeOpacity || 1.0,
      weight: options.strokeWeight || 3,
      ...options.polylineOptions,
    };
        
    const polyline = L.polyline(latLngs, polylineOptions).addTo(this.map);
        
    // Store original coordinates with elevation data
    polyline.originalCoordinates = [...coordinates];
        
    return Promise.resolve(polyline);
  }
    
  /**
     * Remove a polyline from the map
     * @param {Object} polyline - The polyline instance to remove
     * @returns {Promise<void>} - Promise that resolves when the polyline is removed
     */
  async removePolyline(polyline) {
    if (!polyline) {
      return Promise.resolve();
    }
        
    this.map.removeLayer(polyline);
    return Promise.resolve();
  }
    
  /**
     * Add a polygon to the map
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the polygon
     * @param {Object} options - Configuration options for the polygon
     * @returns {Promise<Object>} - Promise that resolves with the created polygon instance
     */
  async addPolygon(coordinates, options = {}) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    const latLngs = coordinates.map(coord => [coord.latitude, coord.longitude]);
        
    const polygonOptions = {
      color: options.strokeColor || '#FF0000',
      opacity: options.strokeOpacity || 0.8,
      weight: options.strokeWeight || 2,
      fillColor: options.fillColor || '#FF0000',
      fillOpacity: options.fillOpacity || 0.35,
      ...options.polygonOptions,
    };
        
    const polygon = L.polygon(latLngs, polygonOptions).addTo(this.map);
        
    // Store original coordinates with elevation data
    polygon.originalCoordinates = [...coordinates];
        
    return Promise.resolve(polygon);
  }
    
  /**
     * Remove a polygon from the map
     * @param {Object} polygon - The polygon instance to remove
     * @returns {Promise<void>} - Promise that resolves when the polygon is removed
     */
  async removePolygon(polygon) {
    if (!polygon) {
      return Promise.resolve();
    }
        
    this.map.removeLayer(polygon);
    return Promise.resolve();
  }
    
  /**
     * Get the current visible bounds of the map
     * @returns {Promise<Object>} - Promise that resolves with the bounds object
     */
  async getBounds() {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    const bounds = this.map.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
        
    return Promise.resolve({
      north: ne.lat,
      east: ne.lng,
      south: sw.lat,
      west: sw.lng,
      northEast: this._toCoordinate(ne),
      southWest: this._toCoordinate(sw),
    });
  }
    
  /**
     * Fit the map view to the specified bounds
     * @param {Object} bounds - The bounds to fit the map to
     * @param {Object} options - Configuration options for fitting
     * @returns {Promise<void>} - Promise that resolves when the map is fitted to bounds
     */
  async fitBounds(bounds, options = {}) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    let leafletBounds;
        
    if (bounds.northEast && bounds.southWest) {
      leafletBounds = L.latLngBounds(
        this._toLatLng(bounds.southWest),
        this._toLatLng(bounds.northEast),
      );
    } else if (bounds.north && bounds.south && bounds.east && bounds.west) {
      leafletBounds = L.latLngBounds(
        L.latLng(bounds.south, bounds.west),
        L.latLng(bounds.north, bounds.east),
      );
    } else if (Array.isArray(bounds)) {
      // Assume array of coordinates
      const latLngs = bounds.map(coord => this._toLatLng(coord));
      leafletBounds = L.latLngBounds(latLngs);
    } else {
      throw new Error('Invalid bounds format');
    }
        
    const fitOptions = {
      padding: options.padding ? L.point(options.padding, options.padding) : null,
      maxZoom: options.maxZoom || null,
      animate: options.animate !== false,
      ...options.fitOptions,
    };
        
    this.map.fitBounds(leafletBounds, fitOptions);
    return Promise.resolve();
  }
    
  /**
     * Register an event listener on the map
     * @param {string} eventType - The type of event to listen for
     * @param {Function} listener - The callback function to execute when the event occurs
     * @returns {Promise<Object>} - Promise that resolves with the listener handle
     */
  async addEventListener(eventType, listener) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    // Map common event types to Leaflet event types
    const leafletEventType = eventType === 'click' ? 'click' :
      eventType === 'zoom_changed' ? 'zoomend' :
        eventType === 'center_changed' ? 'moveend' :
          eventType === 'bounds_changed' ? 'moveend' :
            eventType;
        
    const handlerFunction = event => {
      // Convert Leaflet events to a standard format
      const convertedEvent = {
        type: eventType,
        originalEvent: event,
      };
            
      // Add coordinate and pixel information for mouse events
      if (event.latlng) {
        // Convert latlng to coordinate
        convertedEvent.coordinate = this._toCoordinate(event.latlng);
                
        // Add pixel coordinates
        const pixel = this.coordinateToPixel(convertedEvent.coordinate);
        convertedEvent.pixel = pixel;
      }
            
      listener(convertedEvent);
    };
        
    this.map.on(leafletEventType, handlerFunction);
        
    // Create a handle object for removing later
    const handle = {
      leafletEventType,
      handlerFunction,
    };
        
    // Keep track of the listener for later cleanup
    // Store both the function reference and the handle
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Map());
    }
    this.eventListeners.get(eventType).set(listener, handle);
        
    return Promise.resolve(handle);
  }
    
  /**
     * Remove an event listener from the map
     * @param {string} eventType - The type of event
     * @param {Function|Object} listenerOrHandle - The listener function or handle to remove
     * @returns {Promise<void>} - Promise that resolves when the listener is removed
     */
  async removeEventListener(eventType, listenerOrHandle) {
    if (!listenerOrHandle || !this.map) {
      return Promise.resolve();
    }
        
    let handle = listenerOrHandle;
        
    // Check if this is a function reference instead of a handle
    if (typeof listenerOrHandle === 'function') {
      // Look up the handle from our mapping
      if (this.eventListeners.has(eventType) && 
                this.eventListeners.get(eventType).has(listenerOrHandle)) {
        handle = this.eventListeners.get(eventType).get(listenerOrHandle);
                
        // Remove the mapping
        this.eventListeners.get(eventType).delete(listenerOrHandle);
      } else {
        // If we don't have a mapping, we can't remove it
        console.warn(`No event listener found for ${eventType}`);
        return Promise.resolve();
      }
    }
        
    // Remove the event listener using the handle
    try {
      this.map.off(handle.leafletEventType, handle.handlerFunction);
    } catch (e) {
      console.warn(`Error removing listener for ${eventType}:`, e);
    }
        
    return Promise.resolve();
  }
    
  /**
     * Get the elevation at a specific coordinate
     * Note: Leaflet doesn't provide an elevation service, so this is a stub implementation
     * that will need to be implemented with a third-party service
     * @param {Coordinate} coordinate - The coordinate to get elevation for
     * @returns {Promise<number>} - Promise that resolves with the elevation in meters
     */
  async getElevation(coordinate) {
    // If coordinate already has elevation, return it
    if (coordinate.elevation !== null && coordinate.elevation !== undefined) {
      return Promise.resolve(coordinate.elevation);
    }
        
    // This is where you would integrate with a third-party elevation service
    // For example, open-elevation, mapzen, or the Google Maps Elevation API
    // For now, just return 0 as a placeholder
    console.warn('LeafletAdapter.getElevation: No elevation service configured');
    return Promise.resolve(0);
  }
    
  /**
     * Get elevations for a path of coordinates
     * Note: Leaflet doesn't provide an elevation service, so this is a stub implementation
     * that will need to be implemented with a third-party service
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the path
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForPath(coordinates) {
    // Use any existing elevation data
    const elevations = coordinates.map(coord => {
      return (coord.elevation !== null && coord.elevation !== undefined) 
        ? coord.elevation 
        : 0;
    });
        
    console.warn('LeafletAdapter.getElevationsForPath: No elevation service configured');
    return Promise.resolve(elevations);
  }
    
  /**
     * Convert a geographic coordinate to pixel coordinates on the map
     * @param {Coordinate} coordinate - The geographic coordinate to convert
     * @returns {Array<number>} - [x, y] pixel coordinates
     */
  coordinateToPixel(coordinate) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    // Convert coordinate to Leaflet LatLng
    const latLng = L.latLng(coordinate.lat, coordinate.lng);
        
    // Get the pixel coordinates
    const point = this.map.latLngToContainerPoint(latLng);
        
    return [point.x, point.y];
  }
    
  /**
     * Convert pixel coordinates to a geographic coordinate
     * @param {Array<number>} pixel - [x, y] pixel coordinates relative to the map container
     * @returns {Coordinate} - The geographic coordinate
     */
  pixelToCoordinate(pixel) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    // Convert pixel coordinates to Leaflet Point
    const point = L.point(pixel[0], pixel[1]);
        
    // Convert to LatLng
    const latLng = this.map.containerPointToLatLng(point);
        
    // Return as a Coordinate
    return this._toCoordinate(latLng);
  }
}