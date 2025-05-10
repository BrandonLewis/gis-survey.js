/**
 * Base abstract class for all survey features
 * @module gnss/survey/features/FeatureBase
 */
import { EventEmitter } from '../core/event-emitter.js';

export class FeatureBase extends EventEmitter {
  /**
     * Initialize a feature
     * @param {Object} options - Configuration options for the feature
     * @param {string} [options.id] - Unique identifier for the feature
     * @param {string} [options.name] - Human-readable name for the feature
     * @param {Object} [options.style] - Style properties for the feature
     * @param {Object} [options.properties] - Custom properties for the feature
     * @param {Object} [options.metadata] - Metadata related to the feature
     */
  constructor(options = {}) {
    super();
        
    if (this.constructor === FeatureBase) {
      throw new Error('Abstract class \'FeatureBase\' cannot be instantiated directly.');
    }
        
    this.id = options.id || `feature_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    this.name = options.name || `Feature ${this.id.substr(-4)}`;
    this.type = 'feature';
    this.style = options.style || {};
    this.properties = options.properties || {};
    this.metadata = options.metadata || {};
    this.selected = false;
    this.visible = options.visible !== false;
    this.editable = options.editable !== false;
    this.interactive = options.interactive !== false;
    this.rendered = null;
    this.timestamp = options.timestamp || Date.now();
    this.sourceData = options.sourceData || null;
  }
    
  /**
     * Get the feature type string
     * @returns {string} - The feature type
     */
  getType() {
    return this.type;
  }
    
  /**
     * Get the feature's bounds
     * @returns {Object} - The bounds object with northEast and southWest coordinates
     */
  getBounds() {
    throw new Error('Method \'getBounds()\' must be implemented.');
  }
    
  /**
     * Get the feature's center coordinate
     * @returns {Coordinate} - The center coordinate
     */
  getCenter() {
    throw new Error('Method \'getCenter()\' must be implemented.');
  }
    
  /**
     * Get the elevation range of the feature
     * @returns {Object} - Object with min and max elevations
     */
  getElevationRange() {
    throw new Error('Method \'getElevationRange()\' must be implemented.');
  }
    
  /**
     * Check if the feature contains a coordinate
     * @param {Coordinate} coordinate - The coordinate to check
     * @param {Object} [options] - Tolerance and other options
     * @returns {boolean} - True if the feature contains the coordinate
     */
  contains(_coordinate, _options = {}) {
    throw new Error('Method \'contains()\' must be implemented.');
  }
    
  /**
     * Find the nearest point on the feature to a given coordinate
     * @param {Coordinate} coordinate - The reference coordinate
     * @returns {Object} - Object with the nearest point and distance
     */
  nearest(_coordinate) {
    throw new Error('Method \'nearest()\' must be implemented.');
  }
    
  /**
     * Export the feature to GeoJSON
     * @param {Object} [options] - Export options
     * @returns {Object} - GeoJSON representation of the feature
     */
  toGeoJSON(_options = {}) {
    throw new Error('Method \'toGeoJSON()\' must be implemented.');
  }
    
  /**
     * Import feature from GeoJSON
     * @param {Object} geojson - GeoJSON object to import
     * @param {Object} [options] - Import options
     * @returns {boolean} - Success status
     */
  fromGeoJSON(_geojson, _options = {}) {
    throw new Error('Method \'fromGeoJSON()\' must be implemented.');
  }
    
  /**
     * Clone this feature
     * @returns {FeatureBase} - A new feature instance that is a copy of this one
     */
  clone() {
    throw new Error('Method \'clone()\' must be implemented.');
  }
    
  /**
     * Set the feature's style
     * @param {Object} style - Style properties
     * @param {Object} [options] - Options for style application
     */
  setStyle(style, options = {}) {
    this.style = { ...this.style, ...style };
    this.emit('style-changed', { feature: this, style: this.style, options });
  }
    
  /**
     * Get the feature's style
     * @returns {Object} - Style properties
     */
  getStyle() {
    return { ...this.style };
  }
    
  /**
     * Set the feature's properties
     * @param {Object} properties - Custom properties
     */
  setProperties(properties) {
    this.properties = { ...this.properties, ...properties };
    this.emit('properties-changed', { feature: this, properties: this.properties });
  }
    
  /**
     * Get the feature's properties
     * @returns {Object} - Custom properties
     */
  getProperties() {
    return { ...this.properties };
  }
    
  /**
     * Get a specific property
     * @param {string} name - Property name
     * @returns {*} - Property value
     */
  getProperty(name) {
    return this.properties[name];
  }
    
  /**
     * Set a specific property
     * @param {string} name - Property name
     * @param {*} value - Property value
     */
  setProperty(name, value) {
    this.properties[name] = value;
    this.emit('property-changed', { feature: this, name, value });
  }
    
  /**
     * Set the feature's name
     * @param {string} name - The new name for the feature
     */
  setName(name) {
    this.name = name;
    this.emit('name-changed', { feature: this, name });
  }
    
  /**
     * Get the feature's name
     * @returns {string} - The feature's name
     */
  getName() {
    return this.name;
  }
    
  /**
     * Select the feature
     * @param {Object} [options] - Options for selection
     */
  select(options = {}) {
    if (!this.selected) {
      this.selected = true;
      this.emit('selected', { feature: this, options });
    }
  }
    
  /**
     * Deselect the feature
     * @param {Object} [options] - Options for deselection
     */
  deselect(options = {}) {
    if (this.selected) {
      this.selected = false;
      this.emit('deselected', { feature: this, options });
    }
  }
    
  /**
     * Toggle the feature's selection state
     * @param {Object} [options] - Options for selection toggling
     * @returns {boolean} - The new selection state
     */
  toggleSelection(options = {}) {
    if (this.selected) {
      this.deselect(options);
    } else {
      this.select(options);
    }
    return this.selected;
  }
    
  /**
     * Show the feature
     */
  show() {
    if (!this.visible) {
      this.visible = true;
      this.emit('visibility-changed', { feature: this, visible: true });
    }
  }
    
  /**
     * Hide the feature
     */
  hide() {
    if (this.visible) {
      this.visible = false;
      this.emit('visibility-changed', { feature: this, visible: false });
    }
  }
    
  /**
     * Toggle the feature's visibility
     * @returns {boolean} - The new visibility state
     */
  toggleVisibility() {
    this.visible = !this.visible;
    this.emit('visibility-changed', { feature: this, visible: this.visible });
    return this.visible;
  }
    
  /**
     * Make the feature editable
     */
  enableEditing() {
    if (!this.editable) {
      this.editable = true;
      this.emit('editable-changed', { feature: this, editable: true });
    }
  }
    
  /**
     * Make the feature non-editable
     */
  disableEditing() {
    if (this.editable) {
      this.editable = false;
      this.emit('editable-changed', { feature: this, editable: false });
    }
  }
    
  /**
     * Register a rendered object with this feature
     * @param {Object} renderedObject - The rendered object
     */
  setRendered(renderedObject) {
    this.rendered = renderedObject;
  }
    
  /**
     * Get the rendered object for this feature
     * @returns {Object|null} - The rendered object or null
     */
  getRendered() {
    return this.rendered;
  }
    
  /**
     * Check if the feature has a valid rendered object
     * @returns {boolean} - True if the feature has a rendered object
     */
  isRendered() {
    return this.rendered !== null;
  }
}