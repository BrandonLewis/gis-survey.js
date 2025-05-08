/**
 * Extended Map Interface for 3D maps
 * @module gnss/survey/map/Map3DInterface
 */
import { MapInterface } from './MapInterface.js';

export class Map3DInterface extends MapInterface {
    /**
     * Initialize the 3D map interface
     * @param {Object} options - Configuration options for the map
     */
    constructor(options = {}) {
        super(options);
        
        if (this.constructor === Map3DInterface) {
            throw new Error("Abstract class 'Map3DInterface' cannot be instantiated directly.");
        }
    }
    
    /**
     * Set the camera tilt angle (pitch)
     * @param {number} angle - The tilt angle in degrees (0 = looking straight down)
     * @returns {Promise<void>} - Promise that resolves when the tilt is set
     */
    async setTilt(angle) {
        throw new Error("Method 'setTilt()' must be implemented.");
    }
    
    /**
     * Set the camera heading (rotation)
     * @param {number} angle - The heading angle in degrees (0 = north)
     * @returns {Promise<void>} - Promise that resolves when the heading is set
     */
    async setHeading(angle) {
        throw new Error("Method 'setHeading()' must be implemented.");
    }
    
    /**
     * Get the current camera position
     * @returns {Promise<Object>} - Promise that resolves with the camera position
     */
    async getCameraPosition() {
        throw new Error("Method 'getCameraPosition()' must be implemented.");
    }
    
    /**
     * Set the camera position
     * @param {Object} position - The camera position
     * @param {Coordinate} position.coordinate - The coordinate to position the camera
     * @param {number} position.distance - The distance from the coordinate
     * @param {number} position.heading - The heading angle in degrees
     * @param {number} position.tilt - The tilt angle in degrees
     * @returns {Promise<void>} - Promise that resolves when the position is set
     */
    async setCameraPosition(position) {
        throw new Error("Method 'setCameraPosition()' must be implemented.");
    }
    
    /**
     * Add a 3D model to the map
     * @param {Coordinate} coordinate - The coordinate to place the model
     * @param {Object} options - Configuration options for the model
     * @returns {Promise<Object>} - Promise that resolves with the model object
     */
    async addModel(coordinate, options = {}) {
        throw new Error("Method 'addModel()' must be implemented.");
    }
    
    /**
     * Remove a 3D model from the map
     * @param {Object} model - The model to remove
     * @returns {Promise<void>} - Promise that resolves when the model is removed
     */
    async removeModel(model) {
        throw new Error("Method 'removeModel()' must be implemented.");
    }
    
    /**
     * Add terrain to the map
     * @param {Object} options - Configuration options for the terrain
     * @returns {Promise<Object>} - Promise that resolves with the terrain object
     */
    async addTerrain(options = {}) {
        throw new Error("Method 'addTerrain()' must be implemented.");
    }
    
    /**
     * Remove terrain from the map
     * @returns {Promise<void>} - Promise that resolves when the terrain is removed
     */
    async removeTerrain() {
        throw new Error("Method 'removeTerrain()' must be implemented.");
    }
    
    /**
     * Enable or disable terrain exaggeration
     * @param {number} factor - The exaggeration factor (1.0 = normal)
     * @returns {Promise<void>} - Promise that resolves when exaggeration is set
     */
    async setTerrainExaggeration(factor) {
        throw new Error("Method 'setTerrainExaggeration()' must be implemented.");
    }
}