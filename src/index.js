/**
 * GIS Survey Module - Main entry point
 * 
 * This module provides a complete set of 3D-first, map-agnostic survey tools
 * for geospatial applications. It supports full 3D visualization and
 * calculations, and can optionally integrate with GNSS receivers.
 */

// Import core module functionality
import { EventEmitter } from './core/event-emitter.js';
import { Coordinate } from './core/Coordinate.js';
import { GeometryEngine } from './core/GeometryEngine.js';
import { CoordinateUtils } from './core/CoordinateUtils.js';
import { GeoidModel } from './core/GeoidModel.js';
import { TransformerFactory } from './core/TransformerFactory.js';
import { CoordinateTransformer } from './core/CoordinateTransformer.js';
import { SimpleWGS84Transformer } from './core/SimpleWGS84Transformer.js';
import { initializeCore } from './core/index.js';
import { SimplifiedDrawingTool } from './tools/SimplifiedDrawingTool.js';

/**
 * Initialize the survey module.
 * 
 * @param {Object} [options] - Initialization options
 * @param {Object} [options.core] - Core module options
 * @param {Object} [options.map] - Map provider options
 * @returns {Promise<Object>} Promise that resolves to the survey interface
 */
export async function initialize(options = {}) {
  // Initialize the core coordinate system and geometry engine
  await initializeCore(options.core);
  
  // Return an interface with core functionality implemented
  return {
    version: VERSION,
    core: {
      initialized: true,
      Coordinate,
      GeometryEngine,
      GeoidModel,
      CoordinateUtils,
      TransformerFactory
    }
  };
}

/**
 * Create a new Survey instance.
 * @param {Object} mapInstance - The map instance to use
 * @param {string} mapType - The type of map provider ('google', 'leaflet', 'cesium')
 * @param {Object} [options] - Configuration options
 * @returns {Promise<Object>} A promise that resolves to the Survey instance
 */
export async function createSurvey(mapInstance, mapType, options = {}) {
  // Initialize the survey module
  const moduleInterface = await initialize(options);
  
  // Return a minimal survey interface with core functionality implemented
  return {
    // Core geometry utilities
    geometry: {
      createCoordinate: (lat, lng, elevation = 0, heightReference = 'ellipsoidal', projection = 'WGS84') => {
        return new Coordinate(lat, lng, elevation, heightReference, projection);
      },
      engine: GeometryEngine,
      utils: CoordinateUtils
    },
    
    // Map utilities
    map: {
      getMap: () => mapInstance,
      // Map adapter stubs to be implemented
      getCenter: () => null,
      setCenter: () => false
    },
    
    // Feature creation stubs
    features: {
      createPoint: async (coordinate, options = {}) => {
        console.log('createPoint not yet implemented');
        return null;
      },
      createLine: async (coordinates, options = {}) => {
        console.log('createLine not yet implemented');
        return null;
      },
      createPolygon: async (coordinates, options = {}) => {
        console.log('createPolygon not yet implemented');
        return null;
      }
    },
    
    // Survey tools
    tools: {
      manager: null,
      measurement: null,
      offset: null,
      drawing: new SimplifiedDrawingTool({
        map: mapInstance,
        geometryEngine: GeometryEngine,
        mode: 'point',
        enable3D: options.enable3D || false,
        continuousDrawing: options.continuousDrawing || true
      }),
      editing: null,
      snapping: null
    },
    
    // GNSS integration
    connectGnssModule: (gnssModule) => {
      console.log('GNSS integration not yet implemented');
      return false;
    },
    
    // Core module interface
    core: moduleInterface.core
  };
}

// Export core classes
export { 
  Coordinate,
  GeometryEngine,
  GeoidModel,
  TransformerFactory,
  CoordinateTransformer,
  SimpleWGS84Transformer,
  CoordinateUtils,
  EventEmitter
};

// Export initialization functions
export { initializeCore };

// Export version and build information
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();