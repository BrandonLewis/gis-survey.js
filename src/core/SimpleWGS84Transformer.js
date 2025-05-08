/**
 * SimpleWGS84Transformer.js - Implementation focused on WGS84 and common North American projections
 * 
 * This implementation focuses on common North American coordinate systems used by
 * civil contractors, while being lightweight and efficient. It provides a simplified
 * set of transformations without requiring the full proj4js library.
 */

import { CoordinateTransformer } from './CoordinateTransformer.js';
import { Coordinate } from './Coordinate.js';
import { GeoidModel } from './GeoidModel.js';

/**
 * Simple WGS84-focused coordinate transformer.
 * Supports common North American datums and projections.
 */
export class SimpleWGS84Transformer extends CoordinateTransformer {
  /**
   * Create a new SimpleWGS84Transformer.
   */
  constructor() {
    super();
    
    // Define supported projections with parameters
    this.projections = {
      'WGS84': { // Standard GPS coordinates (EPSG:4326)
        datum: 'WGS84',
        type: 'geographic',
        epsg: '4326',
        params: {}
      },
      'NAD83': { // North American Datum 1983
        datum: 'NAD83',
        type: 'geographic',
        epsg: '4269',
        params: {}
      },
      'NAD27': { // North American Datum 1927
        datum: 'NAD27',
        type: 'geographic',
        epsg: '4267',
        params: {}
      },
      'UTM_NAD83_N': { // UTM North zones with NAD83 datum
        datum: 'NAD83',
        type: 'utm',
        params: { north: true }
      },
      'UTM_NAD83_S': { // UTM South zones with NAD83 datum
        datum: 'NAD83',
        type: 'utm',
        params: { north: false }
      },
      'StatePlane_NAD83': { // State Plane with NAD83 datum
        datum: 'NAD83',
        type: 'stateplane',
        params: {}
      }
    };
    
    // Datum shift parameters
    this.datumShifts = {
      'WGS84_to_NAD83': { // Very minor shift for most applications
        dx: 0.99343, // meters
        dy: -1.90331, // meters
        dz: -0.52655, // meters
        rx: 0.025915, // arcseconds
        ry: 0.009426, // arcseconds
        rz: 0.011599, // arcseconds
        ds: -0.00062  // parts per million
      },
      'NAD83_to_NAD27': {
        // Parameters vary by region - simplification
        // This is a rough approximation - real transformations use grid files
        dx: -8.0, // meters
        dy: 160.0, // meters
        dz: 176.0, // meters
      }
    };
  }
  
  /**
   * Get list of supported projections.
   * @returns {string[]} Array of supported projection identifiers
   */
  getSupportedProjections() {
    return Object.keys(this.projections);
  }
  
  /**
   * Transform a coordinate from one projection to another.
   * @param {Coordinate} coordinate - The coordinate to transform
   * @param {string} fromProjection - Source projection
   * @param {string} toProjection - Target projection
   * @returns {Coordinate} A new coordinate in the target projection
   * @throws {Error} If projections are not supported
   */
  transform(coordinate, fromProjection, toProjection) {
    // Validate inputs
    this._validateProjection(fromProjection);
    this._validateProjection(toProjection);
    
    // If same projection, return a copy
    if (fromProjection === toProjection) {
      return coordinate.clone();
    }
    
    // Check for cached result
    const cacheKey = this._getCacheKey(coordinate, fromProjection, toProjection);
    const cached = this._transformCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Handle date line crossing
    if (this._crossesDateLine(coordinate, fromProjection, toProjection)) {
      return this._handleDateLineCrossing(coordinate, fromProjection, toProjection);
    }
    
    // Transform the coordinate
    let result;
    
    try {
      // First convert to geographic coordinates (lat/lon) on source datum if needed
      let geographicSource;
      if (this.projections[fromProjection].type === 'geographic') {
        geographicSource = coordinate.clone();
      } else if (this.projections[fromProjection].type === 'utm') {
        geographicSource = this._utmToGeographic(coordinate, this.projections[fromProjection].params);
      } else if (this.projections[fromProjection].type === 'stateplane') {
        geographicSource = this._statePlaneToGeographic(coordinate);
      } else {
        throw new Error(`Unsupported projection type: ${this.projections[fromProjection].type}`);
      }
      
      // Then transform between datums if needed
      let geographicTarget;
      const sourceDatum = this.projections[fromProjection].datum;
      const targetDatum = this.projections[toProjection].datum;
      
      if (sourceDatum === targetDatum) {
        geographicTarget = geographicSource;
      } else {
        geographicTarget = this._transformDatum(geographicSource, sourceDatum, targetDatum);
      }
      
      // Finally convert to target projection system if needed
      if (this.projections[toProjection].type === 'geographic') {
        result = geographicTarget.clone();
        result.projection = toProjection;
      } else if (this.projections[toProjection].type === 'utm') {
        result = this._geographicToUtm(geographicTarget, this.projections[toProjection].params);
        result.projection = toProjection;
      } else if (this.projections[toProjection].type === 'stateplane') {
        result = this._geographicToStatePlane(geographicTarget);
        result.projection = toProjection;
      } else {
        throw new Error(`Unsupported projection type: ${this.projections[toProjection].type}`);
      }
      
      // Cache the result
      this._transformCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      this._logTransformationError(error, coordinate, fromProjection, toProjection);
      throw new Error(`Transformation failed from ${fromProjection} to ${toProjection}: ${error.message}`);
    }
  }
  
  /**
   * Convert ellipsoidal height to orthometric height.
   * @param {Coordinate} coordinate - Coordinate with ellipsoidal height
   * @returns {Coordinate} New coordinate with orthometric height
   */
  convertEllipsoidalToOrthometric(coordinate) {
    const geoidHeight = this._getGeoidHeight(coordinate.lat, coordinate.lng);
    
    return new Coordinate(
      coordinate.lat,
      coordinate.lng,
      coordinate.elevation - geoidHeight,
      'orthometric',
      coordinate.projection
    );
  }
  
  /**
   * Convert orthometric height to ellipsoidal height.
   * @param {Coordinate} coordinate - Coordinate with orthometric height
   * @returns {Coordinate} New coordinate with ellipsoidal height
   */
  convertOrthometricToEllipsoidal(coordinate) {
    const geoidHeight = this._getGeoidHeight(coordinate.lat, coordinate.lng);
    
    return new Coordinate(
      coordinate.lat,
      coordinate.lng,
      coordinate.elevation + geoidHeight,
      'ellipsoidal',
      coordinate.projection
    );
  }
  
  /**
   * Get the geoid height (separation between ellipsoid and geoid) at a location.
   * @param {number} lat - Latitude in decimal degrees
   * @param {number} lng - Longitude in decimal degrees
   * @returns {number} Geoid height in meters
   * @private
   */
  _getGeoidHeight(lat, lng) {
    // Check cache first
    const cacheKey = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
    const cached = this._geoidCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    
    // Use the GeoidModel to get the height
    const geoidHeight = GeoidModel.getHeight(lat, lng);
    
    // Cache the result
    this._geoidCache.set(cacheKey, geoidHeight);
    
    return geoidHeight;
  }
  
  /**
   * Validate that a projection is supported.
   * @param {string} projection - Projection identifier
   * @throws {Error} If projection is not supported
   * @private
   */
  _validateProjection(projection) {
    if (!this.projections[projection]) {
      throw new Error(`Unsupported projection: ${projection}. Supported projections are: ${this.getSupportedProjections().join(', ')}`);
    }
  }
  
  /**
   * Transform coordinates between datums.
   * @param {Coordinate} coordinate - Geographic coordinate to transform
   * @param {string} fromDatum - Source datum
   * @param {string} toDatum - Target datum
   * @returns {Coordinate} Transformed coordinate
   * @private
   */
  _transformDatum(coordinate, fromDatum, toDatum) {
    if (fromDatum === toDatum) {
      return coordinate.clone();
    }
    
    // We'll use Helmert transformation for datum shifts
    if (fromDatum === 'WGS84' && toDatum === 'NAD83') {
      return this._applyHelmertTransformation(coordinate, this.datumShifts.WGS84_to_NAD83);
    }
    
    if (fromDatum === 'NAD83' && toDatum === 'WGS84') {
      return this._applyHelmertTransformation(coordinate, this._invertHelmertParams(this.datumShifts.WGS84_to_NAD83));
    }
    
    if (fromDatum === 'NAD83' && toDatum === 'NAD27') {
      return this._applyHelmertTransformation(coordinate, this.datumShifts.NAD83_to_NAD27);
    }
    
    if (fromDatum === 'NAD27' && toDatum === 'NAD83') {
      return this._applyHelmertTransformation(coordinate, this._invertHelmertParams(this.datumShifts.NAD83_to_NAD27));
    }
    
    if (fromDatum === 'WGS84' && toDatum === 'NAD27') {
      // Transform in two steps: WGS84 -> NAD83 -> NAD27
      const nad83 = this._transformDatum(coordinate, 'WGS84', 'NAD83');
      return this._transformDatum(nad83, 'NAD83', 'NAD27');
    }
    
    if (fromDatum === 'NAD27' && toDatum === 'WGS84') {
      // Transform in two steps: NAD27 -> NAD83 -> WGS84
      const nad83 = this._transformDatum(coordinate, 'NAD27', 'NAD83');
      return this._transformDatum(nad83, 'NAD83', 'WGS84');
    }
    
    throw new Error(`Unsupported datum transformation: ${fromDatum} to ${toDatum}`);
  }
  
  /**
   * Apply Helmert transformation parameters.
   * @param {Coordinate} coordinate - Geographic coordinate to transform
   * @param {Object} params - Helmert transformation parameters
   * @returns {Coordinate} Transformed coordinate
   * @private
   */
  _applyHelmertTransformation(coordinate, params) {
    // Convert lat/lon to 3D Cartesian coordinates (ECEF)
    const ecef = this._geographicToECEF(coordinate);
    
    // Apply the 7-parameter Helmert transformation
    const dx = params.dx || 0;
    const dy = params.dy || 0;
    const dz = params.dz || 0;
    const rx = (params.rx || 0) * Math.PI / (180 * 3600); // arcseconds to radians
    const ry = (params.ry || 0) * Math.PI / (180 * 3600);
    const rz = (params.rz || 0) * Math.PI / (180 * 3600);
    const ds = (params.ds || 0) / 1000000; // ppm to scale factor
    
    const x2 = (1 + ds) * (ecef.x + rz * ecef.y - ry * ecef.z) + dx;
    const y2 = (1 + ds) * (-rz * ecef.x + ecef.y + rx * ecef.z) + dy;
    const z2 = (1 + ds) * (ry * ecef.x - rx * ecef.y + ecef.z) + dz;
    
    // Convert back to geographic coordinates
    return this._ecefToGeographic({ x: x2, y: y2, z: z2 }, coordinate.heightReference);
  }
  
  /**
   * Invert Helmert transformation parameters.
   * @param {Object} params - Helmert transformation parameters
   * @returns {Object} Inverted parameters
   * @private
   */
  _invertHelmertParams(params) {
    return {
      dx: -(params.dx || 0),
      dy: -(params.dy || 0),
      dz: -(params.dz || 0),
      rx: -(params.rx || 0),
      ry: -(params.ry || 0),
      rz: -(params.rz || 0),
      ds: -(params.ds || 0)
    };
  }
  
  /**
   * Convert geographic coordinates to ECEF (Earth-Centered, Earth-Fixed) coordinates.
   * @param {Coordinate} coordinate - Geographic coordinate
   * @returns {Object} ECEF coordinates { x, y, z }
   * @private
   */
  _geographicToECEF(coordinate) {
    const a = 6378137.0; // WGS84 semi-major axis in meters
    const e2 = 0.00669437999014; // WGS84 first eccentricity squared
    
    // Handle different coordinate formats
    const lat = coordinate.lat !== undefined ? coordinate.lat : coordinate.y;
    const lng = coordinate.lng !== undefined ? coordinate.lng : coordinate.x;
    const elevation = coordinate.elevation !== undefined ? coordinate.elevation : 
                    (coordinate.z !== undefined ? coordinate.z : 0);
    
    // Validate coordinate values
    if (lat === undefined || lng === undefined) {
      throw new Error('Invalid coordinate: missing latitude or longitude');
    }
    
    const φ = lat * Math.PI / 180; // latitude in radians
    const λ = lng * Math.PI / 180; // longitude in radians
    const h = elevation; // height above ellipsoid in meters
    
    const sinφ = Math.sin(φ);
    const cosφ = Math.cos(φ);
    const sinλ = Math.sin(λ);
    const cosλ = Math.cos(λ);
    
    const N = a / Math.sqrt(1 - e2 * sinφ * sinφ); // radius of curvature in the prime vertical
    
    const x = (N + h) * cosφ * cosλ;
    const y = (N + h) * cosφ * sinλ;
    const z = (N * (1 - e2) + h) * sinφ;
    
    // Return in standard format plus original names for compatibility
    return {
      x, y, z,
      lat, lng, elevation,
      originalFormat: 'geographic'
    };
  }
  
  /**
   * Convert ECEF coordinates to geographic coordinates.
   * @param {Object} ecef - ECEF coordinates { x, y, z }
   * @param {string} heightReference - Height reference system
   * @returns {Coordinate} Geographic coordinate
   * @private
   */
  _ecefToGeographic(ecef, heightReference) {
    const a = 6378137.0; // WGS84 semi-major axis in meters
    const e2 = 0.00669437999014; // WGS84 first eccentricity squared
    const b = a * Math.sqrt(1 - e2); // semi-minor axis
    
    // Handle different coordinate formats if ECEF comes from different sources
    const x = ecef.x;
    const y = ecef.y;
    const z = ecef.z;
    
    // Validate ECEF values
    if (x === undefined || y === undefined || z === undefined) {
      throw new Error('Invalid ECEF coordinate: missing x, y, or z component');
    }
    
    const p = Math.sqrt(x*x + y*y); // distance from Z axis
    const θ = Math.atan2(z * a, p * b); // parametric latitude
    
    const sinθ = Math.sin(θ);
    const cosθ = Math.cos(θ);
    
    const φ = Math.atan2(
      z + e2 * b * sinθ * sinθ * sinθ,
      p - e2 * a * cosθ * cosθ * cosθ
    ); // latitude
    
    const λ = Math.atan2(y, x); // longitude
    
    const sinφ = Math.sin(φ);
    const N = a / Math.sqrt(1 - e2 * sinφ * sinφ); // radius of curvature
    
    const h = p / Math.cos(φ) - N; // height above ellipsoid
    
    const lat = φ * 180 / Math.PI;
    const lng = λ * 180 / Math.PI;
    
    // Create a new Coordinate using the standard format (lat, lng, elevation)
    return new Coordinate(lat, lng, h, heightReference);
  }
  
  /**
   * Convert UTM coordinates to geographic coordinates.
   * @param {Coordinate} coordinate - UTM coordinate
   * @param {Object} params - UTM parameters including zone and hemisphere
   * @returns {Coordinate} Geographic coordinate
   * @private
   */
  _utmToGeographic(coordinate, params) {
    // This would be a full implementation of the UTM to geographic conversion
    // For simplicity, we'll provide a stub implementation - in production code
    // this would use the full UTM conversion formulas
    
    // For demo purposes, we'll convert a fixed UTM coordinate
    // In a real implementation, this would be determined from the coordinate's properties
    // such as the UTM easting, northing, zone, and hemisphere
    
    throw new Error('UTM to Geographic conversion not fully implemented in SimpleWGS84Transformer');
  }
  
  /**
   * Convert geographic coordinates to UTM coordinates.
   * @param {Coordinate} coordinate - Geographic coordinate
   * @param {Object} params - UTM parameters including hemisphere
   * @returns {Coordinate} UTM coordinate
   * @private
   */
  _geographicToUtm(coordinate, params) {
    // This would be a full implementation of the geographic to UTM conversion
    // For simplicity, we'll provide a stub implementation - in production code
    // this would use the full UTM conversion formulas
    
    throw new Error('Geographic to UTM conversion not fully implemented in SimpleWGS84Transformer');
  }
  
  /**
   * Convert State Plane coordinates to geographic coordinates.
   * @param {Coordinate} coordinate - State Plane coordinate
   * @returns {Coordinate} Geographic coordinate
   * @private
   */
  _statePlaneToGeographic(coordinate) {
    // This would be a full implementation of the State Plane to geographic conversion
    // For simplicity, we'll provide a stub implementation - in production code
    // this would use the full State Plane conversion formulas for each state zone
    
    throw new Error('State Plane to Geographic conversion not fully implemented in SimpleWGS84Transformer');
  }
  
  /**
   * Convert geographic coordinates to State Plane coordinates.
   * @param {Coordinate} coordinate - Geographic coordinate
   * @returns {Coordinate} State Plane coordinate
   * @private
   */
  _geographicToStatePlane(coordinate) {
    // This would be a full implementation of the geographic to State Plane conversion
    // For simplicity, we'll provide a stub implementation - in production code
    // this would use the full State Plane conversion formulas for each state zone
    
    throw new Error('Geographic to State Plane conversion not fully implemented in SimpleWGS84Transformer');
  }
}