/**
 * GIS Survey Module - Main entry point
 *
 * This module provides a complete set of 3D-first, map-agnostic survey tools
 * for geospatial applications. It supports full 3D visualization and
 * calculations, and can optionally integrate with GNSS receivers.
 */

// Import and initialize globals to break circular dependencies
import { initializeGlobals } from './core/init.js';
initializeGlobals();

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

// Import survey manager and tools
import { SurveyManager } from './tools/SurveyManager.js';
import { DrawingTool } from './tools/DrawingTool.js';
import { MeasurementTool } from './tools/MeasurementTool.js';
import { EditingTool } from './tools/EditingTool.js';
import { OffsetTool } from './tools/OffsetTool.js';
import { SnappingManager } from './tools/SnappingManager.js';
import { ToolBase } from './tools/ToolBase.js';

// Import feature implementations
import {
  FeatureBase,
  PointFeature,
  LineFeature,
  PolygonFeature,
  FeatureCollection,
  createPoint,
  createLine,
  createPolygon,
  createFeatureCollection,
  importFromGeoJSON,
} from './features/index.js';

// Import map implementations
import {
  MapInterface,
  Map3DInterface,
  ElevationService,
  GoogleMapsAdapter,
  LeafletAdapter,
  GoogleMapsElevationService,
  MapFactory,
  LayerManager,
  RenderingStrategy,
  GoogleMapsRenderingStrategy,
  createMap,
  getSupportedProviders,
} from './map/index.js';

// Backward compatibility - Import SimplifiedDrawingTool for existing code
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
      TransformerFactory,
    },
  };
}

/**
 * Create a new Survey instance.
 * @param {Object} mapInstance - The map instance to use
 * @param {string} mapType - The type of map provider ('google', 'leaflet', 'cesium')
 * @param {Object} [options] - Configuration options
 * @returns {Promise<Object>} A promise that resolves to the SurveyManager instance
 */
export async function createSurvey(mapInstance, mapType, options = {}) {
  // Initialize the survey module
  await initialize(options);

  // Create appropriate map adapter
  const mapInterface = MapFactory.createMap(mapType, {
    mapInstance,
    ...options.mapOptions,
  });

  // Create the survey manager
  const surveyManager = new SurveyManager({
    mapInterface,
    settings: {
      enable3D: options.enable3D === undefined ? true : options.enable3D,
      continuousDrawing: options.continuousDrawing === undefined ? true : options.continuousDrawing,
      autoSave: options.autoSave || false,
      undoLevels: options.undoLevels || 20,
      elevationProvider: options.elevationProvider || 'mapInterface',
      ...options.settings,
    },
  });

  // Initialize layer manager if needed
  if (options.initializeLayers !== false) {
    const renderingStrategy = mapType === 'google' ?
      new GoogleMapsRenderingStrategy(mapInterface) :
      new RenderingStrategy(mapInterface);

    surveyManager.layerManager = new LayerManager(mapInterface, renderingStrategy, {
      defaultLayer: 'main',
    });

    // Create standard layers
    surveyManager.layerManager.createLayer('points', { name: 'Points', visible: true });
    surveyManager.layerManager.createLayer('lines', { name: 'Lines', visible: true });
    surveyManager.layerManager.createLayer('polygons', { name: 'Polygons', visible: true });
    surveyManager.layerManager.createLayer('working', {
      name: 'Working Features',
      visible: true,
      zIndex: 1000,
    });
  }

  return surveyManager;
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
  EventEmitter,
};

// Export Feature classes and utilities
export {
  FeatureBase,
  PointFeature,
  LineFeature,
  PolygonFeature,
  FeatureCollection,
  createPoint,
  createLine,
  createPolygon,
  createFeatureCollection,
  importFromGeoJSON,
};

// Export Map classes and utilities
export {
  MapInterface,
  Map3DInterface,
  ElevationService,
  GoogleMapsAdapter,
  LeafletAdapter,
  GoogleMapsElevationService,
  MapFactory,
  LayerManager,
  RenderingStrategy,
  GoogleMapsRenderingStrategy,
  createMap,
  getSupportedProviders,
};

// Export Tool classes
export {
  SurveyManager,
  DrawingTool,
  MeasurementTool,
  EditingTool,
  OffsetTool,
  SnappingManager,
  ToolBase,
  SimplifiedDrawingTool,
};

// Export initialization functions
export { initializeCore };

// Create a namespace for survey module
export const Survey = {
  Manager: SurveyManager,
  Core: {
    Coordinate,
    GeometryEngine,
    GeoidModel,
    CoordinateUtils,
    TransformerFactory,
    CoordinateTransformer,
    SimpleWGS84Transformer,
    EventEmitter,
  },
  Features: {
    FeatureBase,
    PointFeature,
    LineFeature,
    PolygonFeature,
    FeatureCollection,
    createPoint,
    createLine,
    createPolygon,
    createFeatureCollection,
    importFromGeoJSON,
  },
  Map: {
    MapInterface,
    Map3DInterface,
    ElevationService,
    GoogleMapsAdapter,
    LeafletAdapter,
    GoogleMapsElevationService,
    MapFactory,
    LayerManager,
    RenderingStrategy,
    GoogleMapsRenderingStrategy,
    createMap,
    getSupportedProviders,
  },
  Tools: {
    DrawingTool,
    MeasurementTool,
    EditingTool,
    OffsetTool,
    SnappingManager,
    ToolBase,
    SimplifiedDrawingTool,
  },
};

// Export version and build information
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();