/**
 * TransformerFactory.js - Factory for coordinate transformation providers
 * 
 * Provides a central point for creating and accessing CoordinateTransformer 
 * implementations. This factory pattern allows for switching transformer 
 * implementations without changing client code.
 */

import { SimpleWGS84Transformer } from './SimpleWGS84Transformer.js';

/**
 * Factory class for creating and accessing coordinate transformers.
 */
export class TransformerFactory {
  // Static singleton instances for different transformer types
  static _instances = new Map();
  
  // Selected transformer type
  static _defaultType = 'simple';
  
  /**
   * Set the default transformer type to use.
   * @param {string} type - The transformer type ('simple' or 'proj4js')
   */
  static setDefaultType(type) {
    if (!['simple', 'proj4js'].includes(type)) {
      throw new Error(`Invalid transformer type: ${type}. Must be 'simple' or 'proj4js'`);
    }
    
    this._defaultType = type;
  }
  
  /**
   * Get a transformer instance.
   * @param {string} [type=null] - The transformer type to get, or null for default
   * @returns {CoordinateTransformer} A coordinate transformer
   */
  static getTransformer(type = null) {
    const transformerType = type || this._defaultType;
    
    // Check if we already have an instance
    if (this._instances.has(transformerType)) {
      return this._instances.get(transformerType);
    }
    
    // Create a new instance
    let transformer;
    
    switch (transformerType) {
    case 'simple':
      transformer = new SimpleWGS84Transformer();
      break;
        
    case 'proj4js':
      // Try to load proj4js if available
      this._checkForProj4js();
        
      // We'll implement this when needed
      throw new Error('Proj4js transformer not yet implemented. Use "simple" for now.');
        
    default:
      throw new Error(`Unknown transformer type: ${transformerType}`);
    }
    
    // Cache the instance
    this._instances.set(transformerType, transformer);
    
    return transformer;
  }
  
  /**
   * Check if proj4js is available and log warning if not.
   * @private
   */
  static _checkForProj4js() {
    // Check if proj4js is available
    if (typeof proj4 === 'undefined') {
      console.warn('Proj4js transformer requested, but proj4js is not loaded. ' + 
                 'Make sure to include proj4.js in your project for full projection support.');
      return false;
    }
    return true;
  }
  
  /**
   * Clear all cached transformer instances.
   */
  static clearCache() {
    // Clear all transformer instances
    for (const transformer of this._instances.values()) {
      transformer.clearCache();
    }
    
    this._instances.clear();
  }
  
  /**
   * Check if a certain transformer type is available.
   * @param {string} type - The transformer type to check
   * @returns {boolean} Whether the transformer is available
   */
  static isAvailable(type) {
    switch (type) {
    case 'simple':
      return true;
        
    case 'proj4js':
      return this._checkForProj4js();
        
    default:
      return false;
    }
  }
  
  /**
   * Get a list of all supported projection systems across all transformers.
   * @returns {Object} Object mapping transformer type to array of supported projections
   */
  static getAllSupportedProjections() {
    const result = {};
    
    // Always include simple transformer
    result.simple = new SimpleWGS84Transformer().getSupportedProjections();
    
    // Check if proj4js is available
    if (this._checkForProj4js()) {
      // This would return a list of all projections supported by proj4js
      // We'll implement this when needed
      result.proj4js = ['Many EPSG codes supported when proj4js is loaded'];
    }
    
    return result;
  }
}