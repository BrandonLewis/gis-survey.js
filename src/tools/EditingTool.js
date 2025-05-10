/**
 * EditingTool.js
 * Tool for editing features with 3D vertex manipulation
 * Part of the RTK Surveyor 3D-first implementation
 */

import { ToolBase } from './ToolBase.js';
import { PointFeature } from '../features/PointFeature.js';
import { LineFeature as _LineFeature } from '../features/LineFeature.js';
import { PolygonFeature as _PolygonFeature } from '../features/PolygonFeature.js';

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
export class EditingTool extends ToolBase {
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