/**
 * Line feature class for survey lines and polylines
 * @module gnss/survey/features/LineFeature
 */
import { FeatureBase } from './FeatureBase.js';
import { Coordinate } from '../core/Coordinate.js';
import { GeometryEngine } from '../core/GeometryEngine.js';

export class LineFeature extends FeatureBase {
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