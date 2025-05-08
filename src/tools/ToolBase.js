/**
 * ToolBase.js
 * Base class for all survey tools
 * Part of the RTK Surveyor 3D-first implementation
 */

import { EventEmitter } from '../../event-emitter.js';

/**
 * @typedef {Object} ToolBaseOptions
 * @property {Object} manager - The survey manager instance
 * @property {Object} mapInterface - The map interface instance
 */

/**
 * Base class for all survey tools
 * Defines common functionality and interface requirements
 */
export class ToolBase extends EventEmitter {
  /**
   * Create a new tool instance
   * @param {ToolBaseOptions} options - Tool configuration options
   */
  constructor(options = {}) {
    super();
    
    if (!options.manager) {
      throw new Error('Manager instance is required for tool initialization');
    }
    
    if (!options.mapInterface) {
      throw new Error('Map interface is required for tool initialization');
    }
    
    // Store references
    this.manager = options.manager;
    this.mapInterface = options.mapInterface;
    this.geometryEngine = options.geometryEngine || this.manager.geometryEngine;
    
    // Initialize state variables
    this.isActive = false;
    this.options = options;
    this.workingData = {};
    
    // Setup event listeners
    this._setupEventListeners();
  }
  
  /**
   * Set up tool-specific event listeners
   * Override in derived classes
   * @protected
   */
  _setupEventListeners() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
  
  /**
   * Activate the tool
   * @param {Object} [options] - Tool-specific activation options
   */
  activate(options = {}) {
    if (this.isActive) {
      return; // Already active
    }
    
    // Store activation options
    this.activationOptions = Object.assign({}, options);
    
    // CRITICAL FIX: Update this.options with the new values
    // This ensures derived tools use the updated options in their _activate method
    this.options = Object.assign({}, this.options, options);
    
    console.log('ToolBase.activate: Updating options', options);
    console.log('ToolBase.activate: Combined options are now', this.options);
    
    // Mark as active
    this.isActive = true;
    
    // Tool-specific activation logic
    this._activate();
    
    // Emit activation event
    this.emit('activated', this.activationOptions);
  }
  
  /**
   * Tool-specific activation logic
   * Override in derived classes
   * @protected
   */
  _activate() {
    throw new Error('_activate() must be implemented by derived classes');
  }
  
  /**
   * Deactivate the tool
   */
  deactivate() {
    if (!this.isActive) {
      return; // Already inactive
    }
    
    // Mark as inactive
    this.isActive = false;
    
    // Tool-specific deactivation logic
    this._deactivate();
    
    // We don't completely reset working data here anymore
    // as it can cause issues with derived classes that rely on its structure
    // Instead, derived classes should handle clearing their state in _deactivate()
    
    // Emit deactivation event
    this.emit('deactivated');
  }
  
  /**
   * Tool-specific deactivation logic
   * Override in derived classes
   * @protected
   */
  _deactivate() {
    throw new Error('_deactivate() must be implemented by derived classes');
  }
  
  /**
   * Handle tool reset
   * Clears current operation but keeps the tool active
   */
  reset() {
    // Tool-specific reset logic
    this._reset();
    
    // We don't completely reset working data here anymore
    // as it can cause issues with derived classes that rely on its structure
    // Instead, derived classes should handle clearing their state in _reset()
    
    // Emit reset event
    this.emit('reset');
  }
  
  /**
   * Tool-specific reset logic
   * Override in derived classes
   * @protected
   */
  _reset() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
  
  /**
   * Update tool options
   * @param {Object} options - The new options to apply
   */
  updateOptions(options = {}) {
    this.options = Object.assign(this.options, options);
    
    // Tool-specific option update handling
    this._optionsUpdated();
    
    // Emit options updated event
    this.emit('optionsUpdated', this.options);
  }
  
  /**
   * Tool-specific options update handling
   * Override in derived classes if needed
   * @protected
   */
  _optionsUpdated() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
  
  /**
   * Clean up resources used by the tool
   */
  destroy() {
    // Deactivate first if needed
    if (this.isActive) {
      this.deactivate();
    }
    
    // Tool-specific destroy logic
    this._destroy();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    // Clear references
    this.manager = null;
    this.mapInterface = null;
    this.geometryEngine = null;
  }
  
  /**
   * Tool-specific destroy logic
   * Override in derived classes if needed
   * @protected
   */
  _destroy() {
    // Base implementation does nothing
    // Override in specific tool implementations
  }
}