/**
 * Coordinate.js - 3D Geographic Coordinate class
 * 
 * Represents a point in 3D space using latitude, longitude, and elevation.
 * Supports different height references and projections, with transformation
 * functionality through a pluggable transformer system.
 */

import { TransformerFactory } from './TransformerFactory.js';

/**
 * Class representing a geographic 3D coordinate.
 */
export class Coordinate {
  /**
   * Create a new coordinate.
   * @param {number} lat - Latitude in decimal degrees
   * @param {number} lng - Longitude in decimal degrees
   * @param {number} [elevation=0] - Elevation in meters
   * @param {string} [heightReference='ellipsoidal'] - Height reference system ('ellipsoidal' or 'orthometric')
   * @param {string} [projection='WGS84'] - Coordinate projection system
   */
  constructor(lat, lng, elevation = 0, heightReference = 'ellipsoidal', projection = 'WGS84') {
    try {
      // Handle different input formats and parsing
      if (typeof lat === 'string') lat = parseFloat(lat);
      if (typeof lng === 'string') lng = parseFloat(lng);
      if (typeof elevation === 'string') elevation = parseFloat(elevation);
      
      // Handle null/undefined/NaN latitude/longitude more gracefully with defaults
      if (lat === null || lat === undefined || isNaN(lat)) {
        console.warn('Invalid latitude provided, defaulting to 0');
        lat = 0;
      }
      
      if (lng === null || lng === undefined || isNaN(lng)) {
        console.warn('Invalid longitude provided, defaulting to 0');
        lng = 0;
      }
      
      // Validate coordinate values with clamping instead of throwing
      if (lat < -90 || lat > 90) {
        console.warn(`Latitude ${lat} out of bounds, clamping to valid range`);
        lat = Math.max(-90, Math.min(90, lat));
      }
      
      if (lng < -180 || lng > 180) {
        console.warn(`Longitude ${lng} out of bounds, clamping to valid range`);
        lng = Math.max(-180, Math.min(180, lng));
      }
      
      // Handle null/undefined elevation more gracefully
      const safeElevation = elevation !== null && elevation !== undefined && !isNaN(elevation) 
        ? elevation 
        : 0;
      
      // Validate height reference system
      const validHeightReferences = ['ellipsoidal', 'orthometric'];
      if (!validHeightReferences.includes(heightReference)) {
        console.warn(`Invalid height reference: ${heightReference}, using default 'ellipsoidal'`);
        heightReference = 'ellipsoidal';
      }
      
      this.lat = lat;
      this.lng = lng;
      this.elevation = safeElevation;
      this.heightReference = heightReference;
      this.projection = projection || 'WGS84';
      
      // Get transformer from factory using dependency injection
      // This allows for switching transformer implementations
      this.transformer = TransformerFactory.getTransformer();
      
      // For debugging
      //console.log(`Created coordinate: ${this.lat}, ${this.lng}, ${this.elevation}`);
      
    } catch (error) {
      console.error('Error in Coordinate constructor:', error);
      // Create a safe default coordinate
      this.lat = 0;
      this.lng = 0;
      this.elevation = 0;
      this.heightReference = 'ellipsoidal';
      this.projection = 'WGS84';
      this.transformer = TransformerFactory.getTransformer();
    }
  }
  
  /**
   * Create a Coordinate from an object with lat/lng/elevation properties.
   * Supports multiple object formats commonly found in mapping applications.
   * 
   * @param {Object} obj - Object with coordinate properties
   * @param {number|string} [obj.lat] - Latitude (WGS84)
   * @param {number|string} [obj.latitude] - Alternative latitude property
   * @param {number|string} [obj.lng] - Longitude (WGS84)
   * @param {number|string} [obj.longitude] - Alternative longitude property
   * @param {number|string} [obj.elevation] - Elevation in meters
   * @param {number|string} [obj.altitude] - Alternative elevation property
   * @param {number|string} [obj.alt] - Alternative elevation property
   * @param {string} [obj.heightReference] - Height reference system
   * @param {string} [obj.projection] - Coordinate projection
   * @returns {Coordinate} A new Coordinate object
   */
  static fromObject(obj) {
    try {
      if (!obj || typeof obj !== 'object') {
        console.warn('Invalid object passed to Coordinate.fromObject', obj);
        return new Coordinate(0, 0, 0);
      }
      
      // Extract latitude (try different common property names)
      let lat = obj.lat !== undefined ? obj.lat : 
                obj.latitude !== undefined ? obj.latitude :
                obj.y !== undefined ? obj.y : 0;
      
      // Extract longitude (try different common property names)
      let lng = obj.lng !== undefined ? obj.lng : 
                obj.longitude !== undefined ? obj.longitude :
                obj.x !== undefined ? obj.x : 0;
      
      // Extract elevation (try different common property names)
      let elevation = obj.elevation !== undefined ? obj.elevation : 
                      obj.altitude !== undefined ? obj.altitude :
                      obj.alt !== undefined ? obj.alt :
                      obj.z !== undefined ? obj.z : 0;
      
      // Handle Google Maps-specific LatLng objects
      if (typeof obj.lat === 'function' && typeof obj.lng === 'function') {
        try {
          lat = obj.lat();
          lng = obj.lng();
        } catch (e) {
          console.warn('Error extracting lat/lng from Google Maps LatLng object', e);
        }
      }
      
      // Log the conversion for debugging
      // console.log(`Coordinate.fromObject: (${lat}, ${lng}, ${elevation})`);
      
      return new Coordinate(
        lat,
        lng,
        elevation,
        obj.heightReference || 'ellipsoidal',
        obj.projection || 'WGS84'
      );
    } catch (error) {
      console.error('Error in Coordinate.fromObject:', error);
      return new Coordinate(0, 0, 0);
    }
  }
  
  /**
   * Convert this coordinate to a different projection.
   * @param {string} targetProjection - Target projection system
   * @returns {Coordinate} A new coordinate in the target projection
   */
  toProjection(targetProjection) {
    if (this.projection === targetProjection) {
      return this.clone();
    }
    
    return this.transformer.transform(this, this.projection, targetProjection);
  }
  
  /**
   * Convert to a different height reference system.
   * @param {string} reference - Target height reference system
   * @returns {Coordinate} A new coordinate with the converted height reference
   */
  toHeightReference(reference) {
    if (this.heightReference === reference) {
      return this.clone();
    }
    
    if (reference === 'orthometric' && this.heightReference === 'ellipsoidal') {
      // Convert from ellipsoidal (GPS) to orthometric (mean sea level)
      return this.transformer.convertEllipsoidalToOrthometric(this);
    }
    
    if (reference === 'ellipsoidal' && this.heightReference === 'orthometric') {
      // Convert from orthometric (mean sea level) to ellipsoidal (GPS)
      return this.transformer.convertOrthometricToEllipsoidal(this);
    }
    
    throw new Error(`Unsupported height reference conversion: ${this.heightReference} to ${reference}`);
  }
  
  /**
   * Calculate the 3D distance to another coordinate.
   * @param {Coordinate} other - The other coordinate
   * @returns {number} Distance in meters
   */
  distanceTo(other) {
    // Ensure both coordinates are in the same reference system
    let otherCoord = other;
    
    if (other.projection !== this.projection) {
      otherCoord = other.toProjection(this.projection);
    }
    
    if (otherCoord.heightReference !== this.heightReference) {
      otherCoord = otherCoord.toHeightReference(this.heightReference);
    }
    
    // Calculate horizontal distance using Haversine formula
    const R = 6371000; // Earth radius in meters
    const φ1 = this.lat * Math.PI / 180;
    const φ2 = otherCoord.lat * Math.PI / 180;
    const Δφ = (otherCoord.lat - this.lat) * Math.PI / 180;
    const Δλ = (otherCoord.lng - this.lng) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const horizontalDistance = R * c;
    
    // Calculate elevation difference
    const elevDiff = otherCoord.elevation - this.elevation;
    
    // Return 3D distance using Pythagorean theorem
    return Math.sqrt(horizontalDistance * horizontalDistance + elevDiff * elevDiff);
  }
  
  /**
   * Calculate the bearing to another coordinate.
   * @param {Coordinate} other - The other coordinate
   * @returns {number} Bearing in degrees (0-360)
   */
  bearingTo(other) {
    // Ensure same projection
    const otherCoord = other.projection !== this.projection 
      ? other.toProjection(this.projection) 
      : other;
    
    const φ1 = this.lat * Math.PI / 180;
    const φ2 = otherCoord.lat * Math.PI / 180;
    const λ1 = this.lng * Math.PI / 180;
    const λ2 = otherCoord.lng * Math.PI / 180;
    
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
  }
  
  /**
   * Calculate the midpoint between this coordinate and another.
   * @param {Coordinate} other - The other coordinate 
   * @returns {Coordinate} A new coordinate at the midpoint
   */
  midpointTo(other) {
    // Ensure same reference systems
    let otherCoord = other;
    
    if (other.projection !== this.projection) {
      otherCoord = other.toProjection(this.projection);
    }
    
    if (otherCoord.heightReference !== this.heightReference) {
      otherCoord = otherCoord.toHeightReference(this.heightReference);
    }
    
    // Calculate midpoint
    const φ1 = this.lat * Math.PI / 180;
    const λ1 = this.lng * Math.PI / 180;
    const φ2 = otherCoord.lat * Math.PI / 180;
    const λ2 = otherCoord.lng * Math.PI / 180;
    
    const Bx = Math.cos(φ2) * Math.cos(λ2 - λ1);
    const By = Math.cos(φ2) * Math.sin(λ2 - λ1);
    
    const φ3 = Math.atan2(
      Math.sin(φ1) + Math.sin(φ2),
      Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)
    );
    
    const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);
    
    // Calculate average elevation
    const midElevation = (this.elevation + otherCoord.elevation) / 2;
    
    return new Coordinate(
      φ3 * 180 / Math.PI,
      λ3 * 180 / Math.PI,
      midElevation,
      this.heightReference,
      this.projection
    );
  }
  
  /**
   * Create a copy of this coordinate.
   * @returns {Coordinate} A new coordinate with the same values
   */
  clone() {
    return new Coordinate(
      this.lat,
      this.lng,
      this.elevation,
      this.heightReference,
      this.projection
    );
  }
  
  /**
   * Convert the coordinate to a plain object.
   * @returns {Object} Object representation of the coordinate
   */
  toObject() {
    return {
      lat: this.lat,
      lng: this.lng,
      elevation: this.elevation,
      heightReference: this.heightReference,
      projection: this.projection
    };
  }
  
  /**
   * Convert the coordinate to a GeoJSON point.
   * @returns {Object} GeoJSON Point geometry
   */
  toGeoJSON() {
    // Ensure WGS84 for GeoJSON compliance
    const wgs84Coord = this.projection !== 'WGS84' 
      ? this.toProjection('WGS84') 
      : this;
    
    return {
      type: 'Point',
      coordinates: [wgs84Coord.lng, wgs84Coord.lat, wgs84Coord.elevation]
    };
  }
  
  /**
   * Return string representation of the coordinate.
   * @returns {string} String representation
   */
  toString() {
    return `${this.lat.toFixed(7)},${this.lng.toFixed(7)},${this.elevation.toFixed(2)} (${this.projection}, ${this.heightReference})`;
  }
  
  /**
   * Return a compact string representation of the coordinate (lat, lng only).
   * @returns {string} Compact string representation
   */
  toCompactString() {
    return `${this.lat.toFixed(5)},${this.lng.toFixed(5)}`;
  }
  
  /**
   * Set the elevation (Z value) of the coordinate
   * @param {number} elevation - The new elevation value in meters
   * @returns {Coordinate} - This coordinate for chaining
   */
  setZ(elevation) {
    // Handle null/undefined elevation more gracefully
    const safeElevation = elevation !== null && elevation !== undefined ? elevation : 0;
    
    if (!Number.isFinite(safeElevation)) {
      throw new Error(`Invalid elevation: ${elevation}. Must be a number.`);
    }
    
    this.elevation = safeElevation;
    return this;
  }
}