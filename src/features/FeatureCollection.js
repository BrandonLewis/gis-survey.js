/**
 * Feature collection for managing groups of features
 * @module gnss/survey/features/FeatureCollection
 */
import { EventEmitter } from '../core/event-emitter.js';
import { FeatureBase } from './FeatureBase.js';
import { PointFeature } from './PointFeature.js';
import { LineFeature } from './LineFeature.js';
import { PolygonFeature } from './PolygonFeature.js';
import { Coordinate } from '../core/Coordinate.js';

/**
 * Class for managing collections of features
 */
export class FeatureCollection extends EventEmitter {
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