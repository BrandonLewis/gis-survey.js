/**
 * OffsetTool.js
 * Tool for creating offset points, lines and features
 * Part of the RTK Surveyor 3D-first implementation
 */

import { ToolBase } from './ToolBase.js';
import { PointFeature } from '../features/PointFeature.js';
import { LineFeature } from '../features/LineFeature.js';
import { Coordinate } from '../core/Coordinate.js';
import { GeometryEngine } from '../core/GeometryEngine.js';

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
export class OffsetTool extends ToolBase {
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
    let targetPoint;
    
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