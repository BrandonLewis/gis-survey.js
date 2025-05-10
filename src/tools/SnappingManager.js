/**
 * SnappingManager.js
 * Manager for snapping functionality between features
 * Part of the RTK Surveyor 3D-first implementation
 */

import { EventEmitter } from '../core/event-emitter.js';
import { PointFeature } from '../features/PointFeature.js';

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
export class SnappingManager extends EventEmitter {
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