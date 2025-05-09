/**
 * Core module for the gis-survey.js library.
 * 
 * Provides the foundational 3D coordinate system, transformations,
 * and geometry calculations for the survey tools.
 */

// Export the core classes
export { Coordinate } from './Coordinate.js';
export { GeoidModel } from './GeoidModel.js';
export { TransformerFactory } from './TransformerFactory.js';
export { CoordinateTransformer } from './CoordinateTransformer.js';
export { SimpleWGS84Transformer } from './SimpleWGS84Transformer.js';
export { CoordinateUtils } from './CoordinateUtils.js';

/**
 * Initialize the core geometry module.
 * @param {Object} [options] - Initialization options
 * @param {string} [options.transformerType='simple'] - Type of transformer to use ('simple' or 'proj4js')
 * @param {string} [options.geoidModel='default'] - Geoid model to use for height reference conversions
 * @returns {Promise<boolean>} Promise that resolves when initialization is complete
 */
export async function initializeCore(options = {}) {
  const { 
    transformerType = 'simple',
    geoidModel = 'default',
  } = options;
  
  // Set the default transformer type
  if (options.transformerType) {
    try {
      const { TransformerFactory } = await import('./TransformerFactory.js');
      TransformerFactory.setDefaultType(transformerType);
    } catch (error) {
      console.error(`Failed to set transformer type: ${error.message}`);
      return false;
    }
  }
  
  // Load geoid model if specified
  if (geoidModel !== 'default') {
    try {
      const { GeoidModel } = await import('./GeoidModel.js');
      await GeoidModel.loadModel(geoidModel);
    } catch (error) {
      console.error(`Failed to load geoid model: ${error.message}`);
      return false;
    }
  }
  
  return true;
}

/**
 * Create a coordinate object.
 * Convenience function for creating coordinates.
 * 
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lng - Longitude in decimal degrees
 * @param {number} [elevation=0] - Elevation in meters
 * @param {string} [heightReference='ellipsoidal'] - Height reference system ('ellipsoidal' or 'orthometric')
 * @param {string} [projection='WGS84'] - Coordinate projection system
 * @returns {Coordinate} A new Coordinate object
 */
export function createCoordinate(lat, lng, elevation = 0, heightReference = 'ellipsoidal', projection = 'WGS84') {
  const { Coordinate } = require('./Coordinate.js');
  return new Coordinate(lat, lng, elevation, heightReference, projection);
}

/**
 * Get a list of all supported projections.
 * @returns {string[]} Array of supported projection identifiers
 */
export function getSupportedProjections() {
  const { TransformerFactory } = require('./TransformerFactory.js');
  return TransformerFactory.getAllSupportedProjections();
}

/**
 * Utility function to create a geojson feature from a coordinate.
 * @param {Coordinate} coordinate - The coordinate to convert
 * @param {Object} [properties={}] - Properties to include in the GeoJSON feature
 * @returns {Object} GeoJSON Feature object
 */
export function coordinateToGeoJSON(coordinate, properties = {}) {
  return {
    type: 'Feature',
    geometry: coordinate.toGeoJSON(),
    properties,
  };
}

/**
 * Utility function to create a geojson feature collection from an array of coordinates.
 * @param {Coordinate[]} coordinates - Array of coordinates to convert
 * @param {Object} [properties={}] - Additional properties for the feature collection
 * @returns {Object} GeoJSON FeatureCollection object
 */
export function coordinatesToGeoJSON(coordinates, properties = {}) {
  return {
    type: 'FeatureCollection',
    features: coordinates.map((coord, index) => coordinateToGeoJSON(coord, { 
      id: index, 
      ...properties, 
    })),
    properties,
  };
}