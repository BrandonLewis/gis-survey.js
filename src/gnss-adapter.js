/**
 * GNSS Adapter
 * 
 * Provides optional integration with the gnss.js module
 * Allows survey tools to use GNSS position data
 */
import { EventEmitter } from './core/event-emitter.js';

/**
 * GNSS Adapter class
 * Handles integration with external GNSS module
 */
export class GnssAdapter extends EventEmitter {
  /**
   * Create a new GNSS adapter
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.gnssModule = null;
    this.isConnected = false;
    this.position = null;
    this.satellites = [];
    this.fixQuality = 0;
    
    this.options = Object.assign({
      autoConnect: false,
      positionSmoothingFactor: 0.5,
      enableElevation: true,
    }, options);
  }
  
  /**
   * Connect to a GNSS module
   * @param {Object} gnssModule - The GNSS module instance
   * @returns {boolean} Success of connection
   */
  connect(gnssModule) {
    if (!gnssModule) {
      console.error('Invalid GNSS module provided');
      return false;
    }
    
    // Store reference to GNSS module
    this.gnssModule = gnssModule;
    
    // Setup event listeners
    this._setupEventListeners();
    
    this.isConnected = true;
    this.emit('connected', { adapter: this });
    
    return true;
  }
  
  /**
   * Disconnect from GNSS module
   */
  disconnect() {
    if (!this.isConnected) {
      return;
    }
    
    // Clean up event listeners
    this._removeEventListeners();
    
    this.gnssModule = null;
    this.isConnected = false;
    this.emit('disconnected', {});
  }
  
  /**
   * Set up event listeners on GNSS module
   * @private
   */
  _setupEventListeners() {
    if (!this.gnssModule) {
      return;
    }
    
    // Position updates
    this._positionHandler = (position) => {
      this.position = position;
      this.emit('position', position);
    };
    this.gnssModule.on('position', this._positionHandler);
    
    // Fix quality updates
    this._fixQualityHandler = (data) => {
      this.fixQuality = data.fixQuality || 0;
      this.emit('fix-quality', { quality: this.fixQuality });
    };
    this.gnssModule.on('nmea:gga', this._fixQualityHandler);
    
    // Connection status
    this._connectionHandler = (data) => {
      this.emit('device-connection', data);
    };
    this.gnssModule.on('connection:connected', this._connectionHandler);
    
    // Disconnection status
    this._disconnectionHandler = (data) => {
      this.emit('device-disconnection', data);
    };
    this.gnssModule.on('connection:disconnected', this._disconnectionHandler);
  }
  
  /**
   * Remove event listeners from GNSS module
   * @private
   */
  _removeEventListeners() {
    if (!this.gnssModule) {
      return;
    }
    
    // Remove all handlers
    if (this._positionHandler) {
      this.gnssModule.off('position', this._positionHandler);
    }
    
    if (this._fixQualityHandler) {
      this.gnssModule.off('nmea:gga', this._fixQualityHandler);
    }
    
    if (this._connectionHandler) {
      this.gnssModule.off('connection:connected', this._connectionHandler);
    }
    
    if (this._disconnectionHandler) {
      this.gnssModule.off('connection:disconnected', this._disconnectionHandler);
    }
  }
  
  /**
   * Get current position
   * @returns {Object|null} Current position
   */
  getPosition() {
    if (!this.isConnected || !this.gnssModule) {
      return null;
    }
    
    return this.gnssModule.getPosition();
  }
  
  /**
   * Get fix quality
   * @returns {number} Fix quality (0=no fix, 1=GPS, 2=DGPS, 4=RTK fixed, 5=RTK float)
   */
  getFixQuality() {
    return this.fixQuality;
  }
  
  /**
   * Check if position is available
   * @returns {boolean} Whether position is available
   */
  hasPosition() {
    return !!this.position;
  }
  
  /**
   * Check if position has RTK fix
   * @returns {boolean} Whether position has RTK fix
   */
  hasRtkFix() {
    return this.fixQuality === 4 || this.fixQuality === 5;
  }
}

export default GnssAdapter;