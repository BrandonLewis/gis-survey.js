/**
 * Map Module - Main entry point
 * @module gnss/survey/map
 */

// Core interfaces
export { MapInterface } from './MapInterface.js';
export { Map3DInterface } from './Map3DInterface.js';
export { ElevationService } from './ElevationService.js';

// Map implementations
export { GoogleMapsAdapter } from './GoogleMapsAdapter.js';
export { LeafletAdapter } from './LeafletAdapter.js';

// Elevation service implementations
export { GoogleMapsElevationService } from './GoogleMapsElevationService.js';

// Factory for creating map instances
export { MapFactory } from './MapFactory.js';

// Rendering strategies
export { RenderingStrategy, GoogleMapsRenderingStrategy } from './rendering/index.js';

// Layer management
export { LayerManager } from './LayerManager.js';

/**
 * Create a map instance with the specified provider
 * @param {string} provider - The map provider to use ('google', 'leaflet', etc.)
 * @param {Object} options - Configuration options for the map
 * @returns {MapInterface} - The created map instance
 */
export function createMap(provider, options = {}) {
  return MapFactory.createMap(provider, options);
}

/**
 * Get a list of supported map providers
 * @returns {Array<string>} - Array of supported provider names
 */
export function getSupportedProviders() {
  return MapFactory.getSupportedProviders();
}