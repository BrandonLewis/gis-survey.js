/**
 * Feature Component Module - Main entry point
 * @module gnss/survey/features
 */

// Export feature base class
export { FeatureBase } from './FeatureBase.js';

// Export feature implementations
export { PointFeature } from './PointFeature.js';
export { LineFeature } from './LineFeature.js';
export { PolygonFeature } from './PolygonFeature.js';

// Feature operations
export { FeatureCollection } from './FeatureCollection.js';

/**
 * Create a point feature
 * @param {Coordinate|Object} coordinate - The point's coordinate
 * @param {Object} [options] - Configuration options
 * @returns {PointFeature} - The created point feature
 */
export function createPoint(coordinate, options = {}) {
    const { PointFeature } = require('./PointFeature.js');
    return new PointFeature(coordinate, options);
}

/**
 * Create a line feature
 * @param {Array<Coordinate>} coordinates - The line's coordinates
 * @param {Object} [options] - Configuration options
 * @returns {LineFeature} - The created line feature
 */
export function createLine(coordinates, options = {}) {
    const { LineFeature } = require('./LineFeature.js');
    return new LineFeature(coordinates, options);
}

/**
 * Create a polygon feature
 * @param {Array<Coordinate>} coordinates - The polygon's exterior ring coordinates
 * @param {Object} [options] - Configuration options
 * @returns {PolygonFeature} - The created polygon feature
 */
export function createPolygon(coordinates, options = {}) {
    const { PolygonFeature } = require('./PolygonFeature.js');
    return new PolygonFeature(coordinates, options);
}

/**
 * Create a feature collection
 * @param {Array<FeatureBase>} [features=[]] - Initial features
 * @param {Object} [options] - Configuration options
 * @returns {FeatureCollection} - The created feature collection
 */
export function createFeatureCollection(features = [], options = {}) {
    const { FeatureCollection } = require('./FeatureCollection.js');
    return new FeatureCollection(features, options);
}

/**
 * Import features from GeoJSON
 * @param {Object} geojson - GeoJSON object or FeatureCollection
 * @param {Object} [options] - Import options
 * @returns {Array<FeatureBase>} - Array of imported features
 */
export function importFromGeoJSON(geojson, options = {}) {
    if (!geojson) return [];
    
    // Handle FeatureCollection
    if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        return geojson.features.map(feature => {
            return _createFeatureFromGeoJSON(feature, options);
        }).filter(Boolean);
    }
    
    // Handle individual Feature
    if (geojson.type === 'Feature') {
        const feature = _createFeatureFromGeoJSON(geojson, options);
        return feature ? [feature] : [];
    }
    
    // Handle Geometry
    if (geojson.type && geojson.coordinates) {
        // Wrap it as a feature
        const feature = _createFeatureFromGeoJSON({
            type: 'Feature',
            geometry: geojson
        }, options);
        return feature ? [feature] : [];
    }
    
    return [];
}

/**
 * Create a feature from a GeoJSON object
 * @param {Object} geojson - GeoJSON feature
 * @param {Object} options - Import options
 * @returns {FeatureBase|null} - Created feature or null
 * @private
 */
function _createFeatureFromGeoJSON(geojson, options = {}) {
    if (!geojson || !geojson.geometry || !geojson.geometry.type) {
        return null;
    }
    
    let feature;
    
    switch (geojson.geometry.type) {
        case 'Point':
            feature = createPoint([], { id: geojson.id });
            break;
            
        case 'LineString':
            feature = createLine([], { id: geojson.id });
            break;
            
        case 'Polygon':
            feature = createPolygon([], { id: geojson.id });
            break;
            
        default:
            console.warn(`Unsupported GeoJSON geometry type: ${geojson.geometry.type}`);
            return null;
    }
    
    if (feature) {
        feature.fromGeoJSON(geojson, options);
    }
    
    return feature;
}