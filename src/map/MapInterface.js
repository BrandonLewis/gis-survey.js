/**
 * Abstract Map Interface - Base class for all map providers
 * @module gnss/survey/map/MapInterface
 */
export class MapInterface {
  /**
     * Initialize the map interface
     * @param {Object} options - Configuration options for the map
     */
  constructor(options = {}) {
    if (this.constructor === MapInterface) {
      throw new Error('Abstract class \'MapInterface\' cannot be instantiated directly.');
    }
        
    this.options = options;
  }
    
  /**
     * Set the cursor style for the map
     * @param {string} cursorType - CSS cursor value (e.g., 'default', 'pointer', 'crosshair')
     * @returns {void}
     */
  setCursor(cursorType) {
    throw new Error('Method \'setCursor()\' must be implemented.');
  }
    
  /**
     * Initialize the map with the specified container
     * @param {string|HTMLElement} container - The HTML element or element ID to contain the map
     * @returns {Promise<void>} - Promise that resolves when the map is initialized
     */
  async initialize(container) {
    throw new Error('Method \'initialize()\' must be implemented.');
  }
    
  /**
     * Set the center of the map to the specified coordinate
     * @param {Coordinate} coordinate - The coordinate to center the map on
     * @returns {Promise<void>} - Promise that resolves when the map is centered
     */
  async setCenter(coordinate) {
    throw new Error('Method \'setCenter()\' must be implemented.');
  }
    
  /**
     * Set the zoom level of the map
     * @param {number} zoomLevel - The zoom level to set
     * @returns {Promise<void>} - Promise that resolves when the zoom is set
     */
  async setZoom(zoomLevel) {
    throw new Error('Method \'setZoom()\' must be implemented.');
  }
    
  /**
     * Add a marker to the map
     * @param {Coordinate} coordinate - The coordinate to place the marker
     * @param {Object} options - Configuration options for the marker
     * @returns {Promise<Object>} - Promise that resolves with the created marker instance
     */
  async addMarker(coordinate, options = {}) {
    throw new Error('Method \'addMarker()\' must be implemented.');
  }
    
  /**
     * Remove a marker from the map
     * @param {Object} marker - The marker instance to remove
     * @returns {Promise<void>} - Promise that resolves when the marker is removed
     */
  async removeMarker(marker) {
    throw new Error('Method \'removeMarker()\' must be implemented.');
  }
    
  /**
     * Add a polyline to the map
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the polyline
     * @param {Object} options - Configuration options for the polyline
     * @returns {Promise<Object>} - Promise that resolves with the created polyline instance
     */
  async addPolyline(coordinates, options = {}) {
    throw new Error('Method \'addPolyline()\' must be implemented.');
  }
    
  /**
     * Remove a polyline from the map
     * @param {Object} polyline - The polyline instance to remove
     * @returns {Promise<void>} - Promise that resolves when the polyline is removed
     */
  async removePolyline(polyline) {
    throw new Error('Method \'removePolyline()\' must be implemented.');
  }
    
  /**
     * Add a polygon to the map
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the polygon
     * @param {Object} options - Configuration options for the polygon
     * @returns {Promise<Object>} - Promise that resolves with the created polygon instance
     */
  async addPolygon(coordinates, options = {}) {
    throw new Error('Method \'addPolygon()\' must be implemented.');
  }
    
  /**
     * Remove a polygon from the map
     * @param {Object} polygon - The polygon instance to remove
     * @returns {Promise<void>} - Promise that resolves when the polygon is removed
     */
  async removePolygon(polygon) {
    throw new Error('Method \'removePolygon()\' must be implemented.');
  }
    
  /**
     * Get the current visible bounds of the map
     * @returns {Promise<Object>} - Promise that resolves with the bounds object
     */
  async getBounds() {
    throw new Error('Method \'getBounds()\' must be implemented.');
  }
    
  /**
     * Fit the map view to the specified bounds
     * @param {Object} bounds - The bounds to fit the map to
     * @param {Object} options - Configuration options for fitting
     * @returns {Promise<void>} - Promise that resolves when the map is fitted to bounds
     */
  async fitBounds(bounds, options = {}) {
    throw new Error('Method \'fitBounds()\' must be implemented.');
  }
    
  /**
     * Register an event listener on the map
     * @param {string} eventType - The type of event to listen for
     * @param {Function} listener - The callback function to execute when the event occurs
     * @returns {Promise<Object>} - Promise that resolves with the listener handle
     */
  async addEventListener(eventType, listener) {
    throw new Error('Method \'addEventListener()\' must be implemented.');
  }
    
  /**
     * Remove an event listener from the map
     * @param {string} eventType - The type of event
     * @param {Object} listenerHandle - The listener handle to remove
     * @returns {Promise<void>} - Promise that resolves when the listener is removed
     */
  async removeEventListener(eventType, listenerHandle) {
    throw new Error('Method \'removeEventListener()\' must be implemented.');
  }
    
  /**
     * Get the elevation at a specific coordinate
     * @param {Coordinate} coordinate - The coordinate to get elevation for
     * @returns {Promise<number>} - Promise that resolves with the elevation in meters
     */
  async getElevation(coordinate) {
    throw new Error('Method \'getElevation()\' must be implemented.');
  }
    
  /**
     * Get elevations for a path of coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the path
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForPath(coordinates) {
    throw new Error('Method \'getElevationsForPath()\' must be implemented.');
  }
    
  /**
     * Convert a geographic coordinate to pixel coordinates on the map
     * @param {Coordinate} coordinate - The geographic coordinate to convert
     * @returns {Array<number>} - [x, y] pixel coordinates
     */
  coordinateToPixel(coordinate) {
    throw new Error('Method \'coordinateToPixel()\' must be implemented.');
  }
    
  /**
     * Convert pixel coordinates to a geographic coordinate
     * @param {Array<number>} pixel - [x, y] pixel coordinates
     * @returns {Coordinate} - The geographic coordinate
     */
  pixelToCoordinate(pixel) {
    throw new Error('Method \'pixelToCoordinate()\' must be implemented.');
  }
}