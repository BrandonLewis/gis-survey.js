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

import { ToolBase } from './ToolBase.js';
import { PointFeature } from '../features/PointFeature.js';
import { LineFeature } from '../features/LineFeature.js';
import { PolygonFeature } from '../features/PolygonFeature.js';
import { Coordinate } from '../core/Coordinate.js';

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
export class DrawingTool extends ToolBase {
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
      pointSymbol: this.manager.settings.defaultPointSymbol,
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
        // Use dual marker for vertices too for better position clarity
        useDualMarker: true,
      },
      // Enhanced vertexSymbol with style for active vertices
      activeVertexSymbol: {
        type: 'circle',
        size: 10,
        color: '#3388FF',
        outlineWidth: 2,
        outlineColor: 'white',
        // Use dual marker for vertices too for better position clarity
        useDualMarker: true,
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
      
      // Log activation state for debugging
      console.log(`DrawingTool activated with mode=${this.options.mode}, continuousDrawing=${this.options.continuousDrawing}`);
      
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
      console.log('Created new empty LineFeature for drawing with preview style');
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
        console.log('Created new PolygonFeature for drawing with preview style');
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
      console.log('Created new empty LineFeature for freehand drawing with preview style');
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
      console.log('Using snapped coordinate:', coordinate);
    } else if (event.coordinate) {
      coordinate = event.coordinate;
      console.log('Using coordinate from event object:', coordinate);
    } else if (event.originalEvent && event.latLng) {
      // Handle Google Maps native events if adapter didn't convert properly
      coordinate = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
        elevation: 0,
      };
      console.log('Using raw coordinates from Google Maps event:', coordinate);
    } else {
      console.error('❌ ERROR: Invalid click event, no coordinate found', event);
      return;
    }
    
    console.log(`DrawingTool handling click in ${this.options.mode} mode at:`, 
      coordinate.lat, coordinate.lng, `(continuousDrawing=${this.options.continuousDrawing})`);
    
    try {
      // Handle based on mode
      switch (this.options.mode) {
      case 'point':
        // Create a point at the clicked location
        console.log('Creating point feature at click location');
        this._createPoint(coordinate);
        break;
          
      case 'line':
      case 'polygon':
        // Add vertex to the feature
        console.log(`Adding vertex to ${this.options.mode} at click location`);
        this._addVertex(coordinate);
        break;
      }
      
      console.log('✅ Click successfully processed');
    } catch (error) {
      console.error(`❌ ERROR handling map click in ${this.options.mode} mode:`, error);
      
      // On error, try to recover by starting a new drawing
      // This prevents the tool from getting stuck in a broken state
      console.log('Attempting to recover by starting a new drawing');
      setTimeout(() => {
        this._startNewDrawing();
      }, 10);
    }
    
    console.log('======== END CLICK EVENT ========');
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
  _handleMapMouseUp(event) {
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
      
      // Create a style object with dual marker enabled
      const pointStyle = {
        ...this.options.pointSymbol,
        useDualMarker: true, // Enable the pin + dot dual marker for better position clarity
      };
      
      const pointFeature = new PointFeature(validCoord, {
        id: `point-${Date.now()}`,
        properties: {
          type: 'drawing',
          drawingType: 'point',
          temporary: false,
        },
        style: pointStyle,
      });
      
      console.log(`Created point at ${validCoord.lat}, ${validCoord.lng}`);
      
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
        } catch (error) {
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