/**
 * SimplifiedDrawingTool.js
 * A simplified drawing tool implementation for basic usage
 */

import { EventEmitter } from '../core/event-emitter.js';
import { Coordinate } from '../core/Coordinate.js';

/**
 * Simplified drawing tool that works with Google Maps
 */
export class SimplifiedDrawingTool extends EventEmitter {
  /**
   * Create a new SimplifiedDrawingTool instance
   * @param {Object} options - Tool configuration
   */
  constructor(options = {}) {
    super();
    
    this.map = options.map;
    this.geometryEngine = options.geometryEngine;
    
    this.options = {
      mode: 'point',
      enable3D: true,
      continuousDrawing: true,
      pointSymbol: {
        color: '#4285F4',
        size: 8
      },
      lineSymbol: {
        color: '#4285F4',
        width: 3
      },
      polygonSymbol: {
        fillColor: 'rgba(66, 133, 244, 0.3)',
        outlineColor: '#4285F4',
        outlineWidth: 2
      },
      ...options
    };
    
    this.isActive = false;
    this.listeners = [];
    this.currentFeature = null;
    this.vertices = [];
    this.markers = [];
    this.polyline = null;
    this.polygon = null;
  }
  
  /**
   * Activate the drawing tool
   * @param {Object} options - Activation options
   */
  activate(options = {}) {
    if (this.isActive) {
      this._reset();
    }
    
    // Update options
    Object.assign(this.options, options);
    
    // Mark as active
    this.isActive = true;
    
    // Add click listener to map
    this._addMapListeners();
    
    // Log activation info
    console.log(`SimplifiedDrawingTool activated in ${this.options.mode} mode`);
    
    // Emit activation event
    this.emit('activated', { mode: this.options.mode });
  }
  
  /**
   * Add map event listeners
   * @private
   */
  _addMapListeners() {
    // Remove any existing listeners first
    this._removeMapListeners();
    
    // Add click listener to map
    const clickListener = google.maps.event.addListener(this.map, 'click', this._handleMapClick.bind(this));
    this.listeners.push(clickListener);
    
    // Add mousemove listener for lines and polygons
    if (this.options.mode === 'line' || this.options.mode === 'polygon') {
      const moveListener = google.maps.event.addListener(this.map, 'mousemove', this._handleMapMouseMove.bind(this));
      this.listeners.push(moveListener);
    }
  }
  
  /**
   * Remove map event listeners
   * @private
   */
  _removeMapListeners() {
    this.listeners.forEach(listener => {
      google.maps.event.removeListener(listener);
    });
    this.listeners = [];
  }
  
  /**
   * Handle map click events
   * @param {Object} event - Google Maps click event
   * @private
   */
  _handleMapClick(event) {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    console.log(`Map clicked at ${lat}, ${lng} in ${this.options.mode} mode`);
    
    switch (this.options.mode) {
      case 'point':
        this._createPoint(lat, lng);
        break;
        
      case 'line':
        this._addLineVertex(lat, lng);
        break;
        
      case 'polygon':
        this._addPolygonVertex(lat, lng);
        break;
    }
  }
  
  /**
   * Handle map mouse move events
   * @param {Object} event - Google Maps mouse move event
   * @private
   */
  _handleMapMouseMove(event) {
    if (!this.isActive || this.vertices.length === 0) return;
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    // Update preview line/polygon
    if (this.options.mode === 'line') {
      this._updateLinePreview(lat, lng);
    } else if (this.options.mode === 'polygon') {
      this._updatePolygonPreview(lat, lng);
    }
  }
  
  /**
   * Create a point feature
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @private
   */
  _createPoint(lat, lng) {
    // Create marker
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title: `Point (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
      animation: google.maps.Animation.DROP
    });
    
    this.markers.push(marker);
    
    // Emit event
    const coordinate = new Coordinate(lat, lng, 0);
    this.emit('featureCreated', {
      type: 'point',
      coordinate: coordinate,
      marker: marker
    });
    
    // If continuousDrawing is false, deactivate the tool
    if (!this.options.continuousDrawing) {
      this.deactivate();
    }
  }
  
  /**
   * Add a vertex to the line
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @private
   */
  _addLineVertex(lat, lng) {
    // Add vertex to line
    this.vertices.push({ lat, lng });
    
    // Create marker for vertex
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title: `Vertex ${this.vertices.length}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: this.options.lineSymbol.color,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
        scale: 6
      }
    });
    
    this.markers.push(marker);
    
    // If this is the first vertex, create a new polyline
    if (this.vertices.length === 1) {
      this.polyline = new google.maps.Polyline({
        path: this.vertices,
        geodesic: true,
        strokeColor: this.options.lineSymbol.color,
        strokeOpacity: 1.0,
        strokeWeight: this.options.lineSymbol.width,
        map: this.map
      });
    } else {
      // Otherwise update the existing polyline
      this.polyline.setPath(this.vertices);
      
      // If double-clicked and we have at least 2 points, complete the line
      if (this.vertices.length >= 2) {
        // Double-click is handled automatically by listening for two clicks in quick succession
        const now = Date.now();
        if (this._lastClickTime && now - this._lastClickTime < 300) {
          this._completeLine();
          return;
        }
        this._lastClickTime = now;
      }
    }
  }
  
  /**
   * Add a vertex to the polygon
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @private
   */
  _addPolygonVertex(lat, lng) {
    // Add vertex to polygon
    this.vertices.push({ lat, lng });
    
    // Create marker for vertex
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title: `Vertex ${this.vertices.length}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: this.options.polygonSymbol.outlineColor,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
        scale: 6
      }
    });
    
    this.markers.push(marker);
    
    // If this is the first vertex, create a new polygon
    if (this.vertices.length === 1) {
      // Start with a polyline until we have 3 points
      this.polyline = new google.maps.Polyline({
        path: this.vertices,
        geodesic: true,
        strokeColor: this.options.polygonSymbol.outlineColor,
        strokeOpacity: 1.0,
        strokeWeight: this.options.polygonSymbol.outlineWidth,
        map: this.map
      });
    } else if (this.vertices.length === 3) {
      // With 3 points, we can create a polygon
      if (this.polyline) {
        this.polyline.setMap(null);
        this.polyline = null;
      }
      
      // Create polygon
      this.polygon = new google.maps.Polygon({
        paths: [...this.vertices, this.vertices[0]],
        strokeColor: this.options.polygonSymbol.outlineColor,
        strokeOpacity: 1.0,
        strokeWeight: this.options.polygonSymbol.outlineWidth,
        fillColor: this.options.polygonSymbol.fillColor,
        fillOpacity: 0.35,
        map: this.map
      });
      
      // Double-click is handled automatically by listening for two clicks in quick succession
      const now = Date.now();
      if (this._lastClickTime && now - this._lastClickTime < 300) {
        this._completePolygon();
        return;
      }
      this._lastClickTime = now;
    } else if (this.vertices.length > 3) {
      // Update existing polygon
      this.polygon.setPaths([...this.vertices, this.vertices[0]]);
      
      // Double-click is handled automatically by listening for two clicks in quick succession
      const now = Date.now();
      if (this._lastClickTime && now - this._lastClickTime < 300) {
        this._completePolygon();
        return;
      }
      this._lastClickTime = now;
    } else {
      // Update polyline
      this.polyline.setPath(this.vertices);
    }
  }
  
  /**
   * Update the line preview
   * @param {number} lat - Current mouse latitude
   * @param {number} lng - Current mouse longitude
   * @private
   */
  _updateLinePreview(lat, lng) {
    if (this.vertices.length === 0 || !this.polyline) return;
    
    // Create a preview path with the current vertices plus the mouse position
    const previewPath = [...this.vertices, { lat, lng }];
    this.polyline.setPath(previewPath);
  }
  
  /**
   * Update the polygon preview
   * @param {number} lat - Current mouse latitude
   * @param {number} lng - Current mouse longitude
   * @private
   */
  _updatePolygonPreview(lat, lng) {
    if (this.vertices.length === 0) return;
    
    if (this.vertices.length < 3) {
      // If we have less than 3 vertices, update the polyline
      if (this.polyline) {
        const previewPath = [...this.vertices, { lat, lng }];
        this.polyline.setPath(previewPath);
      }
    } else {
      // If we have 3 or more vertices, update the polygon
      if (this.polygon) {
        const previewPath = [...this.vertices, { lat, lng }, this.vertices[0]];
        this.polygon.setPaths(previewPath);
      }
    }
  }
  
  /**
   * Complete the line drawing
   * @private
   */
  _completeLine() {
    if (this.vertices.length < 2) return;
    
    // Create final polyline
    const finalLine = new google.maps.Polyline({
      path: this.vertices,
      geodesic: true,
      strokeColor: this.options.lineSymbol.color,
      strokeOpacity: 1.0,
      strokeWeight: this.options.lineSymbol.width,
      map: this.map
    });
    
    // Emit event
    const coordinates = this.vertices.map(v => new Coordinate(v.lat, v.lng, 0));
    this.emit('featureCreated', {
      type: 'line',
      coordinates: coordinates,
      polyline: finalLine
    });
    
    // Reset the drawing
    this._reset();
    
    // If continuousDrawing is false, deactivate
    if (!this.options.continuousDrawing) {
      this.deactivate();
    }
  }
  
  /**
   * Complete the polygon drawing
   * @private
   */
  _completePolygon() {
    if (this.vertices.length < 3) return;
    
    // Create final polygon
    const finalPolygon = new google.maps.Polygon({
      paths: this.vertices,
      strokeColor: this.options.polygonSymbol.outlineColor,
      strokeOpacity: 1.0,
      strokeWeight: this.options.polygonSymbol.outlineWidth,
      fillColor: this.options.polygonSymbol.fillColor,
      fillOpacity: 0.35,
      map: this.map
    });
    
    // Emit event
    const coordinates = this.vertices.map(v => new Coordinate(v.lat, v.lng, 0));
    this.emit('featureCreated', {
      type: 'polygon',
      coordinates: coordinates,
      polygon: finalPolygon
    });
    
    // Reset the drawing
    this._reset();
    
    // If continuousDrawing is false, deactivate
    if (!this.options.continuousDrawing) {
      this.deactivate();
    }
  }
  
  /**
   * Reset the drawing state
   * @private
   */
  _reset() {
    // Clear temporary markers
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
    
    // Clear temporary polyline
    if (this.polyline) {
      this.polyline.setMap(null);
      this.polyline = null;
    }
    
    // Clear temporary polygon
    if (this.polygon) {
      this.polygon.setMap(null);
      this.polygon = null;
    }
    
    // Reset vertices
    this.vertices = [];
    
    // Reset last click time
    this._lastClickTime = null;
  }
  
  /**
   * Deactivate the drawing tool
   */
  deactivate() {
    if (!this.isActive) return;
    
    // Remove listeners
    this._removeMapListeners();
    
    // Reset drawing state
    this._reset();
    
    // Mark as inactive
    this.isActive = false;
    
    // Emit deactivation event
    this.emit('deactivated');
  }
}