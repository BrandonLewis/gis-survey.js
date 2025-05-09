/**
 * Google Maps Elevation Service implementation
 * @module gnss/survey/map/GoogleMapsElevationService
 */
import { ElevationService } from './ElevationService.js';
import { Coordinate } from '../core/Coordinate.js';

export class GoogleMapsElevationService extends ElevationService {
  /**
     * Initialize the Google Maps Elevation Service
     * @param {Object} options - Configuration options
     * @param {string} [options.apiKey] - Google Maps API key (optional if already loaded)
     */
  constructor(options = {}) {
    super(options);
        
    this.apiLoaded = false;
    this.apiKey = options.apiKey;
    this.elevationService = null;
  }
    
  /**
     * Load the Google Maps API if not already loaded
     * @returns {Promise<void>} - Promise that resolves when the API is loaded
     * @private
     */
  async _loadGoogleMapsAPI() {
    if (window.google && window.google.maps) {
      this.apiLoaded = true;
            
      if (!this.elevationService && window.google.maps.ElevationService) {
        this.elevationService = new google.maps.ElevationService();
      }
            
      return;
    }
        
    if (!this.apiKey) {
      throw new Error('Google Maps API key is required for initialization');
    }
        
    return new Promise((resolve, reject) => {
      const callbackName = `GoogleMapsCallback_${Date.now()}`;
      window[callbackName] = () => {
        this.apiLoaded = true;
        this.elevationService = new google.maps.ElevationService();
        delete window[callbackName];
        resolve();
      };
            
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&callback=${callbackName}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      document.head.appendChild(script);
    });
  }
    
  /**
     * Convert a Coordinate to a Google Maps LatLng
     * @param {Coordinate} coordinate - The coordinate to convert
     * @returns {google.maps.LatLng} - Google Maps LatLng object
     * @private
     */
  _toLatLng(coordinate) {
    return new google.maps.LatLng(coordinate.latitude, coordinate.longitude);
  }
    
  /**
     * Get the elevation at a specific coordinate
     * @param {Coordinate} coordinate - The coordinate to get elevation for
     * @returns {Promise<number>} - Promise that resolves with the elevation in meters
     */
  async getElevation(coordinate) {
    // Initialize the API if needed
    if (!this.apiLoaded) {
      await this._loadGoogleMapsAPI();
    }
        
    // If coordinate already has elevation, return it
    if (coordinate.elevation !== null && coordinate.elevation !== undefined) {
      return Promise.resolve(coordinate.elevation);
    }
        
    const locations = [this._toLatLng(coordinate)];
        
    return new Promise((resolve, reject) => {
      this.elevationService.getElevationForLocations({ locations }, (results, status) => {
        if (status === google.maps.ElevationStatus.OK && results && results.length > 0) {
          resolve(results[0].elevation);
        } else {
          reject(new Error(`Elevation service failed: ${status}`));
        }
      });
    });
  }
    
  /**
     * Get elevations for a path of coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates for the path
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForPath(coordinates) {
    // Initialize the API if needed
    if (!this.apiLoaded) {
      await this._loadGoogleMapsAPI();
    }
        
    const path = coordinates.map(coord => this._toLatLng(coord));
        
    // Google's API has a limit on the number of samples, so chunk if needed
    const MAX_SAMPLES = 512; // Google's limit
    const samples = Math.min(coordinates.length, MAX_SAMPLES);
        
    return new Promise((resolve, reject) => {
      this.elevationService.getElevationAlongPath(
        {
          path: path,
          samples: samples,
        },
        (results, status) => {
          if (status === google.maps.ElevationStatus.OK && results && results.length > 0) {
            const elevations = results.map(result => result.elevation);
            resolve(elevations);
          } else {
            reject(new Error(`Elevation service failed: ${status}`));
          }
        },
      );
    });
  }
    
  /**
     * Get elevations for an array of coordinates
     * @param {Array<Coordinate>} coordinates - Array of coordinates to get elevations for
     * @returns {Promise<Array<number>>} - Promise that resolves with array of elevations in meters
     */
  async getElevationsForLocations(coordinates) {
    // Initialize the API if needed
    if (!this.apiLoaded) {
      await this._loadGoogleMapsAPI();
    }
        
    // Google has a limit of 512 locations per request, so we may need to batch
    const MAX_LOCATIONS = 512;
    const batches = [];
        
    for (let i = 0; i < coordinates.length; i += MAX_LOCATIONS) {
      const batchCoordinates = coordinates.slice(i, i + MAX_LOCATIONS);
      const locations = batchCoordinates.map(coord => this._toLatLng(coord));
            
      batches.push(
        new Promise((resolve, reject) => {
          this.elevationService.getElevationForLocations(
            { locations },
            (results, status) => {
              if (status === google.maps.ElevationStatus.OK && results) {
                resolve(results.map(result => result.elevation));
              } else {
                reject(new Error(`Elevation service failed: ${status}`));
              }
            },
          );
        }),
      );
    }
        
    // Wait for all batches to complete and combine results
    const results = await Promise.all(batches);
    return results.flat();
  }
}