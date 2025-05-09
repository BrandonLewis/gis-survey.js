/**
 * Map Factory - Creates map instances based on provider type
 * @module gnss/survey/map/MapFactory
 */
import { GoogleMapsAdapter } from './GoogleMapsAdapter.js';
import { LeafletAdapter } from './LeafletAdapter.js';
import { MapInterface } from './MapInterface.js';

export class MapFactory {
  /**
     * Create a map instance based on the provider type
     * @param {string} providerType - The map provider type ('google', 'leaflet', etc.)
     * @param {Object} options - Configuration options for the map provider
     * @returns {MapInterface} - A map interface instance
     */
  static createMap(providerType, options = {}) {
    switch (providerType.toLowerCase()) {
    case 'google':
      return new GoogleMapsAdapter(options);
                
    case 'leaflet':
      return new LeafletAdapter(options);
                
    default:
      throw new Error(`Unsupported map provider type: ${providerType}`);
    }
  }
    
  /**
     * Check if a map provider is available
     * @param {string} providerType - The map provider type ('google', 'leaflet', etc.)
     * @returns {boolean} - True if the provider is available
     */
  static isProviderAvailable(providerType) {
    switch (providerType.toLowerCase()) {
    case 'google':
      return typeof window !== 'undefined' && 
                      (window.google !== undefined || options.apiKey !== undefined);
                
    case 'leaflet':
      return typeof window !== 'undefined';
                
    default:
      return false;
    }
  }
    
  /**
     * Get a list of supported map providers
     * @returns {Array<string>} - Array of supported provider types
     */
  static getSupportedProviders() {
    return ['google', 'leaflet'];
  }
}