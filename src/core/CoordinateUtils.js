/**
 * CoordinateUtils.js - Coordinate format utilities
 * 
 * Provides utility functions for working with different coordinate formats
 * and ensuring consistency across the application.
 */

import { Coordinate } from './Coordinate.js';

/**
 * Coordinate Utilities
 * A collection of helper functions for coordinate processing
 */
export const CoordinateUtils = {
  /**
   * Standardize coordinate properties to use lat/lng/elevation format
   * while preserving the original properties for compatibility
   * 
   * @param {Object} coordinate - Coordinate object with either lat/lng or x/y/z properties
   * @returns {Object} Standardized coordinate object with both property sets
   */
  standardizeCoordinate(coordinate) {
    if (!coordinate || typeof coordinate !== 'object') {
      console.warn('Invalid coordinate object provided to standardizeCoordinate');
      return null;
    }
    
    // Extract latitude (try different common property names)
    const lat = coordinate.lat !== undefined ? coordinate.lat : 
      coordinate.latitude !== undefined ? coordinate.latitude :
        coordinate.y !== undefined ? coordinate.y : null;
    
    // Extract longitude (try different common property names)
    const lng = coordinate.lng !== undefined ? coordinate.lng : 
      coordinate.longitude !== undefined ? coordinate.longitude :
        coordinate.x !== undefined ? coordinate.x : null;
    
    // Extract elevation (try different common property names)
    const elevation = coordinate.elevation !== undefined ? coordinate.elevation : 
      coordinate.altitude !== undefined ? coordinate.altitude :
        coordinate.alt !== undefined ? coordinate.alt :
          coordinate.z !== undefined ? coordinate.z : 0;
    
    // Validate required properties
    if (lat === null || lng === null) {
      console.warn('Cannot standardize coordinate without lat/lng or x/y properties');
      return coordinate; // Return original to avoid data loss
    }
    
    // Return a standardized object with all properties
    // This maintains backwards compatibility while ensuring
    // that standard property names are available
    return {
      // Standard properties
      lat,
      lng,
      elevation,
      
      // Common alternate properties
      latitude: lat,
      longitude: lng,
      
      // Legacy/cartesian properties
      x: lng,
      y: lat,
      z: elevation,
      
      // Original properties for reference
      ...coordinate,
    };
  },
  
  /**
   * Convert any coordinate object to a proper Coordinate instance
   * 
   * @param {Object|Coordinate} coordinate - A coordinate object or Coordinate instance
   * @returns {Coordinate} A proper Coordinate instance
   */
  toCoordinate(coordinate) {
    // If it's already a Coordinate instance, return it
    if (coordinate instanceof Coordinate) {
      return coordinate;
    }
    
    // Otherwise, standardize and convert
    return Coordinate.fromObject(this.standardizeCoordinate(coordinate));
  },
  
  /**
   * Extract standard lat/lng/elevation values from a coordinate object
   * 
   * @param {Object} coordinate - Coordinate object with either lat/lng or x/y/z properties
   * @returns {Object} Object with standardized lat/lng/elevation properties
   */
  extractStandardValues(coordinate) {
    const standardized = this.standardizeCoordinate(coordinate);
    
    return {
      lat: standardized.lat,
      lng: standardized.lng,
      elevation: standardized.elevation,
    };
  },
  
  /**
   * Create a deep copy of a coordinate object with standard properties
   * 
   * @param {Object} coordinate - Coordinate object to copy
   * @returns {Object} A new coordinate object with standard properties
   */
  cloneWithStandardProperties(coordinate) {
    const standardized = this.standardizeCoordinate(coordinate);
    
    // Create a new object with only the standard properties
    return {
      lat: standardized.lat,
      lng: standardized.lng,
      elevation: standardized.elevation,
    };
  },
};