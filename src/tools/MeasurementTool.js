/**
 * MeasurementTool.js
 * Tool for measuring distances, areas, and volumes
 * Part of the RTK Surveyor 3D-first implementation
 */

import { ToolBase } from './ToolBase.js';
import { LineFeature } from '../features/LineFeature.js';
import { PolygonFeature } from '../features/PolygonFeature.js';
import { PointFeature } from '../features/PointFeature.js';
import { GeometryEngine } from '../core/GeometryEngine.js';

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
export class MeasurementTool extends ToolBase {
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
        strokeWidth: 3
      }
    }, options);
    
    // Initialize internal state
    this.workingData = {
      activeMeasurement: null,
      measurements: [],
      points: [],
      mousePosition: null,
      hoverCoordinate: null,
      measurementLabels: [],
      segmentLabels: []
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
            temporary: true
          },
          style: this.options.lineSymbol
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
            temporary: true
          },
          style: Object.assign({}, this.manager.settings.defaultPolygonSymbol, {
            outlineColor: this.options.lineSymbol.color,
            outlineWidth: this.options.lineSymbol.width
          })
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
        { includeElevation: this.options.enable3D }
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
        temporary: true
      },
      style: this.options.pointSymbol
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
        preview: preview
      });
      
      // Create overall measurement label
      if (this.options.showTotalLength) {
        const labelPosition = this._calculateLabelPosition();
        
        const measurementLabel = this.mapInterface.createLabel({
          position: labelPosition,
          text: formattedValue,
          style: this.options.labelStyle
        });
        
        this.workingData.measurementLabels.push(measurementLabel);
      }
      
      // Create segment labels if enabled
      if (this.options.showSegmentLengths && segmentValues.length > 0) {
        segmentValues.forEach((segment, index) => {
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
              font: '10px Arial'
            })
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
      mode: this.options.mode
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
        { includeElevation: this.options.enable3D }
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
        { includeElevation: this.options.enable3D }
      );
      
      // Calculate midpoint for label placement
      // Create a simple midpoint calculation since GeometryEngine doesn't have interpolate
      const midpoint = {
        lat: (start.lat + end.lat) / 2,
        lng: (start.lng + end.lng) / 2,
        elevation: (start.elevation !== undefined && end.elevation !== undefined) ? 
          (start.elevation + end.elevation) / 2 : 0
      };
      
      // Convert to requested units
      const convertedDistance = this._convertDistance(segmentDistance, 'meters', this.options.units);
      
      segments.push({
        value: convertedDistance,
        midpoint: midpoint
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
      includeElevation: this.options.enable3D
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
      volume: this.options.volumeUnits
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
      enable3D: this.options.enable3D
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