/**
 * Google Maps implementation of the rendering strategy
 * @module gnss/survey/map/rendering/GoogleMapsRenderingStrategy
 */
import { RenderingStrategy } from './RenderingStrategy.js';

export class GoogleMapsRenderingStrategy extends RenderingStrategy {
  /**
     * Initialize the Google Maps rendering strategy
     * @param {GoogleMapsAdapter} map - The Google Maps adapter
     * @param {Object} options - Configuration options
     */
  constructor(map, options = {}) {
    super(map, options);
        
    if (!map || !map.map) {
      throw new Error('GoogleMapsRenderingStrategy requires a valid GoogleMapsAdapter instance');
    }
        
    // Store reference to the actual Google Map instance
    this.googleMap = map.map;
        
    // Track rendered features for update/remove operations
    this.renderedFeatures = new Map();
  }
    
  /**
     * Render a point feature on the map
     * @param {Object} feature - The point feature to render
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderPoint(feature, options = {}) {
    try {
      const coordinate = feature.getCoordinate ? feature.getCoordinate() : feature.coordinate;
      if (!coordinate) {
        throw new Error('Invalid point feature: no coordinate found');
      }

      // Enhanced debug logging - clearly mark the start of point rendering
      console.log('========== RENDERING POINT ==========');
      console.log(`Coordinate: ${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}`);
      console.log(`Feature ID: ${feature.id || 'unknown'}`);
      console.log(`Source: ${feature.properties?.source || 'standard'}`);

      const style = feature.style || options.style || this.options.defaultPointStyle || {};
      console.log(`Marker style: ${style.useDualMarker ? 'dual-marker' : (style.iconUrl ? 'image' : 'circle')}`);
      console.log(`Marker color: ${style.color || 'default'}`);
      console.log('=======================================');
            
      // Check for availability of Advanced Markers
      if (!this._isAdvancedMarkerAvailable()) {
        throw new Error('Advanced Markers are required and not available in the current Google Maps API version');
      }
            
      // Get marker icon/content configuration
      const iconConfig = this._createMarkerIcon(style, feature);
            
      // Advanced markers configuration - simpler now since we handle positioning with CSS
      const markerOptions = {
        position: { lat: coordinate.lat, lng: coordinate.lng },
        map: this.googleMap,
        title: feature.name || feature.properties?.name || '',
        gmpDraggable: options.draggable || false,
        content: iconConfig.content,
      };
            
      // Create the Advanced Marker
      const marker = new google.maps.marker.AdvancedMarkerElement(markerOptions);
            
      // Store original feature reference
      marker.originalFeature = feature;
            
      // Add click event handler if needed
      if (options.onClick || options.selectable !== false) {
        // Advanced markers use the 'gmp-click' event (required for Google Maps Platform)
        marker.addEventListener('gmp-click', (event) => {
          // Log that we received a marker click event
          console.log(`Advanced marker gmp-click received for feature: ${feature.id}`);
                    
          // Prevent propagation where possible
          if (event.stopPropagation) {
            event.stopPropagation();
          }
                    
          // Stop immediate propagation if available
          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }
                    
          // Prevent default action
          if (event.preventDefault) {
            event.preventDefault();
          }
                    
          if (options.onClick) {
            options.onClick({
              feature,
              renderedFeature: marker,
              originalEvent: event,
            });
          }
                    
          if (options.selectable !== false) {
            this._handleFeatureClick(feature, marker, event);
          }
                    
          return false;
        });
      }
            
      // Store the rendered feature
      const renderedFeature = {
        id: feature.id,
        type: 'point',
        originalFeature: feature,
        renderedObject: marker,
        options,
      };
            
      this.renderedFeatures.set(feature.id, renderedFeature);
      return renderedFeature;
    } catch (error) {
      console.error('Error rendering point feature:', error);
      throw error;
    }
  }
    
  /**
     * Render a line feature on the map
     * @param {Object} feature - The line feature to render
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderLine(feature, options = {}) {
    try {
      // Use let instead of const since we might need to reassign it
      let coordinates = feature.getCoordinates ? feature.getCoordinates() : feature.coordinates;
            
      // Ensure coordinates exist and are an array
      if (!coordinates || !Array.isArray(coordinates)) {
        console.warn('Line feature has no coordinates array');
        // Create a placeholder empty array
        coordinates = [];
      }
            
      // Get line style from feature or options
      const style = feature.style || options.style || this.options.defaultLineStyle || {};
            
      // Handle empty or insufficient coordinates for preview features
      let path;
      if (coordinates.length < 2) {
        // For preview/temporary features (like during drawing), use a small invisible line
        // that can be updated later
        if (feature.properties?.temporary || feature.properties?.isPreview) {
          console.log(`Creating initial placeholder line with ${coordinates.length} points`);
                    
          // Make a temporary path with two nearby points if we have none
          // or duplicate the single point if we have one
          if (coordinates.length === 0) {
            // Use center of the map for placeholders
            const center = this.googleMap.getCenter();
            path = [
              { lat: center.lat(), lng: center.lng() },
              { lat: center.lat(), lng: center.lng() },
            ];
          } else {
            // Duplicate the single coordinate
            const singleCoord = coordinates[0];
            path = [
              { lat: singleCoord.lat, lng: singleCoord.lng },
              { lat: singleCoord.lat, lng: singleCoord.lng },
            ];
          }
        } else {
          // For permanent features, we'll enforce the minimum coordinate requirement
          throw new Error('Invalid permanent line feature: insufficient coordinates (need at least 2)');
        }
      } else {
        // Normal case - convert existing coordinates to Google Maps path
        path = coordinates.map(coord => ({
          lat: coord.lat,
          lng: coord.lng,
        }));
      }
            
      // Create polyline options
      const polylineOptions = {
        path,
        map: this.googleMap,
        geodesic: options.geodesic !== false,
        strokeColor: style.color || style.strokeColor || '#3388FF',
        strokeOpacity: style.opacity || style.strokeOpacity || 1.0,
        strokeWeight: style.width || style.strokeWeight || 3,
        clickable: true,
        // Ensure it's on top and interactive
        zIndex: 100,
      };
            
      // Create the polyline
      const polyline = new google.maps.Polyline(polylineOptions);
            
      // Store original feature reference
      polyline.originalFeature = feature;
            
      // Add click event handler if needed
      if (options.onClick || options.selectable !== false) {
        polyline.addListener('click', (event) => {
          // Log that we received a line click event
          console.log(`Line click received for feature: ${feature.id}`);
                    
          // Prevent propagation to the map
          if (event.stop) event.stop();
          if (event.domEvent && event.domEvent.stopPropagation) {
            event.domEvent.stopPropagation();
          }
          if (event.originalEvent && event.originalEvent.stopPropagation) {
            event.originalEvent.stopPropagation();
          }
                    
          // Ensure we stop immediate propagation too if available
          if (event.domEvent && event.domEvent.stopImmediatePropagation) {
            event.domEvent.stopImmediatePropagation();
          }
                    
          // Force preventDefault to ensure no other handlers run
          if (event.domEvent && event.domEvent.preventDefault) {
            event.domEvent.preventDefault();
          }
                    
          if (options.onClick) {
            options.onClick({
              feature,
              renderedFeature: polyline,
              originalEvent: event,
            });
          }
                    
          if (options.selectable !== false) {
            this._handleFeatureClick(feature, polyline, event);
          }
                    
          // Return false to try to prevent event bubbling
          return false;
        });
      }
            
      // Store the rendered feature
      const renderedFeature = {
        id: feature.id,
        type: 'line',
        originalFeature: feature,
        renderedObject: polyline,
        options,
      };
            
      this.renderedFeatures.set(feature.id, renderedFeature);
      return renderedFeature;
    } catch (error) {
      console.error('Error rendering line feature:', error);
      throw error;
    }
  }
    
  /**
     * Render a polygon feature on the map
     * @param {Object} feature - The polygon feature to render
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderPolygon(feature, options = {}) {
    try {
      // For polygons, we need to handle rings correctly
      let paths = [];
            
      // Try different methods to get polygon coordinates
      if (feature.getRings && typeof feature.getRings === 'function') {
        const rings = feature.getRings();
        if (rings && rings.length > 0) {
          // Convert each ring to Google Maps path
          paths = rings.map(ring => 
            ring.map(coord => ({
              lat: coord.lat, 
              lng: coord.lng,
            })),
          );
        }
      } else if (feature.coordinates && Array.isArray(feature.coordinates)) {
        // If it's a simple array of coordinates (single ring)
        paths = [feature.coordinates.map(coord => ({
          lat: coord.lat,
          lng: coord.lng,
        }))];
      }
            
      // Handle empty or insufficient coordinates for preview features
      if (paths.length === 0 || paths[0].length < 3) {
        // For preview/temporary features (like during drawing), use a placeholder polygon
        if (feature.properties?.temporary || feature.properties?.isPreview) {
          console.log(`Creating initial placeholder polygon with ${paths.length > 0 ? paths[0].length : 0} points`);
                    
          // Use center of the map for placeholders
          const center = this.googleMap.getCenter();
          const lat = center.lat();
          const lng = center.lng();
                    
          // Create a tiny triangle at map center that will be invisible to user
          // but valid for the Google Maps API
          paths = [[
            { lat, lng },
            { lat, lng: lng + 0.0000001 },
            { lat: lat + 0.0000001, lng },
          ]];
        } else {
          // For permanent features, enforce the minimum coordinate requirement
          throw new Error('Invalid permanent polygon feature: insufficient coordinates (need at least 3)');
        }
      }
            
      // Get polygon style from feature or options
      const style = feature.style || options.style || this.options.defaultPolygonStyle || {};
            
      // Create polygon options
      const polygonOptions = {
        paths,
        map: this.googleMap,
        strokeColor: style.outlineColor || style.strokeColor || '#3388FF',
        strokeOpacity: style.outlineOpacity || style.strokeOpacity || 0.8,
        strokeWeight: style.outlineWidth || style.strokeWeight || 2,
        fillColor: style.fillColor || '#3388FF',
        fillOpacity: style.fillOpacity || 0.35,
        clickable: true,
        // Ensure it's on top and interactive
        zIndex: 100,
      };
            
      // Create the polygon
      const polygon = new google.maps.Polygon(polygonOptions);
            
      // Store original feature reference
      polygon.originalFeature = feature;
            
      // Add click event handler if needed
      if (options.onClick || options.selectable !== false) {
        polygon.addListener('click', (event) => {
          // Log that we received a polygon click event
          console.log(`Polygon click received for feature: ${feature.id}`);
                    
          // Prevent propagation to the map
          if (event.stop) event.stop();
          if (event.domEvent && event.domEvent.stopPropagation) {
            event.domEvent.stopPropagation();
          }
          if (event.originalEvent && event.originalEvent.stopPropagation) {
            event.originalEvent.stopPropagation();
          }
                    
          // Ensure we stop immediate propagation too if available
          if (event.domEvent && event.domEvent.stopImmediatePropagation) {
            event.domEvent.stopImmediatePropagation();
          }
                    
          // Force preventDefault to ensure no other handlers run
          if (event.domEvent && event.domEvent.preventDefault) {
            event.domEvent.preventDefault();
          }
                    
          if (options.onClick) {
            options.onClick({
              feature,
              renderedFeature: polygon,
              originalEvent: event,
            });
          }
                    
          if (options.selectable !== false) {
            this._handleFeatureClick(feature, polygon, event);
          }
                    
          // Return false to try to prevent event bubbling
          return false;
        });
      }
            
      // Store the rendered feature
      const renderedFeature = {
        id: feature.id,
        type: 'polygon',
        originalFeature: feature,
        renderedObject: polygon,
        options,
      };
            
      this.renderedFeatures.set(feature.id, renderedFeature);
      return renderedFeature;
    } catch (error) {
      console.error('Error rendering polygon feature:', error);
      throw error;
    }
  }
    
  /**
     * Render a feature based on its type
     * @param {Object} feature - The feature to render
     * @param {string} featureType - The type of feature ('point', 'line', 'polygon')
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the rendered feature object
     */
  async renderFeatureByType(feature, featureType, options = {}) {
    switch (featureType) {
    case 'point':
      return this.renderPoint(feature, options);
    case 'line':
      return this.renderLine(feature, options);
    case 'polygon':
      return this.renderPolygon(feature, options);
    default:
      throw new Error(`Unsupported feature type: ${featureType}`);
    }
  }
    
  /**
     * Remove a rendered feature from the map
     * @param {Object} renderedFeature - The rendered feature to remove
     * @returns {Promise<void>} - Promise that resolves when the feature is removed
     */
  async removeFeature(renderedFeature) {
    try {
      const mapObject = renderedFeature.renderedObject;
      if (!mapObject) return;
            
      // Remove the map object based on its type
      if (mapObject instanceof google.maps.marker.AdvancedMarkerElement) {
        // Advanced marker removal
        mapObject.map = null;
      } else if (mapObject instanceof google.maps.Polyline ||
                      mapObject instanceof google.maps.Polygon) {
        // Polyline and Polygon removal
        mapObject.setMap(null);
      }
            
      // Remove from tracked features
      this.renderedFeatures.delete(renderedFeature.id);
            
    } catch (error) {
      console.error('Error removing feature:', error);
      throw error;
    }
  }
    
  /**
     * Update a rendered feature on the map
     * @param {Object} renderedFeature - The previously rendered feature
     * @param {Object} updatedFeature - The updated feature data
     * @param {Object} options - Rendering options
     * @returns {Promise<Object>} - Promise that resolves with the updated rendered feature
     */
  async updateFeature(renderedFeature, updatedFeature, options = {}) {
    try {
      // Remove the existing feature first
      await this.removeFeature(renderedFeature);
            
      // Re-render with updated feature data
      const newRenderedFeature = await this.renderFeatureByType(
        updatedFeature, 
        renderedFeature.type,
        options || renderedFeature.options,
      );
            
      return newRenderedFeature;
    } catch (error) {
      console.error('Error updating feature:', error);
      throw error;
    }
  }
    
  /**
     * Highlight a rendered feature on the map
     * @param {Object} renderedFeature - The rendered feature to highlight
     * @param {Object} options - Highlight options
     * @returns {Promise<void>} - Promise that resolves when the feature is highlighted
     */
  async highlightFeature(renderedFeature, options = {}) {
    try {
      const mapObject = renderedFeature.renderedObject;
      if (!mapObject) return;
            
      // Store original styles for later unhighlighting
      if (!mapObject.originalStyles) {
        this._storeOriginalStyles(mapObject, renderedFeature.type);
      }
            
      // Apply highlighting based on feature type
      switch (renderedFeature.type) {
      case 'point':
        this._highlightMarker(mapObject, options);
        break;
                    
      case 'line':
        this._highlightPolyline(mapObject, options);
        break;
                    
      case 'polygon':
        this._highlightPolygon(mapObject, options);
        break;
      }
    } catch (error) {
      console.error('Error highlighting feature:', error);
      throw error;
    }
  }
    
  /**
     * Remove highlight from a rendered feature
     * @param {Object} renderedFeature - The rendered feature to unhighlight
     * @returns {Promise<void>} - Promise that resolves when the highlight is removed
     */
  async unhighlightFeature(renderedFeature) {
    try {
      const mapObject = renderedFeature.renderedObject;
      if (!mapObject || !mapObject.originalStyles) return;
            
      // Restore original styles based on feature type
      switch (renderedFeature.type) {
      case 'point':
        this._unhighlightMarker(mapObject);
        break;
                    
      case 'line':
        this._unhighlightPolyline(mapObject);
        break;
                    
      case 'polygon':
        this._unhighlightPolygon(mapObject);
        break;
      }
    } catch (error) {
      console.error('Error unhighlighting feature:', error);
      throw error;
    }
  }
    
  /**
     * Store original styles for a map object
     * @param {Object} mapObject - The map object
     * @param {string} type - The feature type
     * @private
     */
  _storeOriginalStyles(mapObject, type) {
    mapObject.originalStyles = {};
        
    switch (type) {
    case 'point':
      // Advanced Marker styles storage
      if (mapObject instanceof google.maps.marker.AdvancedMarkerElement && mapObject.content) {
        const element = mapObject.content;
        mapObject.originalStyles.transform = element.style.transform;
        mapObject.originalStyles.boxShadow = element.style.boxShadow;
        mapObject.originalStyles.zIndex = element.style.zIndex;
      }
      break;
                
    case 'line':
      mapObject.originalStyles.strokeColor = mapObject.get('strokeColor');
      mapObject.originalStyles.strokeWeight = mapObject.get('strokeWeight');
      mapObject.originalStyles.strokeOpacity = mapObject.get('strokeOpacity');
      mapObject.originalStyles.zIndex = mapObject.get('zIndex');
      break;
                
    case 'polygon':
      mapObject.originalStyles.strokeColor = mapObject.get('strokeColor');
      mapObject.originalStyles.strokeWeight = mapObject.get('strokeWeight');
      mapObject.originalStyles.strokeOpacity = mapObject.get('strokeOpacity');
      mapObject.originalStyles.fillColor = mapObject.get('fillColor');
      mapObject.originalStyles.fillOpacity = mapObject.get('fillOpacity');
      mapObject.originalStyles.zIndex = mapObject.get('zIndex');
      break;
    }
  }
    
  /**
     * Highlight a marker
     * @param {Object} marker - The marker to highlight
     * @param {Object} options - Highlight options
     * @private
     */
  _highlightMarker(marker, options = {}) {
    const highlightColor = options.color || '#1a73e8';
        
    try {
      // Highlight advanced marker by modifying the content element
      if (marker.content) {
        const element = marker.content;
                
        // Store original values if not already stored
        if (!element._originalStyles) {
          element._originalStyles = {
            transform: element.style.transform || '',
            transition: element.style.transition || '',
            boxShadow: element.style.boxShadow || '',
            zIndex: element.style.zIndex || '',
          };
        }
                
        // Apply highlighting styles
        element.style.transform = 'scale(1.2)';
        element.style.transition = 'transform 0.2s ease-in-out';
        element.style.boxShadow = `0 0 0 2px ${highlightColor}, 0 2px 4px rgba(0,0,0,0.3)`;
        element.style.zIndex = '1000';
      }
    } catch (error) {
      console.error('Error highlighting marker:', error);
    }
  }
    
  /**
     * Unhighlight a marker
     * @param {Object} marker - The marker to unhighlight
     * @private
     */
  _unhighlightMarker(marker) {
    try {
      // Restore original styles for advanced markers
      if (marker.content && marker.content._originalStyles) {
        const element = marker.content;
        const originalStyles = element._originalStyles;
                
        // Restore original styles
        element.style.transform = originalStyles.transform || '';
        element.style.transition = originalStyles.transition || '';
        element.style.boxShadow = originalStyles.boxShadow || '';
        element.style.zIndex = originalStyles.zIndex || '';
      }
    } catch (error) {
      console.error('Error unhighlighting marker:', error);
    }
  }
    
  /**
     * Highlight a polyline
     * @param {Object} polyline - The polyline to highlight
     * @param {Object} options - Highlight options
     * @private
     */
  _highlightPolyline(polyline, options = {}) {
    const highlightColor = options.color || '#1a73e8';
        
    polyline.setOptions({
      strokeColor: highlightColor,
      strokeWeight: polyline.originalStyles.strokeWeight + 2,
      strokeOpacity: 1.0,
      zIndex: 1000,
    });
  }
    
  /**
     * Unhighlight a polyline
     * @param {Object} polyline - The polyline to unhighlight
     * @private
     */
  _unhighlightPolyline(polyline) {
    if (!polyline.originalStyles) return;
        
    polyline.setOptions({
      strokeColor: polyline.originalStyles.strokeColor,
      strokeWeight: polyline.originalStyles.strokeWeight,
      strokeOpacity: polyline.originalStyles.strokeOpacity,
      zIndex: polyline.originalStyles.zIndex,
    });
  }
    
  /**
     * Highlight a polygon
     * @param {Object} polygon - The polygon to highlight
     * @param {Object} options - Highlight options
     * @private
     */
  _highlightPolygon(polygon, options = {}) {
    const highlightColor = options.color || '#1a73e8';
        
    polygon.setOptions({
      strokeColor: highlightColor,
      strokeWeight: polygon.originalStyles.strokeWeight + 2,
      strokeOpacity: 1.0,
      fillOpacity: polygon.originalStyles.fillOpacity * 1.2,
      zIndex: 1000,
    });
  }
    
  /**
     * Unhighlight a polygon
     * @param {Object} polygon - The polygon to unhighlight
     * @private
     */
  _unhighlightPolygon(polygon) {
    if (!polygon.originalStyles) return;
        
    polygon.setOptions({
      strokeColor: polygon.originalStyles.strokeColor,
      strokeWeight: polygon.originalStyles.strokeWeight,
      strokeOpacity: polygon.originalStyles.strokeOpacity,
      fillColor: polygon.originalStyles.fillColor,
      fillOpacity: polygon.originalStyles.fillOpacity,
      zIndex: polygon.originalStyles.zIndex,
    });
  }
    
  /**
     * Handle feature click events
     * @param {Object} feature - The original feature
     * @param {Object} mapObject - The rendered map object
     * @param {Object} event - The click event
     * @private
     */
  _handleFeatureClick(feature, mapObject, event) {
    // Implement selection logic if needed
    // This should trigger appropriate callbacks or emit events
    if (this.options.onFeatureClick) {
      this.options.onFeatureClick({
        feature,
        renderedFeature: {
          id: feature.id,
          type: this._getFeatureType(mapObject),
          originalFeature: feature,
          renderedObject: mapObject,
        },
        originalEvent: event,
      });
    }
  }
    
  /**
     * Determine the feature type from a rendered map object
     * @param {Object} mapObject - The rendered map object
     * @returns {string} - The feature type
     * @private
     */
  _getFeatureType(mapObject) {
    if (mapObject instanceof google.maps.marker.AdvancedMarkerElement) {
      return 'point';
    } else if (mapObject instanceof google.maps.Polyline) {
      return 'line';
    } else if (mapObject instanceof google.maps.Polygon) {
      return 'polygon';
    }
    return 'unknown';
  }
    
  /**
     * Create a marker icon based on style and feature properties
     * @param {Object} style - The style configuration
     * @param {Object} feature - The feature object
     * @returns {Object} - Icon configuration object
     * @private
     */
  _createMarkerIcon(style, feature) {
    // Determine color based on style or GNSS quality
    let color = style.color;
        
    // For GNSS points, use quality-based coloring if available
    if (feature.properties?.source === 'gnss' && feature.properties?.quality !== undefined) {
      color = this._getQualityColor(feature.properties.quality) || color;
    }
        
    // Default color if none specified
    color = color || '#FF5733';
        
    // Check if we're using a dual-element marker (pin + centered dot)
    if (style.useDualMarker || style.showPinAndDot) {
      // Enhanced traditional pin marker
      const size = style.size || 32; // Larger default size
      
      // Create the main container div - this will be centered on the coordinate by Google Maps
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.width = '0';  // Zero width container
      container.style.height = '0';  // Zero height container
      
      // Create an SVG pin instead of using div
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', `${size}px`);
      svg.setAttribute('height', `${size * 1.6}px`); // Taller for pin shape
      svg.setAttribute('viewBox', '0 0 32 52');
      svg.style.position = 'absolute';
      svg.style.left = `${-size/2}px`;  // Center horizontally
      svg.style.top = `${-size * 1.6}px`;  // Position above the coordinate point
      
      // Create the traditional teardrop/pin shape
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M16 0C7.2 0 0 7.2 0 16c0 9.6 16 36 16 36s16-26.4 16-36c0-8.8-7.2-16-16-16z');
      path.setAttribute('fill', color);
      path.setAttribute('stroke', style.outlineColor || 'white');
      path.setAttribute('stroke-width', style.outlineWidth || 2);
      
      // Add the path to the SVG
      svg.appendChild(path);
      
      // Create a small dot at the exact coordinate point
      const dotElement = document.createElement('div');
      dotElement.style.position = 'absolute';
      dotElement.style.width = '6px';
      dotElement.style.height = '6px';
      dotElement.style.left = '-3px';  // Center the dot
      dotElement.style.top = '-3px';   // Center the dot
      dotElement.style.backgroundColor = 'black';
      dotElement.style.border = '1px solid white';
      dotElement.style.borderRadius = '50%';
      dotElement.style.zIndex = '10';
      
      // Add elements to container
      container.appendChild(svg);
      container.appendChild(dotElement);
      
      // Log for debugging
      console.log('Created SVG pin marker with absolute positioning from center');
      
      return { content: container };
    } else if (style.iconUrl) {
      // SIMPLE APPROACH: Image marker with absolute positioning
      const width = style.iconSize?.[0] || 32;
      const height = style.iconSize?.[1] || 32;
      
      // Create the main container div - this will be centered on the coordinate by Google Maps
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.width = '0';  // Zero width container
      container.style.height = '0';  // Zero height container
      
      // Create and position the image element
      const img = document.createElement('img');
      img.src = style.iconUrl;
      img.style.position = 'absolute';
      img.style.width = `${width}px`;
      img.style.height = `${height}px`;
      img.style.left = `${-width/2}px`;  // Center horizontally
      img.style.top = `${-height}px`;    // Bottom edge at the coordinate
      
      // Add the image to the container
      container.appendChild(img);
      
      // Log for debugging
      console.log('Created image marker with absolute positioning from center');
      
      return { content: container };
    } else {
      // SIMPLE APPROACH: Circle marker centered exactly on the coordinate
      const size = style.size || 10;
      
      // Create the circle element
      const circleDiv = document.createElement('div');
      circleDiv.style.width = `${size * 2}px`;
      circleDiv.style.height = `${size * 2}px`;
      circleDiv.style.borderRadius = '50%';
      circleDiv.style.backgroundColor = color;
      circleDiv.style.border = `${style.outlineWidth || 2}px solid ${style.outlineColor || 'white'}`;
      circleDiv.style.boxSizing = 'border-box';
      circleDiv.style.position = 'relative';
      
      // Position exactly at the center
      circleDiv.style.margin = `${-size}px 0 0 ${-size}px`;
      
      // Add crosshair if needed
      if (style.showCrosshair) {
        // Horizontal line
        const hLine = document.createElement('div');
        hLine.style.position = 'absolute';
        hLine.style.width = '80%';
        hLine.style.height = '1px';
        hLine.style.backgroundColor = 'black';
        hLine.style.left = '10%';
        hLine.style.top = '50%';
        
        // Vertical line
        const vLine = document.createElement('div');
        vLine.style.position = 'absolute';
        vLine.style.width = '1px';
        vLine.style.height = '80%';
        vLine.style.backgroundColor = 'black';
        vLine.style.left = '50%';
        vLine.style.top = '10%';
        
        circleDiv.appendChild(hLine);
        circleDiv.appendChild(vLine);
      }
      
      // Log for debugging
      console.log('Created circle marker centered on coordinate');
      
      return { content: circleDiv };
    }
  }
    
  /**
     * Check if Google Maps Advanced Markers are available
     * @returns {boolean} - Whether Advanced Markers are available
     * @private
     */
  _isAdvancedMarkerAvailable() {
    return window.google && 
              window.google.maps && 
              window.google.maps.marker && 
              window.google.maps.marker.AdvancedMarkerElement;
  }
    
  /**
     * Get color based on GNSS fix quality
     * @param {number} quality - The GNSS fix quality value
     * @returns {string} - Color hex code
     * @private
     */
  _getQualityColor(quality) {
    const qualityColors = {
      0: '#888888', // No fix - gray
      1: '#FF0000', // GPS fix - red
      2: '#FF9900', // DGPS fix - orange
      4: '#00FF00', // RTK fixed - green
      5: '#00FFFF',  // Float RTK - cyan
    };
        
    return qualityColors[quality] || '#888888';
  }
}