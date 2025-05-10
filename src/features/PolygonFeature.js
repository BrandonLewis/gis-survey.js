/**
 * Polygon feature class for survey areas
 * @module gnss/survey/features/PolygonFeature
 */
import { FeatureBase } from './FeatureBase.js';
import { LineFeature } from './LineFeature.js';
import { Coordinate } from '../core/Coordinate.js';
import { GeometryEngine } from '../core/GeometryEngine.js';

export class PolygonFeature extends FeatureBase {
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