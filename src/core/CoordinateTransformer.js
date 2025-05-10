/**
 * CoordinateTransformer.js - Abstract interface for coordinate transformations
 * 
 * Defines the interface that all coordinate transformers must implement.
 * This allows for swapping transformer implementations (simple vs. proj4js)
 * while maintaining consistent functionality.
 */

import { Coordinate } from './Coordinate.js';

/**
 * Abstract base class for coordinate transformations.
 */
export class CoordinateTransformer {
  /**
   * Creates a new coordinate transformer.
   * @throws {Error} If instantiated directly (abstract class)
   */
  constructor() {
    if (this.constructor === CoordinateTransformer) {
      throw new Error('CoordinateTransformer is an abstract class and cannot be instantiated directly');
    }
    
    // Initialize cache for performance
    this._transformCache = new Map();
    this._geoidCache = new Map();
    this._datelineHandled = false;
  }
  
  /**
   * Transform a coordinate from one projection to another.
   * @param {Coordinate} coordinate - The coordinate to transform
   * @param {string} fromProjection - Source projection
   * @param {string} toProjection - Target projection
   * @returns {Coordinate} A new coordinate in the target projection
   * @throws {Error} Must be implemented by subclasses
   */
  transform(_coordinate, _fromProjection, _toProjection) {
    throw new Error('Method transform() must be implemented by subclasses');
  }
  
  /**
   * Get list of supported projections.
   * @returns {string[]} Array of supported projection identifiers
   * @throws {Error} Must be implemented by subclasses
   */
  getSupportedProjections() {
    throw new Error('Method getSupportedProjections() must be implemented by subclasses');
  }
  
  /**
   * Convert ellipsoidal height to orthometric height (from WGS84 ellipsoid to mean sea level).
   * @param {Coordinate} coordinate - Coordinate with ellipsoidal height
   * @returns {Coordinate} New coordinate with orthometric height
   * @throws {Error} Must be implemented by subclasses
   */
  convertEllipsoidalToOrthometric(_coordinate) {
    throw new Error('Method convertEllipsoidalToOrthometric() must be implemented by subclasses');
  }
  
  /**
   * Convert orthometric height to ellipsoidal height (from mean sea level to WGS84 ellipsoid).
   * @param {Coordinate} coordinate - Coordinate with orthometric height
   * @returns {Coordinate} New coordinate with ellipsoidal height
   * @throws {Error} Must be implemented by subclasses
   */
  convertOrthometricToEllipsoidal(_coordinate) {
    throw new Error('Method convertOrthometricToEllipsoidal() must be implemented by subclasses');
  }
  
  /**
   * Clear the internal transformation cache.
   */
  clearCache() {
    this._transformCache.clear();
    this._geoidCache.clear();
  }
  
  /**
   * Check if a coordinate crosses the international date line during transformation.
   * @param {Coordinate} coordinate - The coordinate to check
   * @param {string} fromProjection - Source projection
   * @param {string} toProjection - Target projection
   * @returns {boolean} True if the transformation crosses the date line
   * @protected
   */
  _crossesDateLine(_coordinate, _fromProjection, _toProjection) {
    // Simplistic date line crossing detection
    // For more complex cases, subclasses should override this method
    if (Math.abs(_coordinate.lng) > 170) {
      // Near the date line, we might cross during transformation
      return true;
    }
    return false;
  }
  
  /**
   * Generate a unique cache key for a transformation.
   * @param {Coordinate} coordinate - The coordinate to transform
   * @param {string} fromProjection - Source projection
   * @param {string} toProjection - Target projection 
   * @returns {string} Cache key
   * @protected
   */
  _getCacheKey(coordinate, fromProjection, toProjection) {
    // Use precision that is high enough for our needs but allows caching
    const lat = coordinate.lat.toFixed(9);
    const lng = coordinate.lng.toFixed(9);
    const elev = coordinate.elevation.toFixed(3);
    
    return `${lat}:${lng}:${elev}:${fromProjection}:${toProjection}`;
  }
  
  /**
   * Handle date line crossing in transformations.
   * @param {Coordinate} coordinate - The coordinate to transform
   * @param {string} fromProjection - Source projection
   * @param {string} toProjection - Target projection
   * @returns {Coordinate} Transformed coordinate
   * @protected
   */
  _handleDateLineCrossing(coordinate, fromProjection, toProjection) {
    // Prevent recursive handling
    if (this._datelineHandled) {
      this._datelineHandled = false;
      return this._doTransform(coordinate, fromProjection, toProjection);
    }
    
    this._datelineHandled = true;
    
    // Adjust longitude to avoid the date line
    let adjustedCoord;
    if (coordinate.lng > 0) {
      // Adjust western hemisphere coordinates
      adjustedCoord = new Coordinate(
        coordinate.lat,
        coordinate.lng - 360, // Shift to equivalent position without crossing date line
        coordinate.elevation,
        coordinate.heightReference,
        fromProjection,
      );
    } else {
      // Adjust eastern hemisphere coordinates
      adjustedCoord = new Coordinate(
        coordinate.lat,
        coordinate.lng + 360, // Shift to equivalent position without crossing date line
        coordinate.elevation,
        coordinate.heightReference,
        fromProjection,
      );
    }
    
    // Transform with adjusted coordinates
    const transformed = this.transform(adjustedCoord, fromProjection, toProjection);
    
    // Restore to proper hemisphere
    if (transformed.lng < -180) {
      transformed.lng += 360;
    } else if (transformed.lng > 180) {
      transformed.lng -= 360;
    }
    
    this._datelineHandled = false;
    return transformed;
  }
  
  /**
   * Log transformation errors with context.
   * @param {Error} error - The error that occurred
   * @param {Coordinate} coordinate - The coordinate being transformed
   * @param {string} fromProjection - Source projection
   * @param {string} toProjection - Target projection
   * @protected
   */
  _logTransformationError(error, coordinate, fromProjection, toProjection) {
    console.error(`Transformation error: ${error.message}`, {
      source: {
        projection: fromProjection,
        lat: coordinate.lat,
        lng: coordinate.lng,
        elev: coordinate.elevation,
      },
      target: toProjection,
      error: error.stack,
    });
  }
}