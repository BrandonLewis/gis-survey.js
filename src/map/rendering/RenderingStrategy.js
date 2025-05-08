/**
 * Abstract Feature Rendering Strategy Interface
 * @module gnss/survey/map/rendering/RenderingStrategy
 */
export class RenderingStrategy {
    /**
     * Initialize the rendering strategy
     * @param {MapInterface} map - The map interface to render features on
     * @param {Object} options - Configuration options for the rendering strategy
     */
    constructor(map, options = {}) {
        if (this.constructor === RenderingStrategy) {
            throw new Error("Abstract class 'RenderingStrategy' cannot be instantiated directly.");
        }
        
        this.map = map;
        this.options = options;
    }
    
    /**
     * Render a point feature on the map
     * @param {Object} feature - The point feature to render
     * @param {Coordinate} feature.coordinate - The coordinate of the point
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
    async renderPoint(feature, options = {}) {
        throw new Error("Method 'renderPoint()' must be implemented.");
    }
    
    /**
     * Render a line feature on the map
     * @param {Object} feature - The line feature to render
     * @param {Array<Coordinate>} feature.coordinates - The coordinates of the line
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
    async renderLine(feature, options = {}) {
        throw new Error("Method 'renderLine()' must be implemented.");
    }
    
    /**
     * Render a polygon feature on the map
     * @param {Object} feature - The polygon feature to render
     * @param {Array<Coordinate>} feature.coordinates - The coordinates of the polygon boundary
     * @param {Array<Array<Coordinate>>} [feature.holes] - Arrays of coordinates for any holes
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
    async renderPolygon(feature, options = {}) {
        throw new Error("Method 'renderPolygon()' must be implemented.");
    }
    
    /**
     * Remove a rendered feature from the map
     * @param {Object} renderedFeature - The rendered feature to remove
     * @returns {Promise<void>} - Promise that resolves when the feature is removed
     */
    async removeFeature(renderedFeature) {
        throw new Error("Method 'removeFeature()' must be implemented.");
    }
    
    /**
     * Update a rendered feature on the map
     * @param {Object} renderedFeature - The previously rendered feature
     * @param {Object} updatedFeature - The updated feature data
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the updated rendered feature
     */
    async updateFeature(renderedFeature, updatedFeature, options = {}) {
        throw new Error("Method 'updateFeature()' must be implemented.");
    }
    
    /**
     * Highlight a rendered feature on the map
     * @param {Object} renderedFeature - The rendered feature to highlight
     * @param {Object} options - Highlight options
     * @returns {Promise<void>} - Promise that resolves when the feature is highlighted
     */
    async highlightFeature(renderedFeature, options = {}) {
        throw new Error("Method 'highlightFeature()' must be implemented.");
    }
    
    /**
     * Remove highlight from a rendered feature
     * @param {Object} renderedFeature - The rendered feature to unhighlight
     * @returns {Promise<void>} - Promise that resolves when the highlight is removed
     */
    async unhighlightFeature(renderedFeature) {
        throw new Error("Method 'unhighlightFeature()' must be implemented.");
    }
}