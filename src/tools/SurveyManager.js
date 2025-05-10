/**
 * SurveyManager.js
 * Central manager for all survey operations and tools
 * Part of the RTK Surveyor 3D-first implementation
 */

import { EventEmitter } from '../core/event-emitter.js';
import { FeatureCollection } from '../features/FeatureCollection.js';
import { GeometryEngine } from '../core/GeometryEngine.js';

// Import all survey tools
import { MeasurementTool } from './MeasurementTool.js';
import { OffsetTool } from './OffsetTool.js';
import { DrawingTool } from './DrawingTool.js';
import { EditingTool } from './EditingTool.js';
import { SnappingManager } from './SnappingManager.js';

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
export class SurveyManager extends EventEmitter {
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
      const { PointFeature } = await import('../features/PointFeature.js');
      const { Coordinate } = await import('../core/Coordinate.js');

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