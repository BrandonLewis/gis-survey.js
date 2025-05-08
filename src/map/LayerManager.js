/**
 * Layer Management for organizing map features
 * @module gnss/survey/map/LayerManager
 */
export class LayerManager {
    /**
     * Initialize the layer manager
     * @param {MapInterface} map - The map interface to manage layers for
     * @param {RenderingStrategy} renderingStrategy - The strategy for rendering features
     * @param {Object} options - Configuration options
     */
    constructor(map, renderingStrategy, options = {}) {
        this.map = map;
        this.renderingStrategy = renderingStrategy;
        this.options = options;
        
        // Layers storage - each layer contains features
        this.layers = new Map();
        
        // Selection tracking
        this.selectedFeatures = new Map();
        
        // Create default layer if specified
        if (options.defaultLayer) {
            this.createLayer(options.defaultLayer);
        }
    }
    
    /**
     * Set up event listeners for a feature
     * This ensures selection/deselection events are properly handled
     * @param {Object} feature - The feature to set up listeners for
     * @param {Object} renderedFeature - The rendered feature object
     * @private
     */
    _setupFeatureEventListeners(feature, renderedFeature) {
        if (!feature || !feature.on || typeof feature.on !== 'function') {
            console.warn('Cannot set up event listeners: feature has no event emitter');
            return;
        }
        
        // Listen for selection events
        feature.on('selected', () => {
            console.log(`Feature ${feature.id} selected event received`);
            this.selectedFeatures.set(feature.id, renderedFeature);
            this.renderingStrategy.highlightFeature(renderedFeature).catch(error => {
                console.error(`Error highlighting feature ${feature.id}:`, error);
            });
        });
        
        // Listen for deselection events
        feature.on('deselected', () => {
            console.log(`Feature ${feature.id} deselected event received`);
            this.selectedFeatures.delete(feature.id);
            this.renderingStrategy.unhighlightFeature(renderedFeature).catch(error => {
                console.error(`Error unhighlighting feature ${feature.id}:`, error);
            });
        });
    }
    
    /**
     * Create a new layer
     * @param {string} layerId - The unique identifier for the layer
     * @param {Object} options - Layer options
     * @returns {Object} - The created layer
     */
    createLayer(layerId, options = {}) {
        if (this.layers.has(layerId)) {
            throw new Error(`Layer with ID '${layerId}' already exists`);
        }
        
        const layer = {
            id: layerId,
            options,
            features: new Map(),
            visible: options.visible !== false,
            selectable: options.selectable !== false,
            editable: options.editable !== false
        };
        
        this.layers.set(layerId, layer);
        return layer;
    }
    
    /**
     * Remove a layer and all its features
     * @param {string} layerId - The ID of the layer to remove
     * @returns {Promise<void>} - Promise that resolves when the layer is removed
     */
    async removeLayer(layerId) {
        if (!this.layers.has(layerId)) {
            return Promise.resolve();
        }
        
        const layer = this.layers.get(layerId);
        
        // Remove all features from the map
        const removePromises = [];
        for (const feature of layer.features.values()) {
            removePromises.push(this.renderingStrategy.removeFeature(feature));
        }
        
        await Promise.all(removePromises);
        
        // Remove the layer
        this.layers.delete(layerId);
        
        return Promise.resolve();
    }
    
    /**
     * Set layer visibility
     * @param {string} layerId - The ID of the layer
     * @param {boolean} visible - Whether the layer should be visible
     * @returns {Promise<void>} - Promise that resolves when visibility is set
     */
    async setLayerVisibility(layerId, visible) {
        if (!this.layers.has(layerId)) {
            throw new Error(`Layer with ID '${layerId}' does not exist`);
        }
        
        const layer = this.layers.get(layerId);
        
        // If visibility is already set correctly, do nothing
        if (layer.visible === visible) {
            return Promise.resolve();
        }
        
        layer.visible = visible;
        
        // Hide or show all features in the layer
        const promises = [];
        for (const feature of layer.features.values()) {
            if (visible) {
                // Re-render the feature if it was hidden
                promises.push(
                    this.renderingStrategy.renderFeatureByType(
                        feature.originalFeature,
                        feature.type
                    )
                );
            } else {
                // Remove the feature from the map
                promises.push(this.renderingStrategy.removeFeature(feature));
            }
        }
        
        await Promise.all(promises);
        
        return Promise.resolve();
    }
    
    /**
     * Add a feature to a layer
     * @param {string} layerId - The ID of the layer to add to
     * @param {Object} feature - The feature to add
     * @param {string} featureType - The type of feature ('point', 'line', 'polygon')
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature
     */
    async addFeature(layerId, feature, featureType, options = {}) {
        if (!this.layers.has(layerId)) {
            throw new Error(`Layer with ID '${layerId}' does not exist`);
        }
        
        const layer = this.layers.get(layerId);
        
        // Only render if the layer is visible
        let renderedFeature = null;
        
        if (layer.visible) {
            switch (featureType) {
                case 'point':
                    renderedFeature = await this.renderingStrategy.renderPoint(feature, options);
                    break;
                    
                case 'line':
                    renderedFeature = await this.renderingStrategy.renderLine(feature, options);
                    break;
                    
                case 'polygon':
                    renderedFeature = await this.renderingStrategy.renderPolygon(feature, options);
                    break;
                    
                default:
                    throw new Error(`Unsupported feature type: ${featureType}`);
            }
        } else {
            // If layer is not visible, create a placeholder with the feature data
            const id = feature.id || `feature_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            renderedFeature = {
                id,
                originalFeature: feature,
                renderedObject: null,
                type: featureType,
                highlighted: false
            };
        }
        
        // Store the feature in the layer
        layer.features.set(renderedFeature.id, renderedFeature);
        
        // Set up event listeners for selection/deselection
        this._setupFeatureEventListeners(feature, renderedFeature);
        
        // If the feature is already selected, apply highlighting immediately
        if (feature.selected) {
            console.log(`Feature ${feature.id} added while already selected, applying highlight`);
            this.selectedFeatures.set(feature.id, renderedFeature);
            if (renderedFeature.renderedObject) {
                this.renderingStrategy.highlightFeature(renderedFeature).catch(error => {
                    console.error(`Error highlighting feature ${feature.id}:`, error);
                });
            }
        }
        
        return renderedFeature;
    }
    
    /**
     * Remove a feature from a layer
     * @param {string} layerId - The ID of the layer
     * @param {string} featureId - The ID of the feature to remove
     * @returns {Promise<void>} - Promise that resolves when the feature is removed
     */
    async removeFeature(layerId, featureId) {
        if (!this.layers.has(layerId)) {
            throw new Error(`Layer with ID '${layerId}' does not exist`);
        }
        
        const layer = this.layers.get(layerId);
        
        if (!layer.features.has(featureId)) {
            return Promise.resolve();
        }
        
        const renderedFeature = layer.features.get(featureId);
        const originalFeature = renderedFeature.originalFeature;
        
        // If this is a selected feature, remove it from selection tracking
        if (this.selectedFeatures.has(featureId)) {
            console.log(`Removing selected feature ${featureId} from selection tracking`);
            this.selectedFeatures.delete(featureId);
        }
        
        // Remove event listeners from original feature if possible
        if (originalFeature && typeof originalFeature.off === 'function') {
            console.log(`Removing event listeners from feature ${featureId}`);
            originalFeature.off('selected');
            originalFeature.off('deselected');
        }
        
        // Remove from map if it was rendered
        if (renderedFeature.renderedObject) {
            // Ensure it's unhighlighted before removal
            if (renderedFeature.renderedObject.originalStyles) {
                try {
                    await this.renderingStrategy.unhighlightFeature(renderedFeature);
                } catch (error) {
                    console.error(`Error unhighlighting feature before removal: ${error.message}`);
                }
            }
            
            await this.renderingStrategy.removeFeature(renderedFeature);
        }
        
        // Remove from layer
        layer.features.delete(featureId);
        
        return Promise.resolve();
    }
    
    /**
     * Update a feature in a layer
     * @param {string} layerId - The ID of the layer
     * @param {string} featureId - The ID of the feature to update
     * @param {Object} updatedFeature - The updated feature data
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the updated feature
     */
    async updateFeature(layerId, featureId, updatedFeature, options = {}) {
        if (!this.layers.has(layerId)) {
            throw new Error(`Layer with ID '${layerId}' does not exist`);
        }
        
        const layer = this.layers.get(layerId);
        
        if (!layer.features.has(featureId)) {
            throw new Error(`Feature with ID '${featureId}' does not exist in layer '${layerId}'`);
        }
        
        const existingFeature = layer.features.get(featureId);
        
        // If layer is visible, update the rendered feature
        let updatedRenderedFeature;
        
        if (layer.visible && existingFeature.renderedObject) {
            updatedRenderedFeature = await this.renderingStrategy.updateFeature(
                existingFeature,
                updatedFeature,
                options
            );
        } else {
            // If not visible, just update the data
            updatedRenderedFeature = {
                ...existingFeature,
                originalFeature: updatedFeature
            };
        }
        
        // Update in layer
        layer.features.set(featureId, updatedRenderedFeature);
        
        return updatedRenderedFeature;
    }
    
    /**
     * Get all layers
     * @returns {Array<Object>} - Array of layer objects
     */
    getLayers() {
        return Array.from(this.layers.values());
    }
    
    /**
     * Get a specific layer
     * @param {string} layerId - The ID of the layer to get
     * @returns {Object|null} - The layer object or null if not found
     */
    getLayer(layerId) {
        return this.layers.get(layerId) || null;
    }
    
    /**
     * Get all features in a layer
     * @param {string} layerId - The ID of the layer
     * @returns {Array<Object>} - Array of feature objects
     */
    getLayerFeatures(layerId) {
        if (!this.layers.has(layerId)) {
            throw new Error(`Layer with ID '${layerId}' does not exist`);
        }
        
        const layer = this.layers.get(layerId);
        return Array.from(layer.features.values());
    }
    
    /**
     * Get a specific feature from a layer
     * @param {string} layerId - The ID of the layer
     * @param {string} featureId - The ID of the feature
     * @returns {Object|null} - The feature object or null if not found
     */
    getFeature(layerId, featureId) {
        if (!this.layers.has(layerId)) {
            return null;
        }
        
        const layer = this.layers.get(layerId);
        return layer.features.get(featureId) || null;
    }
    
    /**
     * Fit the map view to show all features in a layer
     * @param {string} layerId - The ID of the layer
     * @param {Object} options - Options for fitting the bounds
     * @returns {Promise<void>} - Promise that resolves when the map is fitted
     */
    async fitLayerToView(layerId, options = {}) {
        if (!this.layers.has(layerId)) {
            throw new Error(`Layer with ID '${layerId}' does not exist`);
        }
        
        const layer = this.layers.get(layerId);
        
        if (layer.features.size === 0) {
            return Promise.resolve();
        }
        
        // Collect all coordinates from all features
        const allCoordinates = [];
        
        for (const feature of layer.features.values()) {
            const featureCoords = this._getFeatureCoordinates(feature);
            allCoordinates.push(...featureCoords);
        }
        
        if (allCoordinates.length === 0) {
            return Promise.resolve();
        }
        
        // Fit map to these coordinates
        await this.map.fitBounds(allCoordinates, options);
        
        return Promise.resolve();
    }
    
    /**
     * Get coordinates from a feature based on its type
     * @param {Object} feature - The feature to extract coordinates from
     * @returns {Array<Coordinate>} - Array of coordinates
     * @private
     */
    _getFeatureCoordinates(feature) {
        if (!feature.originalFeature) {
            return [];
        }
        
        switch (feature.type) {
            case 'point':
                return [feature.originalFeature.coordinate];
                
            case 'line':
            case 'polygon':
                return feature.originalFeature.coordinates || [];
                
            default:
                return [];
        }
    }
}