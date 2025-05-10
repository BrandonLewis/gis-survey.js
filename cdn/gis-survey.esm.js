/**
 * @brandon7lewis/gis-survey.js v1.0.68
 * Mapping and surveying tools module for GIS and RTK surveying
 * https://github.com/BrandonLewis/gis-survey.js
 * 
 * @license MIT
 * @copyright 2025 Brandon Lewis
 */

/**
 * EventEmitter - Simple event system for component communication
 * 
 * Independent copy for gis-survey.js module to avoid dependencies on gnss.js module
 */
class EventEmitter {
  constructor() {
    this.events = {};
    this.debugMode = false;
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(listener);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(l => l !== listener);
    };
  }
  
  /**
   * Modern DOM-style event subscription (alias for on)
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   */
  addEventListener(event, listener) {
    return this.on(event, listener);
  }

  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   */
  once(event, listener) {
    const remove = this.on(event, (...args) => {
      remove();
      listener(...args);
    });
  }

  /**
   * Emit an event with data
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.debugMode) {
      console.log(`[EventEmitter] ${event}:`, data);
    }
    
    if (this.events[event]) {
      this.events[event].forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for '${event}':`, error);
        }
      });
    }
  }

  /**
   * Remove a specific listener for an event
   * @param {string} event - Event name
   * @param {Function} listener - Callback function to remove
   */
  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }
  
  /**
   * Modern DOM-style event unsubscription (alias for off)
   * @param {string} event - Event name
   * @param {Function} listener - Callback function to remove
   */
  removeEventListener(event, listener) {
    return this.off(event, listener);
  }
  
  /**
   * Remove all listeners for an event
   * @param {string} event - Event name
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  /**
   * Enable/disable debug mode
   * @param {boolean} enabled - Whether debug mode is enabled
   */
  setDebug(enabled) {
    this.debugMode = enabled;
  }
}

/**
 * CoordinateTransformer.js - Abstract interface for coordinate transformations
 * 
 * Defines the interface that all coordinate transformers must implement.
 * This allows for swapping transformer implementations (simple vs. proj4js)
 * while maintaining consistent functionality.
 */


/**
 * Abstract base class for coordinate transformations.
 */
class CoordinateTransformer {
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
class GeoidModel {
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
      { lat: 50, lng: -66, height: -34 },   // Northeast
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

var GeoidModel$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  GeoidModel: GeoidModel
});

/**
 * SimpleWGS84Transformer.js - Implementation focused on WGS84 and common North American projections
 * 
 * This implementation focuses on common North American coordinate systems used by
 * civil contractors, while being lightweight and efficient. It provides a simplified
 * set of transformations without requiring the full proj4js library.
 */


/**
 * Simple WGS84-focused coordinate transformer.
 * Supports common North American datums and projections.
 */
class SimpleWGS84Transformer extends CoordinateTransformer {
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
        params: {},
      },
      'NAD83': { // North American Datum 1983
        datum: 'NAD83',
        type: 'geographic',
        epsg: '4269',
        params: {},
      },
      'NAD27': { // North American Datum 1927
        datum: 'NAD27',
        type: 'geographic',
        epsg: '4267',
        params: {},
      },
      'UTM_NAD83_N': { // UTM North zones with NAD83 datum
        datum: 'NAD83',
        type: 'utm',
        params: { north: true },
      },
      'UTM_NAD83_S': { // UTM South zones with NAD83 datum
        datum: 'NAD83',
        type: 'utm',
        params: { north: false },
      },
      'StatePlane_NAD83': { // State Plane with NAD83 datum
        datum: 'NAD83',
        type: 'stateplane',
        params: {},
      },
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
        ds: -62e-5,  // parts per million
      },
      'NAD83_to_NAD27': {
        // Parameters vary by region - simplification
        // This is a rough approximation - real transformations use grid files
        dx: -8, // meters
        dy: 160.0, // meters
        dz: 176.0, // meters
      },
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
      coordinate.projection,
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
      coordinate.projection,
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
      ds: -(params.ds || 0),
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
      originalFormat: 'geographic',
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
      p - e2 * a * cosθ * cosθ * cosθ,
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
  _utmToGeographic(_coordinate, _params) {
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
  _geographicToUtm(_coordinate, _params) {
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
  _statePlaneToGeographic(_coordinate) {
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
  _geographicToStatePlane(_coordinate) {
    // This would be a full implementation of the geographic to State Plane conversion
    // For simplicity, we'll provide a stub implementation - in production code
    // this would use the full State Plane conversion formulas for each state zone
    
    throw new Error('Geographic to State Plane conversion not fully implemented in SimpleWGS84Transformer');
  }
}

/**
 * TransformerFactory.js - Factory for coordinate transformation providers
 * 
 * Provides a central point for creating and accessing CoordinateTransformer 
 * implementations. This factory pattern allows for switching transformer 
 * implementations without changing client code.
 */


/**
 * Factory class for creating and accessing coordinate transformers.
 */
class TransformerFactory {
  // Static singleton instances for different transformer types
  static _instances = new Map();
  
  // Selected transformer type
  static _defaultType = 'simple';
  
  /**
   * Set the default transformer type to use.
   * @param {string} type - The transformer type ('simple' or 'proj4js')
   */
  static setDefaultType(type) {
    if (!['simple', 'proj4js'].includes(type)) {
      throw new Error(`Invalid transformer type: ${type}. Must be 'simple' or 'proj4js'`);
    }
    
    this._defaultType = type;
  }
  
  /**
   * Get a transformer instance.
   * @param {string} [type=null] - The transformer type to get, or null for default
   * @returns {CoordinateTransformer} A coordinate transformer
   */
  static getTransformer(type = null) {
    const transformerType = type || this._defaultType;
    
    // Check if we already have an instance
    if (this._instances.has(transformerType)) {
      return this._instances.get(transformerType);
    }
    
    // Create a new instance
    let transformer;
    
    switch (transformerType) {
    case 'simple':
      transformer = new SimpleWGS84Transformer();
      break;
        
    case 'proj4js':
      // Try to load proj4js if available
      this._checkForProj4js();
        
      // We'll implement this when needed
      throw new Error('Proj4js transformer not yet implemented. Use "simple" for now.');
        
    default:
      throw new Error(`Unknown transformer type: ${transformerType}`);
    }
    
    // Cache the instance
    this._instances.set(transformerType, transformer);
    
    return transformer;
  }
  
  /**
   * Check if proj4js is available and log warning if not.
   * @private
   */
  static _checkForProj4js() {
    // Check if proj4js is available
    if (typeof proj4 === 'undefined') {
      console.warn('Proj4js transformer requested, but proj4js is not loaded. ' + 
                 'Make sure to include proj4.js in your project for full projection support.');
      return false;
    }
    return true;
  }
  
  /**
   * Clear all cached transformer instances.
   */
  static clearCache() {
    // Clear all transformer instances
    for (const transformer of this._instances.values()) {
      transformer.clearCache();
    }
    
    this._instances.clear();
  }
  
  /**
   * Check if a certain transformer type is available.
   * @param {string} type - The transformer type to check
   * @returns {boolean} Whether the transformer is available
   */
  static isAvailable(type) {
    switch (type) {
    case 'simple':
      return true;
        
    case 'proj4js':
      return this._checkForProj4js();
        
    default:
      return false;
    }
  }
  
  /**
   * Get a list of all supported projection systems across all transformers.
   * @returns {Object} Object mapping transformer type to array of supported projections
   */
  static getAllSupportedProjections() {
    const result = {};
    
    // Always include simple transformer
    result.simple = new SimpleWGS84Transformer().getSupportedProjections();
    
    // Check if proj4js is available
    if (this._checkForProj4js()) {
      // This would return a list of all projections supported by proj4js
      // We'll implement this when needed
      result.proj4js = ['Many EPSG codes supported when proj4js is loaded'];
    }
    
    return result;
  }
}

var TransformerFactory$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  TransformerFactory: TransformerFactory
});

/**
 * Coordinate.js - 3D Geographic Coordinate class
 * 
 * Represents a point in 3D space using latitude, longitude, and elevation.
 * Supports different height references and projections, with transformation
 * functionality through a pluggable transformer system.
 */


/**
 * Class representing a geographic 3D coordinate.
 */
class Coordinate {
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
      const elevation = obj.elevation !== undefined ? obj.elevation : 
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
        obj.projection || 'WGS84',
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
      Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By),
    );
    
    const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);
    
    // Calculate average elevation
    const midElevation = (this.elevation + otherCoord.elevation) / 2;
    
    return new Coordinate(
      φ3 * 180 / Math.PI,
      λ3 * 180 / Math.PI,
      midElevation,
      this.heightReference,
      this.projection,
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
      this.projection,
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
      projection: this.projection,
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
      coordinates: [wgs84Coord.lng, wgs84Coord.lat, wgs84Coord.elevation],
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

var Coordinate$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Coordinate: Coordinate
});

/**
 * CoordinateUtils.js - Coordinate format utilities
 * 
 * Provides utility functions for working with different coordinate formats
 * and ensuring consistency across the application.
 */


/**
 * Coordinate Utilities
 * A collection of helper functions for coordinate processing
 */
const CoordinateUtils = {
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

/**
 * GeometryEngine.js - Geodesic geometry calculations for 3D coordinates
 *
 * Provides accurate geometric calculations on an ellipsoidal Earth model,
 * taking elevation into account for true 3D calculations. This engine handles
 * complex computations such as area, volume, and intersection determination.
 */


/**
 * Provides geometric calculations for geographic coordinates.
 */
class GeometryEngine {
  /**
   * Calculate the total elevation gain along a path
   * @param {Array<Coordinate>} coordinates - Array of coordinates representing the path
   * @returns {number} Total elevation gain in meters
   */
  static calculateElevationGain(coordinates) {
    if (!coordinates || coordinates.length < 2) {
      return 0;
    }

    let totalGain = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];

      // Skip if either coordinate doesn't have elevation data
      if (prev.elevation === undefined || prev.elevation === null ||
          curr.elevation === undefined || curr.elevation === null) {
        continue;
      }

      // Only add positive elevation changes
      const diff = curr.elevation - prev.elevation;
      if (diff > 0) {
        totalGain += diff;
      }
    }

    return totalGain;
  }

  /**
   * Calculate the total elevation loss along a path
   * @param {Array<Coordinate>} coordinates - Array of coordinates representing the path
   * @returns {number} Total elevation loss in meters (as a positive number)
   */
  static calculateElevationLoss(coordinates) {
    if (!coordinates || coordinates.length < 2) {
      return 0;
    }

    let totalLoss = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];

      // Skip if either coordinate doesn't have elevation data
      if (prev.elevation === undefined || prev.elevation === null ||
          curr.elevation === undefined || curr.elevation === null) {
        continue;
      }

      // Only add negative elevation changes (as positive values)
      const diff = curr.elevation - prev.elevation;
      if (diff < 0) {
        totalLoss += Math.abs(diff);
      }
    }

    return totalLoss;
  }
  /**
     * Get the Coordinate class
     * @returns {Object} Object containing the Coordinate class
     * @private
     */
  static _getCoordinateClass() {
    return { Coordinate };
  }

  /**
     * Earth parameters.
     * @private
     */
  static _EARTH_RADIUS_M = 6371000; // Mean radius in meters
  static _WGS84_SEMI_MAJOR_AXIS = 6378137.0; // Semi-major axis in meters
  static _WGS84_SEMI_MINOR_AXIS = 6356752.314245; // Semi-minor axis in meters
  static _WGS84_FLATTENING = 1 / 298.257223563; // Flattening

  /**
     * Find the nearest point on a line segment to a given point.
     * Instance method wrapper for the static nearestPointOnSegment method
     * @param {Coordinate} start - Starting point of the segment
     * @param {Coordinate} end - Ending point of the segment
     * @param {Coordinate} point - The point to find the nearest to
     * @returns {Object} Object containing the nearest point and distance information
     */
  nearestPointOnSegment(start, end, point) {
    return GeometryEngine.nearestPointOnSegment(start, end, point);
  }

  /**
     * Calculate the distance between two coordinates.
     * @param {Coordinate|Object} coord1 - First coordinate
     * @param {Coordinate|Object} coord2 - Second coordinate
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @returns {number} Distance in meters
     */
  static calculateDistance(coord1, coord2, options = {}) {
    // Validate coordinates or coordinate-like objects
    if (!coord1 || !coord2 ||
            typeof coord1 !== 'object' || typeof coord2 !== 'object') {
      console.error('Invalid coordinate format for distance calculation');
      return 0;
    }

    const includeElevation = options.includeElevation !== false;

    // Helper function to extract latitude from coordinate-like object
    const getLat = (coord) => {
      // Support both coord.lat and coord.latitude formats
      return coord.lat !== undefined ? coord.lat :
        coord.latitude !== undefined ? coord.latitude : null;
    };

    // Helper function to extract longitude from coordinate-like object
    const getLng = (coord) => {
      // Support both coord.lng and coord.longitude formats
      return coord.lng !== undefined ? coord.lng :
        coord.longitude !== undefined ? coord.longitude : null;
    };

    // Extract lat/lng values
    const lat1 = getLat(coord1);
    const lng1 = getLng(coord1);
    const lat2 = getLat(coord2);
    const lng2 = getLng(coord2);

    // Validate lat/lng existence
    if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
      console.error('Coordinates missing lat/lng properties for distance calculation');
      return 0;
    }

    // Create simplified coordinate objects with consistent properties
    const simpleCoord1 = {
      lat: lat1,
      lng: lng1,
      elevation: coord1.elevation !== undefined ? coord1.elevation : 0,
    };

    const simpleCoord2 = {
      lat: lat2,
      lng: lng2,
      elevation: coord2.elevation !== undefined ? coord2.elevation : 0,
    };

    // If both are true Coordinate instances with distanceTo method, use it
    if (includeElevation &&
            coord1 instanceof Coordinate &&
            coord2 instanceof Coordinate &&
            typeof coord1.distanceTo === 'function') {
      return coord1.distanceTo(coord2);
    }

    // For 3D distance with elevation (Pythagorean approach)
    if (includeElevation) {
      // Calculate 2D distance
      const distance2D = this._calculateApproximateDistance(simpleCoord1, simpleCoord2);

      // Extract elevations
      const elev1 = simpleCoord1.elevation !== undefined ? simpleCoord1.elevation : 0;
      const elev2 = simpleCoord2.elevation !== undefined ? simpleCoord2.elevation : 0;

      // Apply Pythagorean theorem for 3D distance
      const elevDiff = elev2 - elev1;
      return Math.sqrt(distance2D * distance2D + elevDiff * elevDiff);
    }

    // For 2D distance, use simplified Vincenty approximation
    return this._calculateApproximateDistance(simpleCoord1, simpleCoord2);
  }

  /**
     * Calculate the area of a polygon defined by an array of coordinates.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon (must be closed)
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @returns {number} Area in square meters
     */
  static calculateArea(coordinates, options = {}) {
    const includeElevation = options.includeElevation !== false;

    // Check if we have enough coordinates
    if (coordinates.length < 3) {
      return 0;
    }

    // Check if the polygon is closed
    const firstCoord = coordinates[0];
    const lastCoord = coordinates[coordinates.length - 1];
    const isClosed = firstCoord.lat === lastCoord.lat &&
            firstCoord.lng === lastCoord.lng;

    // Create a closed copy if needed
    const closedCoords = isClosed ? coordinates : [...coordinates, coordinates[0]];

    // Check for self-intersection
    if (this._isSelfIntersecting(closedCoords)) {
      // For self-intersecting polygons, we'll need to triangulate
      return this._calculateAreaWithTriangulation(closedCoords, options);
    }

    if (includeElevation) {
      // For 3D area, project to a plane and calculate
      return this._calculate3DArea(closedCoords);
    } else {
      // Use spherical geometry for 2D area
      return this._calculate2DSphericalArea(closedCoords);
    }
  }

  /**
     * Calculate the perimeter of a polygon or the length of a line.
     * @param {Coordinate[]} coordinates - Array of coordinates
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @returns {number} Perimeter in meters
     */
  static calculatePerimeter(coordinates, options = {}) {
    const includeElevation = options.includeElevation !== false;

    if (coordinates.length < 2) {
      return 0;
    }

    let perimeter = 0;

    // Sum the distances between consecutive points
    for (let i = 0; i < coordinates.length - 1; i++) {
      perimeter += this.calculateDistance(
        coordinates[i],
        coordinates[i + 1],
        { includeElevation },
      );
    }

    // If it's a polygon (has at least 3 points), close it
    if (coordinates.length >= 3) {
      // Check if already closed
      const firstCoord = coordinates[0];
      const lastCoord = coordinates[coordinates.length - 1];
      const isClosed = firstCoord.lat === lastCoord.lat &&
                firstCoord.lng === lastCoord.lng;

      if (!isClosed) {
        // Add distance from last point back to first
        perimeter += this.calculateDistance(
          coordinates[coordinates.length - 1],
          coordinates[0],
          { includeElevation },
        );
      }
    }

    return perimeter;
  }

  /**
     * Calculate the length of a path (alias for calculatePerimeter).
     * @param {Coordinate[]} coordinates - Array of coordinates
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @param {boolean} [options.closed=false] - Whether the path is closed
     * @returns {number} Path length in meters
     */
  static calculatePathLength(coordinates, options = {}) {
    return this.calculatePerimeter(coordinates, options);
  }

  /**
     * Calculate a perpendicular offset point from a line segment.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a line
     * @param {number} pointIndex - Index of the segment start point
     * @param {number} segmentPosition - Normalized position along the segment (0-1)
     * @param {number} distance - Offset distance in meters
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.enable3D=true] - Whether to include elevation in the calculation
     * @returns {Object} Object with the offset point and other segment info
     */
  static calculatePerpendicularOffset(coordinates, pointIndex, segmentPosition, distance, options = {}) {
    if (coordinates.length < 2 || pointIndex < 0 || pointIndex >= coordinates.length - 1) {
      throw new Error('Invalid coordinates or point index for perpendicular offset');
    }

    const enable3D = options.enable3D !== false;

    // Get the segment points
    const startPoint = coordinates[pointIndex];
    const endPoint = coordinates[pointIndex + 1];

    // Calculate the point on the segment at the given position
    const segmentFraction = Math.max(0, Math.min(1, segmentPosition));

    // Interpolate the point position
    const nearestPoint = new Coordinate(
      startPoint.lat + segmentFraction * (endPoint.lat - startPoint.lat),
      startPoint.lng + segmentFraction * (endPoint.lng - startPoint.lng),
      enable3D ? startPoint.elevation + segmentFraction * (endPoint.elevation - startPoint.elevation) : null,
      startPoint.heightReference,
      startPoint.projection,
    );

    // Calculate the bearing of the segment
    const segmentBearing = startPoint.bearingTo(endPoint);

    // Calculate perpendicular bearing (90 degrees to the right)
    const perpendicularBearing = (segmentBearing + 90) % 360;

    // Calculate the offset point
    const offsetPoint = this._calculateDestinationPoint(
      nearestPoint,
      distance,
      perpendicularBearing,
    );

    // If 3D is enabled, ensure the offset point has proper elevation
    if (enable3D && nearestPoint.elevation !== null && nearestPoint.elevation !== undefined) {
      offsetPoint.elevation = nearestPoint.elevation;
    }

    return {
      nearestPoint: nearestPoint,
      offsetPoint: offsetPoint,
      pointIndex: pointIndex,
      segmentPosition: segmentFraction,
      segmentBearing: segmentBearing,
      perpendicularBearing: perpendicularBearing,
    };
  }

  /**
     * Calculate the bearing between two coordinates.
     * @param {Coordinate} from - Starting coordinate
     * @param {Coordinate} to - Ending coordinate
     * @returns {number} Bearing in degrees (0-360)
     */
  static calculateBearing(from, to) {
    // Use the bearing calculation from the Coordinate class
    return from.bearingTo(to);
  }

  /**
     * Create a geodesic arc with the given radius around a point.
     * @param {Coordinate} center - Center coordinate
     * @param {number} radiusMeters - Radius in meters
     * @param {number} [startAngle=0] - Starting angle in degrees
     * @param {number} [endAngle=360] - Ending angle in degrees
     * @param {number} [segments=32] - Number of segments to create
     * @returns {Coordinate[]} Array of coordinates forming the arc
     */
  static createArc(center, radiusMeters, startAngle = 0, endAngle = 360, segments = 32) {
    const result = [];
    const angleRange = endAngle - startAngle;

    // Calculate angle increment based on segments
    const angleIncrement = angleRange / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = (startAngle + i * angleIncrement) * Math.PI / 180;
      const point = this._calculateDestinationPoint(
        center,
        radiusMeters,
        angle,
      );
      result.push(point);
    }

    return result;
  }

  /**
     * Create a geodesic circle with the given radius around a point.
     * @param {Coordinate} center - Center coordinate
     * @param {number} radiusMeters - Radius in meters
     * @param {number} [segments=32] - Number of segments to create
     * @returns {Coordinate[]} Array of coordinates forming the circle
     */
  static createCircle(center, radiusMeters, segments = 32) {
    return this.createArc(center, radiusMeters, 0, 360, segments);
  }

  /**
     * Create a geodesic rectangle with the given dimensions.
     * @param {Coordinate} center - Center coordinate
     * @param {number} widthMeters - Width in meters
     * @param {number} heightMeters - Height in meters
     * @param {number} [rotationDegrees=0] - Rotation in degrees
     * @returns {Coordinate[]} Array of coordinates forming the rectangle
     */
  static createRectangle(center, widthMeters, heightMeters, rotationDegrees = 0) {
    const rotationRadians = rotationDegrees * Math.PI / 180;
    const halfWidth = widthMeters / 2;
    const halfHeight = heightMeters / 2;

    // Calculate corners
    const bearings = [
      Math.atan2(-halfHeight, -halfWidth) + rotationRadians,
      Math.atan2(-halfHeight, halfWidth) + rotationRadians,
      Math.atan2(halfHeight, halfWidth) + rotationRadians,
      Math.atan2(halfHeight, -halfWidth) + rotationRadians,
    ];

    const distances = [
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
    ];

    // Generate the corners
    const corners = [];
    for (let i = 0; i < 4; i++) {
      const bearing = (bearings[i] * 180 / Math.PI + 360) % 360;
      corners.push(this._calculateDestinationPoint(
        center,
        distances[i],
        bearing,
      ));
    }

    // Close the polygon
    corners.push(corners[0]);

    return corners;
  }

  /**
     * Check if a point is contained within a polygon.
     * @param {Coordinate} point - The point to check
     * @param {Coordinate[]} polygon - Array of coordinates defining the polygon
     * @returns {boolean} True if the point is inside the polygon
     */
  static isPointInPolygon(point, polygon) {
    // Ray casting algorithm for point-in-polygon detection
    let inside = false;

    // Check if the polygon is closed - if not, close it
    const isPolygonClosed = polygon[0].lat === polygon[polygon.length - 1].lat &&
            polygon[0].lng === polygon[polygon.length - 1].lng;
    const closedPolygon = isPolygonClosed ? polygon : [...polygon, polygon[0]];

    // Ensure all coordinates are in the same projection
    const targetProjection = point.projection;
    const normalizedPolygon = closedPolygon.map(coord =>
      coord.projection !== targetProjection ?
        coord.toProjection(targetProjection) :
        coord,
    );

    for (let i = 0, j = normalizedPolygon.length - 1; i < normalizedPolygon.length; j = i++) {
      const xi = normalizedPolygon[i].lng;
      const yi = normalizedPolygon[i].lat;
      const xj = normalizedPolygon[j].lng;
      const yj = normalizedPolygon[j].lat;

      const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
                (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
     * Check if a point is contained within a polygon (alias for isPointInPolygon).
     * @param {Coordinate} point - The point to check
     * @param {Coordinate[]} polygon - Array of coordinates defining the polygon
     * @returns {boolean} True if the point is inside the polygon
     */
  static pointInPolygon(point, polygon) {
    return this.isPointInPolygon(point, polygon);
  }

  /**
     * Calculate the centroid of a polygon.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {Coordinate} Centroid coordinate
     */
  static calculateCentroid(coordinates) {
    // Check if we have enough coordinates
    if (coordinates.length < 3) {
      throw new Error('Cannot calculate centroid: need at least 3 coordinates');
    }

    // For simple polygons, use the arithmetic mean of coordinates
    // For more complex cases, this is an approximation
    let sumLat = 0;
    let sumLng = 0;
    let sumElev = 0;

    for (const coord of coordinates) {
      sumLat += coord.lat;
      sumLng += coord.lng;
      sumElev += coord.elevation;
    }

    return new Coordinate(
      sumLat / coordinates.length,
      sumLng / coordinates.length,
      sumElev / coordinates.length,
      coordinates[0].heightReference,
      coordinates[0].projection,
    );
  }

  /**
     * Calculate the centroid of a polygon with holes.
     * @param {Coordinate[]} exteriorRing - Array of coordinates defining the exterior ring
     * @param {Array<Array<Coordinate>>} [holes=[]] - Array of holes, each an array of coordinates
     * @returns {Coordinate|null} Centroid coordinate or null if insufficient coordinates
     */
  static calculatePolygonCentroid(exteriorRing, holes = []) {
    // Check if we have enough coordinates for the exterior ring
    if (!exteriorRing || exteriorRing.length < 3) {
      console.warn('Cannot calculate polygon centroid: need at least 3 coordinates for exterior ring');
      // Return null instead of throwing an error for easier error handling
      // or if we have at least one coordinate, return it as a fallback
      if (exteriorRing && exteriorRing.length > 0) {
        return exteriorRing[0].clone();
      }
      return null;
    }

    // If there are no holes, use the regular centroid calculation
    if (!holes || holes.length === 0) {
      return this.calculateCentroid(exteriorRing);
    }

    // For polygons with holes, we can use different strategies:
    // 1. Area-weighted centroid of exterior ring and holes
    // 2. Find centroid of exterior ring and adjust based on holes
    // 3. Triangulate and compute weighted centroid

    // For simplicity, we'll use the exterior ring centroid
    // with a slight adjustment if all holes are valid

    // Calculate the centroid of the exterior ring
    const exteriorCentroid = this.calculateCentroid(exteriorRing);

    // Filter valid holes (those with at least 3 points)
    const validHoles = holes.filter(hole => hole && hole.length >= 3);

    if (validHoles.length === 0) {
      return exteriorCentroid;
    }

    // Calculate area of exterior ring
    const exteriorArea = this.calculateArea(exteriorRing);
    if (exteriorArea === 0) {
      return exteriorCentroid;
    }

    // Calculate area-weighted centroid considering holes
    let totalArea = exteriorArea;
    let weightedLat = exteriorCentroid.lat * exteriorArea;
    let weightedLng = exteriorCentroid.lng * exteriorArea;
    let weightedElev = exteriorCentroid.elevation * exteriorArea;

    for (const hole of validHoles) {
      const holeCentroid = this.calculateCentroid(hole);
      const holeArea = this.calculateArea(hole);

      totalArea -= holeArea;
      weightedLat -= holeCentroid.lat * holeArea;
      weightedLng -= holeCentroid.lng * holeArea;
      weightedElev -= holeCentroid.elevation * holeArea;
    }

    // If the total area becomes too small or negative, fall back to exterior centroid
    if (totalArea <= 0) {
      return exteriorCentroid;
    }

    // Calculate the final weighted centroid
    return new Coordinate(
      weightedLat / totalArea,
      weightedLng / totalArea,
      weightedElev / totalArea,
      exteriorRing[0].heightReference,
      exteriorRing[0].projection,
    );
  }

  /**
     * Calculate the center of a path (line).
     * @param {Coordinate[]} coordinates - Array of coordinates defining a path
     * @returns {Coordinate} Center coordinate of the path
     */
  static calculatePathCenter(coordinates) {
    // Check if we have coordinates
    if (coordinates.length === 0) {
      throw new Error('Cannot calculate path center: no coordinates provided');
    }

    // For a single point, return it
    if (coordinates.length === 1) {
      return coordinates[0].clone();
    }

    // For a path with two points, return the midpoint
    if (coordinates.length === 2) {
      const lat = (coordinates[0].lat + coordinates[1].lat) / 2;
      const lng = (coordinates[0].lng + coordinates[1].lng) / 2;
      const elevation = (coordinates[0].elevation + coordinates[1].elevation) / 2;

      return new Coordinate(
        lat,
        lng,
        elevation,
        coordinates[0].heightReference,
        coordinates[0].projection,
      );
    }

    // For a path with more than two points, find the middle point along the path
    const totalLength = this.calculatePathLength(coordinates);
    const targetDistance = totalLength / 2;

    // Find the point at the target distance
    let currentDistance = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const segmentLength = this.calculateDistance(
        coordinates[i],
        coordinates[i + 1],
        { includeElevation: true },
      );

      if (currentDistance + segmentLength >= targetDistance) {
        // The center point is on this segment
        const remainingDistance = targetDistance - currentDistance;
        const fraction = remainingDistance / segmentLength;

        // Interpolate the position
        const bearing = coordinates[i].bearingTo(coordinates[i + 1]);
        const center = this._calculateDestinationPoint(
          coordinates[i],
          segmentLength * fraction,
          bearing,
        );

        // Interpolate the elevation
        center.elevation = coordinates[i].elevation +
                    (coordinates[i + 1].elevation - coordinates[i].elevation) * fraction;

        return center;
      }

      currentDistance += segmentLength;
    }

    // If something went wrong, fall back to the midpoint of the path
    let sumLat = 0;
    let sumLng = 0;
    let sumElev = 0;

    for (const coord of coordinates) {
      sumLat += coord.lat;
      sumLng += coord.lng;
      sumElev += coord.elevation;
    }

    return new Coordinate(
      sumLat / coordinates.length,
      sumLng / coordinates.length,
      sumElev / coordinates.length,
      coordinates[0].heightReference,
      coordinates[0].projection,
    );
  }

  /**
     * Create an offset line parallel to an existing line.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a line
     * @param {number} offsetMeters - Offset distance in meters (positive is right, negative is left)
     * @param {Object} [options={}] - Offset options
     * @param {boolean} [options.closed=false] - Whether the line forms a closed loop
     * @returns {Coordinate[]} Array of coordinates forming the offset line
     */
  static createOffsetLine(coordinates, offsetMeters, options = {}) {
    if (coordinates.length < 2) {
      throw new Error('Cannot create offset: need at least 2 coordinates');
    }

    const closed = options.closed || false;
    const result = [];

    // Process each segment
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];

      // Calculate bearing of the segment
      const bearing = start.bearingTo(end);

      // Calculate perpendicular bearing (90 degrees to the right)
      const perpBearing = (bearing + 90) % 360;

      // Calculate offset points
      const startOffset = this._calculateDestinationPoint(
        start,
        offsetMeters,
        perpBearing,
      );

      result.push(startOffset);

      // Add the end point for the last segment
      if (i === coordinates.length - 2) {
        const endOffset = this._calculateDestinationPoint(
          end,
          offsetMeters,
          perpBearing,
        );
        result.push(endOffset);
      }
    }

    // If closed, add first point to close the loop
    if (closed && result.length > 2) {
      result.push(result[0]);
    }

    return result;
  }

  /**
     * Find the closest point on a line segment to a given point.
     * @param {Coordinate|Object} point - The reference point
     * @param {Coordinate|Object} segmentStart - Start of the line segment
     * @param {Coordinate|Object} segmentEnd - End of the line segment
     * @returns {Object} Object with the closest point and distance information
     */
  static nearestPointOnSegment(start, end, point) {
    const result = this._findClosestPointOnLineSegment(point, start, end);
    return {
      point: result.point,
      distance: result.distance,
      fraction: result.fraction,
      segmentPosition: result.fraction, // For compatibility with existing code
    };
  }

  /**
     * Calculate a destination point given a starting point, distance, and bearing.
     * Public method wrapping the private implementation.
     * @param {Coordinate} coordinate - Starting coordinate
     * @param {number} distance - Distance in meters
     * @param {number} bearing - Bearing in degrees
     * @returns {Coordinate} Destination coordinate
     */
  static destinationCoordinate(coordinate, distance, bearing) {
    return this._calculateDestinationPoint(coordinate, distance, bearing);
  }

  /**
     * Calculate a destination point given a starting point, distance, and bearing.
     * Uses CoordinateUtils for consistent property handling.
     * @param {Coordinate|Object} start - Starting coordinate
     * @param {number} distance - Distance in meters
     * @param {number} bearing - Bearing in degrees
     * @returns {Coordinate} Destination coordinate
     * @private
     */
  static _calculateDestinationPoint(start, distance, bearing) {
    // Standardize coordinate properties
    const standardStart = CoordinateUtils.standardizeCoordinate(start);

    if (!standardStart) {
      console.error('Invalid starting coordinate for destination calculation:', start);
      return null;
    }

    const earthRadius = this._EARTH_RADIUS_M;
    const bearingRad = bearing * Math.PI / 180;
    const latRad = standardStart.lat * Math.PI / 180;
    const lngRad = standardStart.lng * Math.PI / 180;

    const distRatio = distance / earthRadius;
    const sinDistRatio = Math.sin(distRatio);
    const cosDistRatio = Math.cos(distRatio);

    const sinLat1 = Math.sin(latRad);
    const cosLat1 = Math.cos(latRad);

    const sinLat2 = sinLat1 * cosDistRatio + cosLat1 * sinDistRatio * Math.cos(bearingRad);
    const lat2 = Math.asin(sinLat2);

    const y = Math.sin(bearingRad) * sinDistRatio * cosLat1;
    const x = cosDistRatio - sinLat1 * sinLat2;
    const lng2 = lngRad + Math.atan2(y, x);

    // Preserve the original height reference and projection if available
    const heightReference = start.heightReference ? start.heightReference :
      (start instanceof Coordinate ? start.heightReference : 'ellipsoidal');
    const projection = start.projection ? start.projection :
      (start instanceof Coordinate ? start.projection : 'WGS84');

    return new Coordinate(
      lat2 * 180 / Math.PI,
      ((lng2 * 180 / Math.PI) + 540) % 360 - 180, // Normalize to -180 to +180
      standardStart.elevation,
      heightReference,
      projection,
    );
  }

  /**
     * Find the closest point on a line segment to a given point.
     * Uses CoordinateUtils for consistent property handling.
     * @param {Coordinate|Object} point - The reference point
     * @param {Coordinate|Object} segmentStart - Start of the line segment
     * @param {Coordinate|Object} segmentEnd - End of the line segment
     * @returns {Object} Object with closest point and distance information
     * @private
     */
  static _findClosestPointOnLineSegment(point, segmentStart, segmentEnd) {
    // Standardize coordinates using CoordinateUtils
    const standardPoint = CoordinateUtils.toCoordinate(point);
    const standardStart = CoordinateUtils.toCoordinate(segmentStart);
    const standardEnd = CoordinateUtils.toCoordinate(segmentEnd);

    // Calculate vectors
    const x = standardPoint.lng - standardStart.lng;
    const y = standardPoint.lat - standardStart.lat;
    const dx = standardEnd.lng - standardStart.lng;
    const dy = standardEnd.lat - standardStart.lat;

    // Calculate dot product
    const dot = x * dx + y * dy;

    // Calculate squared length of the segment
    const len2 = dx * dx + dy * dy;

    // Calculate parametric position along the line segment
    const t = len2 > 0 ? Math.max(0, Math.min(1, dot / len2)) : 0;

    // Calculate closest point
    const closestLng = standardStart.lng + t * dx;
    const closestLat = standardStart.lat + t * dy;

    // Calculate elevation (linear interpolation)
    const closestElev = standardStart.elevation +
            t * (standardEnd.elevation - standardStart.elevation);

    // Create the closest point coordinate
    const closestPoint = new Coordinate(
      closestLat,
      closestLng,
      closestElev,
      standardStart.heightReference,
      standardStart.projection,
    );

    // Calculate the distance to the closest point
    const distance = standardPoint.distanceTo(closestPoint);

    return {
      point: closestPoint,
      distance,
      fraction: t,
    };
  }
    
  /**
     * Check if two line segments intersect.
     * @param {Coordinate} p1 - First point of first line segment
     * @param {Coordinate} p2 - Second point of first line segment
     * @param {Coordinate} p3 - First point of second line segment
     * @param {Coordinate} p4 - Second point of second line segment
     * @returns {boolean} True if the line segments intersect
     * @private
     */
  static _lineSegmentsIntersect(p1, p2, p3, p4) {
    // Convert to longitude, latitude order for calculation
    const pt1 = { x: p1.lng, y: p1.lat };
    const pt2 = { x: p2.lng, y: p2.lat };
    const pt3 = { x: p3.lng, y: p3.lat };
    const pt4 = { x: p4.lng, y: p4.lat };

    // Calculate cross products
    const d1 = this._direction(pt3, pt4, pt1);
    const d2 = this._direction(pt3, pt4, pt2);
    const d3 = this._direction(pt1, pt2, pt3);
    const d4 = this._direction(pt1, pt2, pt4);

    // Check if the line segments intersect
    return (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
                ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) ||
            (d1 === 0 && this._onSegment(pt3, pt4, pt1)) ||
            (d2 === 0 && this._onSegment(pt3, pt4, pt2)) ||
            (d3 === 0 && this._onSegment(pt1, pt2, pt3)) ||
            (d4 === 0 && this._onSegment(pt1, pt2, pt4));
  }

  /**
     * Calculate the direction of three points.
     * @param {Object} a - First point {x, y}
     * @param {Object} b - Second point {x, y}
     * @param {Object} c - Third point {x, y}
     * @returns {number} Direction value
     * @private
     */
  static _direction(a, b, c) {
    return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  }

  /**
     * Check if a point is on a line segment.
     * @param {Object} a - First endpoint of segment {x, y}
     * @param {Object} b - Second endpoint of segment {x, y}
     * @param {Object} c - Point to check {x, y}
     * @returns {boolean} True if the point is on the segment
     * @private
     */
  static _onSegment(a, b, c) {
    return c.x <= Math.max(a.x, b.x) && c.x >= Math.min(a.x, b.x) &&
            c.y <= Math.max(a.y, b.y) && c.y >= Math.min(a.y, b.y);
  }

  /**
     * Check if a polygon is self-intersecting.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {boolean} True if the polygon is self-intersecting
     * @private
     */
  static _isSelfIntersecting(coordinates) {
    // Check all line segments against all other line segments for intersection
    for (let i = 0; i < coordinates.length - 1; i++) {
      for (let j = i + 2; j < coordinates.length - 1; j++) {
        // Skip adjacent segments
        if (i === 0 && j === coordinates.length - 2) continue;

        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];
        const p3 = coordinates[j];
        const p4 = coordinates[j + 1];

        if (this._lineSegmentsIntersect(p1, p2, p3, p4)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
     * Check if a polygon or path is self-intersecting.
     * Public method wrapping the private implementation.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon or path
     * @returns {boolean} True if the polygon or path is self-intersecting
     */
  static hasSelfIntersections(coordinates) {
    if (!coordinates || coordinates.length < 4) {
      return false; // A path needs at least 4 points to self-intersect
    }

    return this._isSelfIntersecting(coordinates);
  }

  /**
     * Calculate 2D area using spherical geometry.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {number} Area in square meters
     * @private
     */
  static _calculate2DSphericalArea(coordinates) {
    // We don't need R here since it's used in _calculateSphericalTriangleArea
    let area = 0;

    // For more than 3 coordinates, we compute the area using a sum of spherical triangles
    for (let i = 1; i < coordinates.length - 1; i++) {
      area += this._calculateSphericalTriangleArea(
        coordinates[0],
        coordinates[i],
        coordinates[i + 1],
      );
    }

    return Math.abs(area);
  }

  /**
     * Calculate the area of a spherical triangle using Girard's formula.
     * @param {Coordinate} A - First coordinate
     * @param {Coordinate} B - Second coordinate
     * @param {Coordinate} C - Third coordinate
     * @returns {number} Area in square meters
     * @private
     */
  static _calculateSphericalTriangleArea(A, B, C) {
    const R = this._EARTH_RADIUS_M;

    // Convert to radians
    const a1 = A.lat * Math.PI / 180;
    const a2 = A.lng * Math.PI / 180;
    const b1 = B.lat * Math.PI / 180;
    const b2 = B.lng * Math.PI / 180;
    const c1 = C.lat * Math.PI / 180;
    const c2 = C.lng * Math.PI / 180;

    // Calculate the angles of the spherical triangle
    const a = Math.acos(
      Math.sin(b1) * Math.sin(c1) +
            Math.cos(b1) * Math.cos(c1) * Math.cos(b2 - c2),
    );
    const b = Math.acos(
      Math.sin(a1) * Math.sin(c1) +
            Math.cos(a1) * Math.cos(c1) * Math.cos(a2 - c2),
    );
    const c = Math.acos(
      Math.sin(a1) * Math.sin(b1) +
            Math.cos(a1) * Math.cos(b1) * Math.cos(a2 - b2),
    );

    // Calculate the spherical excess (in radians)
    const E = a + b + c - Math.PI;

    // Calculate the area
    return E * R * R;
  }

  /**
     * Calculate area of a self-intersecting polygon using triangulation.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @param {Object} options - Calculation options
     * @returns {number} Area in square meters
     * @private
     */
  static _calculateAreaWithTriangulation(coordinates, _options) {
    // For simplicity in this implementation, we'll assume the polygon is not self-intersecting
    // A full implementation would use ear clipping or other triangulation methods

    console.warn('Self-intersecting polygon detected. Area calculation may be inaccurate.');

    // Fall back to 2D calculation
    return this._calculate2DSphericalArea(coordinates);
  }

  /**
     * Calculate 3D area considering elevation.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {number} Area in square meters
     * @private
     */
  static _calculate3DArea(coordinates) {
    // For 3D area, we'll project to a plane and calculate
    // First determine plane normal vector by taking cross product
    // of vectors formed by first three points

    if (coordinates.length < 3) {
      return 0;
    }

    // Convert to Cartesian coordinates
    const cartesian = coordinates.map(coord => this._geographicToCartesian(coord));

    // Calculate normal vector of best-fit plane
    const normal = this._calculateBestFitPlaneNormal(cartesian);

    // Project points onto the plane
    const projectedPoints = cartesian.map(point =>
      this._projectPointOntoPlane(point, normal, cartesian[0]),
    );

    // Calculate 3D area of the polygon on this plane
    let area = 0;
    for (let i = 0; i < projectedPoints.length - 1; i++) {
      const p1 = projectedPoints[i];
      const p2 = projectedPoints[i + 1];

      // Add area of triangle formed with origin point
      const crossProduct = this._crossProduct(p1, p2);
      area += 0.5 * this._vectorLength(crossProduct);
    }

    return area;
  }

  /**
     * Calculate the normal vector of the best-fit plane for a set of points.
     * @param {Object[]} points - Array of Cartesian coordinates {x, y, z}
     * @returns {Object} Normal vector {x, y, z}
     * @private
     */
  static _calculateBestFitPlaneNormal(points) {
    // For simplicity, we'll use the normal of the first triangle
    // In a full implementation, we would use Principal Component Analysis

    if (points.length < 3) {
      return { x: 0, y: 0, z: 1 }; // Default to up
    }

    // Calculate vectors from first point to second and third points
    const v1 = {
      x: points[1].x - points[0].x,
      y: points[1].y - points[0].y,
      z: points[1].z - points[0].z,
    };

    const v2 = {
      x: points[2].x - points[0].x,
      y: points[2].y - points[0].y,
      z: points[2].z - points[0].z,
    };

    // Calculate cross product to get normal vector
    const normal = this._crossProduct(v1, v2);

    // Normalize
    const length = this._vectorLength(normal);

    return {
      x: normal.x / length,
      y: normal.y / length,
      z: normal.z / length,
    };
  }

  /**
     * Convert geographic coordinates to Cartesian (ECEF) coordinates.
     * Uses CoordinateUtils for consistent property handling.
     * @param {Coordinate|Object} coord - Geographic coordinate
     * @returns {Object} Cartesian coordinate with consistent property naming
     * @private
     */
  static _geographicToCartesian(coord) {
    const a = this._WGS84_SEMI_MAJOR_AXIS;
    const e2 = 0.00669437999014; // WGS84 first eccentricity squared

    // Standardize coordinate properties using CoordinateUtils
    const standardCoord = CoordinateUtils.standardizeCoordinate(coord);

    if (!standardCoord || standardCoord.lat === null || standardCoord.lng === null) {
      console.error('Invalid coordinate format for conversion:', coord);
      // Return a default value at origin
      return { x: 0, y: 0, z: 0, originalFormat: 'cartesian' };
    }

    const latRad = standardCoord.lat * Math.PI / 180;
    const lngRad = standardCoord.lng * Math.PI / 180;
    const h = standardCoord.elevation;

    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLng = Math.sin(lngRad);
    const cosLng = Math.cos(lngRad);

    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

    // Create result with both naming conventions for compatibility
    const result = {
      x: (N + h) * cosLat * cosLng,
      y: (N + h) * cosLat * sinLng,
      z: (N * (1 - e2) + h) * sinLat,
      // Include standardized geographic properties
      lat: standardCoord.lat,
      lng: standardCoord.lng,
      elevation: standardCoord.elevation,
      originalFormat: 'geographic',
    };

    return result;
  }

  /**
     * Project a point onto a plane.
     * @param {Object} point - Cartesian coordinate {x, y, z}
     * @param {Object} normal - Normal vector of the plane {x, y, z}
     * @param {Object} planePoint - A point on the plane {x, y, z}
     * @returns {Object} Projected point on the plane
     * @private
     */
  static _projectPointOntoPlane(point, normal, planePoint) {
    // Calculate vector from plane point to target point
    const v = {
      x: point.x - planePoint.x,
      y: point.y - planePoint.y,
      z: point.z - planePoint.z,
    };

    // Calculate distance from point to plane
    const dist = this._dotProduct(v, normal);

    // Project the point onto the plane
    return {
      x: point.x - dist * normal.x,
      y: point.y - dist * normal.y,
      z: point.z - dist * normal.z,
    };
  }

  /**
     * Calculate the dot product of two vectors.
     * @param {Object} v1 - First vector {x, y, z}
     * @param {Object} v2 - Second vector {x, y, z}
     * @returns {number} Dot product
     * @private
     */
  static _dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  /**
     * Calculate the cross product of two vectors.
     * @param {Object} v1 - First vector {x, y, z}
     * @param {Object} v2 - Second vector {x, y, z}
     * @returns {Object} Cross product vector {x, y, z}
     * @private
     */
  static _crossProduct(v1, v2) {
    return {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x,
    };
  }

  /**
     * Calculate the length of a vector.
     * @param {Object} v - Vector {x, y, z}
     * @returns {number} Vector length
     * @private
     */
  static _vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
     * Calculate the approximate 2D distance between two coordinates using Haversine formula.
     * @param {Coordinate|Object} coord1 - First coordinate
     * @param {Coordinate|Object} coord2 - Second coordinate
     * @returns {number} Distance in meters
     * @private
     */
  static _calculateApproximateDistance(coord1, coord2) {
    const R = this._EARTH_RADIUS_M;
    const lat1 = coord1.lat * Math.PI / 180;
    const lat2 = coord2.lat * Math.PI / 180;
    const dLat = lat2 - lat1;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

/**
 * Core module for the gis-survey.js library.
 * 
 * Provides the foundational 3D coordinate system, transformations,
 * and geometry calculations for the survey tools.
 */


/**
 * Initialize the core geometry module.
 * @param {Object} [options] - Initialization options
 * @param {string} [options.transformerType='simple'] - Type of transformer to use ('simple' or 'proj4js')
 * @param {string} [options.geoidModel='default'] - Geoid model to use for height reference conversions
 * @returns {Promise<boolean>} Promise that resolves when initialization is complete
 */
async function initializeCore(options = {}) {
  const { 
    transformerType = 'simple',
    geoidModel = 'default',
  } = options;
  
  // Set the default transformer type
  if (options.transformerType) {
    try {
      const { TransformerFactory } = await Promise.resolve().then(function () { return TransformerFactory$1; });
      TransformerFactory.setDefaultType(transformerType);
    } catch (error) {
      console.error(`Failed to set transformer type: ${error.message}`);
      return false;
    }
  }
  
  // Load geoid model if specified
  if (geoidModel !== 'default') {
    try {
      const { GeoidModel } = await Promise.resolve().then(function () { return GeoidModel$1; });
      await GeoidModel.loadModel(geoidModel);
    } catch (error) {
      console.error(`Failed to load geoid model: ${error.message}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Base abstract class for all survey features
 * @module gnss/survey/features/FeatureBase
 */

class FeatureBase extends EventEmitter {
  /**
     * Initialize a feature
     * @param {Object} options - Configuration options for the feature
     * @param {string} [options.id] - Unique identifier for the feature
     * @param {string} [options.name] - Human-readable name for the feature
     * @param {Object} [options.style] - Style properties for the feature
     * @param {Object} [options.properties] - Custom properties for the feature
     * @param {Object} [options.metadata] - Metadata related to the feature
     */
  constructor(options = {}) {
    super();
        
    if (this.constructor === FeatureBase) {
      throw new Error('Abstract class \'FeatureBase\' cannot be instantiated directly.');
    }
        
    this.id = options.id || `feature_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.name = options.name || `Feature ${this.id.substr(-4)}`;
    this.type = 'feature';
    this.style = options.style || {};
    this.properties = options.properties || {};
    this.metadata = options.metadata || {};
    this.selected = false;
    this.visible = options.visible !== false;
    this.editable = options.editable !== false;
    this.interactive = options.interactive !== false;
    this.rendered = null;
    this.timestamp = options.timestamp || Date.now();
    this.sourceData = options.sourceData || null;
  }
    
  /**
     * Get the feature type string
     * @returns {string} - The feature type
     */
  getType() {
    return this.type;
  }
    
  /**
     * Get the feature's bounds
     * @returns {Object} - The bounds object with northEast and southWest coordinates
     */
  getBounds() {
    throw new Error('Method \'getBounds()\' must be implemented.');
  }
    
  /**
     * Get the feature's center coordinate
     * @returns {Coordinate} - The center coordinate
     */
  getCenter() {
    throw new Error('Method \'getCenter()\' must be implemented.');
  }
    
  /**
     * Get the elevation range of the feature
     * @returns {Object} - Object with min and max elevations
     */
  getElevationRange() {
    throw new Error('Method \'getElevationRange()\' must be implemented.');
  }
    
  /**
     * Check if the feature contains a coordinate
     * @param {Coordinate} coordinate - The coordinate to check
     * @param {Object} [options] - Tolerance and other options
     * @returns {boolean} - True if the feature contains the coordinate
     */
  contains(_coordinate, _options = {}) {
    throw new Error('Method \'contains()\' must be implemented.');
  }
    
  /**
     * Find the nearest point on the feature to a given coordinate
     * @param {Coordinate} coordinate - The reference coordinate
     * @returns {Object} - Object with the nearest point and distance
     */
  nearest(_coordinate) {
    throw new Error('Method \'nearest()\' must be implemented.');
  }
    
  /**
     * Export the feature to GeoJSON
     * @param {Object} [options] - Export options
     * @returns {Object} - GeoJSON representation of the feature
     */
  toGeoJSON(_options = {}) {
    throw new Error('Method \'toGeoJSON()\' must be implemented.');
  }
    
  /**
     * Import feature from GeoJSON
     * @param {Object} geojson - GeoJSON object to import
     * @param {Object} [options] - Import options
     * @returns {boolean} - Success status
     */
  fromGeoJSON(_geojson, _options = {}) {
    throw new Error('Method \'fromGeoJSON()\' must be implemented.');
  }
    
  /**
     * Clone this feature
     * @returns {FeatureBase} - A new feature instance that is a copy of this one
     */
  clone() {
    throw new Error('Method \'clone()\' must be implemented.');
  }
    
  /**
     * Set the feature's style
     * @param {Object} style - Style properties
     * @param {Object} [options] - Options for style application
     */
  setStyle(style, options = {}) {
    this.style = { ...this.style, ...style };
    this.emit('style-changed', { feature: this, style: this.style, options });
  }
    
  /**
     * Get the feature's style
     * @returns {Object} - Style properties
     */
  getStyle() {
    return { ...this.style };
  }
    
  /**
     * Set the feature's properties
     * @param {Object} properties - Custom properties
     */
  setProperties(properties) {
    this.properties = { ...this.properties, ...properties };
    this.emit('properties-changed', { feature: this, properties: this.properties });
  }
    
  /**
     * Get the feature's properties
     * @returns {Object} - Custom properties
     */
  getProperties() {
    return { ...this.properties };
  }
    
  /**
     * Get a specific property
     * @param {string} name - Property name
     * @returns {*} - Property value
     */
  getProperty(name) {
    return this.properties[name];
  }
    
  /**
     * Set a specific property
     * @param {string} name - Property name
     * @param {*} value - Property value
     */
  setProperty(name, value) {
    this.properties[name] = value;
    this.emit('property-changed', { feature: this, name, value });
  }
    
  /**
     * Set the feature's name
     * @param {string} name - The new name for the feature
     */
  setName(name) {
    this.name = name;
    this.emit('name-changed', { feature: this, name });
  }
    
  /**
     * Get the feature's name
     * @returns {string} - The feature's name
     */
  getName() {
    return this.name;
  }
    
  /**
     * Select the feature
     * @param {Object} [options] - Options for selection
     */
  select(options = {}) {
    if (!this.selected) {
      this.selected = true;
      this.emit('selected', { feature: this, options });
    }
  }
    
  /**
     * Deselect the feature
     * @param {Object} [options] - Options for deselection
     */
  deselect(options = {}) {
    if (this.selected) {
      this.selected = false;
      this.emit('deselected', { feature: this, options });
    }
  }
    
  /**
     * Toggle the feature's selection state
     * @param {Object} [options] - Options for selection toggling
     * @returns {boolean} - The new selection state
     */
  toggleSelection(options = {}) {
    if (this.selected) {
      this.deselect(options);
    } else {
      this.select(options);
    }
    return this.selected;
  }
    
  /**
     * Show the feature
     */
  show() {
    if (!this.visible) {
      this.visible = true;
      this.emit('visibility-changed', { feature: this, visible: true });
    }
  }
    
  /**
     * Hide the feature
     */
  hide() {
    if (this.visible) {
      this.visible = false;
      this.emit('visibility-changed', { feature: this, visible: false });
    }
  }
    
  /**
     * Toggle the feature's visibility
     * @returns {boolean} - The new visibility state
     */
  toggleVisibility() {
    this.visible = !this.visible;
    this.emit('visibility-changed', { feature: this, visible: this.visible });
    return this.visible;
  }
    
  /**
     * Make the feature editable
     */
  enableEditing() {
    if (!this.editable) {
      this.editable = true;
      this.emit('editable-changed', { feature: this, editable: true });
    }
  }
    
  /**
     * Make the feature non-editable
     */
  disableEditing() {
    if (this.editable) {
      this.editable = false;
      this.emit('editable-changed', { feature: this, editable: false });
    }
  }
    
  /**
     * Register a rendered object with this feature
     * @param {Object} renderedObject - The rendered object
     */
  setRendered(renderedObject) {
    this.rendered = renderedObject;
  }
    
  /**
     * Get the rendered object for this feature
     * @returns {Object|null} - The rendered object or null
     */
  getRendered() {
    return this.rendered;
  }
    
  /**
     * Check if the feature has a valid rendered object
     * @returns {boolean} - True if the feature has a rendered object
     */
  isRendered() {
    return this.rendered !== null;
  }
}

/**
 * Point feature class for survey points
 * @module gnss/survey/features/PointFeature
 */

class PointFeature extends FeatureBase {
  /**
     * Initialize a point feature
     * @param {Coordinate|Object} coordinate - The point's coordinate
     * @param {Object} [options] - Configuration options
     * @param {string} [options.id] - Unique identifier
     * @param {string} [options.name] - Human-readable name
     * @param {Object} [options.style] - Style properties
     * @param {Object} [options.properties] - Custom properties
     * @param {Object} [options.metadata] - Metadata
     */
  constructor(coordinate, options = {}) {
    super(options);
        
    this.type = 'point';
        
    // Handle different input types
    if (coordinate instanceof Coordinate) {
      // Use the Coordinate instance directly
      this.coordinate = coordinate;
    } else if (typeof coordinate === 'object') {
      if (coordinate.latitude !== undefined && coordinate.longitude !== undefined) {
        // Object with latitude/longitude properties
        const elevationVal = coordinate.elevation !== undefined ? coordinate.elevation :
          (coordinate.alt !== undefined ? coordinate.alt : null);

        // Create compatible coordinate object
        this.coordinate = {
          lat: coordinate.latitude,
          lng: coordinate.longitude,
          elevation: elevationVal,
          toString: function() { return `${this.lat}, ${this.lng}, ${this.elevation || 0}`; },
        };
      } else if (coordinate.lat !== undefined && coordinate.lng !== undefined) {
        // Google Maps-style object with lat/lng - use directly with minimal modifications
        const elevationVal = coordinate.elevation !== undefined ? coordinate.elevation :
          (coordinate.alt !== undefined ? coordinate.alt : null);

        // Ensure it has all expected properties
        if (!coordinate.toString) {
          coordinate.toString = function() { return `${this.lat}, ${this.lng}, ${this.elevation || 0}`; };
        }

        // Store elevation if available
        if (elevationVal !== null && elevationVal !== undefined) {
          coordinate.elevation = elevationVal;
        }

        this.coordinate = coordinate;
      } else if (Array.isArray(coordinate) && coordinate.length >= 2) {
        // Array [lng, lat, elevation] (GeoJSON style)
        const lat = coordinate[1];
        const lng = coordinate[0];
        const elevation = coordinate.length > 2 ? coordinate[2] : null;
                
        // Create compatible coordinate object
        this.coordinate = {
          lat: lat,
          lng: lng,
          elevation: elevation,
          toString: function() { return `${this.lat}, ${this.lng}, ${this.elevation || 0}`; },
        };
      } else {
        console.error('Invalid coordinate format:', coordinate);
        throw new Error('Invalid coordinate format');
      }
    } else {
      console.error('Invalid coordinate type:', typeof coordinate);
      throw new Error('Point feature requires a valid coordinate');
    }
        
    // If no name was provided, generate a coordinate-based name
    if (!options.name) {
      // Create a name that works with any coordinate format
      const lat = this.coordinate.lat || this.coordinate.latitude;
      const lng = this.coordinate.lng || this.coordinate.longitude;
      this.name = `Point ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
        
    // Store elevation in properties too for easy access
    const elevation = this.coordinate.elevation;
    if (elevation !== null && elevation !== undefined) {
      this.properties.elevation = elevation;
    }
  }
    
  /**
     * Get the point's coordinate
     * @returns {Coordinate|Object} - The coordinate
     */
  getCoordinate() {
    // Return the stored coordinate, which may be a Coordinate instance
    // or a compatible coordinate-like object
    return this.coordinate;
  }
    
  /**
     * Set the point's coordinate
     * @param {Coordinate|Object} coordinate - The new coordinate
     */
  setCoordinate(coordinate) {
    // Accept either Coordinate instances or coordinate-like objects
    if (coordinate && (coordinate instanceof Coordinate || 
            (typeof coordinate === 'object' && 
             (coordinate.lat !== undefined || coordinate.latitude !== undefined)))) {
            
      // Store the coordinate directly
      this.coordinate = coordinate;
            
      // Extract elevation consistently regardless of coordinate type
      const elevation = coordinate.elevation !== undefined ? coordinate.elevation :
        coordinate.alt !== undefined ? coordinate.alt : null;
            
      // Update elevation property
      if (elevation !== null && elevation !== undefined) {
        this.properties.elevation = elevation;
      } else {
        delete this.properties.elevation;
      }
            
      this.emit('geometry-changed', { feature: this, coordinate: this.coordinate });
    } else {
      console.error('Invalid coordinate format:', coordinate);
      throw new Error('Coordinate must be a valid coordinate-like object');
    }
  }
    
  /**
     * Get the feature's bounds
     * @returns {Object} - The bounds object with northEast and southWest coordinates
     */
  getBounds() {
    // For a point, the bounds are the same point
    return {
      northEast: this.coordinate.clone(),
      southWest: this.coordinate.clone(),
      north: this.coordinate.lat,
      east: this.coordinate.lng,
      south: this.coordinate.lat,
      west: this.coordinate.lng,
    };
  }
    
  /**
     * Get the feature's center coordinate
     * @returns {Coordinate} - The center coordinate
     */
  getCenter() {
    return this.coordinate;
  }
    
  /**
     * Get the elevation range of the feature
     * @returns {Object} - Object with min and max elevations
     */
  getElevationRange() {
    const elevation = this.coordinate.elevation || 0;
    return {
      min: elevation,
      max: elevation,
      range: 0,
    };
  }
    
  /**
     * Check if the feature contains a coordinate
     * @param {Coordinate|Object} coordinate - The coordinate to check
     * @param {Object} [options] - Tolerance and other options
     * @param {number} [options.tolerance=0] - Distance tolerance in meters
     * @param {boolean} [options.includeElevation=false] - Whether to consider elevation
     * @returns {boolean} - True if the feature contains the coordinate
     */
  contains(coordinate, options = {}) {
    // Check if we have a valid coordinate-like object
    if (!coordinate || typeof coordinate !== 'object' || 
            (coordinate.lat === undefined && coordinate.latitude === undefined)) {
      console.error('Invalid coordinate format:', coordinate);
      return false;
    }
        
    const tolerance = options.tolerance || 0;
        
    if (tolerance === 0) {
      // Exact match only - simple comparison of lat/lng
      const checkLat = this.coordinate.lat || this.coordinate.latitude;
      const checkLng = this.coordinate.lng || this.coordinate.longitude;
      const coordLat = coordinate.lat || coordinate.latitude;
      const coordLng = coordinate.lng || coordinate.longitude;
            
      // Check for exact match
      return checkLat === coordLat && checkLng === coordLng;
    } else {
      // Within tolerance distance - use GeometryEngine with any coordinate-like object
      try {
        const distance = GeometryEngine.calculateDistance(
          this.coordinate, 
          coordinate, 
          { includeElevation: options.includeElevation },
        );
        return distance <= tolerance;
      } catch (error) {
        console.error('Error calculating distance for contains check:', error);
        return false;
      }
    }
  }
    
  /**
     * Find the nearest point on the feature to a given coordinate
     * @param {Coordinate|Object} coordinate - The reference coordinate
     * @returns {Object} - Object with the nearest point and distance
     */
  nearest(coordinate) {
    // Check if we have a valid coordinate-like object
    if (!coordinate || typeof coordinate !== 'object' || 
            (coordinate.lat === undefined && coordinate.latitude === undefined)) {
      console.error('Invalid coordinate format:', coordinate);
      throw new Error('Coordinate must be a valid coordinate-like object');
    }
        
    try {
      const distance = GeometryEngine.calculateDistance(
        this.coordinate, 
        coordinate, 
        { includeElevation: true },
      );
            
      // Return a simple object with the result
      return {
        // Just return the original coordinate, no need to clone
        coordinate: this.coordinate,
        distance,
      };
    } catch (error) {
      console.error('Error calculating nearest point:', error);
      return {
        coordinate: this.coordinate,
        distance: Infinity,
      };
    }
  }
    
  /**
     * Export the feature to GeoJSON
     * @param {Object} [options] - Export options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation
     * @param {boolean} [options.includeProperties=true] - Whether to include properties
     * @returns {Object} - GeoJSON representation of the feature
     */
  toGeoJSON(options = {}) {
    const includeElevation = options.includeElevation !== false;
    const includeProperties = options.includeProperties !== false;
        
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          this.coordinate.lng,
          this.coordinate.lat,
        ],
      },
      id: this.id,
    };
        
    // Include elevation if available and requested
    if (includeElevation && this.coordinate.elevation !== null && this.coordinate.elevation !== undefined) {
      geojson.geometry.coordinates.push(this.coordinate.elevation);
    }
        
    // Include properties if requested
    if (includeProperties) {
      geojson.properties = {
        name: this.name,
        ...this.properties,
      };
    }
        
    return geojson;
  }
    
  /**
     * Import feature from GeoJSON
     * @param {Object} geojson - GeoJSON object to import
     * @param {Object} [options] - Import options
     * @returns {boolean} - Success status
     */
  fromGeoJSON(geojson, _options = {}) {
    if (!geojson || geojson.type !== 'Feature' || !geojson.geometry || 
            geojson.geometry.type !== 'Point' || !Array.isArray(geojson.geometry.coordinates)) {
      return false;
    }
        
    const coords = geojson.geometry.coordinates;
    if (coords.length < 2) {
      return false;
    }
        
    // Extract coordinates (GeoJSON format is [longitude, latitude, elevation?])
    const longitude = coords[0];
    const latitude = coords[1];
    const elevation = coords.length > 2 ? coords[2] : null;
        
    // Create new coordinate
    this.coordinate = new Coordinate(latitude, longitude, elevation);
        
    // Update properties
    if (geojson.properties) {
      if (geojson.properties.name) {
        this.name = geojson.properties.name;
        delete geojson.properties.name;
      }
            
      this.properties = { ...geojson.properties };
    }
        
    // Update ID if provided
    if (geojson.id) {
      this.id = geojson.id;
    }
        
    // Store elevation in properties too for easy access
    if (elevation !== null && elevation !== undefined) {
      this.properties.elevation = elevation;
    }
        
    this.emit('geometry-changed', { feature: this, coordinate: this.coordinate });
    return true;
  }
    
  /**
     * Clone this feature
     * @returns {PointFeature} - A new point feature instance that is a copy of this one
     */
  clone() {
    const cloned = new PointFeature(
      this.coordinate.clone(),
      {
        id: `clone_${this.id}`,
        name: `${this.name} (copy)`,
        style: { ...this.style },
        properties: { ...this.properties },
        metadata: { ...this.metadata },
        visible: this.visible,
        editable: this.editable,
        interactive: this.interactive,
      },
    );
        
    return cloned;
  }
    
  /**
     * Calculate distance to another point
     * @param {PointFeature|Coordinate} point - The other point
     * @param {Object} [options] - Distance calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation
     * @returns {number} - Distance in meters
     */
  distanceTo(point, options = {}) {
    const otherCoord = point instanceof PointFeature ? point.getCoordinate() : point;
        
    if (!(otherCoord instanceof Coordinate)) {
      throw new Error('Point must be a PointFeature or Coordinate');
    }
        
    return GeometryEngine.calculateDistance(
      this.coordinate, 
      otherCoord, 
      { includeElevation: options.includeElevation !== false },
    );
  }
    
  /**
     * Calculate bearing to another point
     * @param {PointFeature|Coordinate} point - The other point
     * @returns {number} - Bearing in degrees (0-360)
     */
  bearingTo(point) {
    const otherCoord = point instanceof PointFeature ? point.getCoordinate() : point;
        
    if (!(otherCoord instanceof Coordinate)) {
      throw new Error('Point must be a PointFeature or Coordinate');
    }
        
    return GeometryEngine.calculateBearing(this.coordinate, otherCoord);
  }
    
  /**
     * Move the point by a specified distance and bearing
     * @param {number} distance - Distance to move in meters
     * @param {number} bearing - Bearing in degrees (0 = north, 90 = east, etc.)
     * @param {Object} [options] - Movement options
     * @param {boolean} [options.preserveElevation=true] - Keep the same elevation
     * @returns {PointFeature} - This feature for chaining
     */
  moveByDistanceAndBearing(distance, bearing, options = {}) {
    const preserveElevation = options.preserveElevation !== false;
    const elevation = preserveElevation ? this.coordinate.elevation : null;
        
    const newCoord = GeometryEngine.destinationCoordinate(
      this.coordinate, 
      distance, 
      bearing,
    );
        
    if (preserveElevation && elevation !== null && elevation !== undefined) {
      newCoord.elevation = elevation;
    }
        
    this.setCoordinate(newCoord);
    return this;
  }
    
  /**
     * Move the point to a specific coordinate
     * @param {Coordinate} coordinate - The new coordinate
     * @returns {PointFeature} - This feature for chaining
     */
  moveTo(coordinate) {
    this.setCoordinate(coordinate);
    return this;
  }
}

var PointFeature$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  PointFeature: PointFeature
});

/**
 * Line feature class for survey lines and polylines
 * @module gnss/survey/features/LineFeature
 */

class LineFeature extends FeatureBase {
  /**
     * Initialize a line feature
     * @param {Array<Coordinate>} coordinates - The line's coordinates
     * @param {Object} [options] - Configuration options
     * @param {string} [options.id] - Unique identifier
     * @param {string} [options.name] - Human-readable name
     * @param {Object} [options.style] - Style properties
     * @param {Object} [options.properties] - Custom properties
     * @param {Object} [options.metadata] - Metadata
     * @param {boolean} [options.closed=false] - Whether the line forms a closed loop
     */
  constructor(coordinates = [], options = {}) {
    super(options);
        
    this.type = 'line';
    this.closed = options.closed || false;
        
    // Validate and convert coordinates
    this.coordinates = this._validateCoordinates(coordinates);
        
    // Update properties with metadata about the line
    this._updateProperties();
        
    // If no name was provided, generate a default name
    if (!options.name) {
      this.name = this.closed ? 
        `Closed Line (${this.coordinates.length} vertices)` : 
        `Line (${this.coordinates.length} vertices)`;
    }
  }
    
  /**
     * Validate and convert coordinate array
     * @param {Array} coordinates - Array of coordinates in various formats
     * @returns {Array<Coordinate>} - Array of Coordinate objects
     * @private
     */
  _validateCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) {
      throw new Error('Coordinates must be an array');
    }
        
    return coordinates.map(coord => {
      if (coord instanceof Coordinate) {
        return coord;
      } else if (typeof coord === 'object') {
        if (coord.latitude !== undefined && coord.longitude !== undefined) {
          // Object with lat/lng properties
          const elevation = coord.elevation !== undefined ? coord.elevation : 
            (coord.alt !== undefined ? coord.alt : null);
          return new Coordinate(coord.latitude, coord.longitude, elevation);
        } else if (coord.lat !== undefined && coord.lng !== undefined) {
          // Google Maps-style object
          const elevation = coord.elevation !== undefined ? coord.elevation : 
            (coord.alt !== undefined ? coord.alt : null);
          return new Coordinate(coord.lat, coord.lng, elevation);
        } else if (Array.isArray(coord) && coord.length >= 2) {
          // Array [lng, lat, elevation] (GeoJSON style)
          return new Coordinate(coord[1], coord[0], coord[2] || null);
        }
      }
            
      throw new Error('Invalid coordinate format in array');
    });
  }
    
  /**
     * Update internal properties with metadata about the line
     * @private
     */
  _updateProperties() {
    if (this.coordinates.length < 2) {
      this.properties.length = 0;
      return;
    }
        
    // Calculate length
    this.properties.length = GeometryEngine.calculatePathLength(this.coordinates, { includeElevation: true });
        
    // Get elevation statistics
    const elevations = this.coordinates
      .map(coord => coord.elevation)
      .filter(elev => elev !== null && elev !== undefined);
        
    if (elevations.length > 0) {
      this.properties.minElevation = Math.min(...elevations);
      this.properties.maxElevation = Math.max(...elevations);
      this.properties.elevationGain = GeometryEngine.calculateElevationGain(this.coordinates);
      this.properties.elevationLoss = GeometryEngine.calculateElevationLoss(this.coordinates);
    }
  }
    
  /**
     * Get the line's coordinates
     * @returns {Array<Coordinate>} - Array of coordinates
     */
  getCoordinates() {
    return [...this.coordinates];
  }
    
  /**
     * Set the line's coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates
     */
  setCoordinates(coordinates) {
    this.coordinates = this._validateCoordinates(coordinates);
    this._updateProperties();
    this.emit('geometry-changed', { feature: this, coordinates: this.coordinates });
  }
    
  /**
     * Add a coordinate to the line
     * @param {Coordinate} coordinate - The coordinate to add
     * @param {number} [index] - Optional index to insert at (default: end of line)
     */
  addCoordinate(coordinate, index = null) {
    if (!(coordinate instanceof Coordinate)) {
      throw new Error('Coordinate must be an instance of Coordinate class');
    }
        
    if (index === null) {
      // Add to end
      this.coordinates.push(coordinate);
    } else {
      // Insert at specific index
      this.coordinates.splice(index, 0, coordinate);
    }
        
    this._updateProperties();
    this.emit('geometry-changed', { 
      feature: this, 
      coordinates: this.coordinates,
      action: 'add',
      coordinate,
      index: index === null ? this.coordinates.length - 1 : index,
    });
  }
    
  /**
     * Remove a coordinate from the line
     * @param {number} index - Index of the coordinate to remove
     * @returns {Coordinate|null} - The removed coordinate or null if index was invalid
     */
  removeCoordinate(index) {
    if (index < 0 || index >= this.coordinates.length) {
      return null;
    }
        
    const removed = this.coordinates.splice(index, 1)[0];
    this._updateProperties();
        
    this.emit('geometry-changed', { 
      feature: this, 
      coordinates: this.coordinates,
      action: 'remove',
      coordinate: removed,
      index,
    });
        
    return removed;
  }
    
  /**
     * Update a coordinate at a specific index
     * @param {number} index - Index of the coordinate to update
     * @param {Coordinate} coordinate - The new coordinate
     * @returns {boolean} - Success status
     */
  updateCoordinate(index, coordinate) {
    if (index < 0 || index >= this.coordinates.length) {
      return false;
    }
        
    if (!(coordinate instanceof Coordinate)) {
      throw new Error('Coordinate must be an instance of Coordinate class');
    }
        
    const oldCoord = this.coordinates[index];
    this.coordinates[index] = coordinate;
    this._updateProperties();
        
    this.emit('geometry-changed', { 
      feature: this, 
      coordinates: this.coordinates,
      action: 'update',
      oldCoordinate: oldCoord,
      newCoordinate: coordinate,
      index,
    });
        
    return true;
  }
    
  /**
     * Get the number of vertices in the line
     * @returns {number} - Vertex count
     */
  getVertexCount() {
    return this.coordinates.length;
  }
    
  /**
     * Get a specific vertex by index
     * @param {number} index - Index of the vertex
     * @returns {Coordinate|null} - The coordinate or null if index is invalid
     */
  getVertex(index) {
    if (index < 0 || index >= this.coordinates.length) {
      return null;
    }
        
    return this.coordinates[index];
  }
    
  /**
     * Toggle the closed state of the line
     * @returns {boolean} - The new closed state
     */
  toggleClosed() {
    this.closed = !this.closed;
    this._updateProperties();
        
    this.emit('closed-changed', { 
      feature: this, 
      closed: this.closed, 
    });
        
    return this.closed;
  }
    
  /**
     * Set the closed state of the line
     * @param {boolean} closed - Whether the line should be closed
     */
  setClosed(closed) {
    if (this.closed !== closed) {
      this.closed = closed;
      this._updateProperties();
            
      this.emit('closed-changed', { 
        feature: this, 
        closed: this.closed, 
      });
    }
  }
    
  /**
     * Check if the line is closed
     * @returns {boolean} - True if the line is closed
     */
  isClosed() {
    return this.closed;
  }
    
  /**
     * Get the feature's bounds
     * @returns {Object} - The bounds object with northEast and southWest coordinates
     */
  getBounds() {
    if (this.coordinates.length === 0) {
      return null;
    }
        
    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;
        
    for (const coord of this.coordinates) {
      north = Math.max(north, coord.lat);
      south = Math.min(south, coord.lat);
      east = Math.max(east, coord.lng);
      west = Math.min(west, coord.lng);
    }
        
    return {
      north,
      south,
      east,
      west,
      northEast: new Coordinate(north, east),
      southWest: new Coordinate(south, west),
    };
  }
    
  /**
     * Get the feature's center coordinate
     * @returns {Coordinate} - The center coordinate
     */
  getCenter() {
    if (this.coordinates.length === 0) {
      return null;
    } else if (this.coordinates.length === 1) {
      return this.coordinates[0];
    }
        
    // Use the GeometryEngine to calculate the center
    return GeometryEngine.calculatePathCenter(this.coordinates);
  }
    
  /**
     * Get the elevation range of the feature
     * @returns {Object} - Object with min, max, and range elevations
     */
  getElevationRange() {
    if (this.coordinates.length === 0) {
      return { min: 0, max: 0, range: 0 };
    }
        
    const elevations = this.coordinates
      .map(coord => coord.elevation)
      .filter(elev => elev !== null && elev !== undefined);
        
    if (elevations.length === 0) {
      return { min: 0, max: 0, range: 0 };
    }
        
    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
        
    return {
      min,
      max,
      range: max - min,
    };
  }
    
  /**
     * Check if the feature contains a coordinate
     * @param {Coordinate} coordinate - The coordinate to check
     * @param {Object} [options] - Tolerance and other options
     * @param {number} [options.tolerance=0] - Distance tolerance in meters
     * @param {boolean} [options.includeElevation=false] - Whether to consider elevation
     * @returns {boolean} - True if the feature contains the coordinate
     */
  contains(coordinate, options = {}) {
    if (this.coordinates.length < 2) {
      return false;
    }
        
    if (!(coordinate instanceof Coordinate)) {
      throw new Error('Coordinate must be an instance of Coordinate class');
    }
        
    const tolerance = options.tolerance || 0;
        
    // Check if the coordinate is on the line within tolerance
    const nearest = this.nearest(coordinate);
        
    return nearest.distance <= tolerance;
  }
    
  /**
     * Find the nearest point on the feature to a given coordinate
     * @param {Coordinate} coordinate - The reference coordinate
     * @returns {Object} - Object with the nearest point, distance, and segment index
     */
  nearest(coordinate) {
    if (this.coordinates.length < 2) {
      if (this.coordinates.length === 1) {
        const distance = GeometryEngine.calculateDistance(
          this.coordinates[0], 
          coordinate, 
          { includeElevation: true },
        );
                
        return {
          coordinate: this.coordinates[0].clone(),
          distance,
          segmentIndex: 0,
          segmentFraction: 0,
        };
      }
            
      return {
        coordinate: null,
        distance: Infinity,
        segmentIndex: -1,
        segmentFraction: 0,
      };
    }
        
    if (!(coordinate instanceof Coordinate)) {
      throw new Error('Coordinate must be an instance of Coordinate class');
    }
        
    // Use the GeometryEngine to find the nearest point on the path
    return GeometryEngine.calculateNearestPointOnPath(this.coordinates, coordinate, { closed: this.closed });
  }
    
  /**
     * Export the feature to GeoJSON
     * @param {Object} [options] - Export options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation
     * @param {boolean} [options.includeProperties=true] - Whether to include properties
     * @returns {Object} - GeoJSON representation of the feature
     */
  toGeoJSON(options = {}) {
    const includeElevation = options.includeElevation !== false;
    const includeProperties = options.includeProperties !== false;
        
    // Determine if this should be a LineString or a Polygon
    const type = this.closed ? 'Polygon' : 'LineString';
        
    let coordinates;
        
    if (type === 'LineString') {
      // LineString - array of coordinates
      coordinates = this.coordinates.map(coord => {
        // Use lng/lat instead of longitude/latitude as that's how they're stored in Coordinate
        const point = [coord.lng, coord.lat];
        if (includeElevation && coord.elevation !== null && coord.elevation !== undefined) {
          point.push(coord.elevation);
        }
        return point;
      });
    } else {
      // Polygon - array of linear rings (arrays of coordinates)
      // Make a copy of coordinates that closes the ring if needed
      const ring = [...this.coordinates];
      if (ring.length > 0 && 
                (ring[0].lat !== ring[ring.length - 1].lat || 
                 ring[0].lng !== ring[ring.length - 1].lng)) {
        ring.push(ring[0]);
      }
            
      coordinates = [ring.map(coord => {
        // Use lng/lat instead of longitude/latitude as that's how they're stored in Coordinate
        const point = [coord.lng, coord.lat];
        if (includeElevation && coord.elevation !== null && coord.elevation !== undefined) {
          point.push(coord.elevation);
        }
        return point;
      })];
    }
        
    const geojson = {
      type: 'Feature',
      geometry: {
        type,
        coordinates,
      },
      id: this.id,
    };
        
    // Include properties if requested
    if (includeProperties) {
      geojson.properties = {
        name: this.name,
        ...this.properties,
      };
    }
        
    return geojson;
  }
    
  /**
     * Import feature from GeoJSON
     * @param {Object} geojson - GeoJSON object to import
     * @param {Object} [options] - Import options
     * @returns {boolean} - Success status
     */
  fromGeoJSON(geojson, _options = {}) {
    if (!geojson || geojson.type !== 'Feature' || !geojson.geometry) {
      return false;
    }
        
    const geometryType = geojson.geometry.type;
    let newCoordinates = [];
    let isClosed = false;
        
    if (geometryType === 'LineString') {
      if (!Array.isArray(geojson.geometry.coordinates)) {
        return false;
      }
            
      // Process LineString coordinates
      newCoordinates = geojson.geometry.coordinates.map(coords => {
        if (!Array.isArray(coords) || coords.length < 2) {
          throw new Error('Invalid GeoJSON LineString coordinates');
        }
                
        return new Coordinate(
          coords[1], 
          coords[0], 
          coords.length > 2 ? coords[2] : null,
        );
      });
            
      // Check if the line is closed
      const first = newCoordinates[0];
      const last = newCoordinates[newCoordinates.length - 1];
            
      if (first && last && 
                first.lat === last.lat && 
                first.lng === last.lng) {
        isClosed = true;
      }
            
    } else if (geometryType === 'Polygon') {
      if (!Array.isArray(geojson.geometry.coordinates) || 
                !Array.isArray(geojson.geometry.coordinates[0])) {
        return false;
      }
            
      // Process Polygon coordinates (use the exterior ring only)
      const ring = geojson.geometry.coordinates[0];
            
      newCoordinates = ring.map(coords => {
        if (!Array.isArray(coords) || coords.length < 2) {
          throw new Error('Invalid GeoJSON Polygon coordinates');
        }
                
        return new Coordinate(
          coords[1], 
          coords[0], 
          coords.length > 2 ? coords[2] : null,
        );
      });
            
      // Polygons should be closed, but we'll check anyway
      const first = newCoordinates[0];
      const last = newCoordinates[newCoordinates.length - 1];
            
      if (first && last && 
                first.latitude === last.latitude && 
                first.longitude === last.longitude) {
        // Remove the duplicate closing point
        newCoordinates.pop();
      }
            
      isClosed = true;
            
    } else {
      return false;
    }
        
    // Update the feature
    this.coordinates = newCoordinates;
    this.closed = isClosed;
        
    // Update properties
    if (geojson.properties) {
      if (geojson.properties.name) {
        this.name = geojson.properties.name;
        delete geojson.properties.name;
      }
            
      this.properties = { ...geojson.properties };
    }
        
    // Update ID if provided
    if (geojson.id) {
      this.id = geojson.id;
    }
        
    this._updateProperties();
    this.emit('geometry-changed', { feature: this, coordinates: this.coordinates });
        
    return true;
  }
    
  /**
     * Clone this feature
     * @returns {LineFeature} - A new line feature instance that is a copy of this one
     */
  clone() {
    const clonedCoordinates = this.coordinates.map(coord => coord.clone());
        
    const cloned = new LineFeature(
      clonedCoordinates,
      {
        id: `clone_${this.id}`,
        name: `${this.name} (copy)`,
        style: { ...this.style },
        properties: { ...this.properties },
        metadata: { ...this.metadata },
        visible: this.visible,
        editable: this.editable,
        interactive: this.interactive,
        closed: this.closed,
      },
    );
        
    return cloned;
  }
    
  /**
     * Calculate the length of the line
     * @param {Object} [options] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation
     * @returns {number} - Length in meters
     */
  calculateLength(options = {}) {
    if (this.coordinates.length < 2) {
      return 0;
    }
        
    return GeometryEngine.calculatePathLength(
      this.coordinates, 
      { 
        includeElevation: options.includeElevation !== false,
        closed: this.closed,
      },
    );
  }
    
  /**
     * Calculate the area of the closed line
     * @param {Object} [options] - Calculation options
     * @returns {number} - Area in square meters
     */
  calculateArea(options = {}) {
    if (!this.closed || this.coordinates.length < 3) {
      return 0;
    }
        
    return GeometryEngine.calculateArea(this.coordinates, options);
  }
    
  /**
     * Create an elevation profile for the line
     * @returns {Array<Object>} - Array of {distance, elevation} points
     */
  createElevationProfile() {
    if (this.coordinates.length < 2) {
      return [];
    }
        
    return GeometryEngine.createElevationProfile(this.coordinates);
  }
    
  /**
     * Calculate the elevation gain and loss
     * @returns {Object} - Object with gain and loss in meters
     */
  calculateElevationChange() {
    if (this.coordinates.length < 2) {
      return { gain: 0, loss: 0 };
    }
        
    return {
      gain: GeometryEngine.calculateElevationGain(this.coordinates),
      loss: GeometryEngine.calculateElevationLoss(this.coordinates),
    };
  }
    
  /**
     * Create offset line parallel to this line
     * @param {number} distance - Offset distance in meters (positive = right, negative = left)
     * @param {Object} [options] - Offset options
     * @returns {LineFeature} - New line feature with the offset coordinates
     */
  createOffsetLine(distance, options = {}) {
    if (this.coordinates.length < 2) {
      return this.clone();
    }
        
    const offsetCoords = GeometryEngine.createOffsetLine(
      this.coordinates, 
      distance, 
      { 
        closed: this.closed,
        ...options,
      },
    );
        
    return new LineFeature(
      offsetCoords,
      {
        name: `${this.name} (offset ${distance}m)`,
        style: { ...this.style },
        closed: this.closed,
      },
    );
  }
    
  /**
     * Simplify the line by removing redundant points
     * @param {number} tolerance - Tolerance distance in meters
     * @returns {LineFeature} - This feature for chaining
     */
  simplify(tolerance) {
    if (this.coordinates.length < 3 || tolerance <= 0) {
      return this;
    }
        
    const simplified = GeometryEngine.simplifyPath(this.coordinates, tolerance);
    this.setCoordinates(simplified);
        
    return this;
  }
    
  /**
     * Create points at regular intervals along the line
     * @param {number} interval - Distance between points in meters
     * @param {Object} [options] - Interpolation options
     * @returns {Array<Coordinate>} - Array of coordinates
     */
  createRegularPoints(interval, options = {}) {
    if (this.coordinates.length < 2 || interval <= 0) {
      return [];
    }
        
    return GeometryEngine.createRegularPointsAlongPath(
      this.coordinates, 
      interval, 
      { 
        closed: this.closed,
        ...options,
      },
    );
  }
    
  /**
     * Get a point at a specific percentage along the line
     * @param {number} percentage - Percentage along the line (0-100)
     * @returns {Coordinate} - The coordinate at that percentage
     */
  getPointAtPercentage(percentage) {
    if (this.coordinates.length < 2) {
      return null;
    }
        
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
        
    const distance = (percentage / 100) * this.calculateLength();
    return this.getPointAtDistance(distance);
  }
    
  /**
     * Get a point at a specific distance along the line
     * @param {number} distance - Distance along the line in meters
     * @returns {Coordinate} - The coordinate at that distance
     */
  getPointAtDistance(distance) {
    if (this.coordinates.length < 2) {
      return null;
    }
        
    return GeometryEngine.getPointAtDistance(this.coordinates, distance, { closed: this.closed });
  }
    
  /**
     * Split the line at a specific vertex
     * @param {number} index - Index of the vertex to split at
     * @returns {Array<LineFeature>} - Array of two line features
     */
  splitAtVertex(index) {
    if (index <= 0 || index >= this.coordinates.length - 1) {
      return [this.clone()];
    }
        
    const part1 = new LineFeature(
      this.coordinates.slice(0, index + 1),
      {
        name: `${this.name} (part 1)`,
        style: { ...this.style },
        closed: false,
      },
    );
        
    const part2 = new LineFeature(
      this.coordinates.slice(index),
      {
        name: `${this.name} (part 2)`,
        style: { ...this.style },
        closed: false,
      },
    );
        
    return [part1, part2];
  }
    
  /**
     * Reverse the order of coordinates
     * @returns {LineFeature} - This feature for chaining
     */
  reverse() {
    this.coordinates.reverse();
    this.emit('geometry-changed', { feature: this, coordinates: this.coordinates });
    return this;
  }
}

/**
 * Polygon feature class for survey areas
 * @module gnss/survey/features/PolygonFeature
 */

class PolygonFeature extends FeatureBase {
  /**
     * Initialize a polygon feature
     * @param {Array<Coordinate>} coordinates - The polygon's exterior ring coordinates
     * @param {Object} [options] - Configuration options
     * @param {string} [options.id] - Unique identifier
     * @param {string} [options.name] - Human-readable name
     * @param {Object} [options.style] - Style properties
     * @param {Object} [options.properties] - Custom properties
     * @param {Object} [options.metadata] - Metadata
     * @param {Array<Array<Coordinate>>} [options.holes=[]] - Arrays of coordinates for interior rings (holes)
     */
  constructor(coordinates = [], options = {}) {
    super(options);
        
    this.type = 'polygon';
        
    // Create with internal LineFeature objects for ring management
    this.exteriorRing = new LineFeature(coordinates, { closed: true });
        
    // Interior rings (holes)
    this.interiorRings = [];
        
    if (options.holes && Array.isArray(options.holes)) {
      for (const holeCoords of options.holes) {
        this.interiorRings.push(
          new LineFeature(holeCoords, { closed: true }),
        );
      }
    }
        
    // Update properties with metadata about the polygon
    this._updateProperties();
        
    // If no name was provided, generate a default name
    if (!options.name) {
      this.name = `Polygon (${this.exteriorRing.getVertexCount()} vertices)`;
    }
        
    // Set up event forwarding from rings
    this._setupEventForwarding();
  }
    
  /**
     * Set up event forwarding from the rings to this polygon
     * @private
     */
  _setupEventForwarding() {
    // Forward events from exterior ring
    this.exteriorRing.on('geometry-changed', event => {
      this._updateProperties();
      this.emit('geometry-changed', { 
        feature: this, 
        ring: 'exterior',
        ringIndex: -1,
        ...event,
      });
    });
        
    // Set up forwarding for interior rings too
    for (let i = 0; i < this.interiorRings.length; i++) {
      const ring = this.interiorRings[i];
            
      ring.on('geometry-changed', event => {
        this._updateProperties();
        this.emit('geometry-changed', { 
          feature: this, 
          ring: 'interior',
          ringIndex: i,
          ...event,
        });
      });
    }
  }
    
  /**
     * Update internal properties with metadata about the polygon
     * @private
     */
  _updateProperties() {
    // Make sure we have enough coordinates before calculating properties
    const exteriorCoords = this.exteriorRing.getCoordinates();
    if (exteriorCoords.length < 3) {
      // Set default values for incomplete polygons
      this.properties.area = 0;
      this.properties.perimeter = 0;
      return;
    }
        
    // Calculate area
    this.properties.area = this.calculateArea();
        
    // Calculate perimeter (exterior ring length)
    this.properties.perimeter = this.exteriorRing.calculateLength();
        
    // Get elevation statistics
    const elevations = exteriorCoords
      .map(coord => coord.elevation)
      .filter(elev => elev !== null && elev !== undefined);
        
    if (elevations.length > 0) {
      this.properties.minElevation = Math.min(...elevations);
      this.properties.maxElevation = Math.max(...elevations);
      this.properties.averageElevation = elevations.reduce((sum, elev) => sum + elev, 0) / elevations.length;
    }
        
    // Update approximate centroid
    try {
      const center = this.calculateCentroid();
      if (center) {
        this.properties.centroid = {
          lat: center.lat,
          lng: center.lng,
        };
      }
    } catch (error) {
      console.warn(`Could not calculate centroid: ${error.message}`);
    }
  }
    
  /**
     * Get the polygon's exterior ring coordinates
     * @returns {Array<Coordinate>} - Array of coordinates
     */
  getCoordinates() {
    return this.exteriorRing.getCoordinates();
  }
    
  /**
     * Set the polygon's exterior ring coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates
     */
  setCoordinates(coordinates) {
    this.exteriorRing.setCoordinates(coordinates);
    // _updateProperties is called via event forwarding
  }
    
  /**
     * Get all interior rings (holes)
     * @returns {Array<Array<Coordinate>>} - Array of coordinate arrays
     */
  getHoles() {
    return this.interiorRings.map(ring => ring.getCoordinates());
  }
    
  /**
     * Get all rings (exterior and interior)
     * @returns {Array<Array<Coordinate>>} - Array of coordinate arrays, where first array is exterior ring
     */
  getRings() {
    const rings = [this.exteriorRing.getCoordinates()];
    return rings.concat(this.getHoles());
  }
    
  /**
     * Set all rings (exterior and interior)
     * @param {Array<Array<Coordinate>>} rings - Array of coordinate arrays where first array is exterior ring
     */
  setRings(rings) {
    if (!rings || !Array.isArray(rings) || rings.length === 0) {
      throw new Error('Invalid rings: must provide a non-empty array of coordinate arrays');
    }
        
    // Set exterior ring (first ring)
    this.exteriorRing.setCoordinates(rings[0]);
        
    // Clear existing interior rings
    this.interiorRings = [];
        
    // Add interior rings (if any)
    for (let i = 1; i < rings.length; i++) {
      this.addHole(rings[i]);
    }
        
    // Update properties
    this._updateProperties();
  }
    
  /**
     * Get a specific interior ring
     * @param {number} index - Index of the ring
     * @returns {Array<Coordinate>|null} - Array of coordinates or null if index is invalid
     */
  getHole(index) {
    if (index < 0 || index >= this.interiorRings.length) {
      return null;
    }
        
    return this.interiorRings[index].getCoordinates();
  }
    
  /**
     * Add a new hole to the polygon
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the hole
     * @returns {number} - Index of the new hole
     */
  addHole(coordinates) {
    const hole = new LineFeature(coordinates, { closed: true });
        
    // Set up event forwarding
    const holeIndex = this.interiorRings.length;
        
    hole.on('geometry-changed', event => {
      this._updateProperties();
      this.emit('geometry-changed', { 
        feature: this, 
        ring: 'interior',
        ringIndex: holeIndex,
        ...event,
      });
    });
        
    this.interiorRings.push(hole);
    this._updateProperties();
        
    this.emit('hole-added', { 
      feature: this, 
      holeIndex, 
      coordinates: hole.getCoordinates(), 
    });
        
    return holeIndex;
  }
    
  /**
     * Remove a hole from the polygon
     * @param {number} index - Index of the hole to remove
     * @returns {boolean} - Success status
     */
  removeHole(index) {
    if (index < 0 || index >= this.interiorRings.length) {
      return false;
    }
        
    const removed = this.interiorRings.splice(index, 1)[0];
    this._updateProperties();
        
    this.emit('hole-removed', { 
      feature: this, 
      holeIndex: index, 
      coordinates: removed.getCoordinates(), 
    });
        
    return true;
  }
    
  /**
     * Update a hole's coordinates
     * @param {number} index - Index of the hole
     * @param {Array<Coordinate>} coordinates - New coordinates
     * @returns {boolean} - Success status
     */
  updateHole(index, coordinates) {
    if (index < 0 || index >= this.interiorRings.length) {
      return false;
    }
        
    this.interiorRings[index].setCoordinates(coordinates);
    // _updateProperties is called via event forwarding
        
    return true;
  }
    
  /**
     * Get the number of holes in the polygon
     * @returns {number} - Hole count
     */
  getHoleCount() {
    return this.interiorRings.length;
  }
    
  /**
     * Add a vertex to the exterior ring
     * @param {Coordinate} coordinate - The coordinate to add
     * @param {number} [index] - Optional index to insert at (default: end of ring)
     */
  addVertex(coordinate, index = null) {
    this.exteriorRing.addCoordinate(coordinate, index);
    // _updateProperties is called via event forwarding
  }
    
  /**
     * Remove a vertex from the exterior ring
     * @param {number} index - Index of the vertex to remove
     * @returns {Coordinate|null} - The removed coordinate or null if index was invalid
     */
  removeVertex(index) {
    return this.exteriorRing.removeCoordinate(index);
    // _updateProperties is called via event forwarding
  }
    
  /**
     * Update a vertex in the exterior ring
     * @param {number} index - Index of the vertex to update
     * @param {Coordinate} coordinate - The new coordinate
     * @returns {boolean} - Success status
     */
  updateVertex(index, coordinate) {
    return this.exteriorRing.updateCoordinate(index, coordinate);
    // _updateProperties is called via event forwarding
  }
    
  /**
     * Get the number of vertices in the exterior ring
     * @returns {number} - Vertex count
     */
  getVertexCount() {
    return this.exteriorRing.getVertexCount();
  }
    
  /**
     * Get a specific vertex from the exterior ring
     * @param {number} index - Index of the vertex
     * @returns {Coordinate|null} - The coordinate or null if index is invalid
     */
  getVertex(index) {
    return this.exteriorRing.getVertex(index);
  }
    
  /**
     * Get the feature's bounds
     * @returns {Object} - The bounds object with northEast and southWest coordinates
     */
  getBounds() {
    return this.exteriorRing.getBounds();
  }
    
  /**
     * Get the feature's center coordinate
     * @returns {Coordinate} - The center coordinate
     */
  getCenter() {
    return this.calculateCentroid();
  }
    
  /**
     * Calculate the centroid of the polygon
     * @returns {Coordinate} - The centroid coordinate
     */
  calculateCentroid() {
    return GeometryEngine.calculatePolygonCentroid(
      this.exteriorRing.getCoordinates(),
      this.getHoles(),
    );
  }
    
  /**
     * Get the elevation range of the feature
     * @returns {Object} - Object with min, max, and range elevations
     */
  getElevationRange() {
    // First get elevation range from exterior ring
    const exteriorRange = this.exteriorRing.getElevationRange();
        
    // If there are no interior rings, just return exterior range
    if (this.interiorRings.length === 0) {
      return exteriorRange;
    }
        
    // Otherwise, combine with interior rings
    let min = exteriorRange.min;
    let max = exteriorRange.max;
        
    for (const ring of this.interiorRings) {
      const ringRange = ring.getElevationRange();
            
      if (ringRange.min < min) min = ringRange.min;
      if (ringRange.max > max) max = ringRange.max;
    }
        
    return {
      min,
      max,
      range: max - min,
    };
  }
    
  /**
     * Check if the polygon contains a coordinate
     * @param {Coordinate} coordinate - The coordinate to check
     * @param {Object} [options] - Tolerance and other options
     * @returns {boolean} - True if the polygon contains the coordinate
     */
  contains(coordinate, _options = {}) {
    if (!(coordinate instanceof Coordinate)) {
      throw new Error('Coordinate must be an instance of Coordinate class');
    }
        
    const exteriorCoords = this.exteriorRing.getCoordinates();
    if (exteriorCoords.length < 3) {
      return false;
    }
        
    // First check if the point is in the exterior ring
    const inExterior = GeometryEngine.pointInPolygon(coordinate, exteriorCoords);
        
    // If not in exterior, definitely not in polygon
    if (!inExterior) {
      return false;
    }
        
    // If in exterior, check if it's in any holes
    for (const hole of this.interiorRings) {
      if (GeometryEngine.pointInPolygon(coordinate, hole.getCoordinates())) {
        // If in a hole, not in the polygon
        return false;
      }
    }
        
    // In exterior but not in any holes
    return true;
  }
    
  /**
     * Find the nearest point on the feature to a given coordinate
     * @param {Coordinate} coordinate - The reference coordinate
     * @returns {Object} - Object with the nearest point and distance
     */
  nearest(coordinate) {
    if (!(coordinate instanceof Coordinate)) {
      throw new Error('Coordinate must be an instance of Coordinate class');
    }
        
    // First check if the point is inside the polygon
    if (this.contains(coordinate)) {
      // If inside, distance is 0
      return {
        coordinate: coordinate.clone(),
        distance: 0,
        isInterior: true,
      };
    }
        
    // Otherwise, find nearest point on exterior ring
    const exteriorNearest = this.exteriorRing.nearest(coordinate);
        
    // Find nearest points on all holes too
    let minDistance = exteriorNearest.distance;
    let nearestPoint = exteriorNearest.coordinate;
        
    for (const hole of this.interiorRings) {
      const holeNearest = hole.nearest(coordinate);
            
      if (holeNearest.distance < minDistance) {
        minDistance = holeNearest.distance;
        nearestPoint = holeNearest.coordinate;
      }
    }
        
    return {
      coordinate: nearestPoint,
      distance: minDistance,
      isInterior: false,
    };
  }
    
  /**
     * Export the feature to GeoJSON
     * @param {Object} [options] - Export options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation
     * @param {boolean} [options.includeProperties=true] - Whether to include properties
     * @returns {Object} - GeoJSON representation of the feature
     */
  toGeoJSON(options = {}) {
    const includeElevation = options.includeElevation !== false;
    const includeProperties = options.includeProperties !== false;
        
    // Get exterior ring and ensure it's closed
    const exteriorCoords = this.exteriorRing.getCoordinates();
    const exteriorRing = [...exteriorCoords];
        
    // Ensure exterior ring is closed as required by GeoJSON
    if (exteriorRing.length > 0 && 
            (exteriorRing[0].lat !== exteriorRing[exteriorRing.length - 1].lat || 
             exteriorRing[0].lng !== exteriorRing[exteriorRing.length - 1].lng)) {
      exteriorRing.push(exteriorRing[0]);
    }
        
    // Convert exterior ring to GeoJSON format
    const exteriorRingGeoJSON = exteriorRing.map(coord => {
      // Use lng/lat instead of longitude/latitude as that's how they're stored in Coordinate
      const point = [coord.lng, coord.lat];
      if (includeElevation && coord.elevation !== null && coord.elevation !== undefined) {
        point.push(coord.elevation);
      }
      return point;
    });
        
    // Convert interior rings to GeoJSON format
    const interiorRingsGeoJSON = this.interiorRings.map(ring => {
      let holeCoords = ring.getCoordinates();
            
      // Ensure hole is closed as required by GeoJSON
      if (holeCoords.length > 0 && 
                (holeCoords[0].lat !== holeCoords[holeCoords.length - 1].lat || 
                 holeCoords[0].lng !== holeCoords[holeCoords.length - 1].lng)) {
        holeCoords = [...holeCoords, holeCoords[0]];
      }
            
      return holeCoords.map(coord => {
        // Use lng/lat instead of longitude/latitude as that's how they're stored in Coordinate
        const point = [coord.lng, coord.lat];
        if (includeElevation && coord.elevation !== null && coord.elevation !== undefined) {
          point.push(coord.elevation);
        }
        return point;
      });
    });
        
    // Create the GeoJSON object
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [exteriorRingGeoJSON, ...interiorRingsGeoJSON],
      },
      id: this.id,
    };
        
    // Include properties if requested
    if (includeProperties) {
      geojson.properties = {
        name: this.name,
        ...this.properties,
      };
    }
        
    return geojson;
  }
    
  /**
     * Import feature from GeoJSON
     * @param {Object} geojson - GeoJSON object to import
     * @param {Object} [options] - Import options
     * @returns {boolean} - Success status
     */
  fromGeoJSON(geojson, _options = {}) {
    if (!geojson || geojson.type !== 'Feature' || !geojson.geometry || 
            geojson.geometry.type !== 'Polygon' || !Array.isArray(geojson.geometry.coordinates)) {
      return false;
    }
        
    const rings = geojson.geometry.coordinates;
    if (rings.length === 0 || !Array.isArray(rings[0])) {
      return false;
    }
        
    // Process exterior ring (first ring)
    const exteriorRingCoords = rings[0].map(coords => {
      if (!Array.isArray(coords) || coords.length < 2) {
        throw new Error('Invalid GeoJSON Polygon coordinates');
      }
            
      return new Coordinate(
        coords[1], 
        coords[0], 
        coords.length > 2 ? coords[2] : null,
      );
    });
        
    // Ensure exterior ring is not closed for internal representation
    // (GeoJSON has explicit closing point, but we handle closing automatically)
    if (exteriorRingCoords.length > 0 && 
            exteriorRingCoords[0].equals(exteriorRingCoords[exteriorRingCoords.length - 1])) {
      exteriorRingCoords.pop();
    }
        
    // Set exterior ring
    this.exteriorRing.setCoordinates(exteriorRingCoords);
        
    // Remove all existing holes
    this.interiorRings = [];
        
    // Process interior rings (holes)
    for (let i = 1; i < rings.length; i++) {
      const ring = rings[i];
            
      const holeCoords = ring.map(coords => {
        if (!Array.isArray(coords) || coords.length < 2) {
          throw new Error('Invalid GeoJSON Polygon hole coordinates');
        }
                
        return new Coordinate(
          coords[1], 
          coords[0], 
          coords.length > 2 ? coords[2] : null,
        );
      });
            
      // Ensure hole is not closed for internal representation
      if (holeCoords.length > 0 && 
                holeCoords[0].equals(holeCoords[holeCoords.length - 1])) {
        holeCoords.pop();
      }
            
      // Add new hole
      this.addHole(holeCoords);
    }
        
    // Update properties
    if (geojson.properties) {
      if (geojson.properties.name) {
        this.name = geojson.properties.name;
        delete geojson.properties.name;
      }
            
      this.properties = { ...geojson.properties };
    }
        
    // Update ID if provided
    if (geojson.id) {
      this.id = geojson.id;
    }
        
    this._updateProperties();
    this.emit('geometry-changed', { feature: this });
        
    return true;
  }
    
  /**
     * Clone this feature
     * @returns {PolygonFeature} - A new polygon feature instance that is a copy of this one
     */
  clone() {
    const clonedExteriorCoords = this.exteriorRing.getCoordinates().map(coord => coord.clone());
        
    const clonedHoles = this.interiorRings.map(ring => 
      ring.getCoordinates().map(coord => coord.clone()),
    );
        
    const cloned = new PolygonFeature(
      clonedExteriorCoords,
      {
        id: `clone_${this.id}`,
        name: `${this.name} (copy)`,
        style: { ...this.style },
        properties: { ...this.properties },
        metadata: { ...this.metadata },
        visible: this.visible,
        editable: this.editable,
        interactive: this.interactive,
        holes: clonedHoles,
      },
    );
        
    return cloned;
  }
    
  /**
     * Calculate the area of the polygon
     * @param {Object} [options] - Calculation options
     * @param {boolean} [options.includeHoles=true] - Whether to subtract hole areas
     * @returns {number} - Area in square meters
     */
  calculateArea(options = {}) {
    const includeHoles = options.includeHoles !== false;
        
    const exteriorCoords = this.exteriorRing.getCoordinates();
    if (exteriorCoords.length < 3) {
      return 0;
    }
        
    // Calculate exterior area
    let area = GeometryEngine.calculateArea(exteriorCoords);
        
    // Subtract hole areas if requested
    if (includeHoles && this.interiorRings.length > 0) {
      for (const hole of this.interiorRings) {
        const holeCoords = hole.getCoordinates();
        if (holeCoords.length < 3) continue;
                
        const holeArea = GeometryEngine.calculateArea(holeCoords);
        area -= holeArea;
      }
    }
        
    return area;
  }
    
  /**
     * Calculate the perimeter of the polygon
     * @param {Object} [options] - Calculation options
     * @param {boolean} [options.includeHoles=true] - Whether to include hole perimeters
     * @returns {number} - Perimeter in meters
     */
  calculatePerimeter(options = {}) {
    const includeHoles = options.includeHoles !== false;
        
    // Calculate exterior perimeter
    let perimeter = this.exteriorRing.calculateLength();
        
    // Add hole perimeters if requested
    if (includeHoles && this.interiorRings.length > 0) {
      for (const hole of this.interiorRings) {
        perimeter += hole.calculateLength();
      }
    }
        
    return perimeter;
  }
    
  /**
     * Create a simplified version of the polygon
     * @param {number} tolerance - Tolerance distance in meters
     * @returns {PolygonFeature} - A new simplified polygon feature
     */
  simplify(tolerance) {
    if (tolerance <= 0) {
      return this.clone();
    }
        
    const simplifiedExterior = GeometryEngine.simplifyPath(
      this.exteriorRing.getCoordinates(), 
      tolerance,
    );
        
    const simplifiedHoles = this.interiorRings.map(ring => 
      GeometryEngine.simplifyPath(ring.getCoordinates(), tolerance),
    );
        
    return new PolygonFeature(
      simplifiedExterior,
      {
        name: `${this.name} (simplified)`,
        style: { ...this.style },
        holes: simplifiedHoles,
      },
    );
  }
    
  /**
     * Create a buffered polygon around this polygon
     * @param {number} distance - Buffer distance in meters
     * @param {Object} [options] - Buffer options
     * @returns {PolygonFeature} - A new polygon feature representing the buffer
     */
  buffer(distance, options = {}) {
    const exteriorCoords = this.exteriorRing.getCoordinates();
    if (exteriorCoords.length < 3) {
      return this.clone();
    }
        
    const bufferedExterior = GeometryEngine.bufferPolygon(
      exteriorCoords, 
      distance, 
      options,
    );
        
    // Buffering with negative distance could create multiple polygons
    // For simplicity, we just return the first one
    return new PolygonFeature(
      bufferedExterior,
      {
        name: `${this.name} (buffer ${distance}m)`,
        style: { ...this.style },
      },
    );
  }
    
  /**
     * Check if the polygon is valid (no self-intersections)
     * @returns {boolean} - True if the polygon is valid
     */
  isValid() {
    const exteriorCoords = this.exteriorRing.getCoordinates();
    if (exteriorCoords.length < 3) {
      return false;
    }
        
    // Check exterior ring for self-intersections
    if (GeometryEngine.hasSelfIntersections(exteriorCoords)) {
      return false;
    }
        
    // Check each hole for self-intersections
    for (const hole of this.interiorRings) {
      const holeCoords = hole.getCoordinates();
      if (holeCoords.length < 3) continue;
            
      if (GeometryEngine.hasSelfIntersections(holeCoords)) {
        return false;
      }
            
      // Check if hole is inside the exterior ring
      const holeCenter = GeometryEngine.calculatePathCenter(holeCoords);
      if (!GeometryEngine.pointInPolygon(holeCenter, exteriorCoords)) {
        return false;
      }
            
      // Check if hole intersects with exterior ring
      if (GeometryEngine.doPathsIntersect(exteriorCoords, holeCoords)) {
        return false;
      }
            
      // Check if hole intersects with other holes
      for (const otherHole of this.interiorRings) {
        if (hole === otherHole) continue;
                
        const otherHoleCoords = otherHole.getCoordinates();
        if (GeometryEngine.doPathsIntersect(holeCoords, otherHoleCoords)) {
          return false;
        }
      }
    }
        
    return true;
  }
    
  /**
     * Calculate the surface of the polygon considering elevation
     * @returns {number} - Surface area in square meters
     */
  calculate3DSurfaceArea() {
    // Implement using TIN (Triangulated Irregular Network)
    // This is a simplified implementation
    return GeometryEngine.calculate3DPolygonSurfaceArea(
      this.exteriorRing.getCoordinates(),
      this.getHoles(),
    );
  }
    
  /**
     * Calculate the volume of the polygon
     * @param {Object} [options] - Calculation options
     * @param {number} [options.baseElevation] - Base elevation in meters
     * @returns {number} - Volume in cubic meters
     */
  calculateVolume(options = {}) {
    let baseElevation;
        
    if (options.baseElevation !== undefined) {
      baseElevation = options.baseElevation;
    } else {
      // Use minimum elevation as base
      const elevRange = this.getElevationRange();
      baseElevation = elevRange.min;
    }
        
    return GeometryEngine.calculatePolygonVolume(
      this.exteriorRing.getCoordinates(),
      this.getHoles(),
      baseElevation,
    );
  }
}

/**
 * Feature collection for managing groups of features
 * @module gnss/survey/features/FeatureCollection
 */

/**
 * Class for managing collections of features
 */
class FeatureCollection extends EventEmitter {
  /**
     * Initialize a feature collection
     * @param {Array<FeatureBase>} [features=[]] - Initial features
     * @param {Object} [options] - Configuration options
     * @param {string} [options.id] - Unique identifier for the collection
     * @param {string} [options.name] - Human-readable name for the collection
     */
  constructor(features = [], options = {}) {
    super();
        
    this.id = options.id || `collection_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.name = options.name || `Collection ${this.id.substr(-4)}`;
    this.features = new Map();
        
    // Add initial features
    if (Array.isArray(features)) {
      features.forEach(feature => this.addFeature(feature));
    }
  }
    
  /**
     * Add a feature to the collection
     * @param {FeatureBase} feature - The feature to add
     * @returns {string} - The feature ID
     */
  addFeature(feature) {
    if (!(feature instanceof FeatureBase)) {
      throw new Error('Feature must be an instance of FeatureBase');
    }
        
    this.features.set(feature.id, feature);
        
    // Listen for feature events
    feature.on('geometry-changed', event => {
      this.emit('feature-geometry-changed', { ...event, collection: this });
    });
        
    feature.on('properties-changed', event => {
      this.emit('feature-properties-changed', { ...event, collection: this });
    });
        
    feature.on('style-changed', event => {
      this.emit('feature-style-changed', { ...event, collection: this });
    });
        
    feature.on('selected', event => {
      this.emit('feature-selected', { ...event, collection: this });
    });
        
    feature.on('deselected', event => {
      this.emit('feature-deselected', { ...event, collection: this });
    });
        
    feature.on('visibility-changed', event => {
      this.emit('feature-visibility-changed', { ...event, collection: this });
    });
        
    this.emit('feature-added', { feature, collection: this });
        
    return feature.id;
  }
    
  /**
     * Remove a feature from the collection
     * @param {string|FeatureBase} featureOrId - The feature or its ID to remove
     * @returns {boolean} - Success status
     */
  removeFeature(featureOrId) {
    const featureId = featureOrId instanceof FeatureBase ? featureOrId.id : featureOrId;
        
    if (!this.features.has(featureId)) {
      return false;
    }
        
    const feature = this.features.get(featureId);
    this.features.delete(featureId);
        
    // Remove all listeners
    feature.removeAllListeners();
        
    this.emit('feature-removed', { feature, collection: this });
        
    return true;
  }
    
  /**
     * Get a feature by ID
     * @param {string} id - The feature ID
     * @returns {FeatureBase|undefined} - The feature or undefined if not found
     */
  getFeature(id) {
    return this.features.get(id);
  }
    
  /**
     * Check if the collection contains a specific feature
     * @param {string|FeatureBase} featureOrId - The feature or its ID to check
     * @returns {boolean} - True if the feature is in the collection
     */
  hasFeature(featureOrId) {
    const featureId = featureOrId instanceof FeatureBase ? featureOrId.id : featureOrId;
    return this.features.has(featureId);
  }
    
  /**
     * Get all features in the collection
     * @returns {Array<FeatureBase>} - Array of features
     */
  getAllFeatures() {
    return Array.from(this.features.values());
  }
    
  /**
     * Get features of a specific type
     * @param {string} type - Feature type ('point', 'line', 'polygon', etc.)
     * @returns {Array<FeatureBase>} - Array of features of the specified type
     */
  getFeaturesByType(type) {
    return this.getAllFeatures().filter(feature => feature.type === type);
  }
    
  /**
     * Get features that match a predicate function
     * @param {Function} predicate - Function that returns true for features to include
     * @returns {Array<FeatureBase>} - Array of matching features
     */
  findFeatures(predicate) {
    return this.getAllFeatures().filter(predicate);
  }
    
  /**
     * Get the number of features in the collection
     * @returns {number} - Feature count
     */
  getFeatureCount() {
    return this.features.size;
  }
    
  /**
     * Get the count of features by type
     * @returns {Object} - Object with type counts
     */
  getFeatureCountsByType() {
    const counts = {};
        
    this.getAllFeatures().forEach(feature => {
      counts[feature.type] = (counts[feature.type] || 0) + 1;
    });
        
    return counts;
  }
    
  /**
     * Clear all features from the collection
     */
  clear() {
    const featuresToRemove = this.getAllFeatures();
        
    featuresToRemove.forEach(feature => {
      this.removeFeature(feature);
    });
        
    this.emit('collection-cleared', { collection: this });
  }
    
  /**
     * Select all features in the collection
     * @param {Object} [options] - Selection options
     */
  selectAll(options = {}) {
    this.getAllFeatures().forEach(feature => {
      if (!feature.selected) {
        feature.select(options);
      }
    });
  }
    
  /**
     * Deselect all features in the collection
     * @param {Object} [options] - Deselection options
     */
  deselectAll(options = {}) {
    this.getAllFeatures().forEach(feature => {
      if (feature.selected) {
        feature.deselect(options);
      }
    });
  }
    
  /**
     * Get selected features
     * @returns {Array<FeatureBase>} - Array of selected features
     */
  getSelectedFeatures() {
    return this.getAllFeatures().filter(feature => feature.selected);
  }
    
  /**
     * Set visibility for all features
     * @param {boolean} visible - Whether features should be visible
     */
  setAllVisible(visible) {
    this.getAllFeatures().forEach(feature => {
      if (feature.visible !== visible) {
        if (visible) {
          feature.show();
        } else {
          feature.hide();
        }
      }
    });
  }
    
  /**
     * Get visible features
     * @returns {Array<FeatureBase>} - Array of visible features
     */
  getVisibleFeatures() {
    return this.getAllFeatures().filter(feature => feature.visible);
  }
    
  /**
     * Export the collection to GeoJSON
     * @param {Object} [options] - Export options
     * @returns {Object} - GeoJSON FeatureCollection
     */
  toGeoJSON(options = {}) {
    console.log('Exporting FeatureCollection to GeoJSON, feature count:', this.features.size);
        
    const features = this.getAllFeatures()
      .filter(feature => options.includeHidden || feature.visible)
      .map(feature => {
        console.log(`Processing feature for export: ${feature.id}, type: ${feature.type}`);
        if (feature.type === 'line' || feature.type === 'polygon') {
          console.log(`  Coordinates count: ${feature.getCoordinates().length}`);
        }
        const geojson = feature.toGeoJSON(options);
                
        // Validate the created GeoJSON feature
        if (geojson.geometry) {
          if (geojson.geometry.type === 'LineString' && Array.isArray(geojson.geometry.coordinates)) {
            console.log(`  LineString exported with ${geojson.geometry.coordinates.length} coordinates`);
          } else if (geojson.geometry.type === 'Polygon' && Array.isArray(geojson.geometry.coordinates) && 
                              geojson.geometry.coordinates.length > 0) {
            console.log(`  Polygon exported with ${geojson.geometry.coordinates[0].length} coordinates in exterior ring`);
          }
        } else {
          console.warn(`  Warning: No geometry in exported feature ${feature.id}`);
        }
                
        return geojson;
      });
        
    return {
      type: 'FeatureCollection',
      features,
    };
  }
    
  /**
     * Import features from GeoJSON
     * @param {Object} geojson - GeoJSON object
     * @param {Object} [options] - Import options
     * @returns {number} - Number of features imported
     */
  fromGeoJSON(geojson, options = {}) {
    if (!geojson) {
      return 0;
    }
        
    let features = [];
        
    // Handle feature collection
    if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
      features = geojson.features;
    } 
    // Handle single feature
    else if (geojson.type === 'Feature') {
      features = [geojson];
    }
        
    // Import all valid features
    let importCount = 0;
        
    for (const featureJson of features) {
      if (!featureJson || !featureJson.geometry || !featureJson.geometry.type) {
        continue;
      }
            
      try {
        // Create the appropriate feature type
        let feature;
                
        switch (featureJson.geometry.type) {
        case 'Point':
          feature = new PointFeature(featureJson.geometry.coordinates, { id: featureJson.id });
          break;
        case 'LineString':
          // Pass the coordinates from GeoJSON directly to LineFeature constructor 
          feature = new LineFeature(
            featureJson.geometry.coordinates.map(coords => 
              new Coordinate(coords[1], coords[0], coords.length > 2 ? coords[2] : null),
            ),
            { id: featureJson.id },
          );
          break;
        case 'Polygon':
          // For polygons, use the first ring (exterior) as constructor coordinates
          if (featureJson.geometry.coordinates && featureJson.geometry.coordinates.length > 0) {
            const exteriorRing = featureJson.geometry.coordinates[0].map(coords =>
              new Coordinate(coords[1], coords[0], coords.length > 2 ? coords[2] : null),
            );
                            
            // Create holes array for additional rings if they exist
            const holes = [];
            for (let i = 1; i < featureJson.geometry.coordinates.length; i++) {
              holes.push(
                featureJson.geometry.coordinates[i].map(coords =>
                  new Coordinate(coords[1], coords[0], coords.length > 2 ? coords[2] : null),
                ),
              );
            }
                            
            feature = new PolygonFeature(exteriorRing, { 
              id: featureJson.id,
              holes: holes,
            });
          } else {
            feature = new PolygonFeature([], { id: featureJson.id });
          }
          break;
        default:
          console.warn(`Unsupported GeoJSON geometry type: ${featureJson.geometry.type}`);
          continue;
        }
                
        // Directly add the feature if we constructed it with coordinates already
        if (featureJson.geometry.type === 'LineString' || featureJson.geometry.type === 'Polygon') {
          // Need to handle properties
          if (featureJson.properties) {
            if (featureJson.properties.name) {
              feature.name = featureJson.properties.name;
            }
            // Copy all properties
            feature.properties = { ...featureJson.properties };
          }
                    
          this.addFeature(feature);
          importCount++;
        }
        // Let the feature handle import itself for other types
        else if (feature.fromGeoJSON(featureJson, options)) {
          this.addFeature(feature);
          importCount++;
        }
      } catch (err) {
        console.error('Error importing GeoJSON feature:', err);
      }
    }
        
    if (importCount > 0) {
      this.emit('features-imported', { 
        count: importCount, 
        collection: this, 
      });
    }
        
    return importCount;
  }
    
  /**
     * Get the combined bounds of all features
     * @returns {Object|null} - Bounds object or null if collection is empty
     */
  getBounds() {
    const features = this.getAllFeatures();
        
    if (features.length === 0) {
      return null;
    }
        
    // Start with the bounds of the first feature
    const firstBounds = features[0].getBounds();
    if (!firstBounds) {
      return null;
    }
        
    let north = firstBounds.north;
    let south = firstBounds.south;
    let east = firstBounds.east;
    let west = firstBounds.west;
        
    // Expand to include all other features
    for (let i = 1; i < features.length; i++) {
      const bounds = features[i].getBounds();
      if (!bounds) continue;
            
      if (bounds.north > north) north = bounds.north;
      if (bounds.south < south) south = bounds.south;
      if (bounds.east > east) east = bounds.east;
      if (bounds.west < west) west = bounds.west;
    }
        
    // Coordinate is already imported at the top of the file
        
    return {
      north,
      south,
      east,
      west,
      northEast: new Coordinate(north, east),
      southWest: new Coordinate(south, west),
    };
  }
    
  /**
     * Apply a style to all features
     * @param {Object} style - Style properties
     * @param {Object} [options] - Style application options
     */
  applyStyleToAll(style, options = {}) {
    this.getAllFeatures().forEach(feature => {
      feature.setStyle(style, options);
    });
  }
    
  /**
     * Find features at a coordinate
     * @param {Coordinate} coordinate - The coordinate to search at
     * @param {Object} [options] - Search options
     * @param {number} [options.tolerance=0] - Distance tolerance in meters
     * @returns {Array<FeatureBase>} - Features at the coordinate
     */
  findFeaturesAt(coordinate, options = {}) {
    return this.getAllFeatures().filter(feature => 
      feature.visible && feature.contains(coordinate, options),
    );
  }
    
  /**
     * Get features at a position, considering screen coordinates if needed
     * @param {Coordinate} coordinate - The coordinate to search at
     * @param {Object} [options] - Search options
     * @param {number} [options.tolerance=10] - Pixel tolerance for selection
     * @param {Array<number>} [options.screenPosition] - Screen position [x,y] if available
     * @param {Object} [options.mapInterface] - Map interface for coordinate conversion if needed
     * @returns {Array<FeatureBase>} - Features at the position
     */
  getFeaturesAtPosition(coordinate, options = {}) {
    const tolerance = options.tolerance || 10; // Default to 10px tolerance
    const screenPosition = options.screenPosition;
    const mapInterface = options.mapInterface;
        
    // If we have screen coordinates and a map interface, use that for more precise selection
    if (screenPosition && mapInterface) {
      return this.getAllFeatures().filter(feature => {
        // Skip hidden features
        if (!feature.visible) return false;
                
        // For points, check distance in screen coordinates
        if (feature.type === 'point') {
          const featureCoord = feature.getCoordinate();
          if (!featureCoord) return false;
                    
          try {
            const featureScreenPos = mapInterface.coordinateToPixel(featureCoord);
            if (!featureScreenPos) return false;
                        
            const distance = Math.sqrt(
              Math.pow(featureScreenPos[0] - screenPosition[0], 2) +
                            Math.pow(featureScreenPos[1] - screenPosition[1], 2),
            );
                        
            return distance <= tolerance;
          } catch (e) {
            console.warn('Error calculating screen distance:', e);
            return false;
          }
        }
                
        // For lines and polygons, check if coordinate is contained with tolerance
        return feature.contains(coordinate, { tolerance });
      });
    }
        
    // Fall back to regular coordinate-based selection
    return this.findFeaturesAt(coordinate, { tolerance });
  }
    
  /**
     * Find the nearest feature to a coordinate
     * @param {Coordinate} coordinate - The reference coordinate
     * @param {Object} [options] - Search options
     * @param {number} [options.maxDistance] - Maximum distance to consider
     * @param {string} [options.featureType] - Filter by feature type
     * @returns {Object|null} - Object with feature and distance, or null if none found
     */
  findNearestFeature(coordinate, options = {}) {
    let features = this.getAllFeatures().filter(feature => feature.visible);
        
    if (options.featureType) {
      features = features.filter(feature => feature.type === options.featureType);
    }
        
    if (features.length === 0) {
      return null;
    }
        
    let nearestFeature = null;
    let minDistance = Infinity;
        
    features.forEach(feature => {
      const nearest = feature.nearest(coordinate);
            
      if (nearest && nearest.distance < minDistance) {
        if (!options.maxDistance || nearest.distance <= options.maxDistance) {
          nearestFeature = feature;
          minDistance = nearest.distance;
        }
      }
    });
        
    if (nearestFeature) {
      return {
        feature: nearestFeature,
        distance: minDistance,
      };
    }
        
    return null;
  }
    
  /**
     * Update an existing feature in the collection
     * @param {FeatureBase} feature - The feature to update
     * @returns {boolean} - Success status
     */
  updateFeature(feature) {
    if (!(feature instanceof FeatureBase)) {
      throw new Error('Feature must be an instance of FeatureBase');
    }
        
    // Make sure the feature exists in the collection
    if (!this.features.has(feature.id)) {
      return false;
    }
        
    // Update the feature reference
    this.features.set(feature.id, feature);
        
    // Emit update event
    this.emit('feature-updated', { feature, collection: this });
        
    return true;
  }
}

/**
 * ToolBase.js
 * Base class for all survey tools
 * Part of the RTK Surveyor 3D-first implementation
 */


/**
 * @typedef {Object} ToolBaseOptions
 * @property {Object} manager - The survey manager instance
 * @property {Object} mapInterface - The map interface instance
 */

/**
 * Base class for all survey tools
 * Defines common functionality and interface requirements
 */
class ToolBase extends EventEmitter {
  /**
   * Create a new tool instance
   * @param {ToolBaseOptions} options - Tool configuration options
   */
  constructor(options = {}) {
    super();
    
    if (!options.manager) {
      throw new Error('Manager instance is required for tool initialization');
    }
    
    if (!options.mapInterface) {
      throw new Error('Map interface is required for tool initialization');
    }
    
    // Store references
    this.manager = options.manager;
    this.mapInterface = options.mapInterface;
    this.geometryEngine = options.geometryEngine || this.manager.geometryEngine;
    
    // Initialize state variables
    this.isActive = false;
    this.options = options;
    this.workingData = {};
    
    // Setup event listeners
    this._setupEventListeners();
  }
  
  /**
   * Set up tool-specific event listeners
   * Override in derived classes
   * @protected
   */
  _setupEventListeners() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
  
  /**
   * Activate the tool
   * @param {Object} [options] - Tool-specific activation options
   */
  activate(options = {}) {
    if (this.isActive) {
      return; // Already active
    }
    
    // Store activation options
    this.activationOptions = Object.assign({}, options);
    
    // CRITICAL FIX: Update this.options with the new values
    // This ensures derived tools use the updated options in their _activate method
    this.options = Object.assign({}, this.options, options);
    
    console.log('ToolBase.activate: Updating options', options);
    console.log('ToolBase.activate: Combined options are now', this.options);
    
    // Mark as active
    this.isActive = true;
    
    // Tool-specific activation logic
    this._activate();
    
    // Emit activation event
    this.emit('activated', this.activationOptions);
  }
  
  /**
   * Tool-specific activation logic
   * Override in derived classes
   * @protected
   */
  _activate() {
    throw new Error('_activate() must be implemented by derived classes');
  }
  
  /**
   * Deactivate the tool
   */
  deactivate() {
    if (!this.isActive) {
      return; // Already inactive
    }
    
    // Mark as inactive
    this.isActive = false;
    
    // Tool-specific deactivation logic
    this._deactivate();
    
    // We don't completely reset working data here anymore
    // as it can cause issues with derived classes that rely on its structure
    // Instead, derived classes should handle clearing their state in _deactivate()
    
    // Emit deactivation event
    this.emit('deactivated');
  }
  
  /**
   * Tool-specific deactivation logic
   * Override in derived classes
   * @protected
   */
  _deactivate() {
    throw new Error('_deactivate() must be implemented by derived classes');
  }
  
  /**
   * Handle tool reset
   * Clears current operation but keeps the tool active
   */
  reset() {
    // Tool-specific reset logic
    this._reset();
    
    // We don't completely reset working data here anymore
    // as it can cause issues with derived classes that rely on its structure
    // Instead, derived classes should handle clearing their state in _reset()
    
    // Emit reset event
    this.emit('reset');
  }
  
  /**
   * Tool-specific reset logic
   * Override in derived classes
   * @protected
   */
  _reset() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
  
  /**
   * Update tool options
   * @param {Object} options - The new options to apply
   */
  updateOptions(options = {}) {
    this.options = Object.assign(this.options, options);
    
    // Tool-specific option update handling
    this._optionsUpdated();
    
    // Emit options updated event
    this.emit('optionsUpdated', this.options);
  }
  
  /**
   * Tool-specific options update handling
   * Override in derived classes if needed
   * @protected
   */
  _optionsUpdated() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
  
  /**
   * Clean up resources used by the tool
   */
  destroy() {
    // Deactivate first if needed
    if (this.isActive) {
      this.deactivate();
    }
    
    // Tool-specific destroy logic
    this._destroy();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    // Clear references
    this.manager = null;
    this.mapInterface = null;
    this.geometryEngine = null;
  }
  
  /**
   * Tool-specific destroy logic
   * Override in derived classes if needed
   * @protected
   */
  _destroy() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
}

/**
 * MeasurementTool.js
 * Tool for measuring distances, areas, and volumes
 * Part of the RTK Surveyor 3D-first implementation
 */


/**
 * @typedef {Object} MeasurementToolOptions
 * @property {string} [mode='distance'] - Measurement mode (distance, area, or volume)
 * @property {string} [units='meters'] - Units for distance (meters, feet, kilometers, miles)
 * @property {string} [areaUnits='square-meters'] - Units for area (square-meters, square-feet, hectares, acres)
 * @property {string} [volumeUnits='cubic-meters'] - Units for volume (cubic-meters, cubic-feet)
 * @property {boolean} [enable3D=true] - Whether to use 3D measurements
 * @property {boolean} [continuousMeasure=false] - Whether to continuously measure while moving
 * @property {boolean} [showSegmentLengths=true] - Whether to show individual segment lengths
 * @property {boolean} [showTotalLength=true] - Whether to show accumulated total length
 * @property {Object} [lineSymbol] - Symbol for measurement lines
 * @property {Object} [pointSymbol] - Symbol for measurement points
 * @property {Object} [labelStyle] - Style for measurement labels
 */

/**
 * Tool for distance, area, and volume measurements
 * Supports both 2D and 3D measurements with multiple unit options
 */
class MeasurementTool extends ToolBase {
  /**
   * Create a new MeasurementTool instance
   * @param {Object} options - Tool configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize tool-specific options with defaults
    this.options = Object.assign({
      mode: 'distance',
      units: 'meters',
      areaUnits: 'square-meters',
      volumeUnits: 'cubic-meters',
      enable3D: true,
      continuousMeasure: false,
      showSegmentLengths: true,
      showTotalLength: true,
      lineSymbol: this.manager.settings.defaultLineSymbol,
      pointSymbol: this.manager.settings.defaultPointSymbol,
      labelStyle: {
        font: '12px Arial',
        fillColor: 'black',
        strokeColor: 'white',
        strokeWidth: 3,
      },
    }, options);
    
    // Initialize internal state
    this.workingData = {
      activeMeasurement: null,
      measurements: [],
      points: [],
      mousePosition: null,
      hoverCoordinate: null,
      measurementLabels: [],
      segmentLabels: [],
    };
    
    // Use direct imported GeometryEngine instead of relying on manager
    // This ensures we always have the required methods available
    this.geometryEngine = GeometryEngine;
    
    // Bind event handlers to maintain 'this' context
    this._handleMapClick = this._handleMapClick.bind(this);
    this._handleMapMouseMove = this._handleMapMouseMove.bind(this);
    this._handleMapDoubleClick = this._handleMapDoubleClick.bind(this);
    this._handleMapRightClick = this._handleMapRightClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }
  
  /**
   * Set up tool-specific event listeners
   * @protected
   * @override
   */
  _setupEventListeners() {
    // Implement specific event listeners if needed
  }
  
  /**
   * Tool-specific activation logic
   * @protected
   * @override
   */
  _activate() {
    // Activate the appropriate measurement mode
    this._activateMeasurementMode(this.options.mode);
    
    // Add map event listeners
    this.mapInterface.addEventListener('click', this._handleMapClick);
    this.mapInterface.addEventListener('mousemove', this._handleMapMouseMove);
    this.mapInterface.addEventListener('dblclick', this._handleMapDoubleClick);
    this.mapInterface.addEventListener('contextmenu', this._handleMapRightClick);
    
    // Add keyboard event listeners
    document.addEventListener('keydown', this._handleKeyDown);
    
    // Create a new working feature based on mode
    this._createNewMeasurement();
  }
  
  /**
   * Tool-specific deactivation logic
   * @protected
   * @override
   */
  _deactivate() {
    // Remove map event listeners
    this.mapInterface.removeEventListener('click', this._handleMapClick);
    this.mapInterface.removeEventListener('mousemove', this._handleMapMouseMove);
    this.mapInterface.removeEventListener('dblclick', this._handleMapDoubleClick);
    this.mapInterface.removeEventListener('contextmenu', this._handleMapRightClick);
    
    // Remove keyboard event listeners
    document.removeEventListener('keydown', this._handleKeyDown);
    
    // Clear any temporary features
    this._clearTemporaryMeasurements();
  }
  
  /**
   * Tool-specific reset logic
   * @protected
   * @override
   */
  _reset() {
    // Clear any active measurement
    this._clearActiveMeasurement();
    
    // Create a new measurement
    this._createNewMeasurement();
  }
  
  /**
   * Activate a specific measurement mode
   * @param {string} mode - The measurement mode (distance, area, volume)
   * @private
   */
  _activateMeasurementMode(mode) {
    // Validate the mode
    if (!['distance', 'area', 'volume'].includes(mode)) {
      console.error(`Invalid measurement mode: ${mode}`);
      mode = 'distance';
    }
    
    // Update the current mode
    this.options.mode = mode;
    
    // If already active, reset the measurement for the new mode
    if (this.isActive) {
      this._reset();
    }
    
    // Emit mode change event
    this.emit('mode-changed', { mode });
  }
  
  /**
   * Create a new measurement feature based on current mode
   * @private
   */
  _createNewMeasurement() {
    // Clear any existing active measurement
    this._clearActiveMeasurement();
    
    // Create appropriate feature type based on mode
    switch (this.options.mode) {
    case 'distance':
      this.workingData.activeMeasurement = new LineFeature([], {
        id: `measurement-${Date.now()}`,
        properties: {
          type: 'measurement',
          measurementType: 'distance',
          temporary: true,
        },
        style: this.options.lineSymbol,
      });
      break;
        
    case 'area':
    case 'volume':
      // Create a polygon with empty rings
      this.workingData.activeMeasurement = new PolygonFeature([[]], {
        id: `measurement-${Date.now()}`,
        properties: {
          type: 'measurement',
          measurementType: this.options.mode,
          temporary: true,
        },
        style: Object.assign({}, this.manager.settings.defaultPolygonSymbol, {
          outlineColor: this.options.lineSymbol.color,
          outlineWidth: this.options.lineSymbol.width,
        }),
      });
      break;
    }
    
    // Add the feature to the manager's working features
    this.manager.workingFeatures.addFeature(this.workingData.activeMeasurement);
    
    // Reset points array
    this.workingData.points = [];
    this.workingData.measurementLabels = [];
    this.workingData.segmentLabels = [];
  }
  
  /**
   * Clear the active measurement
   * @private
   */
  _clearActiveMeasurement() {
    if (this.workingData.activeMeasurement) {
      // Remove from manager's working features
      this.manager.workingFeatures.removeFeature(this.workingData.activeMeasurement);
      this.workingData.activeMeasurement = null;
    }
    
    // Clear points and labels
    this.workingData.points.forEach(point => {
      this.manager.workingFeatures.removeFeature(point);
    });
    
    this.workingData.points = [];
    
    // Clear labels
    this._clearMeasurementLabels();
  }
  
  /**
   * Clear all temporary measurements
   * @private
   */
  _clearTemporaryMeasurements() {
    // Clear active measurement
    this._clearActiveMeasurement();
    
    // Clear saved measurements from working features
    this.workingData.measurements.forEach(measurement => {
      this.manager.workingFeatures.removeFeature(measurement);
    });
    
    this.workingData.measurements = [];
  }
  
  /**
   * Clear measurement labels
   * @private
   */
  _clearMeasurementLabels() {
    // Remove labels from map
    this.workingData.measurementLabels.forEach(label => {
      this.mapInterface.removeLabel(label);
    });
    
    this.workingData.segmentLabels.forEach(label => {
      this.mapInterface.removeLabel(label);
    });
    
    this.workingData.measurementLabels = [];
    this.workingData.segmentLabels = [];
  }
  
  /**
   * Handle map click events
   * @param {Object} event - The map click event
   * @private
   */
  _handleMapClick(event) {
    // Get clicked coordinate
    const coordinate = event.coordinate;
    
    // Skip if no coordinate or no active measurement
    if (!coordinate || !this.workingData.activeMeasurement) {
      return;
    }
    
    // Add point to the measurement
    this._addPointToMeasurement(coordinate);
    
    // Update the measurement display
    this._updateMeasurementDisplay();
  }
  
  /**
   * Handle map mouse move events
   * @param {Object} event - The map mousemove event
   * @private
   */
  _handleMapMouseMove(event) {
    // Store current mouse position
    this.workingData.mousePosition = event.coordinate;
    this.workingData.hoverCoordinate = event.coordinate;
    
    // Update the measurement preview if we have at least one point
    if (this.workingData.activeMeasurement && this.workingData.points.length > 0) {
      this._updateMeasurementPreview();
    }
    
    // Handle continuous measurement mode
    if (this.options.continuousMeasure && 
        this.workingData.activeMeasurement && 
        this.workingData.points.length > 0) {
      // Only add points that are a certain distance apart
      const lastPoint = this.workingData.points[this.workingData.points.length - 1];
      const lastCoord = lastPoint.getCoordinate();
      const distance = this.geometryEngine.calculateDistance(lastCoord, event.coordinate, 
        { includeElevation: this.options.enable3D },
      );
      
      // Add point if it's more than 5 meters away from the last point
      if (distance > 5) {
        this._addPointToMeasurement(event.coordinate);
        this._updateMeasurementDisplay();
      }
    }
  }
  
  /**
   * Handle map double click events
   * @param {Object} event - The map double click event
   * @private
   */
  _handleMapDoubleClick(event) {
    // Prevent default browser behavior
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
    }
    
    // Complete the current measurement
    this._completeMeasurement();
  }
  
  /**
   * Handle map right click events
   * @param {Object} event - The map right click event
   * @private
   */
  _handleMapRightClick(event) {
    // Prevent default context menu
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
    }
    
    // If we have points, complete the measurement
    if (this.workingData.points.length > 0) {
      this._completeMeasurement();
    } else {
      // Otherwise, cancel the measurement
      this._reset();
    }
  }
  
  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  _handleKeyDown(event) {
    // Handle Escape key
    if (event.key === 'Escape') {
      if (this.workingData.points.length > 0) {
        // Remove the last point
        this._removeLastPoint();
      } else {
        // No points, reset the measurement
        this._reset();
      }
    }
    
    // Handle Enter key
    if (event.key === 'Enter') {
      // Complete the measurement
      this._completeMeasurement();
    }
  }
  
  /**
   * Add a point to the current measurement
   * @param {Object} coordinate - The coordinate to add
   * @private
   */
  _addPointToMeasurement(coordinate) {
    // Create a point feature for the vertex
    const pointFeature = new PointFeature(coordinate, {
      id: `measurement-point-${Date.now()}-${this.workingData.points.length}`,
      properties: {
        type: 'measurement-point',
        measurementId: this.workingData.activeMeasurement.id,
        index: this.workingData.points.length,
        temporary: true,
      },
      style: this.options.pointSymbol,
    });
    
    // Apply 3D elevation if enabled
    if (this.options.enable3D) {
      this.manager.applyElevationData(pointFeature);
    }
    
    // Add to working features and points array
    this.manager.workingFeatures.addFeature(pointFeature);
    this.workingData.points.push(pointFeature);
    
    // Update the measurement feature geometry
    this._updateMeasurementGeometry();
  }
  
  /**
   * Remove the last point from the measurement
   * @private
   */
  _removeLastPoint() {
    if (this.workingData.points.length === 0) {
      return;
    }
    
    // Remove the last point
    const lastPoint = this.workingData.points.pop();
    this.manager.workingFeatures.removeFeature(lastPoint);
    
    // Update the measurement feature geometry
    this._updateMeasurementGeometry();
    
    // Update the display
    this._updateMeasurementDisplay();
  }
  
  /**
   * Update the measurement feature geometry based on collected points
   * @private
   */
  _updateMeasurementGeometry() {
    if (!this.workingData.activeMeasurement) {
      return;
    }
    
    // Extract coordinates from point features
    const coordinates = this.workingData.points.map(point => point.getCoordinate());
    
    // Update the geometry based on measurement type
    switch (this.options.mode) {
    case 'distance':
      this.workingData.activeMeasurement.setCoordinates(coordinates);
      break;
        
    case 'area':
    case 'volume':
      // For area and volume, we need a polygon
      if (coordinates.length >= 3) {
        // Close the polygon if needed
        const polygonCoordinates = [...coordinates];
          
        // Don't explicitly close it - the polygon feature will handle this
        this.workingData.activeMeasurement.setRings([polygonCoordinates]);
      } else {
        // Not enough points for a polygon yet, use empty geometry
        this.workingData.activeMeasurement.setRings([coordinates]);
      }
      break;
    }
  }
  
  /**
   * Update the measurement preview with the current mouse position
   * @private
   */
  _updateMeasurementPreview() {
    if (!this.workingData.activeMeasurement || !this.workingData.mousePosition) {
      return;
    }
    
    // Create a preview with existing points plus mouse position
    const coordinates = this.workingData.points.map(point => point.getCoordinate());
    const previewCoordinates = [...coordinates, this.workingData.mousePosition];
    
    // Update preview based on measurement type
    switch (this.options.mode) {
    case 'distance':
      this.workingData.activeMeasurement.setCoordinates(previewCoordinates);
      break;
        
    case 'area':
    case 'volume':
      if (previewCoordinates.length >= 3) {
        this.workingData.activeMeasurement.setRings([previewCoordinates]);
      } else {
        this.workingData.activeMeasurement.setRings([previewCoordinates]);
      }
      break;
    }
    
    // Update display including preview
    this._updateMeasurementDisplay(true);
  }
  
  /**
   * Update measurement display with labels and values
   * @param {boolean} [preview=false] - Whether this is a preview update
   * @private
   */
  _updateMeasurementDisplay(preview = false) {
    // Clear existing labels
    this._clearMeasurementLabels();
    
    if (!this.workingData.activeMeasurement) {
      return;
    }
    
    // Calculate measurement values based on mode
    let measurementValue = 0;
    let measurementUnit = '';
    let segmentValues = [];
    
    switch (this.options.mode) {
    case 'distance':
      // Get coordinates including potential preview point
      const lineCoordinates = this.workingData.points.map(point => point.getCoordinate());
      if (preview && this.workingData.mousePosition) {
        lineCoordinates.push(this.workingData.mousePosition);
      }
        
      // Calculate total distance
      if (lineCoordinates.length >= 2) {
        measurementValue = this._calculateDistance(lineCoordinates);
        measurementUnit = this.options.units;
          
        // Calculate individual segment distances
        if (this.options.showSegmentLengths) {
          segmentValues = this._calculateSegmentDistances(lineCoordinates);
        }
      }
      break;
        
    case 'area':
      // Get coordinates including potential preview point
      const areaCoordinates = this.workingData.points.map(point => point.getCoordinate());
      if (preview && this.workingData.mousePosition) {
        areaCoordinates.push(this.workingData.mousePosition);
      }
        
      // Calculate area
      if (areaCoordinates.length >= 3) {
        measurementValue = this._calculateArea(areaCoordinates);
        measurementUnit = this.options.areaUnits;
          
        // Also calculate perimeter if showing segment lengths
        if (this.options.showSegmentLengths) {
          // Add a copy of the first point to close the polygon
          const perimeterCoords = [...areaCoordinates, areaCoordinates[0]];
          segmentValues = this._calculateSegmentDistances(perimeterCoords);
        }
      }
      break;
        
    case 'volume':
      // Get coordinates including potential preview point
      const volumeCoordinates = this.workingData.points.map(point => point.getCoordinate());
      if (preview && this.workingData.mousePosition) {
        volumeCoordinates.push(this.workingData.mousePosition);
      }
        
      // Calculate volume (requires at least 3 points and 3D data)
      if (volumeCoordinates.length >= 3 && this.options.enable3D) {
        measurementValue = this._calculateVolume(volumeCoordinates);
        measurementUnit = this.options.volumeUnits;
          
        // Also calculate perimeter if showing segment lengths
        if (this.options.showSegmentLengths) {
          // Add a copy of the first point to close the polygon
          const perimeterCoords = [...volumeCoordinates, volumeCoordinates[0]];
          segmentValues = this._calculateSegmentDistances(perimeterCoords);
        }
      }
      break;
    }
    
    // Create and display measurement labels
    if (measurementValue > 0) {
      // Format the value
      const formattedValue = this._formatMeasurementValue(measurementValue, measurementUnit);
      
      // Emit measurement updated event to notify components
      this.emit('measurement-updated', {
        type: this.options.mode,
        value: measurementValue,
        unit: measurementUnit,
        formattedValue: formattedValue,
        segments: segmentValues.length,
        vertices: this.workingData.points.length,
        preview: preview,
      });
      
      // Create overall measurement label
      if (this.options.showTotalLength) {
        const labelPosition = this._calculateLabelPosition();
        
        const measurementLabel = this.mapInterface.createLabel({
          position: labelPosition,
          text: formattedValue,
          style: this.options.labelStyle,
        });
        
        this.workingData.measurementLabels.push(measurementLabel);
      }
      
      // Create segment labels if enabled
      if (this.options.showSegmentLengths && segmentValues.length > 0) {
        segmentValues.forEach((segment, _index) => {
          // Skip if segment value is 0
          if (segment.value <= 0) {
            return;
          }
          
          // Format the segment value
          const formattedSegment = this._formatMeasurementValue(segment.value, measurementUnit);
          
          // Create segment label
          const segmentLabel = this.mapInterface.createLabel({
            position: segment.midpoint,
            text: formattedSegment,
            style: Object.assign({}, this.options.labelStyle, {
              font: '10px Arial',
            }),
          });
          
          this.workingData.segmentLabels.push(segmentLabel);
        });
      }
    }
  }
  
  /**
   * Calculate label position for the measurement
   * @returns {Object} The position for the label
   * @private
   */
  _calculateLabelPosition() {
    switch (this.options.mode) {
    case 'distance':
      // For distance, place label near the last point
      if (this.workingData.points.length > 0) {
        const lastPoint = this.workingData.points[this.workingData.points.length - 1];
        return lastPoint.getCoordinate();
      }
      break;
        
    case 'area':
    case 'volume':
      // For area/volume, place label at centroid
      if (this.workingData.activeMeasurement) {
        return this.workingData.activeMeasurement.getCentroid();
      }
      break;
    }
    
    // Fallback to first point if available
    if (this.workingData.points.length > 0) {
      return this.workingData.points[0].getCoordinate();
    }
    
    return null;
  }
  
  /**
   * Complete the current measurement
   * @private
   */
  _completeMeasurement() {
    // Require at least 2 points for distance, 3 for area/volume
    const minPoints = this.options.mode === 'distance' ? 2 : 3;
    
    if (!this.workingData.activeMeasurement || this.workingData.points.length < minPoints) {
      // Not enough points, just reset
      this._reset();
      return;
    }
    
    // Finalize the measurement
    const finalMeasurement = this.workingData.activeMeasurement;
    
    // Complete the geometry (no preview point)
    this._updateMeasurementGeometry();
    
    // Calculate the final measurement value
    let measurementValue = 0;
    let measurementUnit = '';
    
    switch (this.options.mode) {
    case 'distance':
      const coordinates = finalMeasurement.getCoordinates();
      measurementValue = this._calculateDistance(coordinates);
      measurementUnit = this.options.units;
      break;
        
    case 'area':
      const areaRings = finalMeasurement.getRings();
      if (areaRings.length > 0) {
        measurementValue = this._calculateArea(areaRings[0]);
        measurementUnit = this.options.areaUnits;
      }
      break;
        
    case 'volume':
      const volumeRings = finalMeasurement.getRings();
      if (volumeRings.length > 0) {
        measurementValue = this._calculateVolume(volumeRings[0]);
        measurementUnit = this.options.volumeUnits;
      }
      break;
    }
    
    // Format and store the measurement value
    const formattedValue = this._formatMeasurementValue(measurementValue, measurementUnit);
    
    // Update feature properties with measurement info
    finalMeasurement.setProperty('measurementValue', measurementValue);
    finalMeasurement.setProperty('measurementUnit', measurementUnit);
    finalMeasurement.setProperty('measurementFormatted', formattedValue);
    finalMeasurement.setProperty('temporary', false);
    
    // Update point features to be non-temporary
    this.workingData.points.forEach(point => {
      point.setProperty('temporary', false);
    });
    
    // Move to completed measurements collection
    this.workingData.measurements.push(finalMeasurement);
    
    // Create a new measurement
    this._createNewMeasurement();
    
    // Emit measurement completed event
    this.emit('measurement-completed', {
      feature: finalMeasurement,
      value: measurementValue,
      unit: measurementUnit,
      formattedValue: formattedValue,
      mode: this.options.mode,
    });
  }
  
  /**
   * Calculate total distance of a line
   * @param {Array} coordinates - Array of coordinates
   * @returns {number} The distance in meters
   * @private
   */
  _calculateDistance(coordinates) {
    if (coordinates.length < 2) {
      return 0;
    }
    
    let totalDistance = 0;
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const segmentDistance = this.geometryEngine.calculateDistance(
        coordinates[i],
        coordinates[i + 1],
        { includeElevation: this.options.enable3D },
      );
      
      totalDistance += segmentDistance;
    }
    
    // Convert to requested units
    return this._convertDistance(totalDistance, 'meters', this.options.units);
  }
  
  /**
   * Calculate distances for each segment
   * @param {Array} coordinates - Array of coordinates
   * @returns {Array} Array of segment distances with midpoints
   * @private
   */
  _calculateSegmentDistances(coordinates) {
    if (coordinates.length < 2) {
      return [];
    }
    
    const segments = [];
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];
      
      const segmentDistance = this.geometryEngine.calculateDistance(
        start,
        end,
        { includeElevation: this.options.enable3D },
      );
      
      // Calculate midpoint for label placement
      // Create a simple midpoint calculation since GeometryEngine doesn't have interpolate
      const midpoint = {
        lat: (start.lat + end.lat) / 2,
        lng: (start.lng + end.lng) / 2,
        elevation: (start.elevation !== undefined && end.elevation !== undefined) ? 
          (start.elevation + end.elevation) / 2 : 0,
      };
      
      // Convert to requested units
      const convertedDistance = this._convertDistance(segmentDistance, 'meters', this.options.units);
      
      segments.push({
        value: convertedDistance,
        midpoint: midpoint,
      });
    }
    
    return segments;
  }
  
  /**
   * Calculate area of a polygon
   * @param {Array} coordinates - Array of coordinates forming a polygon ring
   * @returns {number} The area in square meters
   * @private
   */
  _calculateArea(coordinates) {
    if (coordinates.length < 3) {
      return 0;
    }
    
    // Ensure polygon is properly closed
    const closedCoordinates = [...coordinates];
    
    // Simple check to see if first and last points are equal
    const first = closedCoordinates[0];
    const last = closedCoordinates[closedCoordinates.length - 1];
    const areEqual = first.lat === last.lat && first.lng === last.lng;
    
    if (!areEqual) {
      closedCoordinates.push(closedCoordinates[0]);
    }
    
    // Calculate area using GeometryEngine static method
    const area = this.geometryEngine.calculateArea(closedCoordinates, {
      includeElevation: this.options.enable3D,
    });
    
    // Convert to requested units
    return this._convertArea(area, 'square-meters', this.options.areaUnits);
  }
  
  /**
   * Calculate volume enclosed by a polygon base and elevation
   * @param {Array} coordinates - Array of coordinates forming a polygon ring
   * @returns {number} The volume in cubic meters
   * @private
   */
  _calculateVolume(coordinates) {
    if (coordinates.length < 3 || !this.options.enable3D) {
      return 0;
    }
    
    // Ensure polygon is properly closed
    const closedCoordinates = [...coordinates];
    
    // Simple check to see if first and last points are equal
    const first = closedCoordinates[0];
    const last = closedCoordinates[closedCoordinates.length - 1];
    const areEqual = first.lat === last.lat && first.lng === last.lng;
    
    if (!areEqual) {
      closedCoordinates.push(closedCoordinates[0]);
    }
    
    // Calculate volume using GeometryEngine
    const volume = this.geometryEngine.calculateVolume ? 
      this.geometryEngine.calculateVolume(closedCoordinates) :
      this._calculateVolumeDirectly(closedCoordinates);
    
    // Convert to requested units
    return this._convertVolume(volume, 'cubic-meters', this.options.volumeUnits);
  }
  
  /**
   * Direct implementation of volume calculation if GeometryEngine.calculateVolume is not available
   * @param {Array} coordinates - Array of coordinates forming a polygon ring
   * @returns {number} The volume in cubic meters
   * @private
   */
  _calculateVolumeDirectly(coordinates) {
    // Calculate the base area using the _calculateArea method
    const baseArea = this._calculateArea(coordinates);
    
    // Calculate average height (elevation) of the polygon vertices
    let totalHeight = 0;
    let validPoints = 0;
    
    for (const coord of coordinates) {
      if (coord.elevation !== undefined && coord.elevation !== null) {
        totalHeight += coord.elevation;
        validPoints++;
      }
    }
    
    // If we have valid elevation data, calculate the volume
    if (validPoints > 0) {
      const avgHeight = totalHeight / validPoints;
      return baseArea * avgHeight;
    }
    
    return 0;
  }
  
  /**
   * Convert distance between different units
   * @param {number} distance - The distance to convert
   * @param {string} fromUnit - The source unit
   * @param {string} toUnit - The target unit
   * @returns {number} The converted distance
   * @private
   */
  _convertDistance(distance, fromUnit, toUnit) {
    if (fromUnit === toUnit) {
      return distance;
    }
    
    // Convert from source unit to meters
    let meters = distance;
    if (fromUnit !== 'meters') {
      switch (fromUnit) {
      case 'feet':
        meters = distance * 0.3048;
        break;
      case 'kilometers':
        meters = distance * 1000;
        break;
      case 'miles':
        meters = distance * 1609.344;
        break;
      }
    }
    
    // Convert from meters to target unit
    switch (toUnit) {
    case 'meters':
      return meters;
    case 'feet':
      return meters / 0.3048;
    case 'kilometers':
      return meters / 1000;
    case 'miles':
      return meters / 1609.344;
    default:
      return meters;
    }
  }
  
  /**
   * Convert area between different units
   * @param {number} area - The area to convert
   * @param {string} fromUnit - The source unit
   * @param {string} toUnit - The target unit
   * @returns {number} The converted area
   * @private
   */
  _convertArea(area, fromUnit, toUnit) {
    if (fromUnit === toUnit) {
      return area;
    }
    
    // Convert from source unit to square meters
    let squareMeters = area;
    if (fromUnit !== 'square-meters') {
      switch (fromUnit) {
      case 'square-feet':
        squareMeters = area * 0.092903;
        break;
      case 'hectares':
        squareMeters = area * 10000;
        break;
      case 'acres':
        squareMeters = area * 4046.856;
        break;
      }
    }
    
    // Convert from square meters to target unit
    switch (toUnit) {
    case 'square-meters':
      return squareMeters;
    case 'square-feet':
      return squareMeters / 0.092903;
    case 'hectares':
      return squareMeters / 10000;
    case 'acres':
      return squareMeters / 4046.856;
    default:
      return squareMeters;
    }
  }
  
  /**
   * Convert volume between different units
   * @param {number} volume - The volume to convert
   * @param {string} fromUnit - The source unit
   * @param {string} toUnit - The target unit
   * @returns {number} The converted volume
   * @private
   */
  _convertVolume(volume, fromUnit, toUnit) {
    if (fromUnit === toUnit) {
      return volume;
    }
    
    // Convert from source unit to cubic meters
    let cubicMeters = volume;
    if (fromUnit !== 'cubic-meters') {
      switch (fromUnit) {
      case 'cubic-feet':
        cubicMeters = volume * 0.0283168;
        break;
      }
    }
    
    // Convert from cubic meters to target unit
    switch (toUnit) {
    case 'cubic-meters':
      return cubicMeters;
    case 'cubic-feet':
      return cubicMeters / 0.0283168;
    default:
      return cubicMeters;
    }
  }
  
  /**
   * Format measurement value for display
   * @param {number} value - The measurement value
   * @param {string} unit - The measurement unit
   * @returns {string} Formatted measurement string
   * @private
   */
  _formatMeasurementValue(value, unit) {
    // Handle different unit display formats
    let formattedValue;
    let unitDisplay;
    
    // Format to appropriate precision based on unit
    switch (unit) {
    case 'meters':
      formattedValue = value < 10 ? value.toFixed(2) : Math.round(value).toString();
      unitDisplay = 'm';
      break;
    case 'feet':
      formattedValue = value < 10 ? value.toFixed(2) : Math.round(value).toString();
      unitDisplay = 'ft';
      break;
    case 'kilometers':
      formattedValue = value.toFixed(3);
      unitDisplay = 'km';
      break;
    case 'miles':
      formattedValue = value.toFixed(3);
      unitDisplay = 'mi';
      break;
    case 'square-meters':
      formattedValue = value < 10 ? value.toFixed(2) : Math.round(value).toString();
      unitDisplay = 'm²';
      break;
    case 'square-feet':
      formattedValue = value < 10 ? value.toFixed(2) : Math.round(value).toString();
      unitDisplay = 'ft²';
      break;
    case 'hectares':
      formattedValue = value.toFixed(4);
      unitDisplay = 'ha';
      break;
    case 'acres':
      formattedValue = value.toFixed(4);
      unitDisplay = 'ac';
      break;
    case 'cubic-meters':
      formattedValue = value < 10 ? value.toFixed(2) : Math.round(value).toString();
      unitDisplay = 'm³';
      break;
    case 'cubic-feet':
      formattedValue = value < 10 ? value.toFixed(2) : Math.round(value).toString();
      unitDisplay = 'ft³';
      break;
    default:
      formattedValue = value.toString();
      unitDisplay = unit;
    }
    
    return `${formattedValue} ${unitDisplay}`;
  }
  
  /**
   * Set the measurement mode
   * @param {string} mode - The measurement mode (distance, area, volume)
   * @returns {boolean} Success of mode change
   */
  setMode(mode) {
    if (!['distance', 'area', 'volume'].includes(mode)) {
      console.error(`Invalid measurement mode: ${mode}`);
      return false;
    }
    
    // Update the mode
    this.options.mode = mode;
    
    // If tool is active, reset it for the new mode
    if (this.isActive) {
      this._reset();
    }
    
    // Emit mode change event
    this.emit('mode-changed', { mode });
    
    return true;
  }
  
  /**
   * Set the measurement units
   * @param {Object} units - The units to set
   * @param {string} [units.distance] - Distance unit
   * @param {string} [units.area] - Area unit
   * @param {string} [units.volume] - Volume unit
   * @returns {boolean} Success of units change
   */
  setUnits(units = {}) {
    // Validate units
    if (units.distance && !['meters', 'feet', 'kilometers', 'miles'].includes(units.distance)) {
      console.error(`Invalid distance unit: ${units.distance}`);
      return false;
    }
    
    if (units.area && !['square-meters', 'square-feet', 'hectares', 'acres'].includes(units.area)) {
      console.error(`Invalid area unit: ${units.area}`);
      return false;
    }
    
    if (units.volume && !['cubic-meters', 'cubic-feet'].includes(units.volume)) {
      console.error(`Invalid volume unit: ${units.volume}`);
      return false;
    }
    
    // Update units
    if (units.distance) this.options.units = units.distance;
    if (units.area) this.options.areaUnits = units.area;
    if (units.volume) this.options.volumeUnits = units.volume;
    
    // Update display if active
    if (this.isActive && this.workingData.activeMeasurement) {
      this._updateMeasurementDisplay();
    }
    
    // Emit units changed event
    this.emit('units-changed', {
      distance: this.options.units,
      area: this.options.areaUnits,
      volume: this.options.volumeUnits,
    });
    
    return true;
  }
  
  /**
   * Toggle 3D measurement mode
   * @param {boolean} enable - Whether to enable 3D measurements
   * @returns {boolean} New state of 3D mode
   */
  setEnable3D(enable) {
    this.options.enable3D = !!enable;
    
    // Update display if active
    if (this.isActive && this.workingData.activeMeasurement) {
      this._updateMeasurementDisplay();
    }
    
    // Emit 3D mode changed event
    this.emit('enable-3d-changed', {
      enable3D: this.options.enable3D,
    });
    
    return this.options.enable3D;
  }
  
  /**
   * Complete the current measurement and return it
   * @returns {Object} The completed measurement feature or null
   */
  completeMeasurement() {
    this._completeMeasurement();
    
    // Return the most recently completed measurement
    if (this.workingData.measurements.length > 0) {
      return this.workingData.measurements[this.workingData.measurements.length - 1];
    }
    
    return null;
  }
  
  /**
   * Get all completed measurements
   * @returns {Array} Array of completed measurement features
   */
  getMeasurements() {
    return this.workingData.measurements;
  }
  
  /**
   * Clear all measurements
   */
  clearAllMeasurements() {
    // Clear temporary and working measurements
    this._clearTemporaryMeasurements();
    
    // Reset tool
    this._reset();
    
    // Emit event
    this.emit('measurements-cleared');
  }
}

/**
 * OffsetTool.js
 * Tool for creating offset points, lines and features
 * Part of the RTK Surveyor 3D-first implementation
 */


/**
 * @typedef {Object} OffsetToolOptions
 * @property {string} [mode='point'] - Offset mode (point, line, perpendicular)
 * @property {string} [units='meters'] - Distance units (meters, feet, etc.)
 * @property {boolean} [enable3D=true] - Whether to use 3D offsets
 * @property {number} [defaultDistance=5] - Default offset distance
 * @property {number} [defaultBearing=0] - Default offset bearing (degrees)
 * @property {Object} [sourceSymbol] - Symbol for source features
 * @property {Object} [targetSymbol] - Symbol for offset features
 * @property {Object} [previewSymbol] - Symbol for preview features
 */

/**
 * Tool for creating offset features
 * Supports point-based, line-based, and perpendicular offsets
 */
class OffsetTool extends ToolBase {
  /**
   * Create a new OffsetTool instance
   * @param {Object} options - Tool configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize tool-specific options with defaults
    this.options = Object.assign({
      mode: 'point',
      units: 'meters',
      enable3D: true,
      defaultDistance: 5,
      defaultBearing: 0,
      distanceSnap: 1,
      bearingSnap: 5,
      sourceSymbol: {
        type: 'circle',
        size: 8,
        color: '#3388FF',
      },
      targetSymbol: {
        type: 'circle',
        size: 8,
        color: '#FF5733',
      },
      lineSymbol: {
        width: 2,
        color: '#FF5733',
        dashArray: '5,5',
      },
      previewSymbol: {
        type: 'circle',
        size: 8,
        color: 'rgba(255, 87, 51, 0.5)',
        outlineWidth: 1,
        outlineColor: '#FF5733',
      },
    }, options);
    
    // Initialize internal state
    this.workingData = {
      sourceFeature: null,
      targetFeature: null,
      previewFeature: null,
      offsetLine: null,
      offsetDistance: this.options.defaultDistance,
      offsetBearing: this.options.defaultBearing,
      mousePosition: null,
      selectedPoint: null,
      snapEnabled: true,
    };
    
    // Bind event handlers to maintain 'this' context
    this._handleMapClick = this._handleMapClick.bind(this);
    this._handleMapMouseMove = this._handleMapMouseMove.bind(this);
    this._handleMapDoubleClick = this._handleMapDoubleClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleFeatureSelected = this._handleFeatureSelected.bind(this);
  }
  
  /**
   * Set up tool-specific event listeners
   * @protected
   * @override
   */
  _setupEventListeners() {
    // Listen for feature selection from the manager
    this.manager.on('featureSelected', this._handleFeatureSelected);
  }
  
  /**
   * Tool-specific activation logic
   * @protected
   * @override
   */
  _activate() {
    // Add map event listeners
    this.mapInterface.addEventListener('click', this._handleMapClick);
    this.mapInterface.addEventListener('mousemove', this._handleMapMouseMove);
    this.mapInterface.addEventListener('dblclick', this._handleMapDoubleClick);
    
    // Add keyboard event listeners
    document.addEventListener('keydown', this._handleKeyDown);
    
    // Set the initial mode
    this._setOffsetMode(this.options.mode);
    
    // Initialize offset values
    this.workingData.offsetDistance = this.options.defaultDistance;
    this.workingData.offsetBearing = this.options.defaultBearing;
    
    // Emit activation event with additional info
    this.emit('activated', {
      mode: this.options.mode,
      offsetDistance: this.workingData.offsetDistance,
      offsetBearing: this.workingData.offsetBearing,
    });
  }
  
  /**
   * Tool-specific deactivation logic
   * @protected
   * @override
   */
  _deactivate() {
    // Remove map event listeners
    this.mapInterface.removeEventListener('click', this._handleMapClick);
    this.mapInterface.removeEventListener('mousemove', this._handleMapMouseMove);
    this.mapInterface.removeEventListener('dblclick', this._handleMapDoubleClick);
    
    // Remove keyboard event listeners
    document.removeEventListener('keydown', this._handleKeyDown);
    
    // Clear any preview features
    this._clearPreviewFeatures();
    
    // Clear working data
    this.workingData = {
      sourceFeature: null,
      targetFeature: null,
      previewFeature: null,
      offsetLine: null,
      offsetDistance: this.options.defaultDistance,
      offsetBearing: this.options.defaultBearing,
      mousePosition: null,
      selectedPoint: null,
      snapEnabled: true,
    };
  }
  
  /**
   * Tool-specific reset logic
   * @protected
   * @override
   */
  _reset() {
    // Clear any preview features
    this._clearPreviewFeatures();
    
    // Reset working data but keep offset values
    const currentDistance = this.workingData.offsetDistance;
    const currentBearing = this.workingData.offsetBearing;
    const currentMode = this.options.mode;
    
    this.workingData = {
      sourceFeature: null,
      targetFeature: null,
      previewFeature: null,
      offsetLine: null,
      offsetDistance: currentDistance,
      offsetBearing: currentBearing,
      mousePosition: null,
      selectedPoint: null,
      snapEnabled: true,
    };
    
    // Emit reset event
    this.emit('reset', {
      mode: currentMode,
      offsetDistance: currentDistance,
      offsetBearing: currentBearing,
    });
  }
  
  /**
   * Set the offset mode
   * @param {string} mode - The offset mode (point, line, perpendicular)
   * @private
   */
  _setOffsetMode(mode) {
    // Validate mode
    if (!['point', 'line', 'perpendicular'].includes(mode)) {
      console.error(`Invalid offset mode: ${mode}`);
      mode = 'point';
    }
    
    // Update the mode
    this.options.mode = mode;
    
    // Reset the tool for the new mode
    this._reset();
    
    // Emit mode change event
    this.emit('modeChanged', { mode });
  }
  
  /**
   * Clear preview features
   * @private
   */
  _clearPreviewFeatures() {
    // Remove preview features from working features
    if (this.workingData.previewFeature) {
      this.manager.workingFeatures.removeFeature(this.workingData.previewFeature);
      this.workingData.previewFeature = null;
    }
    
    if (this.workingData.offsetLine) {
      this.manager.workingFeatures.removeFeature(this.workingData.offsetLine);
      this.workingData.offsetLine = null;
    }
  }
  
  /**
   * Handle map click events
   * @param {Object} event - The map click event
   * @private
   */
  _handleMapClick(event) {
    // Handle click based on current mode and state
    switch (this.options.mode) {
    case 'point':
      if (!this.workingData.sourceFeature) {
        // First click: select or create source point
        if (this.workingData.selectedPoint) {
          // Use the selected point as source
          this.workingData.sourceFeature = this.workingData.selectedPoint;
          this._updatePointOffsetPreview();
        } else {
          // Create a new source point at click location
          this._createSourcePoint(event.coordinate);
        }
      } else {
        // Second click: create offset point
        this._createOffsetPoint();
      }
      break;
        
    case 'line':
    case 'perpendicular':
      if (!this.workingData.sourceFeature) {
        // First click: select or create source line
        const selectedFeatures = this.manager.getSelectedFeatures();
        const selectedLine = selectedFeatures.find(f => f.type === 'line');
          
        if (selectedLine) {
          // Use the selected line as source
          this.workingData.sourceFeature = selectedLine;
          this._updateLineOffsetPreview();
        } else {
          // Start creating a new line
          this._startCreatingSourceLine(event.coordinate);
        }
      } else if (this.workingData.sourceFeature && this.workingData.sourceFeature.type === 'line') {
        if (this.workingData.sourceFeature.isTemporary) {
          // Add point to temporary source line
          this._addPointToSourceLine(event.coordinate);
        } else {
          // Create offset from existing line
          this._createOffsetFromLine();
        }
      }
      break;
    }
  }
  
  /**
   * Handle map mouse move events
   * @param {Object} event - The map mousemove event
   * @private
   */
  _handleMapMouseMove(event) {
    // Store current mouse position
    this.workingData.mousePosition = event.coordinate;
    
    // Update preview based on current mode and state
    if (this.workingData.sourceFeature) {
      switch (this.options.mode) {
      case 'point':
        this._updatePointOffsetPreview();
        break;
          
      case 'line':
      case 'perpendicular':
        if (this.workingData.sourceFeature.isTemporary) {
          // Update the temporary source line
          this._updateTemporarySourceLine();
        } else {
          // Update the offset preview
          this._updateLineOffsetPreview();
        }
        break;
      }
    }
  }
  
  /**
   * Handle map double click events
   * @param {Object} event - The map double click event
   * @private
   */
  _handleMapDoubleClick(event) {
    // Prevent default browser behavior
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
    }
    
    // Complete line creation for line modes
    if (['line', 'perpendicular'].includes(this.options.mode) && 
        this.workingData.sourceFeature && 
        this.workingData.sourceFeature.isTemporary) {
      this._completeSourceLine();
    }
  }
  
  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  _handleKeyDown(event) {
    // Handle Escape key
    if (event.key === 'Escape') {
      if (['line', 'perpendicular'].includes(this.options.mode) && 
          this.workingData.sourceFeature && 
          this.workingData.sourceFeature.isTemporary) {
        // Cancel line creation
        this._cancelSourceLine();
      } else {
        // Reset the tool
        this._reset();
      }
    }
    
    // Handle Enter key
    if (event.key === 'Enter') {
      if (['line', 'perpendicular'].includes(this.options.mode) && 
          this.workingData.sourceFeature && 
          this.workingData.sourceFeature.isTemporary) {
        // Complete line creation
        this._completeSourceLine();
      } else if (this.workingData.sourceFeature) {
        // Create offset
        if (this.options.mode === 'point') {
          this._createOffsetPoint();
        } else {
          this._createOffsetFromLine();
        }
      }
    }
    
    // Handle number keys for quick distance changes
    if (event.key >= '1' && event.key <= '9') {
      const distance = parseInt(event.key) * (event.shiftKey ? 10 : 1);
      this.setOffsetDistance(distance);
    }
    
    // Handle arrow keys for bearing adjustments
    if (event.key === 'ArrowLeft') {
      this.adjustOffsetBearing(-15);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      this.adjustOffsetBearing(15);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.adjustOffsetDistance(1);
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      this.adjustOffsetDistance(-1);
      event.preventDefault();
    }
  }
  
  /**
   * Handle feature selection events
   * @param {Object} feature - The selected feature
   * @private
   */
  _handleFeatureSelected(feature) {
    if (!this.isActive) {
      return;
    }
    
    // Store selected point for point mode
    if (feature.type === 'point' && this.options.mode === 'point') {
      this.workingData.selectedPoint = feature;
      
      // If no source feature yet, use this as source
      if (!this.workingData.sourceFeature) {
        this.workingData.sourceFeature = feature;
        this._updatePointOffsetPreview();
      }
    }
    
    // Store selected line for line modes
    if (feature.type === 'line' && ['line', 'perpendicular'].includes(this.options.mode)) {
      // If no source feature yet, use this as source
      if (!this.workingData.sourceFeature) {
        this.workingData.sourceFeature = feature;
        this._updateLineOffsetPreview();
      }
    }
  }
  
  /**
   * Create a source point at the specified coordinate
   * @param {Object} coordinate - The coordinate for the source point
   * @private
   */
  _createSourcePoint(coordinate) {
    // Create a new point feature
    const sourcePoint = new PointFeature(coordinate,{
      id: `offset-source-${Date.now()}`,
      properties: {
        type: 'offset-source',
        temporary: false,
      },
      style: this.options.sourceSymbol,
    });
    
    // Apply 3D elevation if enabled
    if (this.options.enable3D) {
      this.manager.applyElevationData(sourcePoint);
    }
    
    // Add to features collection
    this.manager.features.addFeature(sourcePoint);
    
    // Set as source feature
    this.workingData.sourceFeature = sourcePoint;
    
    // Create preview
    this._updatePointOffsetPreview();
    
    // Emit event
    this.emit('sourcePointCreated', sourcePoint);
  }
  
  /**
   * Update the point offset preview
   * @private
   */
  _updatePointOffsetPreview() {
    // Clear any existing preview
    this._clearPreviewFeatures();
    
    if (!this.workingData.sourceFeature || this.workingData.sourceFeature.type !== 'point') {
      return;
    }
    
    // Get source point coordinate
    const sourceCoord = this.workingData.sourceFeature.getCoordinate();
    
    // Calculate bearing
    let bearing = this.workingData.offsetBearing;
    
    // If mouse position is available, calculate dynamic bearing
    if (this.workingData.mousePosition) {
      const mouseBearing = sourceCoord.bearingTo(new Coordinate(this.workingData.mousePosition));
      
      if (this.workingData.snapEnabled) {
        // Snap to increments
        bearing = Math.round(mouseBearing / this.options.bearingSnap) * this.options.bearingSnap;
      } else {
        bearing = mouseBearing;
      }
      
      // Update stored bearing
      this.workingData.offsetBearing = bearing;
    }
    
    // Calculate offset point
    const offsetCoord = GeometryEngine.destinationCoordinate(
      sourceCoord,
      this.workingData.offsetDistance,
      bearing,
    );
    
    // Create preview point
    this.workingData.previewFeature = new PointFeature(offsetCoord,{
      id: `offset-preview-${Date.now()}`,
      properties: {
        type: 'offset-preview',
        temporary: true,
      },
      style: this.options.previewSymbol,
    });
    
    // Create preview line
    this.workingData.offsetLine = new LineFeature([sourceCoord, offsetCoord],{
      id: `offset-line-${Date.now()}`,
      properties: {
        type: 'offset-line',
        temporary: true,
      },
      style: this.options.lineSymbol,
    });
    
    // Add to working features
    this.manager.workingFeatures.addFeature(this.workingData.previewFeature);
    this.manager.workingFeatures.addFeature(this.workingData.offsetLine);
    
    // Emit preview update event
    this.emit('previewUpdated', {
      distance: this.workingData.offsetDistance,
      bearing: this.workingData.offsetBearing,
      sourceCoordinate: sourceCoord,
      targetCoordinate: offsetCoord,
    });
  }
  
  /**
   * Create the offset point from the current preview
   * @private
   */
  _createOffsetPoint() {
    if (!this.workingData.sourceFeature || !this.workingData.previewFeature) {
      return;
    }
    
    // Get preview coordinate
    const offsetCoord = this.workingData.previewFeature.getCoordinate();
    
    // Create the actual offset point
    const offsetPoint = new PointFeature(offsetCoord, {
      id: `offset-target-${Date.now()}`,
      properties: {
        type: 'offset-target',
        offsetDistance: this.workingData.offsetDistance,
        offsetBearing: this.workingData.offsetBearing,
        sourceFeatureId: this.workingData.sourceFeature.id,
        temporary: false,
      },
      style: this.options.targetSymbol,
    });
    
    // Add to features collection
    this.manager.features.addFeature(offsetPoint);
    
    // Store as target feature
    this.workingData.targetFeature = offsetPoint;
    
    // Clear preview
    this._clearPreviewFeatures();
    
    // Reset source feature but keep distance and bearing
    this.workingData.sourceFeature = null;
    
    // Emit event
    this.emit('offsetPointCreated', {
      sourceFeature: this.workingData.sourceFeature,
      targetFeature: offsetPoint,
      distance: this.workingData.offsetDistance,
      bearing: this.workingData.offsetBearing,
    });
    
    // Reset for next operation
    this._reset();
  }
  
  /**
   * Start creating a source line for line-based offset
   * @param {Object} coordinate - The first coordinate of the line
   * @private
   */
  _startCreatingSourceLine(coordinate) {
    // Create a new line feature
    const sourceLine = new LineFeature([coordinate], {
      id: `offset-source-line-${Date.now()}`,
      properties: {
        type: 'offset-source',
        temporary: true,
      },
      style: this.options.sourceSymbol,
    });
    
    // Apply 3D elevation if enabled
    if (this.options.enable3D) {
      this.manager.applyElevationData(sourceLine);
    }
    
    // Add to working features collection
    this.manager.workingFeatures.addFeature(sourceLine);
    
    // Set as source feature
    this.workingData.sourceFeature = sourceLine;
    
    // Emit event
    this.emit('sourceLineStarted', sourceLine);
  }
  
  /**
   * Add a point to the source line being created
   * @param {Object} coordinate - The coordinate to add
   * @private
   */
  _addPointToSourceLine(coordinate) {
    if (!this.workingData.sourceFeature || this.workingData.sourceFeature.type !== 'line') {
      return;
    }
    
    // Get existing coordinates
    const coordinates = this.workingData.sourceFeature.getCoordinates();
    
    // Add the new coordinate
    coordinates.push(coordinate);
    
    // Update the line
    this.workingData.sourceFeature.setCoordinates(coordinates);
    
    // Apply 3D elevation if enabled
    if (this.options.enable3D) {
      this.manager.applyElevationData(this.workingData.sourceFeature);
    }
    
    // Update preview if this is the second point (first segment)
    if (coordinates.length === 2) {
      this._updateLineOffsetPreview();
    }
    
    // Emit event
    this.emit('sourceLinePointAdded', {
      line: this.workingData.sourceFeature,
      coordinate: coordinate,
      pointIndex: coordinates.length - 1,
    });
  }
  
  /**
   * Update the temporary source line with mouse position
   * @private
   */
  _updateTemporarySourceLine() {
    if (!this.workingData.sourceFeature || 
        this.workingData.sourceFeature.type !== 'line' ||
        !this.workingData.sourceFeature.isTemporary ||
        !this.workingData.mousePosition) {
      return;
    }
    
    // Get existing coordinates
    const coordinates = this.workingData.sourceFeature.getCoordinates();
    
    // Need at least one point
    if (coordinates.length === 0) {
      return;
    }
    
    // Create preview coordinates with mouse position as last point
    const previewCoords = [...coordinates.slice(0, -1), this.workingData.mousePosition];
    
    // Update the line
    this.workingData.sourceFeature.setCoordinates(previewCoords);
    
    // Update offset preview if we have at least one segment
    if (previewCoords.length >= 2) {
      this._updateLineOffsetPreview();
    }
  }
  
  /**
   * Complete the source line creation
   * @private
   */
  _completeSourceLine() {
    if (!this.workingData.sourceFeature || 
        this.workingData.sourceFeature.type !== 'line' ||
        !this.workingData.sourceFeature.isTemporary) {
      return;
    }
    
    // Get coordinates
    const coordinates = this.workingData.sourceFeature.getCoordinates();
    
    // Need at least two points for a valid line
    if (coordinates.length < 2) {
      this._cancelSourceLine();
      return;
    }
    
    // Create the final line
    const sourceLine = new LineFeature(coordinates, {
      id: `offset-source-line-${Date.now()}`,
      properties: {
        type: 'offset-source',
        temporary: false,
      },
      style: this.options.sourceSymbol,
    });
    
    // Apply 3D elevation if enabled
    if (this.options.enable3D) {
      this.manager.applyElevationData(sourceLine);
    }
    
    // Add to features collection
    this.manager.features.addFeature(sourceLine);
    
    // Remove temporary line
    this.manager.workingFeatures.removeFeature(this.workingData.sourceFeature);
    
    // Set as source feature
    this.workingData.sourceFeature = sourceLine;
    
    // Update preview
    this._updateLineOffsetPreview();
    
    // Emit event
    this.emit('sourceLineCompleted', sourceLine);
  }
  
  /**
   * Cancel source line creation
   * @private
   */
  _cancelSourceLine() {
    if (!this.workingData.sourceFeature || !this.workingData.sourceFeature.isTemporary) {
      return;
    }
    
    // Remove temporary line
    this.manager.workingFeatures.removeFeature(this.workingData.sourceFeature);
    
    // Clear working data
    this.workingData.sourceFeature = null;
    this._clearPreviewFeatures();
    
    // Emit event
    this.emit('sourceLineCancelled');
  }
  
  /**
   * Update the line offset preview
   * @private
   */
  _updateLineOffsetPreview() {
    // Clear any existing preview
    this._clearPreviewFeatures();
    
    if (!this.workingData.sourceFeature || this.workingData.sourceFeature.type !== 'line') {
      return;
    }
    
    // Get source line coordinates
    const sourceCoords = this.workingData.sourceFeature.getCoordinates();
    
    // Need at least two points for a valid line
    if (sourceCoords.length < 2) {
      return;
    }
    
    let offsetCoords;

    if (this.options.mode === 'line') {
      // Parallel offset line
      offsetCoords = this.geometryEngine.createOffsetLine(
        sourceCoords,
        this.workingData.offsetDistance,
        { enable3D: this.options.enable3D },
      );
      
      // Create preview line
      this.workingData.previewFeature = new LineFeature(offsetCoords,{
        id: `offset-preview-${Date.now()}`,
        properties: {
          type: 'offset-preview',
          temporary: true,
        },
        style: Object.assign({}, this.options.lineSymbol, {
          dashArray: '5,5',
        }),
      });
      
    } else if (this.options.mode === 'perpendicular') {
      // Find closest point on line to mouse position
      if (this.workingData.mousePosition) {
        // Find nearest point on line to mouse position
        const nearestInfo = this.workingData.sourceFeature.nearest(this.workingData.mousePosition);
        
        if (nearestInfo) {
          // Calculate perpendicular offset
          const perpendicular = this.geometryEngine.calculatePerpendicularOffset(
            sourceCoords,
            nearestInfo.pointIndex,
            nearestInfo.segmentPosition,
            this.workingData.offsetDistance,
            { enable3D: this.options.enable3D },
          );
          
          // Create preview point
          this.workingData.previewFeature = new PointFeature(perpendicular.offsetPoint,{
            id: `offset-preview-${Date.now()}`,
            properties: {
              type: 'offset-preview',
              temporary: true,
            },
            style: this.options.previewSymbol,
          });
          
          // Create preview line (perpendicular segment)
          this.workingData.offsetLine = new LineFeature([nearestInfo.nearestPoint, perpendicular.offsetPoint], {
            id: `offset-line-${Date.now()}`,
            properties: {
              type: 'offset-line',
              temporary: true,
            },
            style: this.options.lineSymbol,
          });
          
          // Store segment info for offset creation
          this.workingData.perpendicularInfo = {
            pointIndex: nearestInfo.pointIndex,
            segmentPosition: nearestInfo.segmentPosition,
            nearestPoint: nearestInfo.nearestPoint,
            offsetPoint: perpendicular.offsetPoint,
          };
        }
      }
    }
    
    // Add to working features
    if (this.workingData.previewFeature) {
      this.manager.workingFeatures.addFeature(this.workingData.previewFeature);
    }
    
    if (this.workingData.offsetLine) {
      this.manager.workingFeatures.addFeature(this.workingData.offsetLine);
    }
    
    // Emit preview update event
    this.emit('previewUpdated', {
      distance: this.workingData.offsetDistance,
      sourceFeature: this.workingData.sourceFeature,
      previewFeature: this.workingData.previewFeature,
    });
  }
  
  /**
   * Create the offset feature from the current preview
   * @private
   */
  _createOffsetFromLine() {
    if (!this.workingData.sourceFeature || !this.workingData.previewFeature) {
      return;
    }
    
    let offsetFeature;
    
    if (this.options.mode === 'line') {
      // Get preview coordinates
      const offsetCoords = this.workingData.previewFeature.getCoordinates();
      
      // Create the actual offset line
      offsetFeature = new LineFeature(offsetCoords, {
        id: `offset-target-${Date.now()}`,
        properties: {
          type: 'offset-target',
          offsetDistance: this.workingData.offsetDistance,
          sourceFeatureId: this.workingData.sourceFeature.id,
          temporary: false,
        },
        style: Object.assign({}, this.options.lineSymbol, {
          dashArray: null,
        }),
      });
      
    } else if (this.options.mode === 'perpendicular') {
      // Get preview coordinate
      const offsetCoord = this.workingData.previewFeature.getCoordinate();
      
      // Create the actual offset point
      offsetFeature = new PointFeature(offsetCoord, {
        id: `offset-target-${Date.now()}`,
        properties: {
          type: 'offset-target',
          offsetDistance: this.workingData.offsetDistance,
          sourceFeatureId: this.workingData.sourceFeature.id,
          pointIndex: this.workingData.perpendicularInfo.pointIndex,
          segmentPosition: this.workingData.perpendicularInfo.segmentPosition,
          temporary: false,
        },
        style: this.options.targetSymbol,
      });
    }
    
    if (offsetFeature) {
      // Add to features collection
      this.manager.features.addFeature(offsetFeature);
      
      // Store as target feature
      this.workingData.targetFeature = offsetFeature;
      
      // Emit event
      this.emit('offsetFeatureCreated', {
        sourceFeature: this.workingData.sourceFeature,
        targetFeature: offsetFeature,
        distance: this.workingData.offsetDistance,
        mode: this.options.mode,
      });
    }
    
    // Clear preview
    this._clearPreviewFeatures();
    
    // Reset source feature but keep distance
    this.workingData.sourceFeature = null;
    
    // Reset for next operation
    this._reset();
  }
  
  /**
   * Set the offset distance
   * @param {number} distance - The offset distance
   * @returns {number} The updated distance
   */
  setOffsetDistance(distance) {
    // Validate distance
    if (isNaN(distance) || distance <= 0) {
      console.error('Invalid offset distance. Must be a positive number.');
      return this.workingData.offsetDistance;
    }
    
    // Update distance
    this.workingData.offsetDistance = distance;
    
    // Update preview if active
    if (this.workingData.sourceFeature) {
      if (this.options.mode === 'point') {
        this._updatePointOffsetPreview();
      } else {
        this._updateLineOffsetPreview();
      }
    }
    
    // Emit event
    this.emit('offsetDistanceChanged', {
      distance: this.workingData.offsetDistance,
    });
    
    return this.workingData.offsetDistance;
  }
  
  /**
   * Set the offset bearing (for point mode)
   * @param {number} bearing - The offset bearing in degrees
   * @returns {number} The updated bearing
   */
  setOffsetBearing(bearing) {
    // Validate bearing
    if (isNaN(bearing)) {
      console.error('Invalid offset bearing. Must be a number.');
      return this.workingData.offsetBearing;
    }
    
    // Normalize bearing to 0-360 range
    bearing = (bearing % 360 + 360) % 360;
    
    // Update bearing
    this.workingData.offsetBearing = bearing;
    
    // Update preview if active in point mode
    if (this.workingData.sourceFeature && this.options.mode === 'point') {
      this._updatePointOffsetPreview();
    }
    
    // Emit event
    this.emit('offsetBearingChanged', {
      bearing: this.workingData.offsetBearing,
    });
    
    return this.workingData.offsetBearing;
  }
  
  /**
   * Adjust the offset distance by the specified amount
   * @param {number} amount - The amount to adjust the distance by
   * @returns {number} The updated distance
   */
  adjustOffsetDistance(amount) {
    // Calculate new distance with snap
    const newDistance = Math.max(
      1,
      Math.round((this.workingData.offsetDistance + amount) / this.options.distanceSnap) * this.options.distanceSnap,
    );
    
    return this.setOffsetDistance(newDistance);
  }
  
  /**
   * Adjust the offset bearing by the specified amount
   * @param {number} amount - The amount to adjust the bearing by (in degrees)
   * @returns {number} The updated bearing
   */
  adjustOffsetBearing(amount) {
    // Calculate new bearing with snap
    const newBearing = Math.round((this.workingData.offsetBearing + amount) / this.options.bearingSnap) * this.options.bearingSnap;
    
    return this.setOffsetBearing(newBearing);
  }
  
  /**
   * Toggle snapping functionality
   * @param {boolean} [enable] - Whether to enable snapping
   * @returns {boolean} The updated snap state
   */
  toggleSnap(enable) {
    if (typeof enable === 'boolean') {
      this.workingData.snapEnabled = enable;
    } else {
      this.workingData.snapEnabled = !this.workingData.snapEnabled;
    }
    
    // Emit event
    this.emit('snapToggled', {
      snapEnabled: this.workingData.snapEnabled,
    });
    
    return this.workingData.snapEnabled;
  }
  
  /**
   * Set the offset mode
   * @param {string} mode - The offset mode (point, line, perpendicular)
   * @returns {boolean} Success of mode change
   */
  setMode(mode) {
    if (!['point', 'line', 'perpendicular'].includes(mode)) {
      console.error(`Invalid offset mode: ${mode}`);
      return false;
    }
    
    // Set the mode
    this._setOffsetMode(mode);
    
    return true;
  }
  
  /**
   * Get the current offset settings
   * @returns {Object} Current offset settings
   */
  getSettings() {
    return {
      mode: this.options.mode,
      distance: this.workingData.offsetDistance,
      bearing: this.workingData.offsetBearing,
      enable3D: this.options.enable3D,
      snapEnabled: this.workingData.snapEnabled,
    };
  }
}

/**
 * DrawingTool.js
 * Tool for drawing points, lines, and polygons
 * Part of the RTK Surveyor 3D-first implementation
 * 
 * Usage Notes:
 * - Points are created with a single click
 * - Lines require at least 2 vertices and can be completed by:
 *   1. Double-clicking
 *   2. Pressing Enter
 *   3. Right-clicking
 *   4. Clicking the line tool button again
 * - Polygons require at least 3 vertices and can be completed by:
 *   1. Double-clicking
 *   2. Pressing Enter
 *   3. Right-clicking
 *   4. Clicking the polygon tool button again (recommended)
 * - Press Escape to cancel drawing
 * - Press Backspace/Delete to remove the last vertex
 */


/**
 * @typedef {Object} DrawingToolOptions
 * @property {string} [mode='point'] - Drawing mode (point, line, polygon, freehand)
 * @property {boolean} [enable3D=true] - Whether to enable 3D drawing
 * @property {boolean} [continuousDrawing=false] - Whether to continue drawing after feature completion
 * @property {number} [freehandSamplingInterval=5] - Meters between points in freehand mode
 * @property {Object} [pointSymbol] - Symbol for points
 * @property {Object} [lineSymbol] - Symbol for lines
 * @property {Object} [polygonSymbol] - Symbol for polygons
 * @property {Object} [vertexSymbol] - Symbol for vertices
 */

/**
 * Tool for drawing survey features
 * Supports point, line, polygon, and freehand drawing modes
 */
class DrawingTool extends ToolBase {
  /**
   * Create a new DrawingTool instance
   * @param {Object} options - Tool configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize tool-specific options with defaults
    this.options = Object.assign({
      mode: 'point',
      enable3D: true,
      continuousDrawing: false,
      freehandSamplingInterval: 5, // meters
      pointSymbol: Object.assign({
        size: 32, // Larger size for better visibility
        color: '#FF5733', // Orange color
        outlineWidth: 2,
        outlineColor: 'white',
        useDualMarker: true, // Use the pin+dot style for better positioning feedback
      }, this.manager.settings.defaultPointSymbol || {}),
      lineSymbol: this.manager.settings.defaultLineSymbol,
      // Enhanced lineSymbol with style for preview line
      previewLineSymbol: {
        color: '#3388FF', 
        width: 2,
        opacity: 0.8,
        dashArray: [5, 5],  // Dashed line for preview
      },
      polygonSymbol: this.manager.settings.defaultPolygonSymbol,
      // Enhanced polygonSymbol with style for preview polygon
      previewPolygonSymbol: {
        fillColor: 'rgba(51, 136, 255, 0.1)',  // More transparent fill
        outlineColor: '#3388FF',
        outlineWidth: 2,
        dashArray: [5, 5],  // Dashed outline for preview
      },
      vertexSymbol: {
        type: 'circle',
        size: 8,
        color: '#3388FF',
        outlineWidth: 2,
        outlineColor: 'white',
        // Don't use dual marker for vertices - use centered circle for precision
        useDualMarker: false,
      },
      // Enhanced vertexSymbol with style for active vertices
      activeVertexSymbol: {
        type: 'circle',
        size: 10,
        color: '#3388FF',
        outlineWidth: 2,
        outlineColor: 'white',
        // Don't use dual marker for vertices - use centered circle for precision
        useDualMarker: false,
      },
    }, options);
    
    // Initialize internal state
    this.workingData = {
      activeFeature: null,
      vertices: [],
      mousePosition: null,
      isDragging: false,
      lastFreehandPoint: null,
    };
    
    // Bind event handlers to maintain 'this' context
    this._handleMapClick = this._handleMapClick.bind(this);
    this._handleMapMouseMove = this._handleMapMouseMove.bind(this);
    this._handleMapDoubleClick = this._handleMapDoubleClick.bind(this);
    this._handleMapRightClick = this._handleMapRightClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleMapMouseDown = this._handleMapMouseDown.bind(this);
    this._handleMapMouseUp = this._handleMapMouseUp.bind(this);
  }
  
  /**
   * Set up tool-specific event listeners
   * @protected
   * @override
   */
  _setupEventListeners() {
    // Implement specific event listeners if needed
  }
  
  /**
   * Tool-specific activation logic
   * @protected
   * @override
   */
  _activate() {
    console.log(`Activating DrawingTool in ${this.options.mode} mode, continuousDrawing=${this.options.continuousDrawing}`);
    
    // Ensure workingData is properly initialized
    if (!this.workingData || typeof this.workingData !== 'object') {
      this.workingData = {
        activeFeature: null,
        vertices: [],
        mousePosition: null,
        isDragging: false,
        lastFreehandPoint: null,
      };
    }
    
    try {
      // Add map event listeners
      this.mapInterface.addEventListener('click', this._handleMapClick);
      this.mapInterface.addEventListener('mousemove', this._handleMapMouseMove);
      this.mapInterface.addEventListener('dblclick', this._handleMapDoubleClick);
      this.mapInterface.addEventListener('contextmenu', this._handleMapRightClick);
      this.mapInterface.addEventListener('mousedown', this._handleMapMouseDown);
      this.mapInterface.addEventListener('mouseup', this._handleMapMouseUp);
      
      // Add keyboard event listeners
      document.addEventListener('keydown', this._handleKeyDown);
      
      // Create a new drawing based on the current mode
      this._startNewDrawing();

      // Emit activation event with mode
      this.emit('activated', {
        mode: this.options.mode,
        continuousDrawing: this.options.continuousDrawing,
      });
    } catch (error) {
      console.error('Error activating DrawingTool:', error);
    }
  }
  
  /**
   * Tool-specific deactivation logic
   * @protected
   * @override
   */
  _deactivate() {
    // Remove map event listeners
    this.mapInterface.removeEventListener('click', this._handleMapClick);
    this.mapInterface.removeEventListener('mousemove', this._handleMapMouseMove);
    this.mapInterface.removeEventListener('dblclick', this._handleMapDoubleClick);
    this.mapInterface.removeEventListener('contextmenu', this._handleMapRightClick);
    this.mapInterface.removeEventListener('mousedown', this._handleMapMouseDown);
    this.mapInterface.removeEventListener('mouseup', this._handleMapMouseUp);
    
    // Remove keyboard event listeners
    document.removeEventListener('keydown', this._handleKeyDown);
    
    // Clear any active drawing
    this._clearActiveDrawing();
    
    // Reset working data but preserve structure
    this.workingData = {
      activeFeature: null,
      vertices: [],
      mousePosition: null,
      isDragging: false,
      lastFreehandPoint: null,
    };
  }
  
  /**
   * Tool-specific reset logic
   * @protected
   * @override
   */
  _reset() {
    // Ensure workingData is initialized
    if (!this.workingData) {
      this.workingData = {
        activeFeature: null,
        vertices: [],
        mousePosition: null,
        isDragging: false,
        lastFreehandPoint: null,
      };
    } else {
      // Finish current drawing if any and start a new one
      if (this.workingData.activeFeature) {
        this._completeDrawing();
      }
    }
    
    // Start a new drawing
    this._startNewDrawing();
  }
  
  /**
   * Start a new drawing based on current mode
   * @private
   */
  _startNewDrawing() {
    // Clear any existing drawing
    this._clearActiveDrawing();
    
    // Create appropriate feature based on mode
    switch (this.options.mode) {
    case 'point':
      // For points, we don't create a feature until click
      break;
        
    case 'line':
      // Fix: Pass empty array directly as first parameter, not in options
      this.workingData.activeFeature = new LineFeature([], {
        id: `drawing-${Date.now()}`,
        properties: {
          type: 'drawing',
          drawingType: 'line',
          temporary: true,
          isPreview: true,
        },
        style: this.options.previewLineSymbol || this.options.lineSymbol,
      });
      break;
        
    case 'polygon':
      try {
        // Create a minimal polygon with initial vertices to avoid centroid calculation error
        // Use a tiny "invisible" triangle as a starter polygon that will be replaced
        const initialCoords = [
          new Coordinate(0, 0, 0),
          new Coordinate(0, 0.000001, 0),
          new Coordinate(0.000001, 0, 0),
          new Coordinate(0, 0, 0), // Close the polygon
        ];
          
        this.workingData.activeFeature = new PolygonFeature(initialCoords, {
          id: `drawing-${Date.now()}`,
          properties: {
            type: 'drawing',
            drawingType: 'polygon',
            temporary: true,
            isPreview: true,
          },
          style: this.options.previewPolygonSymbol || this.options.polygonSymbol,
        });
      } catch (error) {
        console.error('Error creating polygon feature:', error);
        // If polygon creation fails, create a line instead as fallback
        this.workingData.activeFeature = new LineFeature([], {
          id: `drawing-${Date.now()}`,
          properties: {
            type: 'drawing',
            drawingType: 'line',
            temporary: true,
            isPreview: true,
          },
          style: this.options.previewLineSymbol || this.options.lineSymbol,
        });
        console.warn('Fallback to LineFeature for drawing');
      }
      break;
        
    case 'freehand':
      // Fix: Pass empty array directly as first parameter, not in options
      this.workingData.activeFeature = new LineFeature([], {
        id: `drawing-${Date.now()}`,
        properties: {
          type: 'drawing',
          drawingType: 'freehand',
          temporary: true,
          isPreview: true,
        },
        style: this.options.previewLineSymbol || this.options.lineSymbol,
      });
      break;
    }
    
    // Add feature to working features if created
    if (this.workingData.activeFeature) {
      this.manager.workingFeatures.addFeature(this.workingData.activeFeature);
    }
    
    // Reset vertices array
    this.workingData.vertices = [];
    this.workingData.lastFreehandPoint = null;
  }
  
  /**
   * Clear the active drawing
   * @private
   */
  _clearActiveDrawing() {
    // Ensure workingData exists and has required properties
    if (!this.workingData) {
      this.workingData = {
        activeFeature: null,
        vertices: [],
        mousePosition: null,
        isDragging: false,
        lastFreehandPoint: null,
      };
      return;
    }
    
    // Remove active feature from working features
    if (this.workingData.activeFeature) {
      this.manager.workingFeatures.removeFeature(this.workingData.activeFeature);
      this.workingData.activeFeature = null;
    }
    
    // Remove vertex features - with defensive check for vertices array
    if (Array.isArray(this.workingData.vertices)) {
      this.workingData.vertices.forEach(vertex => {
        this.manager.workingFeatures.removeFeature(vertex);
      });
      
      // Reset vertices array
      this.workingData.vertices = [];
    } else {
      // Initialize vertices if it doesn't exist
      this.workingData.vertices = [];
    }
  }
  
  /**
   * Handle map click events
   * @param {Object} event - The map click event
   * @private
   */
  _handleMapClick(event) {
    // Enhanced logging for debugging click issues
    console.log('======== MAP CLICK EVENT ========');
    console.log(`DrawingTool._handleMapClick called in ${this.options.mode} mode`);
    console.log('Click event object:', {
      type: event.type,
      hasCoordinate: !!event.coordinate,
      hasLatLng: !!event.latLng,
      hasOriginalEvent: !!event.originalEvent,
      hasPixel: !!event.pixel,
      pixel: event.pixel ? `[${event.pixel[0]}, ${event.pixel[1]}]` : 'N/A',
    });

    // Skip freehand mode (handled by mousedown/mouseup)
    if (this.options.mode === 'freehand') {
      console.log('Skipping click in freehand mode');
      return;
    }
    
    // Extract coordinate from the event with error handling
    let coordinate;
    
    // Check if there's an active snap point from the snapping manager
    if (this.manager.snappingManager && this.manager.snappingManager.getSnapPoint()) {
      // Use the snapped coordinate instead of the raw click coordinate
      const snap = this.manager.snappingManager.getSnapPoint();
      coordinate = snap.coordinate;
    } else if (event.coordinate) {
      coordinate = event.coordinate;
    } else if (event.originalEvent && event.latLng) {
      // Handle Google Maps native events if adapter didn't convert properly
      coordinate = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
        elevation: 0,
      };
    } else {
      console.error('❌ ERROR: Invalid click event, no coordinate found', event);
      return;
    }
    
    try {
      // Handle based on mode
      switch (this.options.mode) {
      case 'point':
        // Create a point at the clicked location
        this._createPoint(coordinate);
        break;
          
      case 'line':
      case 'polygon':
        // Add vertex to the feature
        this._addVertex(coordinate);
        break;
      }
      
    } catch (error) {
      console.error(`❌ ERROR handling map click in ${this.options.mode} mode:`, error);
      
      // On error, try to recover by starting a new drawing
      // This prevents the tool from getting stuck in a broken state
      setTimeout(() => {
        this._startNewDrawing();
      }, 10);
    }
    
  }
  
  /**
   * Handle map mouse move events
   * @param {Object} event - The map mousemove event
   * @private
   */
  _handleMapMouseMove(event) {
    try {
      let coordinate;
      
      // Check if there's an active snap point from the snapping manager
      if (this.manager.snappingManager && this.manager.snappingManager.getSnapPoint()) {
        // Use the snapped coordinate
        const snap = this.manager.snappingManager.getSnapPoint();
        coordinate = snap.coordinate;
      } else if (event.coordinate instanceof Coordinate) {
        // Direct coordinate object
        coordinate = event.coordinate;
        
      } else if (event.coordinate && typeof event.coordinate.lat === 'number' && typeof event.coordinate.lng === 'number') {
        // Coordinate-like object
        coordinate = new Coordinate(
          event.coordinate.lat,
          event.coordinate.lng,
          event.coordinate.elevation !== undefined ? event.coordinate.elevation : 0,
        );
        
      } else if (event.latLng && typeof event.latLng.lat === 'function' && typeof event.latLng.lng === 'function') {
        // Google Maps LatLng object
        coordinate = new Coordinate(
          event.latLng.lat(),
          event.latLng.lng(),
          0,
        );
        
      } else {
        // Try to extract from raw event if available
        const mapInterface = this.mapInterface;
        if (event.originalEvent && mapInterface && typeof mapInterface.getCoordinateFromPixel === 'function') {
          // Try to convert from pixel coordinates if map interface supports it
          const pixel = {
            x: event.originalEvent.clientX,
            y: event.originalEvent.clientY,
          };
          coordinate = mapInterface.getCoordinateFromPixel(pixel);
        }
      }
      
      // Validate the coordinate
      if (!coordinate || typeof coordinate.lat !== 'number' || typeof coordinate.lng !== 'number') {
        console.error('Could not extract valid coordinate from mouse move event');
        return;
      }
      
      // Store the validated coordinate
      this.workingData.mousePosition = coordinate;
      
      // Debug logging for tracking mouse position
      if (this.options.mode === 'line' || this.options.mode === 'polygon') {
        console.debug(`Mouse position: ${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}`);
      }
      
      // Handle freehand drawing
      if (this.options.mode === 'freehand' && this.workingData.isDragging) {
        this._handleFreehandDrawing(coordinate);
      }
      
      // Update preview for line/polygon
      if ((this.options.mode === 'line' || this.options.mode === 'polygon') && 
          this.workingData.activeFeature && 
          this.workingData.vertices.length > 0) {
        // Call the enhanced _updatePreview method
        this._updatePreview();
      }
    } catch (error) {
      console.error('Error handling mouse move event:', error);
    }
  }
  
  /**
   * Handle map double click events
   * @param {Object} event - The map double click event
   * @private
   */
  _handleMapDoubleClick(event) {
    // Prevent default browser behavior if possible
    if (event.originalEvent && typeof event.originalEvent.preventDefault === 'function') {
      event.originalEvent.preventDefault();
    }
    
    console.log(`Double click detected in ${this.options.mode} mode, continuousDrawing=${this.options.continuousDrawing}`);
    
    // Get coordinate, preferring snapped points if available
    let coordinate;
    if (this.manager.snappingManager && this.manager.snappingManager.getSnapPoint()) {
      // Use the snapped coordinate for the final vertex
      const snap = this.manager.snappingManager.getSnapPoint();
      coordinate = snap.coordinate;
      console.log('Using snapped coordinate for final vertex:', coordinate);
    } else if (event.coordinate) {
      coordinate = event.coordinate;
    }
    
    // Add the final vertex at the current location before completing the drawing
    if (coordinate && (this.options.mode === 'line' || this.options.mode === 'polygon')) {
      console.log('Adding final vertex at double-click location');
      this._addVertex(coordinate);
    }
    
    // Complete drawing for line/polygon if we have enough vertices
    if ((this.options.mode === 'line' && this.workingData.vertices.length >= 2) ||
        (this.options.mode === 'polygon' && this.workingData.vertices.length >= 3)) {
      
      console.log(`Completing ${this.options.mode} with ${this.workingData.vertices.length} vertices`);
      
      // Complete the current drawing, which will respect the continuousDrawing option
      this._completeDrawing();
    } else {
      console.log(`Not enough vertices to complete ${this.options.mode} drawing`);
    }
  }
  
  /**
   * Handle map right click events
   * @param {Object} event - The map right click event
   * @private
   */
  _handleMapRightClick(event) {
    // Prevent default context menu if possible
    if (event.originalEvent && typeof event.originalEvent.preventDefault === 'function') {
      event.originalEvent.preventDefault();
    }
    
    console.log(`Right click detected in ${this.options.mode} mode, continuousDrawing=${this.options.continuousDrawing}`);
    
    // For line/polygon mode in the right conditions, complete the drawing
    if ((this.options.mode === 'line' && this.workingData.vertices.length >= 1) ||
        (this.options.mode === 'polygon' && this.workingData.vertices.length >= 2)) {
      
      // Don't add the right-click point as a vertex, just finish with existing vertices
      console.log(`Completing ${this.options.mode} with ${this.workingData.vertices.length} vertices via right-click`);
      
      // We only complete if we have enough vertices
      if ((this.options.mode === 'line' && this.workingData.vertices.length >= 2) ||
          (this.options.mode === 'polygon' && this.workingData.vertices.length >= 3)) {
        this._completeDrawing();
      } else {
        // Not enough vertices yet, just cancel
        console.log(`Not enough vertices to complete ${this.options.mode}, canceling drawing`);
        this._startNewDrawing();
      }
    } else {
      // Otherwise cancel the drawing
      console.log(`Canceling drawing and starting new ${this.options.mode} feature`);
      this._startNewDrawing();
    }
  }
  
  /**
   * Handle map mouse down events
   * @param {Object} event - The map mousedown event
   * @private
   */
  _handleMapMouseDown(event) {
    // Start freehand drawing - check if originalEvent exists and has a button property
    if (this.options.mode === 'freehand' && 
        event.originalEvent && 
        typeof event.originalEvent.button === 'number' && 
        event.originalEvent.button === 0) {
      this.workingData.isDragging = true;
      
      // Get coordinate, preferring snapped points if available
      let coordinate;
      if (this.manager.snappingManager && this.manager.snappingManager.getSnapPoint()) {
        // Use the snapped coordinate for the first point
        const snap = this.manager.snappingManager.getSnapPoint();
        coordinate = snap.coordinate;
        console.log('Using snapped coordinate for freehand start:', coordinate);
      } else if (event.coordinate) {
        coordinate = event.coordinate;
      }
      
      // Add the first point if coordinate is valid
      if (coordinate) {
        this._addFreehandPoint(coordinate);
      }
    }
  }
  
  /**
   * Handle map mouse up events
   * @param {Object} event - The map mouseup event
   * @private
   */
  _handleMapMouseUp(_event) {
    // End freehand drawing
    if (this.options.mode === 'freehand' && this.workingData.isDragging) {
      this.workingData.isDragging = false;
      
      // Complete the drawing if we have enough points
      if (this.workingData.activeFeature) {
        const coordinates = this.workingData.activeFeature.getCoordinates();
        if (coordinates.length >= 2) {
          this._completeDrawing();
        } else {
          // Not enough points, reset
          this._startNewDrawing();
        }
      }
    }
  }
  
  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  _handleKeyDown(event) {
    // Handle Escape key
    if (event.key === 'Escape') {
      console.log('Escape key pressed, canceling current drawing');
      // Cancel drawing
      this._startNewDrawing();
    }
    
    // Handle Enter key
    if (event.key === 'Enter') {
      console.log(`Enter key pressed in ${this.options.mode} mode, continuousDrawing=${this.options.continuousDrawing}`);
      
      // Add current mouse position as final vertex if available and in appropriate mode
      if ((this.options.mode === 'line' || this.options.mode === 'polygon') && 
          this.workingData.vertices.length > 0) {
          
        // Get coordinate, preferring snapped points if available
        let finalCoordinate = this.workingData.mousePosition;
        if (this.manager.snappingManager && this.manager.snappingManager.getSnapPoint()) {
          // Use the snapped coordinate for the final vertex
          const snap = this.manager.snappingManager.getSnapPoint();
          finalCoordinate = snap.coordinate;
          console.log('Using snapped coordinate for final vertex (Enter key):', finalCoordinate);
        }
        
        if (finalCoordinate) {
          console.log('Adding final vertex at current position');
          this._addVertex(finalCoordinate);
        }
      }
      
      // Complete drawing if possible
      if ((this.options.mode === 'line' && this.workingData.vertices.length >= 2) ||
          (this.options.mode === 'polygon' && this.workingData.vertices.length >= 3)) {
        console.log(`Completing ${this.options.mode} with ${this.workingData.vertices.length} vertices via Enter key`);
        this._completeDrawing();
      } else {
        console.log(`Not enough vertices to complete ${this.options.mode} drawing`);
      }
    }
    
    // Handle Backspace/Delete key
    if (event.key === 'Backspace' || event.key === 'Delete') {
      console.log('Backspace/Delete key pressed, removing last vertex');
      // Remove the last vertex
      this._removeLastVertex();
    }
  }
  
  /**
   * Create a point feature at the specified coordinate
   * @param {Object} coordinate - The coordinate for the point
   * @private
   */
  _createPoint(coordinate) {
    try {
      // Create point feature - ensure coordinate is properly formatted
      // Import the Coordinate class from Survey.Core - available from the module import
      let validCoord;
      
      // Check if coordinate is already a Coordinate instance
      if (coordinate instanceof Coordinate) {
        validCoord = coordinate;
      } else if (coordinate && typeof coordinate.lat === 'number' && typeof coordinate.lng === 'number') {
        // Create a proper Coordinate object from coordinate-like object
        validCoord = new Coordinate(
          coordinate.lat,
          coordinate.lng,
          coordinate.elevation !== undefined ? coordinate.elevation : 0,
        );
      } else {
        console.error('Invalid coordinate provided:', coordinate);
        throw new Error('Invalid coordinate');
      }
      
      // Create the point style object
      const pointStyle = {
        ...this.options.pointSymbol,
        // Use dual marker for points by default for better visual cues
        // This shows both a pin and a dot at the exact location
        useDualMarker: true,
      };
      
      // Create a unique ID for debugging purposes
      const pointId = `point-${Date.now()}`;

      const pointFeature = new PointFeature(validCoord, {
        id: pointId,
        properties: {
          type: 'drawing',
          drawingType: 'point',
          temporary: false,
        },
        style: pointStyle,
      });

      // Enhanced debugging for point creation
      console.log('---------- POINT CREATION ----------');
      console.log(`Created point with ID: ${pointId}`);
      console.log(`At exact coordinate: ${validCoord.lat.toFixed(8)}, ${validCoord.lng.toFixed(8)}`);
      console.log(`Using style: ${JSON.stringify(pointStyle)}`);
      console.log('------------------------------------');
      
      // Apply 3D elevation if enabled
      if (this.options.enable3D) {
        this.manager.applyElevationData(pointFeature);
      }
      
      // Add to features collection
      this.manager.features.addFeature(pointFeature);
      
      // Emit event
      this.emit('pointCreated', pointFeature);
      
      // Always maintain the tool active if continuous drawing is enabled
      if (this.options.continuousDrawing) {
        console.log('Continuous drawing enabled, keeping tool active - NO deactivation will occur');
        // We don't need to do anything here - tool remains active
      } else {
        console.log('Continuous drawing disabled, tool will be deactivated');
        // Schedule deactivation for a bit later to avoid race conditions
        // Using a slightly longer timeout to ensure any event propagation completes
        setTimeout(() => {
          console.log('Now deactivating tool (continuousDrawing=false)');
          this.manager.deactivateActiveTool();
        }, 50);
      }
      
      return pointFeature;
    } catch (error) {
      console.error('Error creating point feature:', error);
      
      // Avoid deactivating the tool on error to allow retrying
      return null;
    }
  }
  
  /**
   * Add a vertex to the active line or polygon
   * @param {Object} coordinate - The coordinate to add
   * @private
   */
  _addVertex(coordinate) {
    try {
      if (!this.workingData.activeFeature) {
        console.log('No active feature found when trying to add vertex');
        // Start a new drawing if there's no active feature
        this._startNewDrawing();
        if (!this.workingData.activeFeature) {
          console.error('Failed to create new feature for drawing');
          return;
        }
      }
      
      // Process coordinate to ensure it's usable
      let validCoord;
      
      // Check if coordinate is already a proper Coordinate instance
      if (coordinate instanceof Coordinate) {
        validCoord = coordinate;
      } else if (coordinate && typeof coordinate.lat === 'number' && typeof coordinate.lng === 'number') {
        // Create a proper Coordinate object from coordinate-like object
        validCoord = new Coordinate(
          coordinate.lat,
          coordinate.lng,
          coordinate.elevation !== undefined ? coordinate.elevation : 0,
        );
      } else {
        console.error('Invalid coordinate provided:', coordinate);
        throw new Error('Invalid coordinate');
      }
      
      console.log(`Adding vertex at ${validCoord.lat}, ${validCoord.lng} to ${this.options.mode} feature`);
      
      // Create enhanced vertex style that's more visible
      const enhancedVertexStyle = {
        ...this.options.vertexSymbol,
        size: this.options.vertexSymbol.size || 8,
        color: this.options.vertexSymbol.color || '#3388FF',
        outlineWidth: this.options.vertexSymbol.outlineWidth || 2,
        outlineColor: this.options.vertexSymbol.outlineColor || 'white',
      };
      
      // Create vertex feature for visual feedback
      const vertexFeature = new PointFeature(validCoord, {
        id: `vertex-${Date.now()}-${this.workingData.vertices.length}`,
        properties: {
          type: 'vertex',
          drawingId: this.workingData.activeFeature.id,
          vertexIndex: this.workingData.vertices.length,
          temporary: true,
        },
        style: enhancedVertexStyle,
      });
      
      // Apply 3D elevation if enabled
      if (this.options.enable3D) {
        this.manager.applyElevationData(vertexFeature);
      }
      
      // Add vertex to working features and vertices array
      this.manager.workingFeatures.addFeature(vertexFeature);
      this.workingData.vertices.push(vertexFeature);
      
      // Update feature geometry based on type
      if (this.options.mode === 'line') {
        const coordinates = this.workingData.vertices.map(v => v.getCoordinate());
        console.log(`Setting line coordinates with ${coordinates.length} vertices`);
        this.workingData.activeFeature.setCoordinates(coordinates);
        
        // Make sure the feature is properly triggering an update event
        this.workingData.activeFeature.properties.lastUpdate = Date.now();
        
        // Notify the feature collection that this feature has been updated
        this.manager.workingFeatures.updateFeature(this.workingData.activeFeature);
        
      } else if (this.options.mode === 'polygon') {
        const coordinates = this.workingData.vertices.map(v => v.getCoordinate());
        console.log(`Setting polygon coordinates with ${coordinates.length} vertices`);
        
        try {
          // First try using setRings method (the preferred approach)
          if (typeof this.workingData.activeFeature.setRings === 'function') {
            this.workingData.activeFeature.setRings([coordinates]);
          } 
          // Fall back to setCoordinates if setRings is not available
          else if (typeof this.workingData.activeFeature.setCoordinates === 'function') {
            console.log('Falling back to setCoordinates for polygon');
            this.workingData.activeFeature.setCoordinates(coordinates);
          }
          else {
            console.error('Polygon feature has neither setRings nor setCoordinates methods');
          }
        } catch (error) {
          console.error('Error updating polygon coordinates:', error);
        }
        
        // Make sure the feature is properly triggering an update event
        this.workingData.activeFeature.properties.lastUpdate = Date.now();
        
        // Notify the feature collection that this feature has been updated
        this.manager.workingFeatures.updateFeature(this.workingData.activeFeature);
      }
      
      // After adding a vertex, ensure the preview is immediately updated
      this._updatePreview();
      
      // Emit event
      this.emit('vertexAdded', {
        feature: this.workingData.activeFeature,
        coordinate: validCoord,
        vertexIndex: this.workingData.vertices.length - 1,
      });
      
      // Log the current state of feature collection for debugging
      setTimeout(() => {
        const workingFeatureCount = this.manager.workingFeatures.getFeatureCount();
        console.log(`Working features count after adding vertex: ${workingFeatureCount}`);
        
        const lineFeatures = this.manager.workingFeatures.getFeaturesByType('line');
        const pointFeatures = this.manager.workingFeatures.getFeaturesByType('point');
        console.log(`Working features by type - Lines: ${lineFeatures.length}, Points: ${pointFeatures.length}`);
      }, 10);
      
    } catch (error) {
      console.error('Error adding vertex:', error);
      
      // Try to recover by starting a new drawing
      console.log('Attempting to recover by restarting the drawing');
      setTimeout(() => {
        this._startNewDrawing();
      }, 10);
    }
  }
  
  /**
   * Handle freehand drawing
   * @param {Object} coordinate - The current mouse coordinate
   * @private
   */
  _addFreehandPoint(coordinate) {
    if (!this.workingData.activeFeature) {
      return;
    }
    
    // Only add points that are a certain distance apart
    if (this.workingData.lastFreehandPoint) {
      const distance = this.geometryEngine.calculateDistance(
        this.workingData.lastFreehandPoint, 
        coordinate,
      );
      
      // Skip if too close to the last point
      if (distance < this.options.freehandSamplingInterval) {
        return;
      }
    }
    
    // Create a proper Coordinate object if needed
    let validCoord;
    if (coordinate instanceof Coordinate) {
      validCoord = coordinate;
    } else if (coordinate && typeof coordinate.lat === 'number' && typeof coordinate.lng === 'number') {
      validCoord = new Coordinate(
        coordinate.lat,
        coordinate.lng,
        coordinate.elevation !== undefined ? coordinate.elevation : 0,
      );
    } else {
      console.error('Invalid coordinate for freehand drawing:', coordinate);
      return;
    }
    
    // Add the point to the feature
    const coordinates = this.workingData.activeFeature.getCoordinates();
    coordinates.push(validCoord);
    this.workingData.activeFeature.setCoordinates(coordinates);
    
    // Update the last freehand point with the validated coordinate
    this.workingData.lastFreehandPoint = validCoord;
    
    // Apply 3D elevation if enabled (periodically to avoid too many requests)
    if (this.options.enable3D && coordinates.length % 5 === 0) {
      this.manager.applyElevationData(this.workingData.activeFeature);
    }
  }
  
  /**
   * Handle ongoing freehand drawing
   * @param {Object} coordinate - The current mouse coordinate
   * @private
   */
  _handleFreehandDrawing(coordinate) {
    // Check if there's an active snap point before using raw coordinate
    let pointCoordinate = coordinate;
    if (this.manager.snappingManager && this.manager.snappingManager.getSnapPoint()) {
      // Use the snapped coordinate for the freehand point
      const snap = this.manager.snappingManager.getSnapPoint();
      pointCoordinate = snap.coordinate;
    }
    
    // Add the freehand point
    this._addFreehandPoint(pointCoordinate);
  }
  
  /**
   * Update the preview with the current mouse position
   * This ensures that the line or polygon being drawn shows a preview
   * that follows the mouse cursor in real-time
   * @private
   */
  _updatePreview() {
    if (!this.workingData.activeFeature || !this.workingData.mousePosition) {
      return;
    }
    
    // Get the coordinates of all existing vertices
    const vertices = this.workingData.vertices.map(v => v.getCoordinate());
    
    // Ensure the mousePosition is a proper Coordinate object
    const mouseCoordinate = this.workingData.mousePosition;
    
    // Handle line preview
    if (this.options.mode === 'line' && vertices.length > 0) {
      // For lines, show a preview from the last vertex to the mouse position
      const previewCoords = [...vertices, mouseCoordinate];
      
      console.log(`Updating line preview with ${previewCoords.length} points, last point: ${mouseCoordinate.lat}, ${mouseCoordinate.lng}`);
      
      // Apply the new coordinates to the feature
      this.workingData.activeFeature.setCoordinates(previewCoords);
      
      // Make sure the feature is properly triggering an update event
      // by modifying a property to force an update if the coordinates didn't change
      this.workingData.activeFeature.properties.lastPreviewUpdate = Date.now();
      
      // Notify the feature collection that this feature has been updated
      this.manager.workingFeatures.updateFeature(this.workingData.activeFeature);
    } 
    // Handle polygon preview
    else if (this.options.mode === 'polygon' && vertices.length > 1) {
      // For polygons, show a preview loop from last vertex to mouse position and back to first vertex
      let previewCoords = [...vertices, mouseCoordinate];
      
      // Explicitly close the polygon by adding the first vertex at the end
      // This ensures Google Maps won't add an extra segment automatically
      if (vertices.length > 0) {
        previewCoords = [...previewCoords, vertices[0]];
      }
      
      console.log(`Updating polygon preview with ${previewCoords.length} points, explicitly closed, last point: ${mouseCoordinate.lat}, ${mouseCoordinate.lng}`);
      
      // Apply the new coordinates to the feature
      this.workingData.activeFeature.setRings([previewCoords]);
      
      // Make sure the feature is properly triggering an update event
      this.workingData.activeFeature.properties.lastPreviewUpdate = Date.now();
      
      // Notify the feature collection that this feature has been updated
      this.manager.workingFeatures.updateFeature(this.workingData.activeFeature);
    }
  }
  
  /**
   * Remove the last vertex from the drawing
   * @private
   */
  _removeLastVertex() {
    if (this.workingData.vertices.length === 0) {
      return;
    }
    
    // Remove the last vertex
    const lastVertex = this.workingData.vertices.pop();
    this.manager.workingFeatures.removeFeature(lastVertex);
    
    // Update feature geometry
    if (this.options.mode === 'line') {
      const coordinates = this.workingData.vertices.map(v => v.getCoordinate());
      this.workingData.activeFeature.setCoordinates(coordinates);
    } else if (this.options.mode === 'polygon') {
      let coordinates = this.workingData.vertices.map(v => v.getCoordinate());
      
      // For polygons, explicitly close the ring by adding the first vertex at the end
      // if we have at least one vertex
      if (coordinates.length > 0) {
        coordinates = [...coordinates, coordinates[0]];
      }
      
      this.workingData.activeFeature.setRings([coordinates]);
    }
    
    // Update preview
    this._updatePreview();
    
    // Emit event
    this.emit('vertexRemoved', {
      feature: this.workingData.activeFeature,
      vertexCount: this.workingData.vertices.length,
    });
  }
  
  /**
   * Complete the current drawing
   * @private
   */
  _completeDrawing() {
    if (!this.workingData.activeFeature) {
      console.log('No active feature to complete');
      return;
    }
    
    let finalFeature;
    
    switch (this.options.mode) {
    case 'line':
      // Need at least 2 vertices for a valid line
      if (this.workingData.vertices.length < 2) {
        console.log('Not enough vertices for a line (need at least 2)');
        this._startNewDrawing();
        return;
      }
        
      // Create final line feature
      const lineCoordinates = this.workingData.vertices.map(v => v.getCoordinate());
      console.log(`Creating final line feature with ${lineCoordinates.length} vertices`);
        
      try {
        // Using the existing feature to create the final one
        this.workingData.activeFeature.properties.temporary = false;
        this.workingData.activeFeature.properties.isPreview = false;
        this.workingData.activeFeature.setCoordinates(lineCoordinates);
          
        // Change from preview style to final style
        this.workingData.activeFeature.style = this.options.lineSymbol;
          
        // Set a more descriptive name for the line
        const firstCoord = lineCoordinates[0];
        const lastCoord = lineCoordinates[lineCoordinates.length - 1];
          
        // Format the coordinates for the name (rounded to 5 decimal places)
        const startLat = firstCoord.lat.toFixed(5);
        const startLng = firstCoord.lng.toFixed(5);
        const endLat = lastCoord.lat.toFixed(5);
        const endLng = lastCoord.lng.toFixed(5);
          
        this.workingData.activeFeature.setName(`Line from (${startLat}, ${startLng}) to (${endLat}, ${endLng})`);
          
        finalFeature = this.workingData.activeFeature;
          
        // Remove this feature from working features since we'll add it to permanent features
        this.manager.workingFeatures.removeFeature(finalFeature);
      } catch (error) {
        console.error('Error finalizing line feature:', error);
        this._startNewDrawing();
        return;
      }
      break;
        
    case 'polygon':
      // Need at least 3 vertices for a valid polygon
      if (this.workingData.vertices.length < 3) {
        console.log('Not enough vertices for a polygon (need at least 3)');
        this._startNewDrawing();
        return;
      }
        
      // Create final polygon feature
      let polygonCoordinates = this.workingData.vertices.map(v => v.getCoordinate());
        
      // Ensure the polygon is closed (first vertex is the same as last vertex)
      if (polygonCoordinates.length > 0) {
        // Explicitly close the polygon by adding the first vertex again
        polygonCoordinates = [...polygonCoordinates, polygonCoordinates[0]];
      }
        
      console.log(`Creating final polygon feature with ${polygonCoordinates.length} vertices (including closing vertex)`);
        
      try {
        // Create a new polygon instance with the collected coordinates
        finalFeature = new PolygonFeature(polygonCoordinates, {
          id: `polygon-${Date.now()}`,
          properties: {
            type: 'drawing',
            drawingType: 'polygon',
            temporary: false,
            isPreview: false,
          },
          style: this.options.polygonSymbol,
        });
          
        // Set a descriptive name for the polygon
        try {
          const center = finalFeature.getCenter();
          if (center) {
            const centerLat = center.lat.toFixed(5);
            const centerLng = center.lng.toFixed(5);
            finalFeature.setName(`Polygon at (${centerLat}, ${centerLng})`);
          } else {
            finalFeature.setName(`Polygon with ${polygonCoordinates.length} vertices`);
          }
        } catch (/* eslint-disable-line no-unused-vars */ error) {
          // Fallback naming if there's any issue getting the center
          finalFeature.setName(`Polygon with ${polygonCoordinates.length} vertices`);
        }
          
        // Remove the preview features from working features collection
        this.manager.workingFeatures.removeFeature(this.workingData.activeFeature);
          
        // Also remove all vertex features from working features
        this.workingData.vertices.forEach(vertex => {
          this.manager.workingFeatures.removeFeature(vertex);
        });
      } catch (error) {
        console.error('Error finalizing polygon feature:', error);
        this._startNewDrawing();
        return;
      }
      break;
        
    case 'freehand':
      // Need at least 2 points for a valid freehand line
      const freehandCoords = this.workingData.activeFeature.getCoordinates();
      if (freehandCoords.length < 2) {
        console.log('Not enough points for a freehand line (need at least 2)');
        this._startNewDrawing();
        return;
      }
        
      // Create final feature based on geometry
      console.log(`Creating final freehand feature with ${freehandCoords.length} vertices`);
        
      try {
        // Using the existing feature for the final feature
        this.workingData.activeFeature.properties.temporary = false;
        this.workingData.activeFeature.properties.isPreview = false;
          
        // Change from preview style to final style
        this.workingData.activeFeature.style = this.options.lineSymbol;
          
        // Set a descriptive name for the freehand line
        const firstCoord = freehandCoords[0];
        const lastCoord = freehandCoords[freehandCoords.length - 1];
          
        const startLat = firstCoord.lat.toFixed(5);
        const startLng = firstCoord.lng.toFixed(5);
        const endLat = lastCoord.lat.toFixed(5);
        const endLng = lastCoord.lng.toFixed(5);
          
        this.workingData.activeFeature.setName(`Freehand line from (${startLat}, ${startLng}) to (${endLat}, ${endLng})`);
          
        finalFeature = this.workingData.activeFeature;
          
        // Remove this feature from working features since we'll add it to permanent features
        this.manager.workingFeatures.removeFeature(finalFeature);
      } catch (error) {
        console.error('Error finalizing freehand feature:', error);
        this._startNewDrawing();
        return;
      }
      break;
    }
    
    if (finalFeature) {
      // Apply 3D elevation if enabled
      if (this.options.enable3D) {
        this.manager.applyElevationData(finalFeature);
      }
      
      // Make sure the feature is no longer temporary
      finalFeature.properties.temporary = false;
      
      // Set the feature ID to be a specific type
      const featureType = this.options.mode === 'freehand' ? 'line' : this.options.mode;
      finalFeature.id = `${featureType}-${Date.now()}`;
      
      // Add to features collection and log success
      console.log(`Adding completed ${this.options.mode} feature to collection with ID ${finalFeature.id}`);
      console.log('Feature details:', {
        type: finalFeature.type,
        id: finalFeature.id,
        coordinates: finalFeature.getCoordinates ? finalFeature.getCoordinates() : null,
        name: finalFeature.name,
        properties: finalFeature.properties,
      });
      
      this.manager.features.addFeature(finalFeature);
      
      // Verify the feature was added correctly
      setTimeout(() => {
        const featureCount = this.manager.features.getFeatureCount();
        const lineFeatures = this.manager.features.getFeaturesByType('line');
        console.log(`Total features after adding: ${featureCount}, Line features: ${lineFeatures.length}`);
      }, 100);
      
      // Emit event
      this.emit('drawingCompleted', finalFeature);
      
      // Handle tool state based on continuousDrawing setting
      if (!this.options.continuousDrawing) {
        console.log('Continuous drawing disabled, scheduling tool deactivation');
        // Use setTimeout with longer delay to avoid race conditions with event handling
        setTimeout(() => {
          console.log('Now deactivating tool after completing drawing (continuousDrawing=false)');
          this.manager.deactivateActiveTool();
        }, 50);
      } else {
        // Start a new drawing immediately if in continuous mode
        console.log('Continuous drawing enabled, starting new drawing');
        // Use setTimeout to ensure other events are processed first
        setTimeout(() => {
          this._startNewDrawing();
          console.log('New drawing started in continuous mode');
        }, 10);
      }
    } else {
      console.error('Failed to create final feature');
      // Start a new drawing to recover from the error
      this._startNewDrawing();
    }
  }
  
  /**
   * Set the drawing mode
   * @param {string} mode - The drawing mode (point, line, polygon, freehand)
   * @returns {boolean} Success of mode change
   */
  setMode(mode) {
    if (!['point', 'line', 'polygon', 'freehand'].includes(mode)) {
      console.error(`Invalid drawing mode: ${mode}`);
      return false;
    }
    
    // If we're already in the same mode, complete the current drawing if possible
    if (this.options.mode === mode) {
      return this.tryCompleteCurrentDrawing();
    }
    
    // Finish current drawing if any
    if (this.workingData.activeFeature) {
      if ((this.options.mode === 'line' && this.workingData.vertices.length >= 2) ||
          (this.options.mode === 'polygon' && this.workingData.vertices.length >= 3) ||
          (this.options.mode === 'freehand' && this.workingData.activeFeature.getCoordinates().length >= 2)) {
        this._completeDrawing();
      } else {
        this._clearActiveDrawing();
      }
    }
    
    // Update mode
    this.options.mode = mode;
    
    // Start new drawing with new mode
    this._startNewDrawing();
    
    // Emit event
    this.emit('modeChanged', { mode });
    
    return true;
  }
  
  /**
   * Try to complete the current drawing if there are enough vertices
   * This is useful for finalizing a polygon or line when the user clicks the tool again
   * @returns {boolean} True if a drawing was completed, false otherwise
   */
  tryCompleteCurrentDrawing() {
    // Check if we have an active drawing with enough vertices
    if (this.workingData.activeFeature) {
      if ((this.options.mode === 'line' && this.workingData.vertices.length >= 2) ||
          (this.options.mode === 'polygon' && this.workingData.vertices.length >= 3) ||
          (this.options.mode === 'freehand' && this.workingData.activeFeature.getCoordinates().length >= 2)) {
        console.log(`Completing ${this.options.mode} drawing with ${this.workingData.vertices.length} vertices via tool button click`);
        this._completeDrawing();
        return true;
      } else {
        console.log(`Not enough vertices to complete ${this.options.mode} drawing`);
        // Not enough vertices, just start over
        this._startNewDrawing();
      }
    } else {
      // No active feature, create a new one
      this._startNewDrawing();
    }
    
    return false;
  }
  
  /**
   * Set continuous drawing mode
   * @param {boolean} enable - Whether to enable continuous drawing
   * @returns {boolean} New state of continuous drawing mode
   */
  setContinuousDrawing(enable) {
    this.options.continuousDrawing = !!enable;
    
    // Emit event
    this.emit('continuousDrawingChanged', {
      continuousDrawing: this.options.continuousDrawing,
    });
    
    return this.options.continuousDrawing;
  }
  
  /**
   * Set 3D drawing mode
   * @param {boolean} enable - Whether to enable 3D drawing
   * @returns {boolean} New state of 3D drawing mode
   */
  setEnable3D(enable) {
    this.options.enable3D = !!enable;
    
    // Emit event
    this.emit('enable3DChanged', {
      enable3D: this.options.enable3D,
    });
    
    return this.options.enable3D;
  }
  
  /**
   * Set the freehand sampling interval
   * @param {number} interval - The interval in meters
   * @returns {number} The updated interval
   */
  setFreehandSamplingInterval(interval) {
    if (isNaN(interval) || interval <= 0) {
      console.error('Invalid sampling interval. Must be a positive number.');
      return this.options.freehandSamplingInterval;
    }
    
    this.options.freehandSamplingInterval = interval;
    
    // Emit event
    this.emit('freehandSamplingIntervalChanged', {
      interval: this.options.freehandSamplingInterval,
    });
    
    return this.options.freehandSamplingInterval;
  }
  
  /**
   * Get the current drawing settings
   * @returns {Object} Current drawing settings
   */
  getSettings() {
    return {
      mode: this.options.mode,
      enable3D: this.options.enable3D,
      continuousDrawing: this.options.continuousDrawing,
      freehandSamplingInterval: this.options.freehandSamplingInterval,
    };
  }
}

/**
 * EditingTool.js
 * Tool for editing features with 3D vertex manipulation
 * Part of the RTK Surveyor 3D-first implementation
 */


/**
 * @typedef {Object} EditingToolOptions
 * @property {boolean} [enable3D=true] - Whether to enable 3D editing
 * @property {number} [vertexDistanceTolerance=10] - Pixel distance tolerance for selecting vertices
 * @property {boolean} [allowVertexAddition=true] - Whether to allow adding new vertices to lines/polygons
 * @property {boolean} [allowVertexDeletion=true] - Whether to allow deleting vertices from lines/polygons
 * @property {Object} [vertexSymbol] - Symbol for regular vertices
 * @property {Object} [selectedVertexSymbol] - Symbol for selected vertices
 * @property {Object} [insertionVertexSymbol] - Symbol for insertion points
 * @property {Object} [lineSymbol] - Symbol for selected lines
 * @property {Object} [polygonSymbol] - Symbol for selected polygons
 */

/**
 * Tool for editing survey features
 * Supports full 3D vertex manipulation and geometry editing
 */
class EditingTool extends ToolBase {
  /**
   * Create a new EditingTool instance
   * @param {Object} options - Tool configuration options
   */
  constructor(options = {}) {
    super(options);
    
    // Initialize tool-specific options with defaults
    this.options = Object.assign({
      enable3D: true,
      vertexDistanceTolerance: 10, // pixels
      allowVertexAddition: true,
      allowVertexDeletion: true,
      snapToTerrain: true,
      dragDistanceThreshold: 3, // pixels
      vertexSymbol: {
        type: 'circle',
        size: 8,
        color: '#3388FF',
        outlineWidth: 1,
        outlineColor: 'white',
      },
      selectedVertexSymbol: {
        type: 'circle',
        size: 10,
        color: '#FF5733',
        outlineWidth: 2,
        outlineColor: 'white',
      },
      insertionVertexSymbol: {
        type: 'circle',
        size: 6,
        color: 'rgba(51, 136, 255, 0.5)',
        outlineWidth: 1,
        outlineColor: '#3388FF',
      },
      lineSymbol: Object.assign({}, this.manager.settings.defaultLineSymbol, {
        width: 4,
        color: '#3388FF',
      }),
      polygonSymbol: Object.assign({}, this.manager.settings.defaultPolygonSymbol, {
        outlineWidth: 3,
        outlineColor: '#3388FF',
      }),
    }, options);
    
    // Initialize internal state
    this.workingData = {
      targetFeature: null,
      originalFeature: null,
      vertices: [],
      insertionVertices: [],
      selectedVertex: null,
      isDragging: false,
      dragStartPosition: null,
      mousePosition: null,
      operationMode: 'none', // none, move, add, delete
      operationComplete: false,
      draggedDistance: 0,
      snapTargets: [],
    };
    
    // Bind event handlers to maintain 'this' context
    this._handleMapClick = this._handleMapClick.bind(this);
    this._handleMapMouseMove = this._handleMapMouseMove.bind(this);
    this._handleMapDoubleClick = this._handleMapDoubleClick.bind(this);
    this._handleMapRightClick = this._handleMapRightClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleMapMouseDown = this._handleMapMouseDown.bind(this);
    this._handleMapMouseUp = this._handleMapMouseUp.bind(this);
    this._handleFeatureSelected = this._handleFeatureSelected.bind(this);
  }
  
  /**
   * Set up tool-specific event listeners
   * @protected
   * @override
   */
  _setupEventListeners() {
    // Listen for feature selection from the manager
    this.manager.on('featureSelected', this._handleFeatureSelected);
    
    // Listen for feature changes
    this.manager.features.on('featureUpdated', feature => {
      // If we're editing this feature, update our vertex controls
      if (this.workingData.targetFeature && 
          this.workingData.targetFeature.id === feature.id) {
        this._updateVertexControls();
      }
    });
  }
  
  /**
   * Tool-specific activation logic
   * @protected
   * @override
   */
  _activate() {
    // Add map event listeners
    this.mapInterface.addEventListener('click', this._handleMapClick);
    this.mapInterface.addEventListener('mousemove', this._handleMapMouseMove);
    this.mapInterface.addEventListener('dblclick', this._handleMapDoubleClick);
    this.mapInterface.addEventListener('contextmenu', this._handleMapRightClick);
    this.mapInterface.addEventListener('mousedown', this._handleMapMouseDown);
    this.mapInterface.addEventListener('mouseup', this._handleMapMouseUp);
    
    // Add keyboard event listeners
    document.addEventListener('keydown', this._handleKeyDown);
    
    // Set initial state
    this.workingData.operationMode = 'none';
    
    // Look for currently selected feature
    const selectedFeatures = this.manager.getSelectedFeatures();
    if (selectedFeatures.length === 1) {
      this._startEditingFeature(selectedFeatures[0]);
    }
    
    // Emit activation event
    this.emit('activated', {
      enable3D: this.options.enable3D,
      targetFeature: this.workingData.targetFeature,
    });
  }
  
  /**
   * Tool-specific deactivation logic
   * @protected
   * @override
   */
  _deactivate() {
    // Remove map event listeners
    this.mapInterface.removeEventListener('click', this._handleMapClick);
    this.mapInterface.removeEventListener('mousemove', this._handleMapMouseMove);
    this.mapInterface.removeEventListener('dblclick', this._handleMapDoubleClick);
    this.mapInterface.removeEventListener('contextmenu', this._handleMapRightClick);
    this.mapInterface.removeEventListener('mousedown', this._handleMapMouseDown);
    this.mapInterface.removeEventListener('mouseup', this._handleMapMouseUp);
    
    // Remove keyboard event listeners
    document.removeEventListener('keydown', this._handleKeyDown);
    
    // Complete any in-progress editing
    this._completeEditing();
    
    // Clear vertex controls
    this._clearVertexControls();
    
    // Reset state
    this.workingData.targetFeature = null;
    this.workingData.originalFeature = null;
    this.workingData.operationMode = 'none';
  }
  
  /**
   * Tool-specific reset logic
   * @protected
   * @override
   */
  _reset() {
    // Complete any in-progress editing
    this._completeEditing();
    
    // Reset for next operation
    this.workingData.operationMode = 'none';
    this.workingData.selectedVertex = null;
    this.workingData.isDragging = false;
    this.workingData.operationComplete = false;
    
    // Keep the target feature, just update the vertex controls
    if (this.workingData.targetFeature) {
      this._updateVertexControls();
    }
  }
  
  /**
   * Handle map click events
   * @param {Object} event - The map click event
   * @private
   */
  _handleMapClick(event) {
    // Skip if already dragging
    if (this.workingData.isDragging) {
      return;
    }
    
    const coordinate = event.coordinate;
    const screenPosition = event.pixel;
    
    // If we don't have a target feature, try to select one
    if (!this.workingData.targetFeature) {
      this._selectFeatureAtPosition(coordinate, screenPosition);
      return;
    }
    
    // If we have a target but no operation mode, check if we're clicking a vertex
    if (this.workingData.operationMode === 'none') {
      // Check for vertex selection first
      const vertex = this._findVertexAtPosition(screenPosition);
      if (vertex) {
        this._selectVertex(vertex);
        return;
      }
      
      // Check for insertion point selection
      if (this.options.allowVertexAddition) {
        const insertionVertex = this._findInsertionVertexAtPosition(screenPosition);
        if (insertionVertex) {
          this._addVertexAtInsertion(insertionVertex);
          return;
        }
      }
      
      // If we clicked the feature but not on a vertex, select for move
      if (this._isPositionOnFeature(coordinate, screenPosition)) {
        // Set mode to move the entire feature
        this.workingData.operationMode = 'move';
        this.workingData.dragStartPosition = coordinate;
        
        // Emit event
        this.emit('featureMoveStarted', {
          feature: this.workingData.targetFeature,
          coordinate: coordinate,
        });
        
        return;
      }
      
      // If we clicked elsewhere, deselect the feature
      this._stopEditingFeature();
    }
  }
  
  /**
   * Handle map mouse move events
   * @param {Object} event - The map mousemove event
   * @private
   */
  _handleMapMouseMove(event) {
    // Store mouse position
    this.workingData.mousePosition = event.coordinate;
    const screenPosition = event.pixel;
    
    // Handle drag operations
    if (this.workingData.isDragging) {
      this._handleDrag(event.coordinate, screenPosition);
      return;
    }
    
    // Update UI feedback based on what's under the cursor
    if (this.workingData.targetFeature) {
      // Check for hover over vertices
      const vertex = this._findVertexAtPosition(screenPosition);
      if (vertex) {
        // Highlight the vertex
        this._highlightVertex(vertex);
        this.mapInterface.setCursor('pointer');
        return;
      }
      
      // Check for hover over insertion points
      if (this.options.allowVertexAddition) {
        const insertionVertex = this._findInsertionVertexAtPosition(screenPosition);
        if (insertionVertex) {
          // Highlight the insertion point
          this._highlightInsertionVertex(insertionVertex);
          this.mapInterface.setCursor('pointer');
          return;
        }
      }
      
      // Check if we're over the feature itself
      if (this._isPositionOnFeature(event.coordinate, screenPosition)) {
        this.mapInterface.setCursor('move');
        return;
      }
    }
    
    // Default cursor
    this.mapInterface.setCursor('default');
  }
  
  /**
   * Handle map double click events
   * @param {Object} event - The map double click event
   * @private
   */
  _handleMapDoubleClick(event) {
    // Prevent default browser behavior
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
    }
    
    // Currently no special behavior for double-click in the editing tool
  }
  
  /**
   * Handle map right click events
   * @param {Object} event - The map right click event
   * @private
   */
  _handleMapRightClick(event) {
    // Prevent default context menu
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
    }
    
    // If we have a selected vertex and deletion is allowed, delete it
    if (this.workingData.selectedVertex && this.options.allowVertexDeletion) {
      this._deleteSelectedVertex();
      return;
    }
    
    // If we right-click on the feature, complete editing
    if (this.workingData.targetFeature && 
        this._isPositionOnFeature(event.coordinate, event.pixel)) {
      this._completeEditing();
      return;
    }
    
    // Right-click elsewhere, stop editing
    this._stopEditingFeature();
  }
  
  /**
   * Handle map mouse down events
   * @param {Object} event - The map mousedown event
   * @private
   */
  _handleMapMouseDown(event) {
    // Only handle left mouse button
    if (event.originalEvent.button !== 0) {
      return;
    }
    
    // Start potential drag
    if (this.workingData.targetFeature) {
      const screenPosition = event.pixel;
      const coordinate = event.coordinate;
      
      // Check if we're on a vertex
      const vertex = this._findVertexAtPosition(screenPosition);
      if (vertex) {
        this._selectVertex(vertex);
        this.workingData.isDragging = true;
        this.workingData.dragStartPosition = coordinate;
        this.workingData.operationMode = 'moveVertex';
        this.workingData.draggedDistance = 0;
        
        // Emit event
        this.emit('vertexMoveStarted', {
          feature: this.workingData.targetFeature,
          vertexIndex: vertex.vertexIndex,
          coordinate: coordinate,
        });
        
        return;
      }
      
      // Check if we're on an insertion point
      if (this.options.allowVertexAddition) {
        const insertionVertex = this._findInsertionVertexAtPosition(screenPosition);
        if (insertionVertex) {
          // For insertion points, we add the vertex on click, not drag
          return;
        }
      }
      
      // Check if we're on the feature itself
      if (this._isPositionOnFeature(coordinate, screenPosition)) {
        this.workingData.isDragging = true;
        this.workingData.dragStartPosition = coordinate;
        this.workingData.operationMode = 'move';
        this.workingData.draggedDistance = 0;
        
        // Emit event
        this.emit('featureMoveStarted', {
          feature: this.workingData.targetFeature,
          coordinate: coordinate,
        });
      }
    }
  }
  
  /**
   * Handle map mouse up events
   * @param {Object} event - The map mouseup event
   * @private
   */
  _handleMapMouseUp(event) {
    // End any drag operation
    if (this.workingData.isDragging) {
      this.workingData.isDragging = false;
      
      // If we didn't drag far enough, treat it as a click
      if (this.workingData.draggedDistance < this.options.dragDistanceThreshold) {
        // For vertex, just keep it selected
        if (this.workingData.operationMode === 'moveVertex') {
          // Keep vertex selected, but clear drag state
          this.workingData.dragStartPosition = null;
        } else if (this.workingData.operationMode === 'move') {
          // For feature move, just clear drag state
          this.workingData.dragStartPosition = null;
        }
      } else {
        // Complete the drag operation
        if (this.workingData.operationMode === 'moveVertex') {
          // Emit event
          this.emit('vertexMoveCompleted', {
            feature: this.workingData.targetFeature,
            vertexIndex: this.workingData.selectedVertex.vertexIndex,
            coordinate: event.coordinate,
          });
        } else if (this.workingData.operationMode === 'move') {
          // Emit event
          this.emit('featureMoveCompleted', {
            feature: this.workingData.targetFeature,
            coordinate: event.coordinate,
          });
        }
        
        // Reset operation mode
        this.workingData.operationMode = 'none';
        this.workingData.dragStartPosition = null;
      }
    }
  }
  
  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - The keyboard event
   * @private
   */
  _handleKeyDown(event) {
    // Handle Escape key
    if (event.key === 'Escape') {
      if (this.workingData.isDragging) {
        // Cancel drag operation
        this._cancelDrag();
      } else if (this.workingData.selectedVertex) {
        // Deselect vertex
        this._deselectVertex();
      } else if (this.workingData.targetFeature) {
        // Cancel editing
        this._cancelEditing();
      }
    }
    
    // Handle Delete key
    if ((event.key === 'Delete' || event.key === 'Backspace') && 
        this.workingData.selectedVertex && 
        this.options.allowVertexDeletion) {
      this._deleteSelectedVertex();
    }
    
    // Handle Enter key
    if (event.key === 'Enter') {
      if (this.workingData.targetFeature) {
        this._completeEditing();
      }
    }
  }
  
  /**
   * Handle feature selection events
   * @param {Object} feature - The selected feature
   * @private
   */
  _handleFeatureSelected(feature) {
    if (!this.isActive) {
      return;
    }
    
    // If we're already editing a different feature, complete that edit first
    if (this.workingData.targetFeature && 
        this.workingData.targetFeature.id !== feature.id) {
      this._completeEditing();
    }
    
    // Start editing the selected feature
    this._startEditingFeature(feature);
  }
  
  /**
   * Start editing a feature
   * @param {Object} feature - The feature to edit
   * @private
   */
  _startEditingFeature(feature) {
    // Only allow editing certain feature types
    if (!['point', 'line', 'polygon'].includes(feature.type)) {
      console.warn('Cannot edit feature of type:', feature.type);
      return;
    }
    
    // Store original feature state for undo
    this.workingData.originalFeature = {
      id: feature.id,
      type: feature.type,
      data: feature.toGeoJSON(),
    };
    
    // Set as target feature
    this.workingData.targetFeature = feature;
    
    // Create vertex controls
    this._createVertexControls();
    
    // Reset operation state
    this.workingData.operationMode = 'none';
    this.workingData.selectedVertex = null;
    this.workingData.isDragging = false;
    
    // Apply editing styles to feature
    this._applyEditingStyle();
    
    // Emit event
    this.emit('editingStarted', {
      feature: feature,
      featureType: feature.type,
    });
  }
  
  /**
   * Stop editing the current feature
   * @private
   */
  _stopEditingFeature() {
    if (!this.workingData.targetFeature) {
      return;
    }
    
    // Clear vertex controls
    this._clearVertexControls();
    
    // Restore original style
    this._restoreOriginalStyle();
    
    // Get feature for event
    const feature = this.workingData.targetFeature;
    
    // Clear target feature
    this.workingData.targetFeature = null;
    this.workingData.originalFeature = null;
    this.workingData.selectedVertex = null;
    this.workingData.operationMode = 'none';
    
    // Emit event
    this.emit('editingStopped', {
      feature: feature,
    });
  }
  
  /**
   * Apply editing style to the target feature
   * @private
   */
  _applyEditingStyle() {
    if (!this.workingData.targetFeature) {
      return;
    }
    
    // Store original style
    this.workingData.originalStyle = this.workingData.targetFeature.getStyle();
    
    // Apply appropriate style based on feature type
    switch (this.workingData.targetFeature.type) {
    case 'point':
      // For points, we don't change the style
      break;
        
    case 'line':
      this.workingData.targetFeature.setStyle(this.options.lineSymbol);
      break;
        
    case 'polygon':
      this.workingData.targetFeature.setStyle(this.options.polygonSymbol);
      break;
    }
  }
  
  /**
   * Restore original style to the edited feature
   * @private
   */
  _restoreOriginalStyle() {
    if (!this.workingData.targetFeature || !this.workingData.originalStyle) {
      return;
    }
    
    // Restore the original style
    this.workingData.targetFeature.setStyle(this.workingData.originalStyle);
    this.workingData.originalStyle = null;
  }
  
  /**
   * Create vertex control points for the target feature
   * @private
   */
  _createVertexControls() {
    if (!this.workingData.targetFeature) {
      return;
    }
    
    // Clear any existing controls
    this._clearVertexControls();
    
    let vertices = [];
    
    // Create vertices based on feature type
    switch (this.workingData.targetFeature.type) {
    case 'point':
      // For points, create a single vertex
      const coordinate = this.workingData.targetFeature.getCoordinate();
      vertices.push(this._createVertexFeature(coordinate, 0));
      break;
        
    case 'line':
      // For lines, create vertices for each point
      const lineCoordinates = this.workingData.targetFeature.getCoordinates();
      vertices = lineCoordinates.map((coord, index) => 
        this._createVertexFeature(coord, index),
      );
        
      // Create insertion vertices for potential new points
      if (this.options.allowVertexAddition) {
        this._createInsertionVertices(lineCoordinates);
      }
      break;
        
    case 'polygon':
      // For polygons, create vertices for each point in each ring
      const rings = this.workingData.targetFeature.getRings();
      let vertexIndex = 0;
        
      rings.forEach((ring, ringIndex) => {
        // Don't create a vertex for the closing point (it's the same as the first)
        const ringVertices = ring.slice(0, -1).map((coord, pointIndex) => {
          const vertex = this._createVertexFeature(coord, vertexIndex, {
            ringIndex: ringIndex,
            pointIndex: pointIndex,
          });
          vertexIndex++;
          return vertex;
        });
          
        vertices = vertices.concat(ringVertices);
          
        // Create insertion vertices for potential new points
        if (this.options.allowVertexAddition) {
          this._createInsertionVertices(ring, ringIndex);
        }
      });
      break;
    }
    
    // Store vertices
    this.workingData.vertices = vertices;
    
    // Add vertices to the map
    vertices.forEach(vertex => {
      this.manager.workingFeatures.addFeature(vertex);
    });
    
    // Add insertion vertices to the map
    this.workingData.insertionVertices.forEach(vertex => {
      this.manager.workingFeatures.addFeature(vertex);
    });
  }
  
  /**
   * Update vertex control points for the target feature
   * @private
   */
  _updateVertexControls() {
    // Just recreate them
    this._createVertexControls();
  }
  
  /**
   * Clear all vertex control points
   * @private
   */
  _clearVertexControls() {
    // Remove all vertices from the map
    this.workingData.vertices.forEach(vertex => {
      this.manager.workingFeatures.removeFeature(vertex);
    });
    
    // Remove all insertion vertices from the map
    this.workingData.insertionVertices.forEach(vertex => {
      this.manager.workingFeatures.removeFeature(vertex);
    });
    
    // Clear arrays
    this.workingData.vertices = [];
    this.workingData.insertionVertices = [];
    this.workingData.selectedVertex = null;
  }
  
  /**
   * Create a vertex feature at the specified coordinate
   * @param {Object} coordinate - The coordinate for the vertex
   * @param {number} index - The index of the vertex
   * @param {Object} [metadata] - Additional metadata for the vertex
   * @returns {Object} The created vertex feature
   * @private
   */
  _createVertexFeature(coordinate, index, metadata = {}) {
    const vertexFeature = new PointFeature(coordinate, {
      id: `vertex-${this.workingData.targetFeature.id}-${index}`,
      properties: Object.assign({
        type: 'vertex',
        featureId: this.workingData.targetFeature.id,
        vertexIndex: index,
        isSelected: false,
        temporary: true,
      }, metadata),
      style: this.options.vertexSymbol,
    });
    
    return vertexFeature;
  }
  
  /**
   * Create insertion vertex features between existing vertices
   * @param {Array} coordinates - The coordinates to create insertion vertices for
   * @param {number} [ringIndex] - The ring index for polygon features
   * @private
   */
  _createInsertionVertices(coordinates, ringIndex = 0) {
    if (coordinates.length < 2) {
      return;
    }
    
    const insertionVertices = [];
    
    // For polygons, we need to include the closing segment
    const isClosed = this.workingData.targetFeature.type === 'polygon';
    const segmentCount = isClosed ? coordinates.length : coordinates.length - 1;
    
    for (let i = 0; i < segmentCount; i++) {
      const start = coordinates[i];
      const end = coordinates[(i + 1) % coordinates.length];
      
      // Calculate midpoint
      const midpoint = this.geometryEngine.interpolate(start, end, 0.5);
      
      // Create insertion vertex
      const insertionVertex = new PointFeature(midpoint, {
        id: `insertion-${this.workingData.targetFeature.id}-${ringIndex}-${i}`,
        properties: {
          type: 'insertionVertex',
          featureId: this.workingData.targetFeature.id,
          segmentIndex: i,
          ringIndex: ringIndex,
          startVertex: i,
          endVertex: (i + 1) % coordinates.length,
          temporary: true,
        },
        style: this.options.insertionVertexSymbol,
      });
      
      insertionVertices.push(insertionVertex);
    }
    
    // Add to insertion vertices array
    this.workingData.insertionVertices = this.workingData.insertionVertices.concat(insertionVertices);
  }
  
  /**
   * Find a vertex at the specified screen position
   * @param {Array} screenPosition - The screen position [x, y]
   * @returns {Object|null} The vertex feature or null if none found
   * @private
   */
  _findVertexAtPosition(screenPosition) {
    if (!this.workingData.targetFeature || this.workingData.vertices.length === 0) {
      return null;
    }
    
    // Find the closest vertex
    let closestVertex = null;
    let closestDistance = Infinity;
    
    for (const vertex of this.workingData.vertices) {
      try {
        const vertexScreenPos = this.mapInterface.coordinateToPixel(vertex.getCoordinate());
        
        // Check if vertexScreenPos is valid (not undefined or null)
        if (!vertexScreenPos || vertexScreenPos.length < 2) {
          console.warn('Invalid screen position for vertex:', vertex.id);
          continue;
        }
        
        const distance = Math.sqrt(
          Math.pow(vertexScreenPos[0] - screenPosition[0], 2) +
          Math.pow(vertexScreenPos[1] - screenPosition[1], 2),
        );
        
        if (distance <= this.options.vertexDistanceTolerance && distance < closestDistance) {
          closestVertex = vertex;
          closestDistance = distance;
        }
      } catch (error) {
        console.warn('Error calculating vertex screen position:', error);
      }
    }
    
    return closestVertex;
  }
  
  /**
   * Find an insertion vertex at the specified screen position
   * @param {Array} screenPosition - The screen position [x, y]
   * @returns {Object|null} The insertion vertex or null if none found
   * @private
   */
  _findInsertionVertexAtPosition(screenPosition) {
    if (!this.workingData.targetFeature || this.workingData.insertionVertices.length === 0) {
      return null;
    }
    
    // Find the closest insertion vertex
    let closestVertex = null;
    let closestDistance = Infinity;
    
    for (const vertex of this.workingData.insertionVertices) {
      try {
        const vertexScreenPos = this.mapInterface.coordinateToPixel(vertex.getCoordinate());
        
        // Check if vertexScreenPos is valid (not undefined or null)
        if (!vertexScreenPos || vertexScreenPos.length < 2) {
          console.warn('Invalid screen position for insertion vertex:', vertex.id);
          continue;
        }
        
        const distance = Math.sqrt(
          Math.pow(vertexScreenPos[0] - screenPosition[0], 2) +
          Math.pow(vertexScreenPos[1] - screenPosition[1], 2),
        );
        
        if (distance <= this.options.vertexDistanceTolerance && distance < closestDistance) {
          closestVertex = vertex;
          closestDistance = distance;
        }
      } catch (error) {
        console.warn('Error calculating insertion vertex screen position:', error);
      }
    }
    
    return closestVertex;
  }
  
  /**
   * Check if a position is on the target feature
   * @param {Object} coordinate - The world coordinate
   * @param {Array} screenPosition - The screen position [x, y]
   * @returns {boolean} Whether the position is on the feature
   * @private
   */
  _isPositionOnFeature(coordinate, screenPosition) {
    if (!this.workingData.targetFeature) {
      return false;
    }
    
    // Different hit test based on feature type
    switch (this.workingData.targetFeature.type) {
    case 'point':
      // For points, use the vertex hit test
      return !!this._findVertexAtPosition(screenPosition);
        
    case 'line':
      // For lines, check if we're close to any segment
      const lineCoords = this.workingData.targetFeature.getCoordinates();
        
      // Need at least two points for a line
      if (lineCoords.length < 2) {
        return false;
      }
        
      // Check each segment
      for (let i = 0; i < lineCoords.length - 1; i++) {
        const nearestInfo = this.geometryEngine.nearestPointOnSegment(
          lineCoords[i],
          lineCoords[i + 1],
          coordinate,
        );
          
        if (nearestInfo) {
          try {
            // Convert nearest point to screen coordinates
            const nearestScreenPos = this.mapInterface.coordinateToPixel(nearestInfo.point);
              
            // Ensure the screen position is valid
            if (!nearestScreenPos || nearestScreenPos.length < 2) {
              console.warn('Invalid screen position for nearest point on segment');
              continue;
            }
            
            // Check distance in screen space
            const distance = Math.sqrt(
              Math.pow(nearestScreenPos[0] - screenPosition[0], 2) +
              Math.pow(nearestScreenPos[1] - screenPosition[1], 2),
            );
            
            if (distance <= this.options.vertexDistanceTolerance) {
              return true;
            }
          } catch (error) {
            console.warn('Error calculating screen distance for line segment:', error);
          }
        }
      }
      return false;
        
    case 'polygon':
      // For polygons, check if the point is inside
      return this.workingData.targetFeature.containsPoint(coordinate);
    }
    
    return false;
  }
  
  /**
   * Select a feature at the specified position
   * @param {Object} coordinate - The world coordinate
   * @param {Array} screenPosition - The screen position [x, y]
   * @private
   */
  _selectFeatureAtPosition(coordinate, screenPosition) {
    // Find features at this position
    const features = this.manager.features.getFeaturesAtPosition(coordinate, {
      tolerance: this.options.vertexDistanceTolerance,
      screenPosition: screenPosition,
      mapInterface: this.mapInterface,
    });
    
    // Filter to editable feature types
    const editableFeatures = features.filter(f => 
      ['point', 'line', 'polygon'].includes(f.type),
    );
    
    if (editableFeatures.length > 0) {
      // Select the first editable feature
      this.manager.selectFeature(editableFeatures[0]);
      this._startEditingFeature(editableFeatures[0]);
    }
  }
  
  /**
   * Select a vertex for editing
   * @param {Object} vertex - The vertex feature to select
   * @private
   */
  _selectVertex(vertex) {
    // Deselect current vertex if any
    this._deselectVertex();
    
    // Set as selected vertex
    this.workingData.selectedVertex = vertex;
    
    // Update vertex style
    vertex.setStyle(this.options.selectedVertexSymbol);
    
    // Update vertex property
    vertex.setProperty('isSelected', true);
    
    // Emit event
    this.emit('vertexSelected', {
      feature: this.workingData.targetFeature,
      vertexIndex: vertex.getProperty('vertexIndex'),
    });
  }
  
  /**
   * Deselect the currently selected vertex
   * @private
   */
  _deselectVertex() {
    if (!this.workingData.selectedVertex) {
      return;
    }
    
    // Restore vertex style
    this.workingData.selectedVertex.setStyle(this.options.vertexSymbol);
    
    // Update vertex property
    this.workingData.selectedVertex.setProperty('isSelected', false);
    
    // Emit event
    this.emit('vertexDeselected', {
      feature: this.workingData.targetFeature,
      vertexIndex: this.workingData.selectedVertex.getProperty('vertexIndex'),
    });
    
    // Clear selected vertex
    this.workingData.selectedVertex = null;
  }
  
  /**
   * Highlight a vertex on hover
   * @param {Object} vertex - The vertex to highlight
   * @private
   */
  _highlightVertex(vertex) {
    // Skip if this is already the selected vertex
    if (this.workingData.selectedVertex && 
        this.workingData.selectedVertex.id === vertex.id) {
      return;
    }
    
    // Temporarily adjust style
    const currentStyle = vertex.getStyle();
    vertex.setStyle(Object.assign({}, currentStyle, {
      size: currentStyle.size * 1.2,
    }));
    
    // Reset other vertex styles
    this.workingData.vertices.forEach(v => {
      if (v.id !== vertex.id && !v.getProperty('isSelected')) {
        v.setStyle(this.options.vertexSymbol);
      }
    });
  }
  
  /**
   * Highlight an insertion vertex on hover
   * @param {Object} vertex - The insertion vertex to highlight
   * @private
   */
  _highlightInsertionVertex(vertex) {
    // Temporarily adjust style
    const currentStyle = vertex.getStyle();
    vertex.setStyle(Object.assign({}, currentStyle, {
      size: currentStyle.size * 1.5,
      color: 'rgba(255, 87, 51, 0.5)',
    }));
    
    // Reset other insertion vertex styles
    this.workingData.insertionVertices.forEach(v => {
      if (v.id !== vertex.id) {
        v.setStyle(this.options.insertionVertexSymbol);
      }
    });
  }
  
  /**
   * Add a new vertex at an insertion point
   * @param {Object} insertionVertex - The insertion vertex
   * @private
   */
  _addVertexAtInsertion(insertionVertex) {
    if (!this.workingData.targetFeature || !insertionVertex) {
      return;
    }
    
    const startIndex = insertionVertex.getProperty('startVertex');
    const endIndex = insertionVertex.getProperty('endVertex');
    const ringIndex = insertionVertex.getProperty('ringIndex') || 0;
    const coordinate = insertionVertex.getCoordinate();
    
    // Different approach based on feature type
    switch (this.workingData.targetFeature.type) {
    case 'line':
      // For lines, insert between two vertices
      const lineCoords = this.workingData.targetFeature.getCoordinates();
        
      // Insert at proper position
      lineCoords.splice(endIndex, 0, coordinate);
        
      // Update line coordinates
      this.workingData.targetFeature.setCoordinates(lineCoords);
      break;
        
    case 'polygon':
      // For polygons, insert in the appropriate ring
      const rings = this.workingData.targetFeature.getRings();
        
      // Make sure ring exists
      if (ringIndex >= 0 && ringIndex < rings.length) {
        const ring = rings[ringIndex];
          
        // For polygons, the last point is the same as the first,
        // so we need to handle insertion differently
        if (endIndex === 0) {
          // Inserting between last and first point (wrapping around)
          ring.splice(ring.length - 1, 0, coordinate);
          // Also update the closing point
          ring[ring.length - 1] = ring[0];
        } else {
          // Normal insertion
          ring.splice(endIndex, 0, coordinate);
        }
          
        // Update polygon rings
        this.workingData.targetFeature.setRings(rings);
      }
      break;
    }
    
    // Update vertex controls
    this._updateVertexControls();
    
    // Emit event
    this.emit('vertexAdded', {
      feature: this.workingData.targetFeature,
      coordinate: coordinate,
      beforeIndex: startIndex,
      afterIndex: endIndex,
    });
  }
  
  /**
   * Delete the currently selected vertex
   * @private
   */
  _deleteSelectedVertex() {
    if (!this.workingData.targetFeature || !this.workingData.selectedVertex) {
      return;
    }
    
    const vertexIndex = this.workingData.selectedVertex.getProperty('vertexIndex');
    const ringIndex = this.workingData.selectedVertex.getProperty('ringIndex') || 0;
    
    // Different approach based on feature type
    switch (this.workingData.targetFeature.type) {
    case 'point':
      // Can't delete the only vertex of a point
      console.warn('Cannot delete the vertex of a point feature');
      return;
        
    case 'line':
      // For lines, remove the vertex
      const lineCoords = this.workingData.targetFeature.getCoordinates();
        
      // Ensure we have enough vertices left
      if (lineCoords.length <= 2) {
        console.warn('Cannot delete vertex: Line must have at least 2 vertices');
        return;
      }
        
      // Remove the vertex
      lineCoords.splice(vertexIndex, 1);
        
      // Update line coordinates
      this.workingData.targetFeature.setCoordinates(lineCoords);
      break;
        
    case 'polygon':
      // For polygons, remove from the appropriate ring
      const rings = this.workingData.targetFeature.getRings();
        
      // Make sure ring exists
      if (ringIndex >= 0 && ringIndex < rings.length) {
        const ring = rings[ringIndex];
          
        // Ensure we have enough vertices left
        if (ring.length <= 4) { // 3 real vertices + closing point
          console.warn('Cannot delete vertex: Polygon must have at least 3 vertices');
          return;
        }
          
        // Get the point index within the ring
        const pointIndex = this.workingData.selectedVertex.getProperty('pointIndex');
          
        // Remove the vertex
        ring.splice(pointIndex, 1);
          
        // If we removed the first point, update the closing point
        if (pointIndex === 0) {
          ring[ring.length - 1] = ring[0];
        }
          
        // Update polygon rings
        this.workingData.targetFeature.setRings(rings);
      }
      break;
    }
    
    // Clear selected vertex
    this.workingData.selectedVertex = null;
    
    // Update vertex controls
    this._updateVertexControls();
    
    // Emit event
    this.emit('vertexDeleted', {
      feature: this.workingData.targetFeature,
      vertexIndex: vertexIndex,
    });
  }
  
  /**
   * Handle drag operations
   * @param {Object} coordinate - The current mouse coordinate
   * @param {Array} screenPosition - The current screen position
   * @private
   */
  _handleDrag(coordinate, screenPosition) {
    if (!this.workingData.isDragging || !this.workingData.dragStartPosition) {
      return;
    }
    
    // Calculate drag distance in screen pixels
    const startScreenPos = this.mapInterface.coordinateToPixel(this.workingData.dragStartPosition);
    const distance = Math.sqrt(
      Math.pow(startScreenPos[0] - screenPosition[0], 2) +
      Math.pow(startScreenPos[1] - screenPosition[1], 2),
    );
    
    // Update tracked distance
    this.workingData.draggedDistance = distance;
    
    // Handle based on operation mode
    switch (this.workingData.operationMode) {
    case 'moveVertex':
      this._moveSelectedVertex(coordinate);
      break;
        
    case 'move':
      this._moveFeature(coordinate);
      break;
    }
  }
  
  /**
   * Move the selected vertex to a new position
   * @param {Object} coordinate - The new coordinate
   * @private
   */
  _moveSelectedVertex(coordinate) {
    if (!this.workingData.targetFeature || !this.workingData.selectedVertex) {
      return;
    }
    
    const vertexIndex = this.workingData.selectedVertex.getProperty('vertexIndex');
    const ringIndex = this.workingData.selectedVertex.getProperty('ringIndex') || 0;
    
    // Update the vertex control position
    this.workingData.selectedVertex.setCoordinate(coordinate);
    
    // Apply 3D elevation data if enabled
    if (this.options.enable3D && this.options.snapToTerrain) {
      this.manager.applyElevationData(this.workingData.selectedVertex);
      
      // Get the updated coordinate with elevation
      coordinate = this.workingData.selectedVertex.getCoordinate();
    }
    
    // Update feature geometry based on type
    switch (this.workingData.targetFeature.type) {
    case 'point':
      // For points, just update the coordinate
      this.workingData.targetFeature.setCoordinate(coordinate);
      break;
        
    case 'line':
      // For lines, update the specific vertex
      const lineCoords = this.workingData.targetFeature.getCoordinates();
      lineCoords[vertexIndex] = coordinate;
      this.workingData.targetFeature.setCoordinates(lineCoords);
      break;
        
    case 'polygon':
      // For polygons, update in the appropriate ring
      const rings = this.workingData.targetFeature.getRings();
        
      // Make sure ring exists
      if (ringIndex >= 0 && ringIndex < rings.length) {
        const ring = rings[ringIndex];
          
        // Get the point index within the ring
        const pointIndex = this.workingData.selectedVertex.getProperty('pointIndex');
          
        // Update the vertex
        ring[pointIndex] = coordinate;
          
        // If we updated the first point, also update the closing point
        if (pointIndex === 0) {
          ring[ring.length - 1] = coordinate;
        }
          
        // Update polygon rings
        this.workingData.targetFeature.setRings(rings);
      }
      break;
    }
    
    // Update insertion vertices
    this._updateVertexControls();
    
    // Emit event
    this.emit('vertexMoved', {
      feature: this.workingData.targetFeature,
      vertexIndex: vertexIndex,
      coordinate: coordinate,
    });
  }
  
  /**
   * Move the entire feature to a new position
   * Handles both lat/lng and x/y coordinate formats for compatibility
   * @param {Object} coordinate - The new coordinate
   * @returns {void}
   * @private
   */
  _moveFeature(coordinate) {
    if (!this.workingData.targetFeature || !this.workingData.dragStartPosition) {
      return;
    }
    
    // Handle different coordinate formats and calculate offset
    const startLat = this.workingData.dragStartPosition.lat !== undefined ? this.workingData.dragStartPosition.lat : this.workingData.dragStartPosition.y;
    const startLng = this.workingData.dragStartPosition.lng !== undefined ? this.workingData.dragStartPosition.lng : this.workingData.dragStartPosition.x;
    const startElevation = this.workingData.dragStartPosition.elevation !== undefined ? this.workingData.dragStartPosition.elevation : 
      (this.workingData.dragStartPosition.z !== undefined ? this.workingData.dragStartPosition.z : 0);
    
    const currentLat = coordinate.lat !== undefined ? coordinate.lat : coordinate.y;
    const currentLng = coordinate.lng !== undefined ? coordinate.lng : coordinate.x;
    const currentElevation = coordinate.elevation !== undefined ? coordinate.elevation : 
      (coordinate.z !== undefined ? coordinate.z : 0);
    
    // Calculate offset using standard lat/lng/elevation properties
    const offset = {
      lat: currentLat - startLat,
      lng: currentLng - startLng,
      elevation: this.options.enable3D ? currentElevation - startElevation : 0,
    };
    
    // Move the feature based on type
    switch (this.workingData.targetFeature.type) {
    case 'point':
      // For points, just update the coordinate
      const pointCoord = this.workingData.targetFeature.getCoordinate();
      const pointLat = pointCoord.lat !== undefined ? pointCoord.lat : pointCoord.y;
      const pointLng = pointCoord.lng !== undefined ? pointCoord.lng : pointCoord.x;
      const pointElevation = pointCoord.elevation !== undefined ? pointCoord.elevation : 
        (pointCoord.z !== undefined ? pointCoord.z : 0);
        
      const newCoord = {
        lat: pointLat + offset.lat,
        lng: pointLng + offset.lng,
        elevation: pointElevation + offset.elevation,
      };
      this.workingData.targetFeature.setCoordinate(newCoord);
      break;
        
    case 'line':
      // For lines, offset all vertices
      const lineCoords = this.workingData.targetFeature.getCoordinates();
      const newLineCoords = lineCoords.map(coord => {
        const lat = coord.lat !== undefined ? coord.lat : coord.y;
        const lng = coord.lng !== undefined ? coord.lng : coord.x;
        const elevation = coord.elevation !== undefined ? coord.elevation : 
          (coord.z !== undefined ? coord.z : 0);
          
        return {
          lat: lat + offset.lat,
          lng: lng + offset.lng,
          elevation: elevation + offset.elevation,
        };
      });
      this.workingData.targetFeature.setCoordinates(newLineCoords);
      break;
        
    case 'polygon':
      // For polygons, offset all rings
      const rings = this.workingData.targetFeature.getRings();
      const newRings = rings.map(ring => 
        ring.map(coord => {
          const lat = coord.lat !== undefined ? coord.lat : coord.y;
          const lng = coord.lng !== undefined ? coord.lng : coord.x;
          const elevation = coord.elevation !== undefined ? coord.elevation : 
            (coord.z !== undefined ? coord.z : 0);
            
          return {
            lat: lat + offset.lat,
            lng: lng + offset.lng,
            elevation: elevation + offset.elevation,
          };
        }),
      );
      this.workingData.targetFeature.setRings(newRings);
      break;
    }
    
    // Update start position for continuous movement
    this.workingData.dragStartPosition = coordinate;
    
    // Update vertex controls
    this._updateVertexControls();
    
    // Emit event
    this.emit('featureMoved', {
      feature: this.workingData.targetFeature,
      offset: offset,
    });
  }
  
  /**
   * Cancel the current drag operation
   * @private
   */
  _cancelDrag() {
    if (!this.workingData.isDragging) {
      return;
    }
    
    // Reset drag state
    this.workingData.isDragging = false;
    this.workingData.dragStartPosition = null;
    
    // Reset feature to original state (before drag started)
    if (this.workingData.originalFeature && this.workingData.targetFeature) {
      this.workingData.targetFeature.fromGeoJSON(this.workingData.originalFeature.data);
    }
    
    // Update vertex controls
    this._updateVertexControls();
    
    // Emit event
    this.emit('dragCancelled', {
      feature: this.workingData.targetFeature,
    });
    
    // Reset operation mode
    this.workingData.operationMode = 'none';
  }
  
  /**
   * Complete the editing operation
   * @private
   */
  _completeEditing() {
    if (!this.workingData.targetFeature) {
      return;
    }
    
    // Ensure we're not in a drag operation
    if (this.workingData.isDragging) {
      this.workingData.isDragging = false;
      this.workingData.dragStartPosition = null;
    }
    
    // Update feature with final changes
    this.manager.features.updateFeature(this.workingData.targetFeature);
    
    // Restore original style
    this._restoreOriginalStyle();
    
    // Get feature for event
    const feature = this.workingData.targetFeature;
    
    // Mark operation as complete
    this.workingData.operationComplete = true;
    
    // Clear vertex controls and selection
    this._clearVertexControls();
    
    // Clear target feature
    this.workingData.targetFeature = null;
    this.workingData.originalFeature = null;
    this.workingData.selectedVertex = null;
    this.workingData.operationMode = 'none';
    
    // Emit event
    this.emit('editingCompleted', {
      feature: feature,
    });
  }
  
  /**
   * Cancel the editing operation
   * @private
   */
  _cancelEditing() {
    if (!this.workingData.targetFeature || !this.workingData.originalFeature) {
      return;
    }
    
    // Restore feature to original state
    this.workingData.targetFeature.fromGeoJSON(this.workingData.originalFeature.data);
    
    // Restore original style
    this._restoreOriginalStyle();
    
    // Get feature for event
    const feature = this.workingData.targetFeature;
    
    // Clear vertex controls and selection
    this._clearVertexControls();
    
    // Clear target feature
    this.workingData.targetFeature = null;
    this.workingData.originalFeature = null;
    this.workingData.selectedVertex = null;
    this.workingData.operationMode = 'none';
    
    // Emit event
    this.emit('editingCancelled', {
      feature: feature,
    });
  }
  
  /**
   * Set 3D editing mode
   * @param {boolean} enable - Whether to enable 3D editing
   * @returns {boolean} New state of 3D editing mode
   */
  setEnable3D(enable) {
    this.options.enable3D = !!enable;
    
    // Update vertex controls if active
    if (this.workingData.targetFeature) {
      this._updateVertexControls();
    }
    
    // Emit event
    this.emit('enable3DChanged', {
      enable3D: this.options.enable3D,
    });
    
    return this.options.enable3D;
  }
  
  /**
   * Set vertex addition capability
   * @param {boolean} allow - Whether to allow adding vertices
   * @returns {boolean} New state of vertex addition capability
   */
  setAllowVertexAddition(allow) {
    this.options.allowVertexAddition = !!allow;
    
    // Update vertex controls if active
    if (this.workingData.targetFeature) {
      this._updateVertexControls();
    }
    
    // Emit event
    this.emit('allowVertexAdditionChanged', {
      allowVertexAddition: this.options.allowVertexAddition,
    });
    
    return this.options.allowVertexAddition;
  }
  
  /**
   * Set vertex deletion capability
   * @param {boolean} allow - Whether to allow deleting vertices
   * @returns {boolean} New state of vertex deletion capability
   */
  setAllowVertexDeletion(allow) {
    this.options.allowVertexDeletion = !!allow;
    
    // Emit event
    this.emit('allowVertexDeletionChanged', {
      allowVertexDeletion: this.options.allowVertexDeletion,
    });
    
    return this.options.allowVertexDeletion;
  }
  
  /**
   * Set snap to terrain capability
   * @param {boolean} enable - Whether to enable snap to terrain
   * @returns {boolean} New state of snap to terrain capability
   */
  setSnapToTerrain(enable) {
    this.options.snapToTerrain = !!enable;
    
    // Emit event
    this.emit('snapToTerrainChanged', {
      snapToTerrain: this.options.snapToTerrain,
    });
    
    return this.options.snapToTerrain;
  }
  
  /**
   * Get the current editing settings
   * @returns {Object} Current editing settings
   */
  getSettings() {
    return {
      enable3D: this.options.enable3D,
      allowVertexAddition: this.options.allowVertexAddition,
      allowVertexDeletion: this.options.allowVertexDeletion,
      snapToTerrain: this.options.snapToTerrain,
      vertexDistanceTolerance: this.options.vertexDistanceTolerance,
    };
  }
}

/**
 * SnappingManager.js
 * Manager for snapping functionality between features
 * Part of the RTK Surveyor 3D-first implementation
 */


/**
 * @typedef {Object} SnappingManagerOptions
 * @property {Object} manager - The survey manager instance
 * @property {Object} mapInterface - The map interface instance
 * @property {number} [tolerance=10] - Snap tolerance in pixels
 * @property {boolean} [enable3D=true] - Whether to enable 3D snapping
 * @property {boolean} [snapToVertex=true] - Whether to snap to vertices
 * @property {boolean} [snapToEdge=true] - Whether to snap to edges
 * @property {boolean} [snapToGrid=false] - Whether to snap to grid
 * @property {number} [gridSize=10] - Grid size in meters
 * @property {Object} [vertexSnapSymbol] - Symbol for vertex snap indicators
 * @property {Object} [edgeSnapSymbol] - Symbol for edge snap indicators
 * @property {Object} [gridSnapSymbol] - Symbol for grid snap indicators
 */

/**
 * Manager for snapping functionality between features
 * Provides advanced snapping capabilities for survey tools
 */
class SnappingManager extends EventEmitter {
  /**
   * Create a new SnappingManager instance
   * @param {SnappingManagerOptions} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    if (!options.manager) {
      throw new Error('Manager instance is required for snapping manager initialization');
    }
    
    if (!options.mapInterface) {
      throw new Error('Map interface is required for snapping manager initialization');
    }
    
    // Store references
    this.manager = options.manager;
    this.mapInterface = options.mapInterface;
    this.geometryEngine = options.geometryEngine || this.manager.geometryEngine;
    
    // Initialize options with defaults
    this.options = Object.assign({
      tolerance: 10, // pixels
      enable3D: true,
      snapToVertex: true,
      snapToEdge: true,
      snapToGrid: false,
      gridSize: 10, // meters
      highlightSnap: true,
      includeTemporaryFeatures: true,
      vertexSnapSymbol: {
        type: 'circle',
        size: 12,
        color: 'rgba(255, 87, 51, 0.6)',
        outlineWidth: 2,
        outlineColor: '#FF5733',
      },
      edgeSnapSymbol: {
        type: 'circle',
        size: 10,
        color: 'rgba(51, 136, 255, 0.6)',
        outlineWidth: 1,
        outlineColor: '#3388FF',
      },
      gridSnapSymbol: {
        type: 'circle',
        size: 8,
        color: 'rgba(0, 200, 0, 0.5)',
        outlineWidth: 1,
        outlineColor: '#00C800',
      },
    }, options);
    
    // Initialize state
    this.state = {
      isActive: false,
      currentSnap: null,
      snapIndicator: null,
      snapSourceFeature: null,
      snapTargets: [],
      lastMousePosition: null,
    };
    
    // Bind event handlers
    this._handleMapMouseMove = this._handleMapMouseMove.bind(this);
  }
  
  /**
   * Activate the snapping manager
   * @param {Object} [options] - Activation options
   */
  activate(options = {}) {
    if (this.state.isActive) {
      return;
    }
    
    // Update options if provided
    if (options) {
      this.options = Object.assign(this.options, options);
    }
    
    // Add map event listeners
    this.mapInterface.addEventListener('mousemove', this._handleMapMouseMove);
    
    // Mark as active
    this.state.isActive = true;
    
    // Emit activation event
    this.emit('activated', this.options);
  }
  
  /**
   * Deactivate the snapping manager
   */
  deactivate() {
    if (!this.state.isActive) {
      return;
    }
    
    // Remove map event listeners
    this.mapInterface.removeEventListener('mousemove', this._handleMapMouseMove);
    
    // Clear any active snap
    this._clearSnap();
    
    // Mark as inactive
    this.state.isActive = false;
    
    // Emit deactivation event
    this.emit('deactivated');
  }
  
  /**
   * Set snap targets to constrain snapping to specific features
   * @param {Array|Object} targets - Feature or array of features to snap to
   */
  setSnapTargets(targets) {
    // Convert single feature to array
    const targetArray = Array.isArray(targets) ? targets : [targets];
    
    // Store targets
    this.state.snapTargets = targetArray;
    
    // Emit event
    this.emit('snapTargetsChanged', targetArray);
  }
  
  /**
   * Clear snap targets to allow snapping to any feature
   */
  clearSnapTargets() {
    this.state.snapTargets = [];
    
    // Emit event
    this.emit('snapTargetsCleared');
  }
  
  /**
   * Set the snap source feature to avoid self-snapping
   * @param {Object} feature - The feature to exclude from snap sources
   */
  setSnapSourceFeature(feature) {
    this.state.snapSourceFeature = feature;
  }
  
  /**
   * Handle map mouse move events
   * @param {Object} event - The map mousemove event
   * @private
   */
  _handleMapMouseMove(event) {
    // Make sure we have valid coordinate and pixel data
    if (!event.coordinate || !event.pixel) {
      return;
    }
    
    // Store current mouse position
    this.state.lastMousePosition = {
      coordinate: event.coordinate,
      pixel: event.pixel,
    };
    
    // Find snap point
    const snap = this._findSnapPoint(event.coordinate, event.pixel);
    
    // Clear current snap if none found
    if (!snap) {
      this._clearSnap();
      return;
    }
    
    // Update current snap
    this._updateSnap(snap);
  }
  
  /**
   * Find a snap point based on current snap settings
   * @param {Object} coordinate - The world coordinate
   * @param {Array} pixel - The screen pixel position
   * @returns {Object|null} Snap information or null if no snap found
   * @private
   */
  _findSnapPoint(coordinate, pixel) {
    // Skip if not active
    if (!this.state.isActive) {
      return null;
    }
    
    // Try snapping in priority order
    let snap = null;
    
    // 1. Try vertex snapping
    if (this.options.snapToVertex) {
      snap = this._findVertexSnap(coordinate, pixel);
      if (snap) return snap;
    }
    
    // 2. Try edge snapping
    if (this.options.snapToEdge) {
      snap = this._findEdgeSnap(coordinate, pixel);
      if (snap) return snap;
    }
    
    // 3. Try grid snapping
    if (this.options.snapToGrid) {
      snap = this._findGridSnap(coordinate);
      if (snap) return snap;
    }
    
    return null;
  }
  
  /**
   * Find vertex snap point
   * @param {Object} coordinate - The world coordinate
   * @param {Array} pixel - The screen pixel position
   * @returns {Object|null} Vertex snap information or null
   * @private
   */
  _findVertexSnap(coordinate, pixel) {
    const features = this._getSnapFeatures();
    let bestDistance = Infinity;
    let bestSnap = null;
    
    // Check each feature for vertices
    for (const feature of features) {
      // Skip source feature to avoid self-snapping
      if (this.state.snapSourceFeature && 
          feature.id === this.state.snapSourceFeature.id) {
        continue;
      }
      
      // Get vertices based on feature type
      let vertices = [];
      
      switch (feature.type) {
      case 'point':
        vertices = [feature.getCoordinate()];
        break;
          
      case 'line':
        vertices = feature.getCoordinates();
        break;
          
      case 'polygon':
        // Get all vertices from all rings
        const rings = feature.getRings();
        rings.forEach(ring => {
          vertices = vertices.concat(ring);
        });
        break;
          
      default:
        continue; // Skip unsupported types
      }
      
      // Check each vertex
      for (const vertex of vertices) {
        // Convert vertex to screen coordinates
        const vertexPixel = this.mapInterface.coordinateToPixel(vertex);
        
        // Make sure we have valid pixel coordinates
        if (!vertexPixel || !Array.isArray(vertexPixel) || vertexPixel.length < 2 || 
            !pixel || !Array.isArray(pixel) || pixel.length < 2) {
          continue; // Skip this vertex if we don't have valid coordinates
        }
        
        // Calculate screen distance
        const distance = Math.sqrt(
          Math.pow(vertexPixel[0] - pixel[0], 2) +
          Math.pow(vertexPixel[1] - pixel[1], 2),
        );
        
        // Check if within tolerance and closer than current best
        if (distance <= this.options.tolerance && distance < bestDistance) {
          bestDistance = distance;
          bestSnap = {
            type: 'vertex',
            feature: feature,
            coordinate: vertex,
            distance: distance,
            isSnapped: true,
          };
        }
      }
    }
    
    return bestSnap;
  }
  
  /**
   * Find edge snap point
   * @param {Object} coordinate - The world coordinate
   * @param {Array} pixel - The screen pixel position
   * @returns {Object|null} Edge snap information or null
   * @private
   */
  _findEdgeSnap(coordinate, pixel) {
    const features = this._getSnapFeatures();
    let bestDistance = Infinity;
    let bestSnap = null;
    
    // Check each feature for edges
    for (const feature of features) {
      // Skip source feature to avoid self-snapping
      if (this.state.snapSourceFeature && 
          feature.id === this.state.snapSourceFeature.id) {
        continue;
      }
      
      // Skip point features (no edges)
      if (feature.type === 'point') {
        continue;
      }
      
      // Get segments based on feature type
      const segments = [];
      
      switch (feature.type) {
      case 'line':
        const coords = feature.getCoordinates();
          
        // Create segments from adjacent coordinates
        for (let i = 0; i < coords.length - 1; i++) {
          segments.push({
            start: coords[i],
            end: coords[i + 1],
            feature: feature,
          });
        }
        break;
          
      case 'polygon':
        // Get segments from all rings
        const rings = feature.getRings();
        rings.forEach(ring => {
          for (let i = 0; i < ring.length - 1; i++) {
            segments.push({
              start: ring[i],
              end: ring[i + 1],
              feature: feature,
            });
          }
        });
        break;
          
      default:
        continue; // Skip unsupported types
      }
      
      // Check each segment
      for (const segment of segments) {
        // Find nearest point on segment
        const nearestInfo = this.geometryEngine.nearestPointOnSegment(
          segment.start,
          segment.end,
          coordinate,
        );
        
        if (nearestInfo) {
          // Convert nearest point to screen coordinates
          const nearestPixel = this.mapInterface.coordinateToPixel(nearestInfo.point);
          
          // Calculate screen distance
          const distance = Math.sqrt(
            Math.pow(nearestPixel[0] - pixel[0], 2) +
            Math.pow(nearestPixel[1] - pixel[1], 2),
          );
          
          // Check if within tolerance and closer than current best
          if (distance <= this.options.tolerance && distance < bestDistance) {
            bestDistance = distance;
            bestSnap = {
              type: 'edge',
              feature: segment.feature,
              coordinate: nearestInfo.point,
              segmentStart: segment.start,
              segmentEnd: segment.end,
              segmentPosition: nearestInfo.segmentPosition,
              distance: distance,
              isSnapped: true,
            };
          }
        }
      }
    }
    
    return bestSnap;
  }
  
  /**
   * Find grid snap point
   * @param {Object} coordinate - The world coordinate
   * @returns {Object|null} Grid snap information or null
   * @private
   */
  _findGridSnap(coordinate) {
    // Skip if grid snapping is disabled
    if (!this.options.snapToGrid) {
      return null;
    }
    
    // Calculate grid cell
    const gridSize = this.options.gridSize;
    
    // Handle different coordinate formats
    // Check if coordinate uses x,y,z or lat,lng,elevation
    const lat = coordinate.lat !== undefined ? coordinate.lat : coordinate.y;
    const lng = coordinate.lng !== undefined ? coordinate.lng : coordinate.x;
    const elevation = coordinate.elevation !== undefined ? coordinate.elevation : 
      (coordinate.z !== undefined ? coordinate.z : 0);
    
    if (lat === undefined || lng === undefined) {
      console.error('Invalid coordinate format for grid snapping:', coordinate);
      return null;
    }
    
    // Convert grid size from meters to degrees (simplified approximation)
    // This is a rough conversion factor that will vary by location
    const metersToDegreesLat = 1 / 111000; // Approximate conversion at equator
    const metersToDegreesLng = 1 / (111000 * Math.cos(lat * Math.PI / 180));
    
    const gridSizeLat = gridSize * metersToDegreesLat;
    const gridSizeLng = gridSize * metersToDegreesLng;
    
    // Round to nearest grid point
    const snappedLat = Math.round(lat / gridSizeLat) * gridSizeLat;
    const snappedLng = Math.round(lng / gridSizeLng) * gridSizeLng;
    
    // Create snapped coordinate (standard lat/lng/elevation format)
    const snappedCoordinate = {
      lat: snappedLat,
      lng: snappedLng,
      elevation: elevation,
    };
    
    // Return snap info
    return {
      type: 'grid',
      coordinate: snappedCoordinate,
      gridSize: gridSize,
      isSnapped: true,
    };
  }
  
  /**
   * Get all features that can be snapped to
   * @returns {Array} Array of features
   * @private
   */
  _getSnapFeatures() {
    // If specific snap targets are set, use those
    if (this.state.snapTargets.length > 0) {
      return this.state.snapTargets;
    }
    
    // Otherwise get all features from the manager
    const features = this.manager.features.getAllFeatures();
    
    // Include temporary features if configured
    if (this.options.includeTemporaryFeatures) {
      const workingFeatures = this.manager.workingFeatures.getAllFeatures();
      
      // Filter out snap indicators and temporary controls
      const validWorkingFeatures = workingFeatures.filter(f => {
        const type = f.getProperty('type');
        return !(type === 'vertex' || 
                type === 'insertionVertex' || 
                type === 'snap-indicator');
      });
      
      return features.concat(validWorkingFeatures);
    }
    
    return features;
  }
  
  /**
   * Update the current snap
   * @param {Object} snap - Snap information
   * @private
   */
  _updateSnap(snap) {
    // Clear current snap
    this._clearSnap();
    
    // Store new snap
    this.state.currentSnap = snap;
    
    // Create snap indicator if highlighting is enabled
    if (this.options.highlightSnap) {
      this._createSnapIndicator(snap);
    }
    
    // Emit snap event
    this.emit('snap', snap);
  }
  
  /**
   * Clear current snap
   * @private
   */
  _clearSnap() {
    // Remove snap indicator if exists
    if (this.state.snapIndicator) {
      this.manager.workingFeatures.removeFeature(this.state.snapIndicator);
      this.state.snapIndicator = null;
    }
    
    // Clear current snap
    if (this.state.currentSnap) {
      const wasSnapped = this.state.currentSnap.isSnapped;
      this.state.currentSnap = null;
      
      // Emit unsnap event if we were snapped
      if (wasSnapped) {
        this.emit('unsnap');
      }
    }
  }
  
  /**
   * Create visual indicator for the snap point
   * @param {Object} snap - Snap information
   * @private
   */
  _createSnapIndicator(snap) {
    // Determine symbol based on snap type
    let symbol;
    
    switch (snap.type) {
    case 'vertex':
      symbol = this.options.vertexSnapSymbol;
      break;
        
    case 'edge':
      symbol = this.options.edgeSnapSymbol;
      break;
        
    case 'grid':
      symbol = this.options.gridSnapSymbol;
      break;
        
    default:
      symbol = this.options.vertexSnapSymbol;
    }
    
    // Create indicator feature
    const indicator = new PointFeature(snap.coordinate, {
      id: `snap-indicator-${Date.now()}`,
      properties: {
        type: 'snap-indicator',
        snapType: snap.type,
        temporary: true,
      },
      style: symbol,
    });
    
    // Add to working features
    this.manager.workingFeatures.addFeature(indicator);
    
    // Store reference
    this.state.snapIndicator = indicator;
  }
  
  /**
   * Get the current snap point if any
   * @returns {Object|null} Current snap or null
   */
  getSnapPoint() {
    return this.state.currentSnap;
  }
  
  /**
   * Force snap point calculation at a specific coordinate
   * @param {Object} coordinate - The coordinate to snap from
   * @param {Array} [pixel] - Optional screen position for pixel-based calculations
   * @returns {Object|null} Snap result or null
   */
  snapPointAt(coordinate, pixel) {
    // If pixel not provided, convert coordinate to pixel
    if (!pixel && this.mapInterface) {
      pixel = this.mapInterface.coordinateToPixel(coordinate);
    }
    
    // Find snap
    return this._findSnapPoint(coordinate, pixel);
  }
  
  /**
   * Enable or disable vertex snapping
   * @param {boolean} enable - Whether to enable vertex snapping
   * @returns {boolean} New state
   */
  setSnapToVertex(enable) {
    this.options.snapToVertex = !!enable;
    
    // Emit event
    this.emit('snapSettingsChanged', {
      snapToVertex: this.options.snapToVertex,
    });
    
    return this.options.snapToVertex;
  }
  
  /**
   * Enable or disable edge snapping
   * @param {boolean} enable - Whether to enable edge snapping
   * @returns {boolean} New state
   */
  setSnapToEdge(enable) {
    this.options.snapToEdge = !!enable;
    
    // Emit event
    this.emit('snapSettingsChanged', {
      snapToEdge: this.options.snapToEdge,
    });
    
    return this.options.snapToEdge;
  }
  
  /**
   * Enable or disable grid snapping
   * @param {boolean} enable - Whether to enable grid snapping
   * @returns {boolean} New state
   */
  setSnapToGrid(enable) {
    this.options.snapToGrid = !!enable;
    
    // Emit event
    this.emit('snapSettingsChanged', {
      snapToGrid: this.options.snapToGrid,
    });
    
    return this.options.snapToGrid;
  }
  
  /**
   * Set grid size for grid snapping
   * @param {number} size - Grid size in meters
   * @returns {number} New grid size
   */
  setGridSize(size) {
    if (isNaN(size) || size <= 0) {
      console.error('Invalid grid size. Must be a positive number.');
      return this.options.gridSize;
    }
    
    this.options.gridSize = size;
    
    // Emit event
    this.emit('snapSettingsChanged', {
      gridSize: this.options.gridSize,
    });
    
    return this.options.gridSize;
  }
  
  /**
   * Set snap tolerance
   * @param {number} tolerance - Snap tolerance in pixels
   * @returns {number} New tolerance
   */
  setTolerance(tolerance) {
    if (isNaN(tolerance) || tolerance <= 0) {
      console.error('Invalid tolerance. Must be a positive number.');
      return this.options.tolerance;
    }
    
    this.options.tolerance = tolerance;
    
    // Emit event
    this.emit('snapSettingsChanged', {
      tolerance: this.options.tolerance,
    });
    
    return this.options.tolerance;
  }
  
  /**
   * Get current snapping settings
   * @returns {Object} Current settings
   */
  getSettings() {
    return {
      isActive: this.state.isActive,
      tolerance: this.options.tolerance,
      enable3D: this.options.enable3D,
      snapToVertex: this.options.snapToVertex,
      snapToEdge: this.options.snapToEdge,
      snapToGrid: this.options.snapToGrid,
      gridSize: this.options.gridSize,
      highlightSnap: this.options.highlightSnap,
      includeTemporaryFeatures: this.options.includeTemporaryFeatures,
    };
  }
  
  /**
   * Destroy the snapping manager and clean up resources
   */
  destroy() {
    // Deactivate if active
    if (this.state.isActive) {
      this.deactivate();
    }
    
    // Clear snap targets
    this.state.snapTargets = [];
    
    // Remove all event listeners
    this.removeAllListeners();
  }
}

/**
 * SurveyManager.js
 * Central manager for all survey operations and tools
 * Part of the RTK Surveyor 3D-first implementation
 */


/**
 * @typedef {Object} SurveyManagerOptions
 * @property {Object} mapInterface - The map interface instance
 * @property {Object} [settings] - Optional settings for the survey manager
 * @property {boolean} [settings.enable3D=true] - Whether to enable 3D support
 * @property {boolean} [settings.autoSave=false] - Whether to auto-save survey data
 * @property {number} [settings.undoLevels=20] - Number of undo levels to maintain
 * @property {string} [settings.elevationProvider='mapInterface'] - Elevation data source
 */

/**
 * SurveyManager class
 * Responsible for managing all survey operations, tools, and data
 */
class SurveyManager extends EventEmitter {
  /**
   * Create a new SurveyManager instance
   * @param {SurveyManagerOptions} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    // Store references and initialize properties
    this.mapInterface = options.mapInterface;
    this.settings = Object.assign({
      enable3D: true,
      autoSave: false,
      undoLevels: 20,
      elevationProvider: 'mapInterface',
      snapTolerance: 10, // pixels
      defaultPointSymbol: {
        type: 'circle',
        size: 10,
        color: '#FF5733',
      },
      defaultLineSymbol: {
        width: 3,
        color: '#3388FF',
      },
      defaultPolygonSymbol: {
        fillColor: 'rgba(51, 136, 255, 0.2)',
        outlineColor: '#3388FF',
        outlineWidth: 2,
      },
    }, options.settings || {});
    
    // Initialize feature collections
    this.features = new FeatureCollection();
    this.workingFeatures = new FeatureCollection(); // Temporary/working features
    this.selectedFeatures = new FeatureCollection();
    
    // Initialize geometry engine
    this.geometryEngine = new GeometryEngine();
    
    // Create operation history stack for undo/redo
    this.history = {
      undoStack: [],
      redoStack: [],
      maxSize: this.settings.undoLevels,
    };
    
    // Initialize state trackers
    this.activeTool = null;
    this.activeMode = 'select';
    this.isDrawing = false;
    this.isEditing = false;
    this.isMeasuring = false;
    
    // Initialize survey metadata
    this.metadata = {
      projectName: '',
      created: new Date(),
      modified: new Date(),
      owner: '',
      description: '',
      projection: 'EPSG:4326',
      units: {
        distance: 'meters',
        area: 'square-meters',
        angle: 'degrees',
      },
      customProperties: {},
    };
    
    // Initialize internal callback bindings
    this._setupEventListeners();
    
    // Initialize tools
    this._initializeTools();
  }
  
  /**
   * Initialize all survey tools
   * @private
   */
  _initializeTools() {
    // Initialize all tools
    this.tools = {
      measurement: new MeasurementTool({ 
        manager: this,
        mapInterface: this.mapInterface,
      }),
      offset: new OffsetTool({
        manager: this,
        mapInterface: this.mapInterface,
        geometryEngine: this.geometryEngine,
      }),
      drawing: new DrawingTool({
        manager: this,
        mapInterface: this.mapInterface,
      }),
      editing: new EditingTool({
        manager: this,
        mapInterface: this.mapInterface,
      }),
    };
    
    // Initialize the snapping manager
    this.snappingManager = new SnappingManager({
      manager: this,
      tolerance: this.settings.snapTolerance,
      mapInterface: this.mapInterface,
      geometryEngine: this.geometryEngine,
    });
    
    // Activate snapping by default
    this.snappingManager.activate();
    
    // Emit event for tools initialized
    this.emit('tools-initialized', {
      tools: Object.keys(this.tools),
      snappingActive: true,
    });
  }
  
  /**
   * Set up internal event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen for changes to feature collections
    this.features.on('feature-added', ({ feature }) => {
      this._recordHistoryAction({
        type: 'feature-added',
        featureId: feature.id,
        featureData: feature.toGeoJSON(),
      });
      this.emit('feature-added', { feature });
      this.metadata.modified = new Date();
    });
    
    this.features.on('feature-removed', ({ feature }) => {
      this._recordHistoryAction({
        type: 'feature-removed',
        featureId: feature.id,
        featureData: feature.toGeoJSON(),
      });
      this.emit('feature-removed', { feature });
      this.metadata.modified = new Date();
    });
    
    this.features.on('feature-updated', ({ feature }) => {
      this._recordHistoryAction({
        type: 'feature-updated',
        featureId: feature.id,
        featureData: feature.toGeoJSON(),
        previousData: this._lastFeatureState[feature.id],
      });
      this.emit('feature-updated', { feature });
      this.metadata.modified = new Date();
    });
    
    // Track feature state for history
    this._lastFeatureState = {};
    this.features.on('feature-geometry-changed', ({ feature }) => {
      this._lastFeatureState[feature.id] = feature.toGeoJSON();
    });
  }
  
  /**
   * Activate a specific survey tool
   * @param {string} toolName - The name of the tool to activate
   * @param {Object} [options] - Optional settings for tool activation
   * @returns {boolean} Success of tool activation
   */
  activateTool(toolName, options = {}) {
    // Deactivate current tool if one is active
    if (this.activeTool) {
      this.tools[this.activeTool].deactivate();
    }
    
    // Check if requested tool exists
    if (!this.tools[toolName]) {
      console.error(`Tool '${toolName}' not found`);
      return false;
    }
    
    // Activate the new tool
    try {
      this.tools[toolName].activate(options);
      this.activeTool = toolName;
      this.activeMode = toolName;
      
      // Update state flags based on tool type
      this.isDrawing = toolName === 'drawing';
      this.isEditing = toolName === 'editing';
      this.isMeasuring = toolName === 'measurement';
      
      // Emit event for tool activation
      this.emit('tool-activated', { 
        tool: toolName, 
        options, 
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to activate tool '${toolName}':`, error);
      return false;
    }
  }
  
  /**
   * Deactivate the current active tool
   * @returns {boolean} Success of deactivation
   */
  deactivateActiveTool() {
    if (!this.activeTool) {
      return true; // No tool active, nothing to do
    }
    
    try {
      this.tools[this.activeTool].deactivate();
      
      // Reset state flags
      this.activeTool = null;
      this.activeMode = 'select';
      this.isDrawing = false;
      this.isEditing = false;
      this.isMeasuring = false;
      
      // Emit event for tool deactivation
      this.emit('tool-deactivated');
      
      return true;
    } catch (error) {
      console.error('Failed to deactivate tool:', error);
      return false;
    }
  }
  
  /**
   * Record an action in the history stack for undo/redo
   * @param {Object} action - The action to record
   * @private
   */
  _recordHistoryAction(action) {
    // Add timestamp to action
    action.timestamp = Date.now();
    
    // Add to undo stack
    this.history.undoStack.push(action);
    
    // Clear redo stack when a new action is performed
    this.history.redoStack = [];
    
    // Trim undo stack if it exceeds max size
    if (this.history.undoStack.length > this.history.maxSize) {
      this.history.undoStack.shift();
    }
    
    // Emit history change event
    this.emit('historyChanged', {
      canUndo: this.history.undoStack.length > 0,
      canRedo: this.history.redoStack.length > 0,
    });
  }
  
  /**
   * Undo the last operation
   * @returns {boolean} Success of undo operation
   */
  undo() {
    if (this.history.undoStack.length === 0) {
      return false;
    }
    
    // Get the last action
    const action = this.history.undoStack.pop();
    
    // Add to redo stack
    this.history.redoStack.push(action);
    
    // Perform the undo based on action type
    try {
      switch (action.type) {
      case 'featureAdded':
        this.features.removeFeature(action.featureId);
        break;
      case 'featureRemoved':
        this.features.fromGeoJSON(action.featureData);
        break;
      case 'featureUpdated':
        if (action.previousData) {
          const feature = this.features.getFeature(action.featureId);
          if (feature) {
            feature.fromGeoJSON(action.previousData, { silent: true });
            this.features.updateFeature(feature, { silent: true });
          }
        }
        break;
        // Add more action types as needed
      default:
        console.warn(`Unknown action type for undo: ${action.type}`);
      }
      
      // Emit events
      this.emit('undo-performed', action);
      this.emit('history-changed', {
        canUndo: this.history.undoStack.length > 0,
        canRedo: this.history.redoStack.length > 0,
      });
      
      this.metadata.modified = new Date();
      return true;
    } catch (error) {
      // Restore action to undo stack in case of error
      this.history.undoStack.push(this.history.redoStack.pop());
      console.error('Error during undo operation:', error);
      return false;
    }
  }
  
  /**
   * Redo the last undone operation
   * @returns {boolean} Success of redo operation
   */
  redo() {
    if (this.history.redoStack.length === 0) {
      return false;
    }
    
    // Get the last undone action
    const action = this.history.redoStack.pop();
    
    // Add back to undo stack
    this.history.undoStack.push(action);
    
    // Perform the redo based on action type
    try {
      switch (action.type) {
      case 'featureAdded':
        this.features.fromGeoJSON(action.featureData);
        break;
      case 'featureRemoved':
        this.features.removeFeature(action.featureId);
        break;
      case 'featureUpdated':
        const feature = this.features.getFeature(action.featureId);
        if (feature) {
          feature.fromGeoJSON(action.featureData, { silent: true });
          this.features.updateFeature(feature, { silent: true });
        }
        break;
        // Add more action types as needed
      default:
        console.warn(`Unknown action type for redo: ${action.type}`);
      }
      
      // Emit events
      this.emit('redo-performed', action);
      this.emit('history-changed', {
        canUndo: this.history.undoStack.length > 0,
        canRedo: this.history.redoStack.length > 0,
      });
      
      this.metadata.modified = new Date();
      return true;
    } catch (error) {
      // Restore action to redo stack in case of error
      this.history.redoStack.push(this.history.undoStack.pop());
      console.error('Error during redo operation:', error);
      return false;
    }
  }
  
  /**
   * Save the current survey state
   * @param {Object} [options] - Save options
   * @returns {Object} Survey data object
   */
  saveState(_options = {}) {
    const surveyData = {
      metadata: { ...this.metadata },
      features: this.features.toGeoJSON(),
      settings: { ...this.settings },
    };
    
    // Auto-update modified timestamp
    surveyData.metadata.modified = new Date();
    
    // Emit save event
    this.emit('survey-saved', surveyData);
    
    return surveyData;
  }
  
  /**
   * Load survey state from saved data
   * @param {Object} surveyData - Survey data to load
   * @param {Object} [options] - Load options
   * @returns {boolean} Success of load operation
   */
  loadState(surveyData, _options = {}) {
    if (!surveyData || !surveyData.features) {
      console.error('Invalid survey data format');
      return false;
    }
    
    try {
      // Clear current state
      this.features.clear();
      this.workingFeatures.clear();
      this.selectedFeatures.clear();
      
      // Load metadata
      if (surveyData.metadata) {
        this.metadata = { ...surveyData.metadata };
        
        // Ensure date objects are restored from serialized format
        this.metadata.created = new Date(this.metadata.created);
        this.metadata.modified = new Date(this.metadata.modified);
      }
      
      // Load settings
      if (surveyData.settings) {
        this.settings = Object.assign(this.settings, surveyData.settings);
      }
      
      // Load features
      this.features.fromGeoJSON(surveyData.features);
      
      // Reset history
      this.history.undoStack = [];
      this.history.redoStack = [];
      
      // Emit load event
      this.emit('survey-loaded', surveyData);
      
      return true;
    } catch (error) {
      console.error('Error loading survey data:', error);
      return false;
    }
  }
  
  /**
   * Get currently selected features
   * @returns {Array} Array of selected features
   */
  getSelectedFeatures() {
    return this.selectedFeatures.getAllFeatures();
  }
  
  /**
   * Select a feature
   * @param {Feature|string} feature - Feature or feature ID to select
   * @param {Object} [options] - Selection options
   * @param {boolean} [options.toggle=false] - Whether to toggle selection state
   * @param {boolean} [options.addToSelection=false] - Whether to add to existing selection
   * @returns {boolean} Success of selection operation
   */
  selectFeature(feature, options = {}) {
    const featureObj = typeof feature === 'string' 
      ? this.features.getFeature(feature)
      : feature;
      
    if (!featureObj) {
      return false;
    }
    
    // Check if feature is already selected
    const isSelected = this.selectedFeatures.hasFeature(featureObj.id);
    
    // Handle toggle mode
    if (options.toggle && isSelected) {
      return this.deselectFeature(featureObj);
    }
    
    // Clear existing selection if not adding to it
    if (!options.addToSelection) {
      this.clearSelection();
    }
    
    // Don't reselect already selected features
    if (isSelected) {
      return true;
    }
    
    // Add to selected collection
    this.selectedFeatures.addFeature(featureObj);
    
    // Update feature selection state
    featureObj.select();
    
    // Emit selection event
    this.emit('feature-selected', { feature: featureObj });
    
    return true;
  }
  
  /**
   * Deselect a feature
   * @param {Feature|string} feature - Feature or feature ID to deselect
   * @returns {boolean} Success of deselection operation
   */
  deselectFeature(feature) {
    const featureObj = typeof feature === 'string' 
      ? this.features.getFeature(feature)
      : feature;
      
    if (!featureObj) {
      return false;
    }
    
    // Check if feature is selected
    if (!this.selectedFeatures.hasFeature(featureObj.id)) {
      return true; // Already not selected
    }
    
    // Remove from selected collection
    this.selectedFeatures.removeFeature(featureObj);
    
    // Update feature selection state
    featureObj.deselect();
    
    // Emit deselection event
    this.emit('feature-deselected', { feature: featureObj });
    
    return true;
  }
  
  /**
   * Clear all feature selections
   */
  clearSelection() {
    // Get all selected features
    const selectedFeatures = this.selectedFeatures.getAllFeatures();
    
    // Clear the selected collection
    this.selectedFeatures.clear();
    
    // Update each feature's selection state
    selectedFeatures.forEach(feature => {
      feature.deselect();
    });
    
    // Emit selection cleared event
    if (selectedFeatures.length > 0) {
      this.emit('selection-cleared', { features: selectedFeatures });
    }
  }
  
  /**
   * Apply 3D elevation data to features
   * Uses configured elevation provider to update Z values
   * @param {Array|Feature} features - Features to update with elevation data
   * @returns {Promise} Promise resolving when elevation is applied
   */
  async applyElevationData(features) {
    // Convert single feature to array
    const featureArray = Array.isArray(features) ? features : [features];
    
    if (featureArray.length === 0) {
      return Promise.resolve([]);
    }
    
    // Skip if 3D is disabled
    if (!this.settings.enable3D) {
      return Promise.resolve(featureArray);
    }
    
    try {
      // Determine which elevation provider to use
      if (this.settings.elevationProvider === 'mapInterface' && 
          this.mapInterface && 
          typeof this.mapInterface.getElevation === 'function') {
        
        // Process each feature individually
        for (const feature of featureArray) {
          try {
            // Apply based on feature type
            switch (feature.type) {
            case 'point':
              const pointCoord = feature.getCoordinate();
              // Get elevation for the point
              if (!pointCoord.elevation) {
                const elevation = await this.mapInterface.getElevation(pointCoord);
                pointCoord.setZ(elevation);
              }
              break;
                
            case 'line':
              const lineCoords = feature.getCoordinates();
              // Get elevation for each coordinate that needs it
              for (const coord of lineCoords) {
                if (!coord.elevation) {
                  const elevation = await this.mapInterface.getElevation(coord);
                  coord.setZ(elevation);
                }
              }
              feature.setCoordinates(lineCoords);
              break;
                
            case 'polygon':
              const rings = feature.getRings();
              // Get elevation for each coordinate in each ring
              for (const ring of rings) {
                for (const coord of ring) {
                  if (!coord.elevation) {
                    const elevation = await this.mapInterface.getElevation(coord);
                    coord.setZ(elevation);
                  }
                }
              }
              feature.setRings(rings);
              break;
            }
            
            // Update the feature in the collection
            if (this.features.hasFeature(feature.id)) {
              this.features.updateFeature(feature);
            }
          } catch (error) {
            console.error(`Error applying elevation to feature ${feature.id}:`, error);
          }
        }
        
        // Emit elevation updated event
        this.emit('elevation-data-applied', { features: featureArray });
        
        return featureArray;
      } else {
        console.warn('No valid elevation provider available');
        return featureArray;
      }
    } catch (error) {
      console.error('Error applying elevation data:', error);
      return featureArray;
    }
  }
  
  /**
   * Connect an external GNSS module for position updates and device integration
   * @param {Object} gnssModule - GNSS module instance (from gnss.js library)
   * @param {Object} [options] - GNSS integration options
   * @returns {boolean} Success of connection
   */
  connectGnssModule(gnssModule, options = {}) {
    if (!gnssModule) {
      console.error('Invalid GNSS module provided');
      return false;
    }

    try {
      // Store reference to the GNSS module
      this.gnssModule = gnssModule;

      // Default options
      this.gnssOptions = Object.assign({
        centerMapOnPosition: true,
        trackedPositionMarker: true,
        trackedPositionMarkerStyle: {
          color: '#4285F4',
          size: 12,
          outlineColor: '#FFFFFF',
          outlineWidth: 2,
        },
        accuracyCircle: true,
        qualityIndicator: true,
      }, options);

      // Setup position tracking
      this._setupGnssEventHandlers();

      // Create position marker if enabled
      if (this.gnssOptions.trackedPositionMarker && this.mapInterface) {
        this._createPositionMarker();
      }

      // Emit connected event
      this.emit('gnss-connected', {
        gnssModule: this.gnssModule,
        options: this.gnssOptions,
      });

      return true;
    } catch (error) {
      console.error('Error connecting GNSS module:', error);
      return false;
    }
  }

  /**
   * Set up GNSS module event handlers
   * @private
   */
  _setupGnssEventHandlers() {
    if (!this.gnssModule || !this.gnssModule.events || typeof this.gnssModule.events.on !== 'function') {
      console.warn('GNSS module has no events interface');
      return;
    }

    // Handle position updates
    this.gnssModule.events.on('position', (position) => {
      this._handlePositionUpdate(position);
    });

    // Handle connection events
    this.gnssModule.events.on('connection:connected', (data) => {
      this.emit('gnss-device-connected', data);
    });

    this.gnssModule.events.on('connection:disconnected', () => {
      this.emit('gnss-device-disconnected');
    });

    this.gnssModule.events.on('connection:error', (error) => {
      this.emit('gnss-device-error', error);
    });

    // Handle NTRIP connection events
    this.gnssModule.events.on('ntrip:connected', (data) => {
      this.emit('gnss-ntrip-connected', data);
    });

    this.gnssModule.events.on('ntrip:disconnected', () => {
      this.emit('gnss-ntrip-disconnected');
    });

    this.gnssModule.events.on('ntrip:error', (error) => {
      this.emit('gnss-ntrip-error', error);
    });
  }

  /**
   * Handle position updates from GNSS module
   * @param {Object} position - GNSS position data
   * @private
   */
  _handlePositionUpdate(position) {
    if (!position || !position.latitude || !position.longitude) {
      return;
    }

    // Store current position
    this.currentPosition = position;

    // Update position marker if enabled
    if (this.gnssOptions.trackedPositionMarker && this.positionMarker && this.mapInterface) {
      this._updatePositionMarker(position);
    }

    // Center map if enabled
    if (this.gnssOptions.centerMapOnPosition && this.mapInterface) {
      this.mapInterface.setCenter({
        lat: position.latitude,
        lng: position.longitude,
      });
    }

    // Emit position event
    this.emit('gnss-position-updated', position);
  }

  /**
   * Create a position marker on the map
   * @private
   */
  _createPositionMarker() {
    if (!this.mapInterface) return;

    // Check if we already have a marker
    if (this.positionMarker) {
      return;
    }

    // Create position marker (implementation depends on map adapter)
    if (this.mapInterface && typeof this.mapInterface.createMarker === 'function') {
      this.positionMarker = this.mapInterface.createMarker({
        lat: 0,
        lng: 0,
      }, {
        ...this.gnssOptions.trackedPositionMarkerStyle,
        visible: false,
        zIndex: 1000,
      });
    }

    // Create accuracy circle if enabled
    if (this.gnssOptions.accuracyCircle && typeof this.mapInterface.createCircle === 'function') {
      this.accuracyCircle = this.mapInterface.createCircle({
        lat: 0,
        lng: 0,
      }, 0, {
        fillColor: 'rgba(66, 133, 244, 0.2)',
        strokeColor: '#4285F4',
        strokeWeight: 1,
        visible: false,
        zIndex: 999,
      });
    }
  }

  /**
   * Update position marker with new position data
   * @param {Object} position - GNSS position data
   * @private
   */
  _updatePositionMarker(position) {
    if (!position || !position.latitude || !position.longitude) {
      return;
    }

    // Get style based on fix quality
    const style = this._getPositionStyleByQuality(position.quality);

    // Update position marker
    if (this.positionMarker) {
      this.positionMarker.setPosition({
        lat: position.latitude,
        lng: position.longitude,
      });

      if (typeof this.positionMarker.setStyle === 'function') {
        this.positionMarker.setStyle(style);
      }

      if (typeof this.positionMarker.setVisible === 'function') {
        this.positionMarker.setVisible(true);
      }
    }

    // Update accuracy circle if enabled and accuracy data is available
    if (this.accuracyCircle && position.accuracy) {
      this.accuracyCircle.setCenter({
        lat: position.latitude,
        lng: position.longitude,
      });

      this.accuracyCircle.setRadius(position.accuracy);

      if (typeof this.accuracyCircle.setVisible === 'function') {
        this.accuracyCircle.setVisible(true);
      }
    }
  }

  /**
   * Get position marker style based on fix quality
   * @param {number} quality - GNSS fix quality (0-5)
   * @returns {Object} Style object
   * @private
   */
  _getPositionStyleByQuality(quality) {
    const baseStyle = { ...this.gnssOptions.trackedPositionMarkerStyle };

    // Adjust color based on quality
    switch (quality) {
    case 4: // RTK Fixed
      baseStyle.color = '#4CAF50'; // Green
      break;

    case 5: // RTK Float
      baseStyle.color = '#FF9800'; // Orange
      break;

    case 2: // DGPS
      baseStyle.color = '#FFEB3B'; // Yellow
      break;

    case 1: // GPS
      baseStyle.color = '#2196F3'; // Blue
      break;

    case 0: // No fix
    default:
      baseStyle.color = '#F44336'; // Red
      break;
    }

    return baseStyle;
  }

  /**
   * Capture a GNSS position as a feature
   * @param {Object} [options] - Capture options
   * @returns {Promise<PointFeature|null>} Created point feature or null
   */
  async captureGnssPosition(options = {}) {
    if (!this.gnssModule || !this.currentPosition) {
      console.warn('No GNSS position available');
      return null;
    }

    const position = this.currentPosition;

    try {
      // Create a point feature from the current position
      const { PointFeature } = await Promise.resolve().then(function () { return PointFeature$1; });
      const { Coordinate } = await Promise.resolve().then(function () { return Coordinate$1; });

      // Create coordinate
      const coordinate = new Coordinate(
        position.latitude,
        position.longitude,
        position.altitude || 0,
      );

      // Create style based on fix quality
      const style = this._getPositionStyleByQuality(position.quality);

      // Set default options
      const captureOptions = Object.assign({
        name: `GNSS Point ${new Date().toLocaleTimeString()}`,
        properties: {
          source: 'gnss',
          quality: position.quality,
          satellites: position.satellites,
          accuracy: position.accuracy,
          timestamp: position.timestamp || new Date().toISOString(),
        },
        style,
      }, options);

      // Create feature
      const feature = new PointFeature(coordinate, captureOptions);

      // Add to feature collection
      this.features.addFeature(feature);

      // Emit capture event
      this.emit('gnss-position-captured', {
        feature,
        position,
      });

      return feature;
    } catch (error) {
      console.error('Error capturing GNSS position:', error);
      return null;
    }
  }

  /**
   * Disconnect from GNSS module
   * @returns {boolean} Success of disconnection
   */
  disconnectGnssModule() {
    if (!this.gnssModule) {
      return true; // Already disconnected
    }

    try {
      // Remove position marker
      if (this.positionMarker) {
        if (typeof this.positionMarker.setMap === 'function') {
          this.positionMarker.setMap(null);
        }
        this.positionMarker = null;
      }

      // Remove accuracy circle
      if (this.accuracyCircle) {
        if (typeof this.accuracyCircle.setMap === 'function') {
          this.accuracyCircle.setMap(null);
        }
        this.accuracyCircle = null;
      }

      // Clear current position
      this.currentPosition = null;

      // Reset GNSS module reference
      this.gnssModule = null;

      // Emit disconnected event
      this.emit('gnss-disconnected');

      return true;
    } catch (error) {
      console.error('Error disconnecting GNSS module:', error);
      return false;
    }
  }

  /**
   * Destroy the survey manager and clean up resources
   */
  destroy() {
    // Disconnect GNSS module if connected
    if (this.gnssModule) {
      this.disconnectGnssModule();
    }

    // Deactivate any active tool
    this.deactivateActiveTool();

    // Remove all event listeners
    this.removeAllListeners();

    // Destroy all tools
    Object.values(this.tools).forEach(tool => {
      if (typeof tool.destroy === 'function') {
        tool.destroy();
      }
    });

    // Clear collections
    this.features.clear();
    this.workingFeatures.clear();
    this.selectedFeatures.clear();

    // Clear history
    this.history.undoStack = [];
    this.history.redoStack = [];

    // Emit destruction event
    this.emit('destroyed', { manager: this });
  }
}

/**
 * Feature Component Module - Main entry point
 * @module gnss/survey/features
 */


/**
 * Create a point feature
 * @param {Coordinate|Object} coordinate - The point's coordinate
 * @param {Object} [options] - Configuration options
 * @returns {PointFeature} - The created point feature
 */
function createPoint(coordinate, options = {}) {
  const { PointFeature } = require('./PointFeature.js');
  return new PointFeature(coordinate, options);
}

/**
 * Create a line feature
 * @param {Array<Coordinate>} coordinates - The line's coordinates
 * @param {Object} [options] - Configuration options
 * @returns {LineFeature} - The created line feature
 */
function createLine(coordinates, options = {}) {
  const { LineFeature } = require('./LineFeature.js');
  return new LineFeature(coordinates, options);
}

/**
 * Create a polygon feature
 * @param {Array<Coordinate>} coordinates - The polygon's exterior ring coordinates
 * @param {Object} [options] - Configuration options
 * @returns {PolygonFeature} - The created polygon feature
 */
function createPolygon(coordinates, options = {}) {
  const { PolygonFeature } = require('./PolygonFeature.js');
  return new PolygonFeature(coordinates, options);
}

/**
 * Create a feature collection
 * @param {Array<FeatureBase>} [features=[]] - Initial features
 * @param {Object} [options] - Configuration options
 * @returns {FeatureCollection} - The created feature collection
 */
function createFeatureCollection(features = [], options = {}) {
  const { FeatureCollection } = require('./FeatureCollection.js');
  return new FeatureCollection(features, options);
}

/**
 * Import features from GeoJSON
 * @param {Object} geojson - GeoJSON object or FeatureCollection
 * @param {Object} [options] - Import options
 * @returns {Array<FeatureBase>} - Array of imported features
 */
function importFromGeoJSON(geojson, options = {}) {
  if (!geojson) return [];
    
  // Handle FeatureCollection
  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    return geojson.features.map(feature => {
      return _createFeatureFromGeoJSON(feature, options);
    }).filter(Boolean);
  }
    
  // Handle individual Feature
  if (geojson.type === 'Feature') {
    const feature = _createFeatureFromGeoJSON(geojson, options);
    return feature ? [feature] : [];
  }
    
  // Handle Geometry
  if (geojson.type && geojson.coordinates) {
    // Wrap it as a feature
    const feature = _createFeatureFromGeoJSON({
      type: 'Feature',
      geometry: geojson,
    }, options);
    return feature ? [feature] : [];
  }
    
  return [];
}

/**
 * Create a feature from a GeoJSON object
 * @param {Object} geojson - GeoJSON feature
 * @param {Object} options - Import options
 * @returns {FeatureBase|null} - Created feature or null
 * @private
 */
function _createFeatureFromGeoJSON(geojson, options = {}) {
  if (!geojson || !geojson.geometry || !geojson.geometry.type) {
    return null;
  }
    
  let feature;
    
  switch (geojson.geometry.type) {
  case 'Point':
    feature = createPoint([], { id: geojson.id });
    break;
            
  case 'LineString':
    feature = createLine([], { id: geojson.id });
    break;
            
  case 'Polygon':
    feature = createPolygon([], { id: geojson.id });
    break;
            
  default:
    console.warn(`Unsupported GeoJSON geometry type: ${geojson.geometry.type}`);
    return null;
  }
    
  if (feature) {
    feature.fromGeoJSON(geojson, options);
  }
    
  return feature;
}

/**
 * Abstract Map Interface - Base class for all map providers
 * @module gnss/survey/map/MapInterface
 */
class MapInterface {
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
  setCursor(_cursorType) {
    throw new Error('Method \'setCursor()\' must be implemented.');
  }
    
  /**
     * Initialize the map with the specified container
     * @param {string|HTMLElement} container - The HTML element or element ID to contain the map
     * @returns {Promise<void>} - Promise that resolves when the map is initialized
     */
  async initialize(_container) {
    throw new Error('Method \'initialize()\' must be implemented.');
  }
    
  /**
     * Set the center of the map to the specified coordinate
     * @param {Coordinate} coordinate - The coordinate to center the map on
     * @returns {Promise<void>} - Promise that resolves when the map is centered
     */
  async setCenter(_coordinate) {
    throw new Error('Method \'setCenter()\' must be implemented.');
  }
    
  /**
     * Set the zoom level of the map
     * @param {number} zoomLevel - The zoom level to set
     * @returns {Promise<void>} - Promise that resolves when the zoom is set
     */
  async setZoom(_zoomLevel) {
    throw new Error('Method \'setZoom()\' must be implemented.');
  }
    
  /**
     * Add a marker to the map
     * @param {Coordinate} coordinate - The coordinate to place the marker
     * @param {Object} options - Configuration options for the marker
     * @returns {Promise<Object>} - Promise that resolves with the created marker instance
     */
  async addMarker(_coordinate, _options = {}) {
    throw new Error('Method \'addMarker()\' must be implemented.');
  }
    
  /**
     * Remove a marker from the map
     * @param {Object} marker - The marker instance to remove
     * @returns {Promise<void>} - Promise that resolves when the marker is removed
     */
  async removeMarker(_marker) {
    throw new Error('Method \'removeMarker()\' must be implemented.');
  }
    
  /**
     * Add a polyline to the map
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the polyline
     * @param {Object} options - Configuration options for the polyline
     * @returns {Promise<Object>} - Promise that resolves with the created polyline instance
     */
  async addPolyline(_coordinates, _options = {}) {
    throw new Error('Method \'addPolyline()\' must be implemented.');
  }
    
  /**
     * Remove a polyline from the map
     * @param {Object} polyline - The polyline instance to remove
     * @returns {Promise<void>} - Promise that resolves when the polyline is removed
     */
  async removePolyline(_polyline) {
    throw new Error('Method \'removePolyline()\' must be implemented.');
  }
    
  /**
     * Add a polygon to the map
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the polygon
     * @param {Object} options - Configuration options for the polygon
     * @returns {Promise<Object>} - Promise that resolves with the created polygon instance
     */
  async addPolygon(_coordinates, _options = {}) {
    throw new Error('Method \'addPolygon()\' must be implemented.');
  }
    
  /**
     * Remove a polygon from the map
     * @param {Object} polygon - The polygon instance to remove
     * @returns {Promise<void>} - Promise that resolves when the polygon is removed
     */
  async removePolygon(_polygon) {
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
  async fitBounds(_bounds, _options = {}) {
    throw new Error('Method \'fitBounds()\' must be implemented.');
  }
    
  /**
     * Register an event listener on the map
     * @param {string} eventType - The type of event to listen for
     * @param {Function} listener - The callback function to execute when the event occurs
     * @returns {Promise<Object>} - Promise that resolves with the listener handle
     */
  async addEventListener(_eventType, _listener) {
    throw new Error('Method \'addEventListener()\' must be implemented.');
  }
    
  /**
     * Remove an event listener from the map
     * @param {string} eventType - The type of event
     * @param {Object} listenerHandle - The listener handle to remove
     * @returns {Promise<void>} - Promise that resolves when the listener is removed
     */
  async removeEventListener(_eventType, _listenerHandle) {
    throw new Error('Method \'removeEventListener()\' must be implemented.');
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
     * Convert a geographic coordinate to pixel coordinates on the map
     * @param {Coordinate} coordinate - The geographic coordinate to convert
     * @returns {Array<number>} - [x, y] pixel coordinates
     */
  coordinateToPixel(_coordinate) {
    throw new Error('Method \'coordinateToPixel()\' must be implemented.');
  }
    
  /**
     * Convert pixel coordinates to a geographic coordinate
     * @param {Array<number>} pixel - [x, y] pixel coordinates
     * @returns {Coordinate} - The geographic coordinate
     */
  pixelToCoordinate(_pixel) {
    throw new Error('Method \'pixelToCoordinate()\' must be implemented.');
  }
}

/**
 * Extended Map Interface for 3D maps
 * @module gnss/survey/map/Map3DInterface
 */

class Map3DInterface extends MapInterface {
  /**
     * Initialize the 3D map interface
     * @param {Object} options - Configuration options for the map
     */
  constructor(options = {}) {
    super(options);
        
    if (this.constructor === Map3DInterface) {
      throw new Error('Abstract class \'Map3DInterface\' cannot be instantiated directly.');
    }
  }
    
  /**
     * Set the camera tilt angle (pitch)
     * @param {number} angle - The tilt angle in degrees (0 = looking straight down)
     * @returns {Promise<void>} - Promise that resolves when the tilt is set
     */
  async setTilt(_angle) {
    throw new Error('Method \'setTilt()\' must be implemented.');
  }
    
  /**
     * Set the camera heading (rotation)
     * @param {number} angle - The heading angle in degrees (0 = north)
     * @returns {Promise<void>} - Promise that resolves when the heading is set
     */
  async setHeading(_angle) {
    throw new Error('Method \'setHeading()\' must be implemented.');
  }
    
  /**
     * Get the current camera position
     * @returns {Promise<Object>} - Promise that resolves with the camera position
     */
  async getCameraPosition() {
    throw new Error('Method \'getCameraPosition()\' must be implemented.');
  }
    
  /**
     * Set the camera position
     * @param {Object} position - The camera position
     * @param {Coordinate} position.coordinate - The coordinate to position the camera
     * @param {number} position.distance - The distance from the coordinate
     * @param {number} position.heading - The heading angle in degrees
     * @param {number} position.tilt - The tilt angle in degrees
     * @returns {Promise<void>} - Promise that resolves when the position is set
     */
  async setCameraPosition(_position) {
    throw new Error('Method \'setCameraPosition()\' must be implemented.');
  }
    
  /**
     * Add a 3D model to the map
     * @param {Coordinate} coordinate - The coordinate to place the model
     * @param {Object} options - Configuration options for the model
     * @returns {Promise<Object>} - Promise that resolves with the model object
     */
  async addModel(_coordinate, _options = {}) {
    throw new Error('Method \'addModel()\' must be implemented.');
  }
    
  /**
     * Remove a 3D model from the map
     * @param {Object} model - The model to remove
     * @returns {Promise<void>} - Promise that resolves when the model is removed
     */
  async removeModel(_model) {
    throw new Error('Method \'removeModel()\' must be implemented.');
  }
    
  /**
     * Add terrain to the map
     * @param {Object} options - Configuration options for the terrain
     * @returns {Promise<Object>} - Promise that resolves with the terrain object
     */
  async addTerrain(_options = {}) {
    throw new Error('Method \'addTerrain()\' must be implemented.');
  }
    
  /**
     * Remove terrain from the map
     * @returns {Promise<void>} - Promise that resolves when the terrain is removed
     */
  async removeTerrain() {
    throw new Error('Method \'removeTerrain()\' must be implemented.');
  }
    
  /**
     * Enable or disable terrain exaggeration
     * @param {number} factor - The exaggeration factor (1.0 = normal)
     * @returns {Promise<void>} - Promise that resolves when exaggeration is set
     */
  async setTerrainExaggeration(_factor) {
    throw new Error('Method \'setTerrainExaggeration()\' must be implemented.');
  }
}

/**
 * Abstract Elevation Service Interface
 * @module gnss/survey/map/ElevationService
 */
class ElevationService {
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

/**
 * Google Maps implementation of the Map Interface
 * @module gnss/survey/map/GoogleMapsAdapter
 */

class GoogleMapsAdapter extends MapInterface {
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

/**
 * Leaflet implementation of the Map Interface
 * @module gnss/survey/map/LeafletAdapter
 */

class LeafletAdapter extends MapInterface {
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

/**
 * Google Maps Elevation Service implementation
 * @module gnss/survey/map/GoogleMapsElevationService
 */

class GoogleMapsElevationService extends ElevationService {
  /**
     * Initialize the Google Maps Elevation Service
     * @param {Object} options - Configuration options
     * @param {string} [options.apiKey] - Google Maps API key (optional if already loaded)
     */
  constructor(options = {}) {
    super(options);
        
    this.apiLoaded = false;
    this.apiKey = options.apiKey;
    this.elevationService = null;
  }
    
  /**
     * Load the Google Maps API if not already loaded
     * @returns {Promise<void>} - Promise that resolves when the API is loaded
     * @private
     */
  async _loadGoogleMapsAPI() {
    if (window.google && window.google.maps) {
      this.apiLoaded = true;
            
      if (!this.elevationService && window.google.maps.ElevationService) {
        this.elevationService = new google.maps.ElevationService();
      }
            
      return;
    }
        
    if (!this.apiKey) {
      throw new Error('Google Maps API key is required for initialization');
    }
        
    return new Promise((resolve, reject) => {
      const callbackName = `GoogleMapsCallback_${Date.now()}`;
      window[callbackName] = () => {
        this.apiLoaded = true;
        this.elevationService = new google.maps.ElevationService();
        delete window[callbackName];
        resolve();
      };
            
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&callback=${callbackName}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      document.head.appendChild(script);
    });
  }
    
  /**
     * Convert a Coordinate to a Google Maps LatLng
     * @param {Coordinate} coordinate - The coordinate to convert
     * @returns {google.maps.LatLng} - Google Maps LatLng object
     * @private
     */
  _toLatLng(coordinate) {
    return new google.maps.LatLng(coordinate.latitude, coordinate.longitude);
  }
    
  /**
     * Get the elevation at a specific coordinate
     * @param {Coordinate} coordinate - The coordinate to get elevation for
     * @returns {Promise<number>} - Promise that resolves with the elevation in meters
     */
  async getElevation(coordinate) {
    // Initialize the API if needed
    if (!this.apiLoaded) {
      await this._loadGoogleMapsAPI();
    }
        
    // If coordinate already has elevation, return it
    if (coordinate.elevation !== null && coordinate.elevation !== undefined) {
      return Promise.resolve(coordinate.elevation);
    }
        
    const locations = [this._toLatLng(coordinate)];
        
    return new Promise((resolve, reject) => {
      this.elevationService.getElevationForLocations({ locations }, (results, status) => {
        if (status === google.maps.ElevationStatus.OK && results && results.length > 0) {
          resolve(results[0].elevation);
        } else {
          reject(new Error(`Elevation service failed: ${status}`));
        }
      });
    });
  }
    
  /**
     * Get elevations for a path of coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the path
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForPath(coordinates) {
    // Initialize the API if needed
    if (!this.apiLoaded) {
      await this._loadGoogleMapsAPI();
    }
        
    const path = coordinates.map(coord => this._toLatLng(coord));
        
    // Google's API has a limit on the number of samples, so chunk if needed
    const MAX_SAMPLES = 512; // Google's limit
    const samples = Math.min(coordinates.length, MAX_SAMPLES);
        
    return new Promise((resolve, reject) => {
      this.elevationService.getElevationAlongPath(
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
     * Get elevations for an array of coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates to get elevations for
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForLocations(coordinates) {
    // Initialize the API if needed
    if (!this.apiLoaded) {
      await this._loadGoogleMapsAPI();
    }
        
    // Google has a limit of 512 locations per request, so we may need to batch
    const MAX_LOCATIONS = 512;
    const batches = [];
        
    for (let i = 0; i < coordinates.length; i += MAX_LOCATIONS) {
      const batchCoordinates = coordinates.slice(i, i + MAX_LOCATIONS);
      const locations = batchCoordinates.map(coord => this._toLatLng(coord));
            
      batches.push(
        new Promise((resolve, reject) => {
          this.elevationService.getElevationForLocations(
            { locations },
            (results, status) => {
              if (status === google.maps.ElevationStatus.OK && results) {
                resolve(results.map(result => result.elevation));
              } else {
                reject(new Error(`Elevation service failed: ${status}`));
              }
            },
          );
        }),
      );
    }
        
    // Wait for all batches to complete and combine results
    const results = await Promise.all(batches);
    return results.flat();
  }
}

/**
 * Map Factory - Creates map instances based on provider type
 * @module gnss/survey/map/MapFactory
 */

let MapFactory$1 = class MapFactory {
  /**
     * Create a map instance based on the provider type
     * @param {string} providerType - The map provider type ('google', 'leaflet', etc.)
     * @param {Object} options - Configuration options for the map provider
     * @returns {MapInterface} - A map interface instance
     */
  static createMap(providerType, options = {}) {
    switch (providerType.toLowerCase()) {
    case 'google':
      return new GoogleMapsAdapter(options);
                
    case 'leaflet':
      return new LeafletAdapter(options);
                
    default:
      throw new Error(`Unsupported map provider type: ${providerType}`);
    }
  }
    
  /**
     * Check if a map provider is available
     * @param {string} providerType - The map provider type ('google', 'leaflet', etc.)
     * @param {Object} [options={}] - Configuration options with potential API keys
     * @returns {boolean} - True if the provider is available
     */
  static isProviderAvailable(providerType, options = {}) {
    switch (providerType.toLowerCase()) {
    case 'google':
      return typeof window !== 'undefined' && 
                      (window.google !== undefined || options.apiKey !== undefined);
                
    case 'leaflet':
      return typeof window !== 'undefined';
                
    default:
      return false;
    }
  }
    
  /**
     * Get a list of supported map providers
     * @returns {Array<string>} - Array of supported provider types
     */
  static getSupportedProviders() {
    return ['google', 'leaflet'];
  }
};

/**
 * Abstract Feature Rendering Strategy Interface
 * @module gnss/survey/map/rendering/RenderingStrategy
 */
class RenderingStrategy {
  /**
     * Initialize the rendering strategy
     * @param {MapInterface} map - The map interface to render features on
     * @param {Object} options - Configuration options for the rendering strategy
     */
  constructor(map, options = {}) {
    if (this.constructor === RenderingStrategy) {
      throw new Error('Abstract class \'RenderingStrategy\' cannot be instantiated directly.');
    }
        
    this.map = map;
    this.options = options;
  }
    
  /**
     * Render a point feature on the map
     * @param {Object} feature - The point feature to render
     * @param {Coordinate} feature.coordinate - The coordinate of the point
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderPoint(_feature, _options = {}) {
    throw new Error('Method \'renderPoint()\' must be implemented.');
  }
    
  /**
     * Render a line feature on the map
     * @param {Object} feature - The line feature to render
     * @param {Array<Coordinate>} feature.coordinates - The coordinates of the line
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderLine(_feature, _options = {}) {
    throw new Error('Method \'renderLine()\' must be implemented.');
  }
    
  /**
     * Render a polygon feature on the map
     * @param {Object} feature - The polygon feature to render
     * @param {Array<Coordinate>} feature.coordinates - The coordinates of the polygon boundary
     * @param {Array<Array<Coordinate>>} [feature.holes] - Arrays of coordinates for any holes
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderPolygon(_feature, _options = {}) {
    throw new Error('Method \'renderPolygon()\' must be implemented.');
  }
    
  /**
     * Remove a rendered feature from the map
     * @param {Object} renderedFeature - The rendered feature to remove
     * @returns {Promise<void>} - Promise that resolves when the feature is removed
     */
  async removeFeature(_renderedFeature) {
    throw new Error('Method \'removeFeature()\' must be implemented.');
  }
    
  /**
     * Update a rendered feature on the map
     * @param {Object} renderedFeature - The previously rendered feature
     * @param {Object} updatedFeature - The updated feature data
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the updated rendered feature
     */
  async updateFeature(_renderedFeature, _updatedFeature, _options = {}) {
    throw new Error('Method \'updateFeature()\' must be implemented.');
  }
    
  /**
     * Highlight a rendered feature on the map
     * @param {Object} renderedFeature - The rendered feature to highlight
     * @param {Object} options - Highlight options
     * @returns {Promise<void>} - Promise that resolves when the feature is highlighted
     */
  async highlightFeature(_renderedFeature, _options = {}) {
    throw new Error('Method \'highlightFeature()\' must be implemented.');
  }
    
  /**
     * Remove highlight from a rendered feature
     * @param {Object} renderedFeature - The rendered feature to unhighlight
     * @returns {Promise<void>} - Promise that resolves when the highlight is removed
     */
  async unhighlightFeature(_renderedFeature) {
    throw new Error('Method \'unhighlightFeature()\' must be implemented.');
  }
}

/**
 * Google Maps implementation of the rendering strategy
 * @module gnss/survey/map/rendering/GoogleMapsRenderingStrategy
 */

class GoogleMapsRenderingStrategy extends RenderingStrategy {
  /**
     * Initialize the Google Maps rendering strategy
     * @param {GoogleMapsAdapter} map - The Google Maps adapter
     * @param {Object} options - Configuration options
     */
  constructor(map, options = {}) {
    super(map, options);
        
    if (!map || !map.map) {
      throw new Error('GoogleMapsRenderingStrategy requires a valid GoogleMapsAdapter instance');
    }
        
    // Store reference to the actual Google Map instance
    this.googleMap = map.map;
        
    // Track rendered features for update/remove operations
    this.renderedFeatures = new Map();
  }
    
  /**
     * Render a point feature on the map
     * @param {Object} feature - The point feature to render
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderPoint(feature, options = {}) {
    try {
      const coordinate = feature.getCoordinate ? feature.getCoordinate() : feature.coordinate;
      if (!coordinate) {
        throw new Error('Invalid point feature: no coordinate found');
      }

      // Enhanced debug logging - clearly mark the start of point rendering
      console.log('========== RENDERING POINT ==========');
      console.log(`Coordinate: ${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}`);
      console.log(`Feature ID: ${feature.id || 'unknown'}`);
      console.log(`Source: ${feature.properties?.source || 'standard'}`);

      const style = feature.style || options.style || this.options.defaultPointStyle || {};
      console.log(`Marker style: ${style.useDualMarker ? 'dual-marker' : (style.iconUrl ? 'image' : 'circle')}`);
      console.log(`Marker color: ${style.color || 'default'}`);
      console.log('=======================================');
            
      // Check for availability of Advanced Markers
      if (!this._isAdvancedMarkerAvailable()) {
        throw new Error('Advanced Markers are required and not available in the current Google Maps API version');
      }
            
      // Get marker icon/content configuration
      const iconConfig = this._createMarkerIcon(style, feature);
            
      // Advanced markers configuration - simpler now since we handle positioning with CSS
      const markerOptions = {
        position: { lat: coordinate.lat, lng: coordinate.lng },
        map: this.googleMap,
        title: feature.name || feature.properties?.name || '',
        gmpDraggable: options.draggable || false,
        content: iconConfig.content,
      };
            
      // Create the Advanced Marker
      const marker = new google.maps.marker.AdvancedMarkerElement(markerOptions);
            
      // Store original feature reference
      marker.originalFeature = feature;
            
      // Add click event handler if needed
      if (options.onClick || options.selectable !== false) {
        // Advanced markers use the 'gmp-click' event (required for Google Maps Platform)
        marker.addEventListener('gmp-click', (event) => {
          // Log that we received a marker click event
          console.log(`Advanced marker gmp-click received for feature: ${feature.id}`);
                    
          // Prevent propagation where possible
          if (event.stopPropagation) {
            event.stopPropagation();
          }
                    
          // Stop immediate propagation if available
          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }
                    
          // Prevent default action
          if (event.preventDefault) {
            event.preventDefault();
          }
                    
          if (options.onClick) {
            options.onClick({
              feature,
              renderedFeature: marker,
              originalEvent: event,
            });
          }
                    
          if (options.selectable !== false) {
            this._handleFeatureClick(feature, marker, event);
          }
                    
          return false;
        });
      }
            
      // Store the rendered feature
      const renderedFeature = {
        id: feature.id,
        type: 'point',
        originalFeature: feature,
        renderedObject: marker,
        options,
      };
            
      this.renderedFeatures.set(feature.id, renderedFeature);
      return renderedFeature;
    } catch (error) {
      console.error('Error rendering point feature:', error);
      throw error;
    }
  }
    
  /**
     * Render a line feature on the map
     * @param {Object} feature - The line feature to render
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderLine(feature, options = {}) {
    try {
      // Use let instead of const since we might need to reassign it
      let coordinates = feature.getCoordinates ? feature.getCoordinates() : feature.coordinates;
            
      // Ensure coordinates exist and are an array
      if (!coordinates || !Array.isArray(coordinates)) {
        console.warn('Line feature has no coordinates array');
        // Create a placeholder empty array
        coordinates = [];
      }
            
      // Get line style from feature or options
      const style = feature.style || options.style || this.options.defaultLineStyle || {};
            
      // Handle empty or insufficient coordinates for preview features
      let path;
      if (coordinates.length < 2) {
        // For preview/temporary features (like during drawing), use a small invisible line
        // that can be updated later
        if (feature.properties?.temporary || feature.properties?.isPreview) {
          console.log(`Creating initial placeholder line with ${coordinates.length} points`);
                    
          // Make a temporary path with two nearby points if we have none
          // or duplicate the single point if we have one
          if (coordinates.length === 0) {
            // Use center of the map for placeholders
            const center = this.googleMap.getCenter();
            path = [
              { lat: center.lat(), lng: center.lng() },
              { lat: center.lat(), lng: center.lng() },
            ];
          } else {
            // Duplicate the single coordinate
            const singleCoord = coordinates[0];
            path = [
              { lat: singleCoord.lat, lng: singleCoord.lng },
              { lat: singleCoord.lat, lng: singleCoord.lng },
            ];
          }
        } else {
          // For permanent features, we'll enforce the minimum coordinate requirement
          throw new Error('Invalid permanent line feature: insufficient coordinates (need at least 2)');
        }
      } else {
        // Normal case - convert existing coordinates to Google Maps path
        path = coordinates.map(coord => ({
          lat: coord.lat,
          lng: coord.lng,
        }));
      }
            
      // Create polyline options
      const polylineOptions = {
        path,
        map: this.googleMap,
        geodesic: options.geodesic !== false,
        strokeColor: style.color || style.strokeColor || '#3388FF',
        strokeOpacity: style.opacity || style.strokeOpacity || 1.0,
        strokeWeight: style.width || style.strokeWeight || 3,
        clickable: true,
        // Ensure it's on top and interactive
        zIndex: 100,
      };
            
      // Create the polyline
      const polyline = new google.maps.Polyline(polylineOptions);
            
      // Store original feature reference
      polyline.originalFeature = feature;
            
      // Add click event handler if needed
      if (options.onClick || options.selectable !== false) {
        polyline.addListener('click', (event) => {
          // Log that we received a line click event
          console.log(`Line click received for feature: ${feature.id}`);
                    
          // Prevent propagation to the map
          if (event.stop) event.stop();
          if (event.domEvent && event.domEvent.stopPropagation) {
            event.domEvent.stopPropagation();
          }
          if (event.originalEvent && event.originalEvent.stopPropagation) {
            event.originalEvent.stopPropagation();
          }
                    
          // Ensure we stop immediate propagation too if available
          if (event.domEvent && event.domEvent.stopImmediatePropagation) {
            event.domEvent.stopImmediatePropagation();
          }
                    
          // Force preventDefault to ensure no other handlers run
          if (event.domEvent && event.domEvent.preventDefault) {
            event.domEvent.preventDefault();
          }
                    
          if (options.onClick) {
            options.onClick({
              feature,
              renderedFeature: polyline,
              originalEvent: event,
            });
          }
                    
          if (options.selectable !== false) {
            this._handleFeatureClick(feature, polyline, event);
          }
                    
          // Return false to try to prevent event bubbling
          return false;
        });
      }
            
      // Store the rendered feature
      const renderedFeature = {
        id: feature.id,
        type: 'line',
        originalFeature: feature,
        renderedObject: polyline,
        options,
      };
            
      this.renderedFeatures.set(feature.id, renderedFeature);
      return renderedFeature;
    } catch (error) {
      console.error('Error rendering line feature:', error);
      throw error;
    }
  }
    
  /**
     * Render a polygon feature on the map
     * @param {Object} feature - The polygon feature to render
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderPolygon(feature, options = {}) {
    try {
      // For polygons, we need to handle rings correctly
      let paths = [];
            
      // Try different methods to get polygon coordinates
      if (feature.getRings && typeof feature.getRings === 'function') {
        const rings = feature.getRings();
        if (rings && rings.length > 0) {
          // Convert each ring to Google Maps path
          paths = rings.map(ring => 
            ring.map(coord => ({
              lat: coord.lat, 
              lng: coord.lng,
            })),
          );
        }
      } else if (feature.coordinates && Array.isArray(feature.coordinates)) {
        // If it's a simple array of coordinates (single ring)
        paths = [feature.coordinates.map(coord => ({
          lat: coord.lat,
          lng: coord.lng,
        }))];
      }
            
      // Handle empty or insufficient coordinates for preview features
      if (paths.length === 0 || paths[0].length < 3) {
        // For preview/temporary features (like during drawing), use a placeholder polygon
        if (feature.properties?.temporary || feature.properties?.isPreview) {
          console.log(`Creating initial placeholder polygon with ${paths.length > 0 ? paths[0].length : 0} points`);
                    
          // Use center of the map for placeholders
          const center = this.googleMap.getCenter();
          const lat = center.lat();
          const lng = center.lng();
                    
          // Create a tiny triangle at map center that will be invisible to user
          // but valid for the Google Maps API
          paths = [[
            { lat, lng },
            { lat, lng: lng + 0.0000001 },
            { lat: lat + 0.0000001, lng },
          ]];
        } else {
          // For permanent features, enforce the minimum coordinate requirement
          throw new Error('Invalid permanent polygon feature: insufficient coordinates (need at least 3)');
        }
      }
            
      // Get polygon style from feature or options
      const style = feature.style || options.style || this.options.defaultPolygonStyle || {};
            
      // Create polygon options
      const polygonOptions = {
        paths,
        map: this.googleMap,
        strokeColor: style.outlineColor || style.strokeColor || '#3388FF',
        strokeOpacity: style.outlineOpacity || style.strokeOpacity || 0.8,
        strokeWeight: style.outlineWidth || style.strokeWeight || 2,
        fillColor: style.fillColor || '#3388FF',
        fillOpacity: style.fillOpacity || 0.35,
        clickable: true,
        // Ensure it's on top and interactive
        zIndex: 100,
      };
            
      // Create the polygon
      const polygon = new google.maps.Polygon(polygonOptions);
            
      // Store original feature reference
      polygon.originalFeature = feature;
            
      // Add click event handler if needed
      if (options.onClick || options.selectable !== false) {
        polygon.addListener('click', (event) => {
          // Log that we received a polygon click event
          console.log(`Polygon click received for feature: ${feature.id}`);
                    
          // Prevent propagation to the map
          if (event.stop) event.stop();
          if (event.domEvent && event.domEvent.stopPropagation) {
            event.domEvent.stopPropagation();
          }
          if (event.originalEvent && event.originalEvent.stopPropagation) {
            event.originalEvent.stopPropagation();
          }
                    
          // Ensure we stop immediate propagation too if available
          if (event.domEvent && event.domEvent.stopImmediatePropagation) {
            event.domEvent.stopImmediatePropagation();
          }
                    
          // Force preventDefault to ensure no other handlers run
          if (event.domEvent && event.domEvent.preventDefault) {
            event.domEvent.preventDefault();
          }
                    
          if (options.onClick) {
            options.onClick({
              feature,
              renderedFeature: polygon,
              originalEvent: event,
            });
          }
                    
          if (options.selectable !== false) {
            this._handleFeatureClick(feature, polygon, event);
          }
                    
          // Return false to try to prevent event bubbling
          return false;
        });
      }
            
      // Store the rendered feature
      const renderedFeature = {
        id: feature.id,
        type: 'polygon',
        originalFeature: feature,
        renderedObject: polygon,
        options,
      };
            
      this.renderedFeatures.set(feature.id, renderedFeature);
      return renderedFeature;
    } catch (error) {
      console.error('Error rendering polygon feature:', error);
      throw error;
    }
  }
    
  /**
     * Render a feature based on its type
     * @param {Object} feature - The feature to render
     * @param {string} featureType - The type of feature ('point', 'line', 'polygon')
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderFeatureByType(feature, featureType, options = {}) {
    switch (featureType) {
    case 'point':
      return this.renderPoint(feature, options);
    case 'line':
      return this.renderLine(feature, options);
    case 'polygon':
      return this.renderPolygon(feature, options);
    default:
      throw new Error(`Unsupported feature type: ${featureType}`);
    }
  }
    
  /**
     * Remove a rendered feature from the map
     * @param {Object} renderedFeature - The rendered feature to remove
     * @returns {Promise<void>} - Promise that resolves when the feature is removed
     */
  async removeFeature(renderedFeature) {
    try {
      const mapObject = renderedFeature.renderedObject;
      if (!mapObject) return;
            
      // Remove the map object based on its type
      if (mapObject instanceof google.maps.marker.AdvancedMarkerElement) {
        // Advanced marker removal
        mapObject.map = null;
      } else if (mapObject instanceof google.maps.Polyline ||
                      mapObject instanceof google.maps.Polygon) {
        // Polyline and Polygon removal
        mapObject.setMap(null);
      }
            
      // Remove from tracked features
      this.renderedFeatures.delete(renderedFeature.id);
            
    } catch (error) {
      console.error('Error removing feature:', error);
      throw error;
    }
  }
    
  /**
     * Update a rendered feature on the map
     * @param {Object} renderedFeature - The previously rendered feature
     * @param {Object} updatedFeature - The updated feature data
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the updated rendered feature
     */
  async updateFeature(renderedFeature, updatedFeature, options = {}) {
    try {
      // Remove the existing feature first
      await this.removeFeature(renderedFeature);
            
      // Re-render with updated feature data
      const newRenderedFeature = await this.renderFeatureByType(
        updatedFeature, 
        renderedFeature.type,
        options || renderedFeature.options,
      );
            
      return newRenderedFeature;
    } catch (error) {
      console.error('Error updating feature:', error);
      throw error;
    }
  }
    
  /**
     * Highlight a rendered feature on the map
     * @param {Object} renderedFeature - The rendered feature to highlight
     * @param {Object} options - Highlight options
     * @returns {Promise<void>} - Promise that resolves when the feature is highlighted
     */
  async highlightFeature(renderedFeature, options = {}) {
    try {
      const mapObject = renderedFeature.renderedObject;
      if (!mapObject) return;
            
      // Store original styles for later unhighlighting
      if (!mapObject.originalStyles) {
        this._storeOriginalStyles(mapObject, renderedFeature.type);
      }
            
      // Apply highlighting based on feature type
      switch (renderedFeature.type) {
      case 'point':
        this._highlightMarker(mapObject, options);
        break;
                    
      case 'line':
        this._highlightPolyline(mapObject, options);
        break;
                    
      case 'polygon':
        this._highlightPolygon(mapObject, options);
        break;
      }
    } catch (error) {
      console.error('Error highlighting feature:', error);
      throw error;
    }
  }
    
  /**
     * Remove highlight from a rendered feature
     * @param {Object} renderedFeature - The rendered feature to unhighlight
     * @returns {Promise<void>} - Promise that resolves when the highlight is removed
     */
  async unhighlightFeature(renderedFeature) {
    try {
      const mapObject = renderedFeature.renderedObject;
      if (!mapObject || !mapObject.originalStyles) return;
            
      // Restore original styles based on feature type
      switch (renderedFeature.type) {
      case 'point':
        this._unhighlightMarker(mapObject);
        break;
                    
      case 'line':
        this._unhighlightPolyline(mapObject);
        break;
                    
      case 'polygon':
        this._unhighlightPolygon(mapObject);
        break;
      }
    } catch (error) {
      console.error('Error unhighlighting feature:', error);
      throw error;
    }
  }
    
  /**
     * Store original styles for a map object
     * @param {Object} mapObject - The map object
     * @param {string} type - The feature type
     * @private
     */
  _storeOriginalStyles(mapObject, type) {
    mapObject.originalStyles = {};
        
    switch (type) {
    case 'point':
      // Advanced Marker styles storage
      if (mapObject instanceof google.maps.marker.AdvancedMarkerElement && mapObject.content) {
        const element = mapObject.content;
        mapObject.originalStyles.transform = element.style.transform;
        mapObject.originalStyles.boxShadow = element.style.boxShadow;
        mapObject.originalStyles.zIndex = element.style.zIndex;
      }
      break;
                
    case 'line':
      mapObject.originalStyles.strokeColor = mapObject.get('strokeColor');
      mapObject.originalStyles.strokeWeight = mapObject.get('strokeWeight');
      mapObject.originalStyles.strokeOpacity = mapObject.get('strokeOpacity');
      mapObject.originalStyles.zIndex = mapObject.get('zIndex');
      break;
                
    case 'polygon':
      mapObject.originalStyles.strokeColor = mapObject.get('strokeColor');
      mapObject.originalStyles.strokeWeight = mapObject.get('strokeWeight');
      mapObject.originalStyles.strokeOpacity = mapObject.get('strokeOpacity');
      mapObject.originalStyles.fillColor = mapObject.get('fillColor');
      mapObject.originalStyles.fillOpacity = mapObject.get('fillOpacity');
      mapObject.originalStyles.zIndex = mapObject.get('zIndex');
      break;
    }
  }
    
  /**
     * Highlight a marker
     * @param {Object} marker - The marker to highlight
     * @param {Object} options - Highlight options
     * @private
     */
  _highlightMarker(marker, options = {}) {
    const highlightColor = options.color || '#1a73e8';
        
    try {
      // Highlight advanced marker by modifying the content element
      if (marker.content) {
        const element = marker.content;
                
        // Store original values if not already stored
        if (!element._originalStyles) {
          element._originalStyles = {
            transform: element.style.transform || '',
            transition: element.style.transition || '',
            boxShadow: element.style.boxShadow || '',
            zIndex: element.style.zIndex || '',
          };
        }
                
        // Apply highlighting styles
        element.style.transform = 'scale(1.2)';
        element.style.transition = 'transform 0.2s ease-in-out';
        element.style.boxShadow = `0 0 0 2px ${highlightColor}, 0 2px 4px rgba(0,0,0,0.3)`;
        element.style.zIndex = '1000';
      }
    } catch (error) {
      console.error('Error highlighting marker:', error);
    }
  }
    
  /**
     * Unhighlight a marker
     * @param {Object} marker - The marker to unhighlight
     * @private
     */
  _unhighlightMarker(marker) {
    try {
      // Restore original styles for advanced markers
      if (marker.content && marker.content._originalStyles) {
        const element = marker.content;
        const originalStyles = element._originalStyles;
                
        // Restore original styles
        element.style.transform = originalStyles.transform || '';
        element.style.transition = originalStyles.transition || '';
        element.style.boxShadow = originalStyles.boxShadow || '';
        element.style.zIndex = originalStyles.zIndex || '';
      }
    } catch (error) {
      console.error('Error unhighlighting marker:', error);
    }
  }
    
  /**
     * Highlight a polyline
     * @param {Object} polyline - The polyline to highlight
     * @param {Object} options - Highlight options
     * @private
     */
  _highlightPolyline(polyline, options = {}) {
    const highlightColor = options.color || '#1a73e8';
        
    polyline.setOptions({
      strokeColor: highlightColor,
      strokeWeight: polyline.originalStyles.strokeWeight + 2,
      strokeOpacity: 1.0,
      zIndex: 1000,
    });
  }
    
  /**
     * Unhighlight a polyline
     * @param {Object} polyline - The polyline to unhighlight
     * @private
     */
  _unhighlightPolyline(polyline) {
    if (!polyline.originalStyles) return;
        
    polyline.setOptions({
      strokeColor: polyline.originalStyles.strokeColor,
      strokeWeight: polyline.originalStyles.strokeWeight,
      strokeOpacity: polyline.originalStyles.strokeOpacity,
      zIndex: polyline.originalStyles.zIndex,
    });
  }
    
  /**
     * Highlight a polygon
     * @param {Object} polygon - The polygon to highlight
     * @param {Object} options - Highlight options
     * @private
     */
  _highlightPolygon(polygon, options = {}) {
    const highlightColor = options.color || '#1a73e8';
        
    polygon.setOptions({
      strokeColor: highlightColor,
      strokeWeight: polygon.originalStyles.strokeWeight + 2,
      strokeOpacity: 1.0,
      fillOpacity: polygon.originalStyles.fillOpacity * 1.2,
      zIndex: 1000,
    });
  }
    
  /**
     * Unhighlight a polygon
     * @param {Object} polygon - The polygon to unhighlight
     * @private
     */
  _unhighlightPolygon(polygon) {
    if (!polygon.originalStyles) return;
        
    polygon.setOptions({
      strokeColor: polygon.originalStyles.strokeColor,
      strokeWeight: polygon.originalStyles.strokeWeight,
      strokeOpacity: polygon.originalStyles.strokeOpacity,
      fillColor: polygon.originalStyles.fillColor,
      fillOpacity: polygon.originalStyles.fillOpacity,
      zIndex: polygon.originalStyles.zIndex,
    });
  }
    
  /**
     * Handle feature click events
     * @param {Object} feature - The original feature
     * @param {Object} mapObject - The rendered map object
     * @param {Object} event - The click event
     * @private
     */
  _handleFeatureClick(feature, mapObject, event) {
    // Implement selection logic if needed
    // This should trigger appropriate callbacks or emit events
    if (this.options.onFeatureClick) {
      this.options.onFeatureClick({
        feature,
        renderedFeature: {
          id: feature.id,
          type: this._getFeatureType(mapObject),
          originalFeature: feature,
          renderedObject: mapObject,
        },
        originalEvent: event,
      });
    }
  }
    
  /**
     * Determine the feature type from a rendered map object
     * @param {Object} mapObject - The rendered map object
     * @returns {string} - The feature type
     * @private
     */
  _getFeatureType(mapObject) {
    if (mapObject instanceof google.maps.marker.AdvancedMarkerElement) {
      return 'point';
    } else if (mapObject instanceof google.maps.Polyline) {
      return 'line';
    } else if (mapObject instanceof google.maps.Polygon) {
      return 'polygon';
    }
    return 'unknown';
  }
    
  /**
     * Create a marker icon based on style and feature properties
     * @param {Object} style - The style configuration
     * @param {Object} feature - The feature object
     * @returns {Object} - Icon configuration object
     * @private
     */
  _createMarkerIcon(style, feature) {
    // Determine color based on style or GNSS quality
    let color = style.color;
        
    // For GNSS points, use quality-based coloring if available
    if (feature.properties?.source === 'gnss' && feature.properties?.quality !== undefined) {
      color = this._getQualityColor(feature.properties.quality) || color;
    }
        
    // Default color if none specified
    color = color || '#FF5733';
        
    // Check if we're using a dual-element marker (pin + centered dot)
    if (style.useDualMarker || style.showPinAndDot) {
      // Enhanced traditional pin marker
      const size = style.size || 32; // Larger default size
      
      // Create the main container div - this will be centered on the coordinate by Google Maps
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.width = '0';  // Zero width container
      container.style.height = '0';  // Zero height container
      
      // Create an SVG pin instead of using div
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', `${size}px`);
      svg.setAttribute('height', `${size * 1.6}px`); // Taller for pin shape
      svg.setAttribute('viewBox', '0 0 32 52');
      svg.style.position = 'absolute';
      svg.style.left = `${-size/2}px`;  // Center horizontally
      svg.style.top = `${-size * 1.6}px`;  // Position above the coordinate point
      
      // Create the traditional teardrop/pin shape
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M16 0C7.2 0 0 7.2 0 16c0 9.6 16 36 16 36s16-26.4 16-36c0-8.8-7.2-16-16-16z');
      path.setAttribute('fill', color);
      path.setAttribute('stroke', style.outlineColor || 'white');
      path.setAttribute('stroke-width', style.outlineWidth || 2);
      
      // Add the path to the SVG
      svg.appendChild(path);
      
      // Create a small dot at the exact coordinate point
      const dotElement = document.createElement('div');
      dotElement.style.position = 'absolute';
      dotElement.style.width = '6px';
      dotElement.style.height = '6px';
      dotElement.style.left = '-3px';  // Center the dot
      dotElement.style.top = '-3px';   // Center the dot
      dotElement.style.backgroundColor = 'black';
      dotElement.style.border = '1px solid white';
      dotElement.style.borderRadius = '50%';
      dotElement.style.zIndex = '10';
      
      // Add elements to container
      container.appendChild(svg);
      container.appendChild(dotElement);
      
      // Log for debugging
      console.log('Created SVG pin marker with absolute positioning from center');
      
      return { content: container };
    } else if (style.iconUrl) {
      // SIMPLE APPROACH: Image marker with absolute positioning
      const width = style.iconSize?.[0] || 32;
      const height = style.iconSize?.[1] || 32;
      
      // Create the main container div - this will be centered on the coordinate by Google Maps
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.width = '0';  // Zero width container
      container.style.height = '0';  // Zero height container
      
      // Create and position the image element
      const img = document.createElement('img');
      img.src = style.iconUrl;
      img.style.position = 'absolute';
      img.style.width = `${width}px`;
      img.style.height = `${height}px`;
      img.style.left = `${-width/2}px`;  // Center horizontally
      img.style.top = `${-height}px`;    // Bottom edge at the coordinate
      
      // Add the image to the container
      container.appendChild(img);
      
      // Log for debugging
      console.log('Created image marker with absolute positioning from center');
      
      return { content: container };
    } else {
      // SIMPLE APPROACH: Circle marker centered exactly on the coordinate
      const size = style.size || 10;
      
      // Create the circle element
      const circleDiv = document.createElement('div');
      circleDiv.style.width = `${size * 2}px`;
      circleDiv.style.height = `${size * 2}px`;
      circleDiv.style.borderRadius = '50%';
      circleDiv.style.backgroundColor = color;
      circleDiv.style.border = `${style.outlineWidth || 2}px solid ${style.outlineColor || 'white'}`;
      circleDiv.style.boxSizing = 'border-box';
      circleDiv.style.position = 'relative';
      
      // Position exactly at the center
      circleDiv.style.margin = `${-size}px 0 0 ${-size}px`;
      
      // Add crosshair if needed
      if (style.showCrosshair) {
        // Horizontal line
        const hLine = document.createElement('div');
        hLine.style.position = 'absolute';
        hLine.style.width = '80%';
        hLine.style.height = '1px';
        hLine.style.backgroundColor = 'black';
        hLine.style.left = '10%';
        hLine.style.top = '50%';
        
        // Vertical line
        const vLine = document.createElement('div');
        vLine.style.position = 'absolute';
        vLine.style.width = '1px';
        vLine.style.height = '80%';
        vLine.style.backgroundColor = 'black';
        vLine.style.left = '50%';
        vLine.style.top = '10%';
        
        circleDiv.appendChild(hLine);
        circleDiv.appendChild(vLine);
      }
      
      // Log for debugging
      console.log('Created circle marker centered on coordinate');
      
      return { content: circleDiv };
    }
  }
    
  /**
     * Check if Google Maps Advanced Markers are available
     * @returns {boolean} - Whether Advanced Markers are available
     * @private
     */
  _isAdvancedMarkerAvailable() {
    return window.google && 
              window.google.maps && 
              window.google.maps.marker && 
              window.google.maps.marker.AdvancedMarkerElement;
  }
    
  /**
     * Get color based on GNSS fix quality
     * @param {number} quality - The GNSS fix quality value
     * @returns {string} - Color hex code
     * @private
     */
  _getQualityColor(quality) {
    const qualityColors = {
      0: '#888888', // No fix - gray
      1: '#FF0000', // GPS fix - red
      2: '#FF9900', // DGPS fix - orange
      4: '#00FF00', // RTK fixed - green
      5: '#00FFFF',  // Float RTK - cyan
    };
        
    return qualityColors[quality] || '#888888';
  }
}

/**
 * Layer Management for organizing map features
 * @module gnss/survey/map/LayerManager
 */
class LayerManager {
  /**
     * Initialize the layer manager
     * @param {MapInterface} map - The map interface to manage layers for
     * @param {RenderingStrategy} renderingStrategy - The strategy for rendering features
     * @param {Object} options - Configuration options
     */
  constructor(map, renderingStrategy, options = {}) {
    this.map = map;
    this.renderingStrategy = renderingStrategy;
    this.options = options;
        
    // Layers storage - each layer contains features
    this.layers = new Map();
        
    // Selection tracking
    this.selectedFeatures = new Map();
        
    // Create default layer if specified
    if (options.defaultLayer) {
      this.createLayer(options.defaultLayer);
    }
  }
    
  /**
     * Set up event listeners for a feature
     * This ensures selection/deselection events are properly handled
     * @param {Object} feature - The feature to set up listeners for
     * @param {Object} renderedFeature - The rendered feature object
     * @private
     */
  _setupFeatureEventListeners(feature, renderedFeature) {
    if (!feature || !feature.on || typeof feature.on !== 'function') {
      console.warn('Cannot set up event listeners: feature has no event emitter');
      return;
    }
        
    // Listen for selection events
    feature.on('selected', () => {
      console.log(`Feature ${feature.id} selected event received`);
      this.selectedFeatures.set(feature.id, renderedFeature);
      this.renderingStrategy.highlightFeature(renderedFeature).catch(error => {
        console.error(`Error highlighting feature ${feature.id}:`, error);
      });
    });
        
    // Listen for deselection events
    feature.on('deselected', () => {
      console.log(`Feature ${feature.id} deselected event received`);
      this.selectedFeatures.delete(feature.id);
      this.renderingStrategy.unhighlightFeature(renderedFeature).catch(error => {
        console.error(`Error unhighlighting feature ${feature.id}:`, error);
      });
    });
  }
    
  /**
     * Create a new layer
     * @param {string} layerId - The unique identifier for the layer
     * @param {Object} options - Layer options
     * @returns {Object} - The created layer
     */
  createLayer(layerId, options = {}) {
    if (this.layers.has(layerId)) {
      throw new Error(`Layer with ID '${layerId}' already exists`);
    }
        
    const layer = {
      id: layerId,
      options,
      features: new Map(),
      visible: options.visible !== false,
      selectable: options.selectable !== false,
      editable: options.editable !== false,
    };
        
    this.layers.set(layerId, layer);
    return layer;
  }
    
  /**
     * Remove a layer and all its features
     * @param {string} layerId - The ID of the layer to remove
     * @returns {Promise<void>} - Promise that resolves when the layer is removed
     */
  async removeLayer(layerId) {
    if (!this.layers.has(layerId)) {
      return Promise.resolve();
    }
        
    const layer = this.layers.get(layerId);
        
    // Remove all features from the map
    const removePromises = [];
    for (const feature of layer.features.values()) {
      removePromises.push(this.renderingStrategy.removeFeature(feature));
    }
        
    await Promise.all(removePromises);
        
    // Remove the layer
    this.layers.delete(layerId);
        
    return Promise.resolve();
  }
    
  /**
     * Set layer visibility
     * @param {string} layerId - The ID of the layer
     * @param {boolean} visible - Whether the layer should be visible
     * @returns {Promise<void>} - Promise that resolves when visibility is set
     */
  async setLayerVisibility(layerId, visible) {
    if (!this.layers.has(layerId)) {
      throw new Error(`Layer with ID '${layerId}' does not exist`);
    }
        
    const layer = this.layers.get(layerId);
        
    // If visibility is already set correctly, do nothing
    if (layer.visible === visible) {
      return Promise.resolve();
    }
        
    layer.visible = visible;
        
    // Hide or show all features in the layer
    const promises = [];
    for (const feature of layer.features.values()) {
      if (visible) {
        // Re-render the feature if it was hidden
        promises.push(
          this.renderingStrategy.renderFeatureByType(
            feature.originalFeature,
            feature.type,
          ),
        );
      } else {
        // Remove the feature from the map
        promises.push(this.renderingStrategy.removeFeature(feature));
      }
    }
        
    await Promise.all(promises);
        
    return Promise.resolve();
  }
    
  /**
     * Add a feature to a layer
     * @param {string} layerId - The ID of the layer to add to
     * @param {Object} feature - The feature to add
     * @param {string} featureType - The type of feature ('point', 'line', 'polygon')
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature
     */
  async addFeature(layerId, feature, featureType, options = {}) {
    if (!this.layers.has(layerId)) {
      throw new Error(`Layer with ID '${layerId}' does not exist`);
    }
        
    const layer = this.layers.get(layerId);
        
    // Only render if the layer is visible
    let renderedFeature = null;
        
    if (layer.visible) {
      switch (featureType) {
      case 'point':
        renderedFeature = await this.renderingStrategy.renderPoint(feature, options);
        break;
                    
      case 'line':
        renderedFeature = await this.renderingStrategy.renderLine(feature, options);
        break;
                    
      case 'polygon':
        renderedFeature = await this.renderingStrategy.renderPolygon(feature, options);
        break;
                    
      default:
        throw new Error(`Unsupported feature type: ${featureType}`);
      }
    } else {
      // If layer is not visible, create a placeholder with the feature data
      const id = feature.id || `feature_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      renderedFeature = {
        id,
        originalFeature: feature,
        renderedObject: null,
        type: featureType,
        highlighted: false,
      };
    }
        
    // Store the feature in the layer
    layer.features.set(renderedFeature.id, renderedFeature);
        
    // Set up event listeners for selection/deselection
    this._setupFeatureEventListeners(feature, renderedFeature);
        
    // If the feature is already selected, apply highlighting immediately
    if (feature.selected) {
      console.log(`Feature ${feature.id} added while already selected, applying highlight`);
      this.selectedFeatures.set(feature.id, renderedFeature);
      if (renderedFeature.renderedObject) {
        this.renderingStrategy.highlightFeature(renderedFeature).catch(error => {
          console.error(`Error highlighting feature ${feature.id}:`, error);
        });
      }
    }
        
    return renderedFeature;
  }
    
  /**
     * Remove a feature from a layer
     * @param {string} layerId - The ID of the layer
     * @param {string} featureId - The ID of the feature to remove
     * @returns {Promise<void>} - Promise that resolves when the feature is removed
     */
  async removeFeature(layerId, featureId) {
    if (!this.layers.has(layerId)) {
      throw new Error(`Layer with ID '${layerId}' does not exist`);
    }
        
    const layer = this.layers.get(layerId);
        
    if (!layer.features.has(featureId)) {
      return Promise.resolve();
    }
        
    const renderedFeature = layer.features.get(featureId);
    const originalFeature = renderedFeature.originalFeature;
        
    // If this is a selected feature, remove it from selection tracking
    if (this.selectedFeatures.has(featureId)) {
      console.log(`Removing selected feature ${featureId} from selection tracking`);
      this.selectedFeatures.delete(featureId);
    }
        
    // Remove event listeners from original feature if possible
    if (originalFeature && typeof originalFeature.off === 'function') {
      console.log(`Removing event listeners from feature ${featureId}`);
      originalFeature.off('selected');
      originalFeature.off('deselected');
    }
        
    // Remove from map if it was rendered
    if (renderedFeature.renderedObject) {
      // Ensure it's unhighlighted before removal
      if (renderedFeature.renderedObject.originalStyles) {
        try {
          await this.renderingStrategy.unhighlightFeature(renderedFeature);
        } catch (error) {
          console.error(`Error unhighlighting feature before removal: ${error.message}`);
        }
      }
            
      await this.renderingStrategy.removeFeature(renderedFeature);
    }
        
    // Remove from layer
    layer.features.delete(featureId);
        
    return Promise.resolve();
  }
    
  /**
     * Update a feature in a layer
     * @param {string} layerId - The ID of the layer
     * @param {string} featureId - The ID of the feature to update
     * @param {Object} updatedFeature - The updated feature data
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the updated feature
     */
  async updateFeature(layerId, featureId, updatedFeature, options = {}) {
    if (!this.layers.has(layerId)) {
      throw new Error(`Layer with ID '${layerId}' does not exist`);
    }
        
    const layer = this.layers.get(layerId);
        
    if (!layer.features.has(featureId)) {
      throw new Error(`Feature with ID '${featureId}' does not exist in layer '${layerId}'`);
    }
        
    const existingFeature = layer.features.get(featureId);
        
    // If layer is visible, update the rendered feature
    let updatedRenderedFeature;
        
    if (layer.visible && existingFeature.renderedObject) {
      updatedRenderedFeature = await this.renderingStrategy.updateFeature(
        existingFeature,
        updatedFeature,
        options,
      );
    } else {
      // If not visible, just update the data
      updatedRenderedFeature = {
        ...existingFeature,
        originalFeature: updatedFeature,
      };
    }
        
    // Update in layer
    layer.features.set(featureId, updatedRenderedFeature);
        
    return updatedRenderedFeature;
  }
    
  /**
     * Get all layers
     * @returns {Array<Object>} - Array of layer objects
     */
  getLayers() {
    return Array.from(this.layers.values());
  }
    
  /**
     * Get a specific layer
     * @param {string} layerId - The ID of the layer to get
     * @returns {Object|null} - The layer object or null if not found
     */
  getLayer(layerId) {
    return this.layers.get(layerId) || null;
  }
    
  /**
     * Get all features in a layer
     * @param {string} layerId - The ID of the layer
     * @returns {Array<Object>} - Array of feature objects
     */
  getLayerFeatures(layerId) {
    if (!this.layers.has(layerId)) {
      throw new Error(`Layer with ID '${layerId}' does not exist`);
    }
        
    const layer = this.layers.get(layerId);
    return Array.from(layer.features.values());
  }
    
  /**
     * Get a specific feature from a layer
     * @param {string} layerId - The ID of the layer
     * @param {string} featureId - The ID of the feature
     * @returns {Object|null} - The feature object or null if not found
     */
  getFeature(layerId, featureId) {
    if (!this.layers.has(layerId)) {
      return null;
    }
        
    const layer = this.layers.get(layerId);
    return layer.features.get(featureId) || null;
  }
    
  /**
     * Fit the map view to show all features in a layer
     * @param {string} layerId - The ID of the layer
     * @param {Object} options - Options for fitting the bounds
     * @returns {Promise<void>} - Promise that resolves when the map is fitted
     */
  async fitLayerToView(layerId, options = {}) {
    if (!this.layers.has(layerId)) {
      throw new Error(`Layer with ID '${layerId}' does not exist`);
    }
        
    const layer = this.layers.get(layerId);
        
    if (layer.features.size === 0) {
      return Promise.resolve();
    }
        
    // Collect all coordinates from all features
    const allCoordinates = [];
        
    for (const feature of layer.features.values()) {
      const featureCoords = this._getFeatureCoordinates(feature);
      allCoordinates.push(...featureCoords);
    }
        
    if (allCoordinates.length === 0) {
      return Promise.resolve();
    }
        
    // Fit map to these coordinates
    await this.map.fitBounds(allCoordinates, options);
        
    return Promise.resolve();
  }
    
  /**
     * Get coordinates from a feature based on its type
     * @param {Object} feature - The feature to extract coordinates from
     * @returns {Array<Coordinate>} - Array of coordinates
     * @private
     */
  _getFeatureCoordinates(feature) {
    if (!feature.originalFeature) {
      return [];
    }
        
    switch (feature.type) {
    case 'point':
      return [feature.originalFeature.coordinate];
                
    case 'line':
    case 'polygon':
      return feature.originalFeature.coordinates || [];
                
    default:
      return [];
    }
  }
}

/**
 * Map Module - Main entry point
 * @module gnss/survey/map
 */


/**
 * Create a map instance with the specified provider
 * @param {string} provider - The map provider to use ('google', 'leaflet', etc.)
 * @param {Object} options - Configuration options for the map
 * @returns {MapInterface} - The created map instance
 */
function createMap(provider, options = {}) {
  return MapFactory.createMap(provider, options);
}

/**
 * Get a list of supported map providers
 * @returns {Array<string>} - Array of supported provider names
 */
function getSupportedProviders() {
  return MapFactory.getSupportedProviders();
}

/**
 * SimplifiedDrawingTool.js
 * A simplified drawing tool implementation for basic usage
 */


/**
 * Simplified drawing tool that works with Google Maps
 */
class SimplifiedDrawingTool extends EventEmitter {
  /**
   * Create a new SimplifiedDrawingTool instance
   * @param {Object} options - Tool configuration
   */
  constructor(options = {}) {
    super();
    
    this.map = options.map;
    this.geometryEngine = options.geometryEngine;
    
    this.options = {
      mode: 'point',
      enable3D: true,
      continuousDrawing: true,
      pointSymbol: {
        color: '#4285F4',
        size: 8,
      },
      lineSymbol: {
        color: '#4285F4',
        width: 3,
      },
      polygonSymbol: {
        fillColor: 'rgba(66, 133, 244, 0.3)',
        outlineColor: '#4285F4',
        outlineWidth: 2,
      },
      ...options,
    };
    
    this.isActive = false;
    this.listeners = [];
    this.currentFeature = null;
    this.vertices = [];
    this.markers = [];
    this.polyline = null;
    this.polygon = null;
  }
  
  /**
   * Activate the drawing tool
   * @param {Object} options - Activation options
   */
  activate(options = {}) {
    if (this.isActive) {
      this._reset();
    }
    
    // Update options
    Object.assign(this.options, options);
    
    // Mark as active
    this.isActive = true;
    
    // Add click listener to map
    this._addMapListeners();
    
    // Log activation info
    console.log(`SimplifiedDrawingTool activated in ${this.options.mode} mode`);
    
    // Emit activation event
    this.emit('activated', { mode: this.options.mode });
  }
  
  /**
   * Add map event listeners
   * @private
   */
  _addMapListeners() {
    // Remove any existing listeners first
    this._removeMapListeners();
    
    // Add click listener to map
    const clickListener = google.maps.event.addListener(this.map, 'click', this._handleMapClick.bind(this));
    this.listeners.push(clickListener);
    
    // Add mousemove listener for lines and polygons
    if (this.options.mode === 'line' || this.options.mode === 'polygon') {
      const moveListener = google.maps.event.addListener(this.map, 'mousemove', this._handleMapMouseMove.bind(this));
      this.listeners.push(moveListener);
    }
  }
  
  /**
   * Remove map event listeners
   * @private
   */
  _removeMapListeners() {
    this.listeners.forEach(listener => {
      google.maps.event.removeListener(listener);
    });
    this.listeners = [];
  }
  
  /**
   * Handle map click events
   * @param {Object} event - Google Maps click event
   * @private
   */
  _handleMapClick(event) {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    console.log(`Map clicked at ${lat}, ${lng} in ${this.options.mode} mode`);
    
    switch (this.options.mode) {
    case 'point':
      this._createPoint(lat, lng);
      break;
        
    case 'line':
      this._addLineVertex(lat, lng);
      break;
        
    case 'polygon':
      this._addPolygonVertex(lat, lng);
      break;
    }
  }
  
  /**
   * Handle map mouse move events
   * @param {Object} event - Google Maps mouse move event
   * @private
   */
  _handleMapMouseMove(event) {
    if (!this.isActive || this.vertices.length === 0) return;
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    // Update preview line/polygon
    if (this.options.mode === 'line') {
      this._updateLinePreview(lat, lng);
    } else if (this.options.mode === 'polygon') {
      this._updatePolygonPreview(lat, lng);
    }
  }
  
  /**
   * Create a point feature
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @private
   */
  _createPoint(lat, lng) {
    // Create marker
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title: `Point (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      animation: google.maps.Animation.DROP,
    });
    
    this.markers.push(marker);
    
    // Emit event
    const coordinate = new Coordinate(lat, lng, 0);
    this.emit('featureCreated', {
      type: 'point',
      coordinate: coordinate,
      marker: marker,
    });
    
    // If continuousDrawing is false, deactivate the tool
    if (!this.options.continuousDrawing) {
      this.deactivate();
    }
  }
  
  /**
   * Add a vertex to the line
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @private
   */
  _addLineVertex(lat, lng) {
    // Add vertex to line
    this.vertices.push({ lat, lng });
    
    // Create marker for vertex
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title: `Vertex ${this.vertices.length}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: this.options.lineSymbol.color,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
        scale: 6,
      },
    });
    
    this.markers.push(marker);
    
    // If this is the first vertex, create a new polyline
    if (this.vertices.length === 1) {
      this.polyline = new google.maps.Polyline({
        path: this.vertices,
        geodesic: true,
        strokeColor: this.options.lineSymbol.color,
        strokeOpacity: 1.0,
        strokeWeight: this.options.lineSymbol.width,
        map: this.map,
      });
    } else {
      // Otherwise update the existing polyline
      this.polyline.setPath(this.vertices);
      
      // If double-clicked and we have at least 2 points, complete the line
      if (this.vertices.length >= 2) {
        // Double-click is handled automatically by listening for two clicks in quick succession
        const now = Date.now();
        if (this._lastClickTime && now - this._lastClickTime < 300) {
          this._completeLine();
          return;
        }
        this._lastClickTime = now;
      }
    }
  }
  
  /**
   * Add a vertex to the polygon
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @private
   */
  _addPolygonVertex(lat, lng) {
    // Add vertex to polygon
    this.vertices.push({ lat, lng });
    
    // Create marker for vertex
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title: `Vertex ${this.vertices.length}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: this.options.polygonSymbol.outlineColor,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
        scale: 6,
      },
    });
    
    this.markers.push(marker);
    
    // If this is the first vertex, create a new polygon
    if (this.vertices.length === 1) {
      // Start with a polyline until we have 3 points
      this.polyline = new google.maps.Polyline({
        path: this.vertices,
        geodesic: true,
        strokeColor: this.options.polygonSymbol.outlineColor,
        strokeOpacity: 1.0,
        strokeWeight: this.options.polygonSymbol.outlineWidth,
        map: this.map,
      });
    } else if (this.vertices.length === 3) {
      // With 3 points, we can create a polygon
      if (this.polyline) {
        this.polyline.setMap(null);
        this.polyline = null;
      }
      
      // Create polygon
      this.polygon = new google.maps.Polygon({
        paths: [...this.vertices, this.vertices[0]],
        strokeColor: this.options.polygonSymbol.outlineColor,
        strokeOpacity: 1.0,
        strokeWeight: this.options.polygonSymbol.outlineWidth,
        fillColor: this.options.polygonSymbol.fillColor,
        fillOpacity: 0.35,
        map: this.map,
      });
      
      // Double-click is handled automatically by listening for two clicks in quick succession
      const now = Date.now();
      if (this._lastClickTime && now - this._lastClickTime < 300) {
        this._completePolygon();
        return;
      }
      this._lastClickTime = now;
    } else if (this.vertices.length > 3) {
      // Update existing polygon
      this.polygon.setPaths([...this.vertices, this.vertices[0]]);
      
      // Double-click is handled automatically by listening for two clicks in quick succession
      const now = Date.now();
      if (this._lastClickTime && now - this._lastClickTime < 300) {
        this._completePolygon();
        return;
      }
      this._lastClickTime = now;
    } else {
      // Update polyline
      this.polyline.setPath(this.vertices);
    }
  }
  
  /**
   * Update the line preview
   * @param {number} lat - Current mouse latitude
   * @param {number} lng - Current mouse longitude
   * @private
   */
  _updateLinePreview(lat, lng) {
    if (this.vertices.length === 0 || !this.polyline) return;
    
    // Create a preview path with the current vertices plus the mouse position
    const previewPath = [...this.vertices, { lat, lng }];
    this.polyline.setPath(previewPath);
  }
  
  /**
   * Update the polygon preview
   * @param {number} lat - Current mouse latitude
   * @param {number} lng - Current mouse longitude
   * @private
   */
  _updatePolygonPreview(lat, lng) {
    if (this.vertices.length === 0) return;
    
    if (this.vertices.length < 3) {
      // If we have less than 3 vertices, update the polyline
      if (this.polyline) {
        const previewPath = [...this.vertices, { lat, lng }];
        this.polyline.setPath(previewPath);
      }
    } else {
      // If we have 3 or more vertices, update the polygon
      if (this.polygon) {
        const previewPath = [...this.vertices, { lat, lng }, this.vertices[0]];
        this.polygon.setPaths(previewPath);
      }
    }
  }
  
  /**
   * Complete the line drawing
   * @private
   */
  _completeLine() {
    if (this.vertices.length < 2) return;
    
    // Create final polyline
    const finalLine = new google.maps.Polyline({
      path: this.vertices,
      geodesic: true,
      strokeColor: this.options.lineSymbol.color,
      strokeOpacity: 1.0,
      strokeWeight: this.options.lineSymbol.width,
      map: this.map,
    });
    
    // Emit event
    const coordinates = this.vertices.map(v => new Coordinate(v.lat, v.lng, 0));
    this.emit('featureCreated', {
      type: 'line',
      coordinates: coordinates,
      polyline: finalLine,
    });
    
    // Reset the drawing
    this._reset();
    
    // If continuousDrawing is false, deactivate
    if (!this.options.continuousDrawing) {
      this.deactivate();
    }
  }
  
  /**
   * Complete the polygon drawing
   * @private
   */
  _completePolygon() {
    if (this.vertices.length < 3) return;
    
    // Create final polygon
    const finalPolygon = new google.maps.Polygon({
      paths: this.vertices,
      strokeColor: this.options.polygonSymbol.outlineColor,
      strokeOpacity: 1.0,
      strokeWeight: this.options.polygonSymbol.outlineWidth,
      fillColor: this.options.polygonSymbol.fillColor,
      fillOpacity: 0.35,
      map: this.map,
    });
    
    // Emit event
    const coordinates = this.vertices.map(v => new Coordinate(v.lat, v.lng, 0));
    this.emit('featureCreated', {
      type: 'polygon',
      coordinates: coordinates,
      polygon: finalPolygon,
    });
    
    // Reset the drawing
    this._reset();
    
    // If continuousDrawing is false, deactivate
    if (!this.options.continuousDrawing) {
      this.deactivate();
    }
  }
  
  /**
   * Reset the drawing state
   * @private
   */
  _reset() {
    // Clear temporary markers
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
    
    // Clear temporary polyline
    if (this.polyline) {
      this.polyline.setMap(null);
      this.polyline = null;
    }
    
    // Clear temporary polygon
    if (this.polygon) {
      this.polygon.setMap(null);
      this.polygon = null;
    }
    
    // Reset vertices
    this.vertices = [];
    
    // Reset last click time
    this._lastClickTime = null;
  }
  
  /**
   * Deactivate the drawing tool
   */
  deactivate() {
    if (!this.isActive) return;
    
    // Remove listeners
    this._removeMapListeners();
    
    // Reset drawing state
    this._reset();
    
    // Mark as inactive
    this.isActive = false;
    
    // Emit deactivation event
    this.emit('deactivated');
  }
}

/**
 * GIS Survey Module - Main entry point
 *
 * This module provides a complete set of 3D-first, map-agnostic survey tools
 * for geospatial applications. It supports full 3D visualization and
 * calculations, and can optionally integrate with GNSS receivers.
 */


/**
 * Initialize the survey module.
 *
 * @param {Object} [options] - Initialization options
 * @param {Object} [options.core] - Core module options
 * @param {Object} [options.map] - Map provider options
 * @returns {Promise<Object>} Promise that resolves to the survey interface
 */
async function initialize(options = {}) {
  // Initialize the core coordinate system and geometry engine
  await initializeCore(options.core);

  // Return an interface with core functionality implemented
  return {
    version: VERSION,
    core: {
      initialized: true,
      Coordinate,
      GeometryEngine,
      GeoidModel,
      CoordinateUtils,
      TransformerFactory,
    },
  };
}

/**
 * Create a new Survey instance.
 * @param {Object} mapInstance - The map instance to use
 * @param {string} mapType - The type of map provider ('google', 'leaflet', 'cesium')
 * @param {Object} [options] - Configuration options
 * @returns {Promise<Object>} A promise that resolves to the SurveyManager instance
 */
async function createSurvey(mapInstance, mapType, options = {}) {
  // Initialize the survey module
  await initialize(options);

  // Create appropriate map adapter
  const mapInterface = MapFactory$1.createMap(mapType, {
    mapInstance,
    ...options.mapOptions,
  });

  // Create the survey manager
  const surveyManager = new SurveyManager({
    mapInterface,
    settings: {
      enable3D: options.enable3D === undefined ? true : options.enable3D,
      continuousDrawing: options.continuousDrawing === undefined ? true : options.continuousDrawing,
      autoSave: options.autoSave || false,
      undoLevels: options.undoLevels || 20,
      elevationProvider: options.elevationProvider || 'mapInterface',
      ...options.settings,
    },
  });

  // Initialize layer manager if needed
  if (options.initializeLayers !== false) {
    const renderingStrategy = mapType === 'google' ?
      new GoogleMapsRenderingStrategy(mapInterface) :
      new RenderingStrategy(mapInterface);

    surveyManager.layerManager = new LayerManager(mapInterface, renderingStrategy, {
      defaultLayer: 'main',
    });

    // Create standard layers
    surveyManager.layerManager.createLayer('points', { name: 'Points', visible: true });
    surveyManager.layerManager.createLayer('lines', { name: 'Lines', visible: true });
    surveyManager.layerManager.createLayer('polygons', { name: 'Polygons', visible: true });
    surveyManager.layerManager.createLayer('working', {
      name: 'Working Features',
      visible: true,
      zIndex: 1000,
    });
  }

  return surveyManager;
}

// Create a namespace for survey module
const Survey = {
  Manager: SurveyManager,
  Core: {
    Coordinate,
    GeometryEngine,
    GeoidModel,
    CoordinateUtils,
    TransformerFactory,
    CoordinateTransformer,
    SimpleWGS84Transformer,
    EventEmitter,
  },
  Features: {
    FeatureBase,
    PointFeature,
    LineFeature,
    PolygonFeature,
    FeatureCollection,
    createPoint,
    createLine,
    createPolygon,
    createFeatureCollection,
    importFromGeoJSON,
  },
  Map: {
    MapInterface,
    Map3DInterface,
    ElevationService,
    GoogleMapsAdapter,
    LeafletAdapter,
    GoogleMapsElevationService,
    MapFactory: MapFactory$1,
    LayerManager,
    RenderingStrategy,
    GoogleMapsRenderingStrategy,
    createMap,
    getSupportedProviders,
  },
  Tools: {
    DrawingTool,
    MeasurementTool,
    EditingTool,
    OffsetTool,
    SnappingManager,
    ToolBase,
    SimplifiedDrawingTool,
  },
};

// Export version and build information
const VERSION = '1.0.0';
const BUILD_DATE = new Date().toISOString();

export { BUILD_DATE, Coordinate, CoordinateTransformer, CoordinateUtils, DrawingTool, EditingTool, ElevationService, EventEmitter, FeatureBase, FeatureCollection, GeoidModel, GeometryEngine, GoogleMapsAdapter, GoogleMapsElevationService, GoogleMapsRenderingStrategy, LayerManager, LeafletAdapter, LineFeature, Map3DInterface, MapFactory$1 as MapFactory, MapInterface, MeasurementTool, OffsetTool, PointFeature, PolygonFeature, RenderingStrategy, SimpleWGS84Transformer, SimplifiedDrawingTool, SnappingManager, Survey, SurveyManager, ToolBase, TransformerFactory, VERSION, createFeatureCollection, createLine, createMap, createPoint, createPolygon, createSurvey, getSupportedProviders, importFromGeoJSON, initialize, initializeCore };
//# sourceMappingURL=gis-survey.esm.js.map
