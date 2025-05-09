/**
 * Google Maps implementation of the Map Interface
 * @module gnss/survey/map/GoogleMapsAdapter
 */
import { MapInterface } from './MapInterface.js';
import { Coordinate } from '../core/Coordinate.js';

export class GoogleMapsAdapter extends MapInterface {
  /**
     * Initialize the Google Maps adapter
     * @param {Object} options - Configuration options for Google Maps
     * @param {string} [options.apiKey] - Google Maps API key (optional if already loaded)
     * @param {Object} [options.mapOptions] - Google Maps initialization options
     */
  constructor(options = {}) {
    super(options);
        
    // If a map instance is provided, use it directly
    this.map = options.mapInstance || null;
    this.apiLoaded = this.map !== null || (window.google && window.google.maps);
    this.apiKey = options.apiKey;
    this.mapOptions = options.mapOptions || {
      center: { lat: 0, lng: 0 },
      zoom: 2,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      fullscreenControl: true,
      streetViewControl: false,
    };
        
    // Keep track of event listeners for cleanup
    // Structure: Map<eventType, Map<listenerFunction, handle>>
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
    this.map.getDiv().style.cursor = cursorType;
  }
    
  /**
     * Load the Google Maps API if not already loaded
     * @returns {Promise<void>} - Promise that resolves when the API is loaded
     * @private
     */
  async _loadGoogleMapsAPI() {
    if (window.google && window.google.maps) {
      this.apiLoaded = true;
      return;
    }
        
    if (!this.apiKey) {
      throw new Error('Google Maps API key is required for initialization');
    }
        
    return new Promise((resolve, reject) => {
      const callbackName = `GoogleMapsCallback_${Date.now()}`;
      window[callbackName] = () => {
        this.apiLoaded = true;
        delete window[callbackName];
        resolve();
      };
            
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&callback=${callbackName}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      document.head.appendChild(script);
    });
  }
    
  /**
     * Initialize the map with the specified container
     * @param {string|HTMLElement} container - The HTML element or element ID to contain the map
     * @returns {Promise<void>} - Promise that resolves when the map is initialized
     */
  async initialize(container) {
    // If we already have a map instance, we don't need to create a new one
    if (this.map) {
      return Promise.resolve();
    }
        
    await this._loadGoogleMapsAPI();
        
    const element = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
            
    if (!element) {
      throw new Error(`Map container element not found: ${container}`);
    }
        
    this.map = new google.maps.Map(element, this.mapOptions);
        
    // Wait for the map to be fully loaded
    return new Promise((resolve) => {
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        resolve();
      });
    });
  }
    
  /**
     * Convert a Coordinate to a Google Maps LatLng
     * @param {Coordinate} coordinate - The coordinate to convert
     * @returns {google.maps.LatLng} - Google Maps LatLng object
     * @private
     */
  _toLatLng(coordinate) {
    return new google.maps.LatLng(coordinate.lat, coordinate.lng);
  }
    
  /**
     * Convert a Google Maps LatLng to a Coordinate
     * @param {google.maps.LatLng} latLng - The Google Maps LatLng to convert
     * @param {number} [elevation] - Optional elevation value
     * @returns {Coordinate} - Coordinate instance
     * @private
     */
  _toCoordinate(latLng, elevation = null) {
    // Use 0 as default elevation if null or undefined is provided
    const safeElevation = elevation !== null && elevation !== undefined ? elevation : 0;
    return new Coordinate(latLng.lat(), latLng.lng(), safeElevation);
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
        
    this.map.setCenter(this._toLatLng(coordinate));
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
      position: this._toLatLng(coordinate),
      map: this.map,
      title: options.title || '',
      label: options.label || null,
      icon: options.icon || null,
      draggable: options.draggable || false,
      zIndex: options.zIndex || null,
      ...options.markerOptions,
    };
        
    const marker = new google.maps.Marker(markerOptions);
        
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
        
    marker.setMap(null);
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
        
    const path = coordinates.map(coord => this._toLatLng(coord));
        
    const polylineOptions = {
      path: path,
      map: this.map,
      strokeColor: options.strokeColor || '#FF0000',
      strokeOpacity: options.strokeOpacity || 1.0,
      strokeWeight: options.strokeWeight || 3,
      ...options.polylineOptions,
    };
        
    const polyline = new google.maps.Polyline(polylineOptions);
        
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
        
    polyline.setMap(null);
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
        
    const path = coordinates.map(coord => this._toLatLng(coord));
        
    const polygonOptions = {
      paths: path,
      map: this.map,
      strokeColor: options.strokeColor || '#FF0000',
      strokeOpacity: options.strokeOpacity || 0.8,
      strokeWeight: options.strokeWeight || 2,
      fillColor: options.fillColor || '#FF0000',
      fillOpacity: options.fillOpacity || 0.35,
      ...options.polygonOptions,
    };
        
    const polygon = new google.maps.Polygon(polygonOptions);
        
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
        
    polygon.setMap(null);
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
    if (!bounds) {
      return Promise.resolve(null);
    }
        
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
        
    return Promise.resolve({
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
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
        
    let googleBounds;
        
    if (bounds.northEast && bounds.southWest) {
      googleBounds = new google.maps.LatLngBounds(
        this._toLatLng(bounds.southWest),
        this._toLatLng(bounds.northEast),
      );
    } else if (bounds.north && bounds.south && bounds.east && bounds.west) {
      googleBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(bounds.south, bounds.west),
        new google.maps.LatLng(bounds.north, bounds.east),
      );
    } else if (Array.isArray(bounds)) {
      // Assume array of coordinates
      googleBounds = new google.maps.LatLngBounds();
      bounds.forEach(coord => {
        googleBounds.extend(this._toLatLng(coord));
      });
    } else {
      throw new Error('Invalid bounds format');
    }
        
    const fitOptions = {
      padding: options.padding || 0,
      ...options.fitOptions,
    };
        
    this.map.fitBounds(googleBounds, fitOptions);
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
        
    // Map Google-specific event names to standard ones
    const googleEventType = eventType === 'contextmenu' ? 'rightclick' : eventType;
        
    // Create a debounced version of the mousemove handler to limit coordinate creation
    let lastMoveTime = 0;
    const throttleInterval = 50; // ms between mousemove events
        
    // For click events, track the last click time to prevent double-processing
    // due to how Google Maps handles events internally
    let lastClickTime = 0;
    const clickDebounceTime = 100; // ms between clicks to consider it a "new" click
        
    const handle = google.maps.event.addListener(this.map, googleEventType, event => {
      // For click events, check for debouncing
      if (eventType === 'click' || eventType === 'dblclick') {
        const now = Date.now();
        if (now - lastClickTime < clickDebounceTime) {
          // This might be a duplicate click or same click being processed by different handlers
          console.debug(`Debounced ${eventType} event, too soon after last click`);
          return;
        }
        lastClickTime = now;
                
        // If this event comes from a map feature like POI, ignore it if clickableIcons is false
        // Google will still generate click events for its own features sometimes
        if (event.placeId || event.feature) {
          // This is a click on a Google Maps feature (POI, etc.)
          console.debug('Ignoring click on Google Maps POI or feature');
          // Don't trigger our handler for these clicks
          return;
        }
      }
            
      // For mousemove, throttle the events to reduce coordinate creation
      if (eventType === 'mousemove') {
        const now = Date.now();
        if (now - lastMoveTime < throttleInterval) {
          return; // Skip this event if within throttle interval
        }
        lastMoveTime = now;
      }
            
      // Convert Google Maps events to a standard format
      // Create a normalized version of the originalEvent with preventDefault
      // and stopPropagation functions
      const normalizedOriginalEvent = {
        preventDefault: function() {
          // If the original event has preventDefault, call it
          if (event.domEvent && typeof event.domEvent.preventDefault === 'function') {
            event.domEvent.preventDefault();
          }
        },
        stopPropagation: function() {
          // If the original event has stopPropagation, call it
          if (event.domEvent && typeof event.domEvent.stopPropagation === 'function') {
            event.domEvent.stopPropagation();
          }
        },
        // Also include the original DOM event if it exists
        domEvent: event.domEvent || null,
        // Pass along any other properties from the original event
        ...event,
      };
            
      const convertedEvent = {
        type: eventType,
        originalEvent: normalizedOriginalEvent,
      };
            
      // Add coordinate and pixel information for mouse events
      if (event.latLng) {
        // Only create full coordinate objects for click events, not mousemove
        if (eventType === 'click' || eventType === 'dblclick' || eventType === 'contextmenu') {
          // For significant events, create a full coordinate object
          convertedEvent.coordinate = this._toCoordinate(event.latLng);
                    
          // Log click events with enhanced debug info
          console.log(`Google Maps ${eventType} event:`, 
            `${event.latLng.lat().toFixed(6)}, ${event.latLng.lng().toFixed(6)}`,
            event.domEvent ? `DOM event: ${event.domEvent.type}` : '');
        } else {
          // For mousemove, just provide a simple object with lat/lng
          convertedEvent.coordinate = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
            elevation: 0,
          };
        }
                
        // Always keep the original latLng for direct access
        convertedEvent.latLng = event.latLng;
                
        // Get pixel coordinates for all event types, helpful for debugging
        try {
          if (this.map.getProjection()) {
            const coord = event.latLng;
            const projection = this.map.getProjection();
            const point = projection.fromLatLngToPoint(coord);
            const scale = Math.pow(2, this.map.getZoom());
            const worldPoint = new google.maps.Point(
              point.x * scale, 
              point.y * scale,
            );
                        
            const mapContainer = this.map.getDiv();
            const mapBounds = mapContainer.getBoundingClientRect();
                        
            convertedEvent.pixel = [
              Math.floor(worldPoint.x - (mapBounds.left + window.scrollX)),
              Math.floor(worldPoint.y - (mapBounds.top + window.scrollY)),
            ];
                        
            // For click events, add extra debug logging about pixel position
            if (eventType === 'click') {
              console.debug(`Click at pixel: ${convertedEvent.pixel[0]}, ${convertedEvent.pixel[1]}`);
            }
          }
        } catch (e) {
          console.warn('Error computing pixel coordinates:', e);
        }
      }
            
      // Call the listener with the converted event
      listener(convertedEvent);
    });
        
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
    if (!listenerOrHandle) {
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
        
    // Remove using the handle
    try {
      google.maps.event.removeListener(handle);
    } catch (e) {
      console.warn(`Error removing listener for ${eventType}:`, e);
    }
        
    return Promise.resolve();
  }
    
  /**
     * Get the elevation at a specific coordinate using Google Maps Elevation Service
     * @param {Coordinate} coordinate - The coordinate to get elevation for
     * @returns {Promise<number>} - Promise that resolves with the elevation in meters
     */
  async getElevation(coordinate) {
    if (!this.apiLoaded) {
      throw new Error('Google Maps API not loaded. Call initialize() first.');
    }
        
    // If coordinate already has elevation, return it
    if (coordinate.elevation !== null && coordinate.elevation !== undefined) {
      return Promise.resolve(coordinate.elevation);
    }
        
    const elevationService = new google.maps.ElevationService();
    const locations = [this._toLatLng(coordinate)];
        
    return new Promise((resolve, reject) => {
      elevationService.getElevationForLocations({ locations }, (results, status) => {
        if (status === google.maps.ElevationStatus.OK && results && results.length > 0) {
          resolve(results[0].elevation);
        } else {
          reject(new Error(`Elevation service failed: ${status}`));
        }
      });
    });
  }
    
  /**
     * Get elevations for a path of coordinates using Google Maps Elevation Service
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the path
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForPath(coordinates) {
    if (!this.apiLoaded) {
      throw new Error('Google Maps API not loaded. Call initialize() first.');
    }
        
    // For coordinates that already have elevation, we could just use those
    // but we'll request all to ensure consistency from the elevation service
        
    const elevationService = new google.maps.ElevationService();
    const path = coordinates.map(coord => this._toLatLng(coord));
        
    // Google's API has a limit on the number of samples, so chunk if needed
    const MAX_SAMPLES = 512; // Google's limit
    const samples = Math.min(coordinates.length, MAX_SAMPLES);
        
    return new Promise((resolve, reject) => {
      elevationService.getElevationAlongPath(
        {
          path: path,
          samples: samples,
        },
        (results, status) => {
          if (status === google.maps.ElevationStatus.OK && results && results.length > 0) {
            const elevations = results.map(result => result.elevation);
            resolve(elevations);
          } else {
            reject(new Error(`Elevation service failed: ${status}`));
          }
        },
      );
    });
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
        
    const latLng = this._toLatLng(coordinate);
    const projection = this.map.getProjection();
        
    if (!projection) {
      throw new Error('Map projection not ready.');
    }
        
    const point = projection.fromLatLngToPoint(latLng);
    const scale = Math.pow(2, this.map.getZoom());
    const worldPoint = new google.maps.Point(
      point.x * scale, 
      point.y * scale,
    );
        
    const mapContainer = this.map.getDiv();
    const mapBounds = mapContainer.getBoundingClientRect();
        
    // Get the top-left of the map container
    const topLeft = new google.maps.Point(
      mapBounds.left + window.scrollX,
      mapBounds.top + window.scrollY,
    );
        
    // Position relative to the map container
    return [
      Math.floor(worldPoint.x - topLeft.x),
      Math.floor(worldPoint.y - topLeft.y),
    ];
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
        
    const projection = this.map.getProjection();
        
    if (!projection) {
      throw new Error('Map projection not ready.');
    }
        
    const mapContainer = this.map.getDiv();
    const mapBounds = mapContainer.getBoundingClientRect();
        
    // Get the top-left of the map container
    const topLeft = new google.maps.Point(
      mapBounds.left + window.scrollX,
      mapBounds.top + window.scrollY,
    );
        
    // Position in world coordinates
    const scale = Math.pow(2, this.map.getZoom());
    const worldPoint = new google.maps.Point(
      (pixel[0] + topLeft.x) / scale,
      (pixel[1] + topLeft.y) / scale,
    );
        
    // Convert to LatLng
    const latLng = projection.fromPointToLatLng(worldPoint);
        
    // Return as a Coordinate
    return this._toCoordinate(latLng);
  }
    
  /**
     * Create a text label on the map
     * @param {Object} options - Configuration for the label
     * @param {Coordinate|Object} options.position - The position for the label
     * @param {string} options.text - The text content of the label
     * @param {Object} options.style - Styling options for the label
     * @returns {Object} - The created label object
     */
  createLabel(options) {
    if (!this.map) {
      throw new Error('Map not initialized. Call initialize() first.');
    }
        
    // Extract options with defaults
    const position = options.position;
    const text = options.text || '';
    const style = options.style || {};
        
    // Store labels if not already tracking them
    if (!this._labels) {
      this._labels = [];
    }
        
    // Create the label as a custom overlay
    const latLng = position.lat && position.lng ? 
      new google.maps.LatLng(position.lat, position.lng) : 
      this._toLatLng(position);
            
    // Create styles for the label
    const fontStyle = style.font || '12px Arial';
    const fillColor = style.fillColor || 'black';
    const strokeColor = style.strokeColor || 'white';
    const strokeWidth = style.strokeWidth || 3;
        
    // Custom overlay implementation for the label
    class LabelOverlay extends google.maps.OverlayView {
      constructor(map, latLng, text, style) {
        super();
        this.map = map;
        this.latLng = latLng;
        this.text = text;
        this.style = style;
        this.div = null;
        this.setMap(map);
      }
            
      onAdd() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.padding = '2px 6px';
        div.style.borderRadius = '3px';
        div.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        div.style.font = this.style.font;
        div.style.color = this.style.fillColor;
        div.style.textShadow = `${this.style.strokeWidth}px 0 ${this.style.strokeWidth}px ${this.style.strokeColor}, 
                                       0 ${this.style.strokeWidth}px ${this.style.strokeWidth}px ${this.style.strokeColor}, 
                                       -${this.style.strokeWidth}px 0 ${this.style.strokeWidth}px ${this.style.strokeColor}, 
                                       0 -${this.style.strokeWidth}px ${this.style.strokeWidth}px ${this.style.strokeColor}`;
        div.style.whiteSpace = 'nowrap';
        div.style.userSelect = 'none';
        div.style.pointerEvents = 'none'; // Don't block mouse events
        div.innerHTML = this.text;
                
        this.div = div;
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(div);
      }
            
      draw() {
        if (!this.div) return;
                
        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(this.latLng);
                
        // Position the label
        this.div.style.left = `${position.x}px`;
        this.div.style.top = `${position.y}px`;
        this.div.style.transform = 'translate(-50%, -100%)'; // Position above the point
      }
            
      onRemove() {
        if (this.div) {
          this.div.parentNode.removeChild(this.div);
          this.div = null;
        }
      }
            
      setPosition(latLng) {
        this.latLng = latLng;
        this.draw();
      }
            
      setText(text) {
        this.text = text;
        if (this.div) {
          this.div.innerHTML = text;
        }
      }
            
      setStyle(style) {
        this.style = { ...this.style, ...style };
        if (this.div) {
          this.div.style.font = this.style.font;
          this.div.style.color = this.style.fillColor;
          this.div.style.textShadow = `${this.style.strokeWidth}px 0 ${this.style.strokeWidth}px ${this.style.strokeColor}, 
                                               0 ${this.style.strokeWidth}px ${this.style.strokeWidth}px ${this.style.strokeColor}, 
                                               -${this.style.strokeWidth}px 0 ${this.style.strokeWidth}px ${this.style.strokeColor}, 
                                               0 -${this.style.strokeWidth}px ${this.style.strokeWidth}px ${this.style.strokeColor}`;
        }
      }
    }
        
    // Create the label overlay
    const label = new LabelOverlay(
      this.map, 
      latLng, 
      text, 
      {
        font: fontStyle,
        fillColor: fillColor,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth,
      },
    );
        
    // Store for management
    this._labels.push(label);
        
    return label;
  }
    
  /**
     * Remove a label from the map
     * @param {Object} label - The label to remove
     * @returns {void}
     */
  removeLabel(label) {
    if (!label) return;
        
    // Remove the label from the map
    label.setMap(null);
        
    // Remove from our tracking array
    if (this._labels) {
      const index = this._labels.indexOf(label);
      if (index !== -1) {
        this._labels.splice(index, 1);
      }
    }
  }
}