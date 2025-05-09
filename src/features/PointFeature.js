/**
 * Point feature class for survey points
 * @module gnss/survey/features/PointFeature
 */
import { FeatureBase } from './FeatureBase.js';
import { Coordinate } from '../core/Coordinate.js';
import { GeometryEngine } from '../core/GeometryEngine.js';

export class PointFeature extends FeatureBase {
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
        const elevation = coordinate.elevation !== undefined ? coordinate.elevation : 
          (coordinate.alt !== undefined ? coordinate.alt : null);
                
        // Create compatible coordinate object
        this.coordinate = {
          lat: coordinate.latitude,
          lng: coordinate.longitude,
          elevation: elevation,
          toString: function() { return `${this.lat}, ${this.lng}, ${this.elevation || 0}`; },
        };
      } else if (coordinate.lat !== undefined && coordinate.lng !== undefined) {
        // Google Maps-style object with lat/lng - use directly with minimal modifications
        const elevation = coordinate.elevation !== undefined ? coordinate.elevation : 
          (coordinate.alt !== undefined ? coordinate.alt : null);
                
        // Ensure it has all expected properties
        if (!coordinate.toString) {
          coordinate.toString = function() { return `${this.lat}, ${this.lng}, ${this.elevation || 0}`; };
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
  fromGeoJSON(geojson, options = {}) {
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