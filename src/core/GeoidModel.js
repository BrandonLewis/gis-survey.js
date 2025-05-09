/**
 * GeoidModel.js - Model for converting between height reference systems
 * 
 * Provides geoid height (separation between ellipsoid and orthometric height)
 * calculations for converting between ellipsoidal heights (GPS) and
 * orthometric heights (mean sea level).
 */

/**
 * Static class that provides geoid height information.
 * 
 * In a full implementation, this would load and interpolate from a geoid model
 * grid file (like GEOID18 for the USA). For this implementation, we'll use a
 * simplified, approximate model for demonstration purposes.
 */
export class GeoidModel {
  /**
   * Get the geoid height (separation between ellipsoid and geoid) at a location.
   * Positive value means the geoid is above the ellipsoid.
   * 
   * @param {number} lat - Latitude in decimal degrees
   * @param {number} lng - Longitude in decimal degrees
   * @returns {number} Geoid height in meters
   */
  static getHeight(lat, lng) {
    // This is a simplified model for demonstration
    // In a real application, this would load and interpolate from a grid file
    // like GEOID18, EGM2008, etc.
    
    // For North America, a very simplified approximation
    // Values generally range from -8m to -40m in North America
    
    // Check bounds
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error(`Invalid coordinates: ${lat}, ${lng}`);
    }
    
    // For areas in the continental US, use a simple bilinear approximation
    if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) {
      return this._approximateUSGeoidHeight(lat, lng);
    }
    
    // Basic approximation with latitude as the primary driver
    let height = 0;
    
    // Higher values in the south (more separation)
    // Lower values in the north (less separation)
    // Based on EGM2008 very generalized trends
    if (lat >= 0 && lat <= 90) { // Northern hemisphere
      height = -30 + (lat / 90) * 15; // Range from ~ -30 to -15 meters
    } else { // Southern hemisphere
      height = -30 + (lat / -90) * 15; // Range from ~ -30 to -15 meters
    }
    
    // Add some longitude influence (rough approximation)
    const lngFactor = Math.sin((lng + 100) * Math.PI / 180) * 5; // ±5m variation
    height += lngFactor;
    
    return height;
  }
  
  /**
   * More detailed approximation for the continental United States.
   * @param {number} lat - Latitude in decimal degrees
   * @param {number} lng - Longitude in decimal degrees
   * @returns {number} Approximate geoid height in meters
   * @private
   */
  static _approximateUSGeoidHeight(lat, lng) {
    // These would be replaced with proper grid interpolation in a real implementation
    // Corners of a simplified geoid model for the continental US
    const corners = [
      { lat: 24, lng: -125, height: -32.5 }, // Southwest
      { lat: 24, lng: -66, height: -29.5 },  // Southeast
      { lat: 50, lng: -125, height: -22.5 }, // Northwest
      { lat: 50, lng: -66, height: -34.0 },   // Northeast
    ];
    
    // Normalize coordinates to 0-1 range within the grid
    const normalizedLat = (lat - 24) / (50 - 24);
    const normalizedLng = (lng - (-125)) / ((-66) - (-125));
    
    // Bilinear interpolation
    const h1 = corners[0].height * (1 - normalizedLng) + corners[1].height * normalizedLng;
    const h2 = corners[2].height * (1 - normalizedLng) + corners[3].height * normalizedLng;
    
    const geoidHeight = h1 * (1 - normalizedLat) + h2 * normalizedLat;
    
    // Add some local variation (simplified)
    const localVariation = Math.sin(lat * 8) * Math.sin(lng * 6) * 2.5;
    
    return geoidHeight + localVariation;
  }
  
  /**
   * Load a geoid model grid file.
   * This would be implemented in a full version of the library.
   * 
   * @param {string} modelName - Name of the geoid model to load
   * @returns {Promise<boolean>} Promise that resolves when the model is loaded
   */
  static async loadModel(modelName) {
    console.warn(`GeoidModel.loadModel: ${modelName} not implemented. Using approximation.`);
    return Promise.resolve(false);
  }
}