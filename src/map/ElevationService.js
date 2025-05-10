/**
 * Abstract Elevation Service Interface
 * @module gnss/survey/map/ElevationService
 */
export class ElevationService {
  /**
     * Initialize the elevation service
     * @param {Object} options - Configuration options for the elevation service
     */
  constructor(options = {}) {
    if (this.constructor === ElevationService) {
      throw new Error('Abstract class \'ElevationService\' cannot be instantiated directly.');
    }
        
    this.options = options;
  }
    
  /**
     * Get the elevation at a specific coordinate
     * @param {Coordinate} coordinate - The coordinate to get elevation for
     * @returns {Promise<number>} - Promise that resolves with the elevation in meters
     */
  async getElevation(_coordinate) {
    throw new Error('Method \'getElevation()\' must be implemented.');
  }
    
  /**
     * Get elevations for a path of coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the path
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForPath(_coordinates) {
    throw new Error('Method \'getElevationsForPath()\' must be implemented.');
  }
    
  /**
     * Get elevations for an array of coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates to get elevations for
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForLocations(_coordinates) {
    throw new Error('Method \'getElevationsForLocations()\' must be implemented.');
  }
}