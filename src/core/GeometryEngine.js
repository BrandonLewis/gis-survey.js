/**
 * GeometryEngine.js - Geodesic geometry calculations for 3D coordinates
 *
 * Provides accurate geometric calculations on an ellipsoidal Earth model,
 * taking elevation into account for true 3D calculations. This engine handles
 * complex computations such as area, volume, and intersection determination.
 */

import { Coordinate } from './Coordinate.js';
import { CoordinateUtils } from './CoordinateUtils.js';

/**
 * Provides geometric calculations for geographic coordinates.
 */
export class GeometryEngine {
  /**
   * Calculate the total elevation gain along a path
   * @param {Array<Coordinate>} coordinates - Array of coordinates representing the path
   * @returns {number} Total elevation gain in meters
   */
  static calculateElevationGain(coordinates) {
    if (!coordinates || coordinates.length < 2) {
      return 0;
    }

    let totalGain = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];

      // Skip if either coordinate doesn't have elevation data
      if (prev.elevation === undefined || prev.elevation === null ||
          curr.elevation === undefined || curr.elevation === null) {
        continue;
      }

      // Only add positive elevation changes
      const diff = curr.elevation - prev.elevation;
      if (diff > 0) {
        totalGain += diff;
      }
    }

    return totalGain;
  }

  /**
   * Calculate the total elevation loss along a path
   * @param {Array<Coordinate>} coordinates - Array of coordinates representing the path
   * @returns {number} Total elevation loss in meters (as a positive number)
   */
  static calculateElevationLoss(coordinates) {
    if (!coordinates || coordinates.length < 2) {
      return 0;
    }

    let totalLoss = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];

      // Skip if either coordinate doesn't have elevation data
      if (prev.elevation === undefined || prev.elevation === null ||
          curr.elevation === undefined || curr.elevation === null) {
        continue;
      }

      // Only add negative elevation changes (as positive values)
      const diff = curr.elevation - prev.elevation;
      if (diff < 0) {
        totalLoss += Math.abs(diff);
      }
    }

    return totalLoss;
  }
  /**
     * Get the Coordinate class
     * @returns {Object} Object containing the Coordinate class
     * @private
     */
  static _getCoordinateClass() {
    return { Coordinate };
  }

  /**
     * Earth parameters.
     * @private
     */
  static _EARTH_RADIUS_M = 6371000; // Mean radius in meters
  static _WGS84_SEMI_MAJOR_AXIS = 6378137.0; // Semi-major axis in meters
  static _WGS84_SEMI_MINOR_AXIS = 6356752.314245; // Semi-minor axis in meters
  static _WGS84_FLATTENING = 1 / 298.257223563; // Flattening

  /**
     * Find the nearest point on a line segment to a given point.
     * Instance method wrapper for the static nearestPointOnSegment method
     * @param {Coordinate} start - Starting point of the segment
     * @param {Coordinate} end - Ending point of the segment
     * @param {Coordinate} point - The point to find the nearest to
     * @returns {Object} Object containing the nearest point and distance information
     */
  nearestPointOnSegment(start, end, point) {
    return GeometryEngine.nearestPointOnSegment(start, end, point);
  }

  /**
     * Calculate the distance between two coordinates.
     * @param {Coordinate|Object} coord1 - First coordinate
     * @param {Coordinate|Object} coord2 - Second coordinate
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @returns {number} Distance in meters
     */
  static calculateDistance(coord1, coord2, options = {}) {
    // Validate coordinates or coordinate-like objects
    if (!coord1 || !coord2 ||
            typeof coord1 !== 'object' || typeof coord2 !== 'object') {
      console.error('Invalid coordinate format for distance calculation');
      return 0;
    }

    const includeElevation = options.includeElevation !== false;

    // Helper function to extract latitude from coordinate-like object
    const getLat = (coord) => {
      // Support both coord.lat and coord.latitude formats
      return coord.lat !== undefined ? coord.lat :
        coord.latitude !== undefined ? coord.latitude : null;
    };

    // Helper function to extract longitude from coordinate-like object
    const getLng = (coord) => {
      // Support both coord.lng and coord.longitude formats
      return coord.lng !== undefined ? coord.lng :
        coord.longitude !== undefined ? coord.longitude : null;
    };

    // Extract lat/lng values
    const lat1 = getLat(coord1);
    const lng1 = getLng(coord1);
    const lat2 = getLat(coord2);
    const lng2 = getLng(coord2);

    // Validate lat/lng existence
    if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
      console.error('Coordinates missing lat/lng properties for distance calculation');
      return 0;
    }

    // Create simplified coordinate objects with consistent properties
    const simpleCoord1 = {
      lat: lat1,
      lng: lng1,
      elevation: coord1.elevation !== undefined ? coord1.elevation : 0,
    };

    const simpleCoord2 = {
      lat: lat2,
      lng: lng2,
      elevation: coord2.elevation !== undefined ? coord2.elevation : 0,
    };

    // If both are true Coordinate instances with distanceTo method, use it
    if (includeElevation &&
            coord1 instanceof Coordinate &&
            coord2 instanceof Coordinate &&
            typeof coord1.distanceTo === 'function') {
      return coord1.distanceTo(coord2);
    }

    // For 3D distance with elevation (Pythagorean approach)
    if (includeElevation) {
      // Calculate 2D distance
      const distance2D = this._calculateApproximateDistance(simpleCoord1, simpleCoord2);

      // Extract elevations
      const elev1 = simpleCoord1.elevation !== undefined ? simpleCoord1.elevation : 0;
      const elev2 = simpleCoord2.elevation !== undefined ? simpleCoord2.elevation : 0;

      // Apply Pythagorean theorem for 3D distance
      const elevDiff = elev2 - elev1;
      return Math.sqrt(distance2D * distance2D + elevDiff * elevDiff);
    }

    // For 2D distance, use simplified Vincenty approximation
    return this._calculateApproximateDistance(simpleCoord1, simpleCoord2);
  }

  /**
     * Calculate the area of a polygon defined by an array of coordinates.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon (must be closed)
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @returns {number} Area in square meters
     */
  static calculateArea(coordinates, options = {}) {
    const includeElevation = options.includeElevation !== false;

    // Check if we have enough coordinates
    if (coordinates.length < 3) {
      return 0;
    }

    // Check if the polygon is closed
    const firstCoord = coordinates[0];
    const lastCoord = coordinates[coordinates.length - 1];
    const isClosed = firstCoord.lat === lastCoord.lat &&
            firstCoord.lng === lastCoord.lng;

    // Create a closed copy if needed
    const closedCoords = isClosed ? coordinates : [...coordinates, coordinates[0]];

    // Check for self-intersection
    if (this._isSelfIntersecting(closedCoords)) {
      // For self-intersecting polygons, we'll need to triangulate
      return this._calculateAreaWithTriangulation(closedCoords, options);
    }

    if (includeElevation) {
      // For 3D area, project to a plane and calculate
      return this._calculate3DArea(closedCoords);
    } else {
      // Use spherical geometry for 2D area
      return this._calculate2DSphericalArea(closedCoords);
    }
  }

  /**
     * Calculate the perimeter of a polygon or the length of a line.
     * @param {Coordinate[]} coordinates - Array of coordinates
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @returns {number} Perimeter in meters
     */
  static calculatePerimeter(coordinates, options = {}) {
    const includeElevation = options.includeElevation !== false;

    if (coordinates.length < 2) {
      return 0;
    }

    let perimeter = 0;

    // Sum the distances between consecutive points
    for (let i = 0; i < coordinates.length - 1; i++) {
      perimeter += this.calculateDistance(
        coordinates[i],
        coordinates[i + 1],
        { includeElevation },
      );
    }

    // If it's a polygon (has at least 3 points), close it
    if (coordinates.length >= 3) {
      // Check if already closed
      const firstCoord = coordinates[0];
      const lastCoord = coordinates[coordinates.length - 1];
      const isClosed = firstCoord.lat === lastCoord.lat &&
                firstCoord.lng === lastCoord.lng;

      if (!isClosed) {
        // Add distance from last point back to first
        perimeter += this.calculateDistance(
          coordinates[coordinates.length - 1],
          coordinates[0],
          { includeElevation },
        );
      }
    }

    return perimeter;
  }

  /**
     * Calculate the length of a path (alias for calculatePerimeter).
     * @param {Coordinate[]} coordinates - Array of coordinates
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.includeElevation=true] - Whether to include elevation in the calculation
     * @param {boolean} [options.closed=false] - Whether the path is closed
     * @returns {number} Path length in meters
     */
  static calculatePathLength(coordinates, options = {}) {
    return this.calculatePerimeter(coordinates, options);
  }

  /**
     * Calculate a perpendicular offset point from a line segment.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a line
     * @param {number} pointIndex - Index of the segment start point
     * @param {number} segmentPosition - Normalized position along the segment (0-1)
     * @param {number} distance - Offset distance in meters
     * @param {Object} [options={}] - Calculation options
     * @param {boolean} [options.enable3D=true] - Whether to include elevation in the calculation
     * @returns {Object} Object with the offset point and other segment info
     */
  static calculatePerpendicularOffset(coordinates, pointIndex, segmentPosition, distance, options = {}) {
    if (coordinates.length < 2 || pointIndex < 0 || pointIndex >= coordinates.length - 1) {
      throw new Error('Invalid coordinates or point index for perpendicular offset');
    }

    const enable3D = options.enable3D !== false;

    // Get the segment points
    const startPoint = coordinates[pointIndex];
    const endPoint = coordinates[pointIndex + 1];

    // Calculate the point on the segment at the given position
    const segmentFraction = Math.max(0, Math.min(1, segmentPosition));

    // Interpolate the point position
    const nearestPoint = new Coordinate(
      startPoint.lat + segmentFraction * (endPoint.lat - startPoint.lat),
      startPoint.lng + segmentFraction * (endPoint.lng - startPoint.lng),
      enable3D ? startPoint.elevation + segmentFraction * (endPoint.elevation - startPoint.elevation) : null,
      startPoint.heightReference,
      startPoint.projection,
    );

    // Calculate the bearing of the segment
    const segmentBearing = startPoint.bearingTo(endPoint);

    // Calculate perpendicular bearing (90 degrees to the right)
    const perpendicularBearing = (segmentBearing + 90) % 360;

    // Calculate the offset point
    const offsetPoint = this._calculateDestinationPoint(
      nearestPoint,
      distance,
      perpendicularBearing,
    );

    // If 3D is enabled, ensure the offset point has proper elevation
    if (enable3D && nearestPoint.elevation !== null && nearestPoint.elevation !== undefined) {
      offsetPoint.elevation = nearestPoint.elevation;
    }

    return {
      nearestPoint: nearestPoint,
      offsetPoint: offsetPoint,
      pointIndex: pointIndex,
      segmentPosition: segmentFraction,
      segmentBearing: segmentBearing,
      perpendicularBearing: perpendicularBearing,
    };
  }

  /**
     * Calculate the bearing between two coordinates.
     * @param {Coordinate} from - Starting coordinate
     * @param {Coordinate} to - Ending coordinate
     * @returns {number} Bearing in degrees (0-360)
     */
  static calculateBearing(from, to) {
    // Use the bearing calculation from the Coordinate class
    return from.bearingTo(to);
  }

  /**
     * Create a geodesic arc with the given radius around a point.
     * @param {Coordinate} center - Center coordinate
     * @param {number} radiusMeters - Radius in meters
     * @param {number} [startAngle=0] - Starting angle in degrees
     * @param {number} [endAngle=360] - Ending angle in degrees
     * @param {number} [segments=32] - Number of segments to create
     * @returns {Coordinate[]} Array of coordinates forming the arc
     */
  static createArc(center, radiusMeters, startAngle = 0, endAngle = 360, segments = 32) {
    const result = [];
    const angleRange = endAngle - startAngle;

    // Calculate angle increment based on segments
    const angleIncrement = angleRange / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = (startAngle + i * angleIncrement) * Math.PI / 180;
      const point = this._calculateDestinationPoint(
        center,
        radiusMeters,
        angle,
      );
      result.push(point);
    }

    return result;
  }

  /**
     * Create a geodesic circle with the given radius around a point.
     * @param {Coordinate} center - Center coordinate
     * @param {number} radiusMeters - Radius in meters
     * @param {number} [segments=32] - Number of segments to create
     * @returns {Coordinate[]} Array of coordinates forming the circle
     */
  static createCircle(center, radiusMeters, segments = 32) {
    return this.createArc(center, radiusMeters, 0, 360, segments);
  }

  /**
     * Create a geodesic rectangle with the given dimensions.
     * @param {Coordinate} center - Center coordinate
     * @param {number} widthMeters - Width in meters
     * @param {number} heightMeters - Height in meters
     * @param {number} [rotationDegrees=0] - Rotation in degrees
     * @returns {Coordinate[]} Array of coordinates forming the rectangle
     */
  static createRectangle(center, widthMeters, heightMeters, rotationDegrees = 0) {
    const rotationRadians = rotationDegrees * Math.PI / 180;
    const halfWidth = widthMeters / 2;
    const halfHeight = heightMeters / 2;

    // Calculate corners
    const bearings = [
      Math.atan2(-halfHeight, -halfWidth) + rotationRadians,
      Math.atan2(-halfHeight, halfWidth) + rotationRadians,
      Math.atan2(halfHeight, halfWidth) + rotationRadians,
      Math.atan2(halfHeight, -halfWidth) + rotationRadians,
    ];

    const distances = [
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
      Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight),
    ];

    // Generate the corners
    const corners = [];
    for (let i = 0; i < 4; i++) {
      const bearing = (bearings[i] * 180 / Math.PI + 360) % 360;
      corners.push(this._calculateDestinationPoint(
        center,
        distances[i],
        bearing,
      ));
    }

    // Close the polygon
    corners.push(corners[0]);

    return corners;
  }

  /**
     * Check if a point is contained within a polygon.
     * @param {Coordinate} point - The point to check
     * @param {Coordinate[]} polygon - Array of coordinates defining the polygon
     * @returns {boolean} True if the point is inside the polygon
     */
  static isPointInPolygon(point, polygon) {
    // Ray casting algorithm for point-in-polygon detection
    let inside = false;

    // Check if the polygon is closed - if not, close it
    const isPolygonClosed = polygon[0].lat === polygon[polygon.length - 1].lat &&
            polygon[0].lng === polygon[polygon.length - 1].lng;
    const closedPolygon = isPolygonClosed ? polygon : [...polygon, polygon[0]];

    // Ensure all coordinates are in the same projection
    const targetProjection = point.projection;
    const normalizedPolygon = closedPolygon.map(coord =>
      coord.projection !== targetProjection ?
        coord.toProjection(targetProjection) :
        coord,
    );

    for (let i = 0, j = normalizedPolygon.length - 1; i < normalizedPolygon.length; j = i++) {
      const xi = normalizedPolygon[i].lng;
      const yi = normalizedPolygon[i].lat;
      const xj = normalizedPolygon[j].lng;
      const yj = normalizedPolygon[j].lat;

      const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
                (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
     * Check if a point is contained within a polygon (alias for isPointInPolygon).
     * @param {Coordinate} point - The point to check
     * @param {Coordinate[]} polygon - Array of coordinates defining the polygon
     * @returns {boolean} True if the point is inside the polygon
     */
  static pointInPolygon(point, polygon) {
    return this.isPointInPolygon(point, polygon);
  }

  /**
     * Calculate the centroid of a polygon.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {Coordinate} Centroid coordinate
     */
  static calculateCentroid(coordinates) {
    // Check if we have enough coordinates
    if (coordinates.length < 3) {
      throw new Error('Cannot calculate centroid: need at least 3 coordinates');
    }

    // For simple polygons, use the arithmetic mean of coordinates
    // For more complex cases, this is an approximation
    let sumLat = 0;
    let sumLng = 0;
    let sumElev = 0;

    for (const coord of coordinates) {
      sumLat += coord.lat;
      sumLng += coord.lng;
      sumElev += coord.elevation;
    }

    return new Coordinate(
      sumLat / coordinates.length,
      sumLng / coordinates.length,
      sumElev / coordinates.length,
      coordinates[0].heightReference,
      coordinates[0].projection,
    );
  }

  /**
     * Calculate the centroid of a polygon with holes.
     * @param {Coordinate[]} exteriorRing - Array of coordinates defining the exterior ring
     * @param {Array<Array<Coordinate>>} [holes=[]] - Array of holes, each an array of coordinates
     * @returns {Coordinate|null} Centroid coordinate or null if insufficient coordinates
     */
  static calculatePolygonCentroid(exteriorRing, holes = []) {
    // Check if we have enough coordinates for the exterior ring
    if (!exteriorRing || exteriorRing.length < 3) {
      console.warn('Cannot calculate polygon centroid: need at least 3 coordinates for exterior ring');
      // Return null instead of throwing an error for easier error handling
      // or if we have at least one coordinate, return it as a fallback
      if (exteriorRing && exteriorRing.length > 0) {
        return exteriorRing[0].clone();
      }
      return null;
    }

    // If there are no holes, use the regular centroid calculation
    if (!holes || holes.length === 0) {
      return this.calculateCentroid(exteriorRing);
    }

    // For polygons with holes, we can use different strategies:
    // 1. Area-weighted centroid of exterior ring and holes
    // 2. Find centroid of exterior ring and adjust based on holes
    // 3. Triangulate and compute weighted centroid

    // For simplicity, we'll use the exterior ring centroid
    // with a slight adjustment if all holes are valid

    // Calculate the centroid of the exterior ring
    const exteriorCentroid = this.calculateCentroid(exteriorRing);

    // Filter valid holes (those with at least 3 points)
    const validHoles = holes.filter(hole => hole && hole.length >= 3);

    if (validHoles.length === 0) {
      return exteriorCentroid;
    }

    // Calculate area of exterior ring
    const exteriorArea = this.calculateArea(exteriorRing);
    if (exteriorArea === 0) {
      return exteriorCentroid;
    }

    // Calculate area-weighted centroid considering holes
    let totalArea = exteriorArea;
    let weightedLat = exteriorCentroid.lat * exteriorArea;
    let weightedLng = exteriorCentroid.lng * exteriorArea;
    let weightedElev = exteriorCentroid.elevation * exteriorArea;

    for (const hole of validHoles) {
      const holeCentroid = this.calculateCentroid(hole);
      const holeArea = this.calculateArea(hole);

      totalArea -= holeArea;
      weightedLat -= holeCentroid.lat * holeArea;
      weightedLng -= holeCentroid.lng * holeArea;
      weightedElev -= holeCentroid.elevation * holeArea;
    }

    // If the total area becomes too small or negative, fall back to exterior centroid
    if (totalArea <= 0) {
      return exteriorCentroid;
    }

    // Calculate the final weighted centroid
    return new Coordinate(
      weightedLat / totalArea,
      weightedLng / totalArea,
      weightedElev / totalArea,
      exteriorRing[0].heightReference,
      exteriorRing[0].projection,
    );
  }

  /**
     * Calculate the center of a path (line).
     * @param {Coordinate[]} coordinates - Array of coordinates defining a path
     * @returns {Coordinate} Center coordinate of the path
     */
  static calculatePathCenter(coordinates) {
    // Check if we have coordinates
    if (coordinates.length === 0) {
      throw new Error('Cannot calculate path center: no coordinates provided');
    }

    // For a single point, return it
    if (coordinates.length === 1) {
      return coordinates[0].clone();
    }

    // For a path with two points, return the midpoint
    if (coordinates.length === 2) {
      const lat = (coordinates[0].lat + coordinates[1].lat) / 2;
      const lng = (coordinates[0].lng + coordinates[1].lng) / 2;
      const elevation = (coordinates[0].elevation + coordinates[1].elevation) / 2;

      return new Coordinate(
        lat,
        lng,
        elevation,
        coordinates[0].heightReference,
        coordinates[0].projection,
      );
    }

    // For a path with more than two points, find the middle point along the path
    const totalLength = this.calculatePathLength(coordinates);
    const targetDistance = totalLength / 2;

    // Find the point at the target distance
    let currentDistance = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const segmentLength = this.calculateDistance(
        coordinates[i],
        coordinates[i + 1],
        { includeElevation: true },
      );

      if (currentDistance + segmentLength >= targetDistance) {
        // The center point is on this segment
        const remainingDistance = targetDistance - currentDistance;
        const fraction = remainingDistance / segmentLength;

        // Interpolate the position
        const bearing = coordinates[i].bearingTo(coordinates[i + 1]);
        const center = this._calculateDestinationPoint(
          coordinates[i],
          segmentLength * fraction,
          bearing,
        );

        // Interpolate the elevation
        center.elevation = coordinates[i].elevation +
                    (coordinates[i + 1].elevation - coordinates[i].elevation) * fraction;

        return center;
      }

      currentDistance += segmentLength;
    }

    // If something went wrong, fall back to the midpoint of the path
    let sumLat = 0;
    let sumLng = 0;
    let sumElev = 0;

    for (const coord of coordinates) {
      sumLat += coord.lat;
      sumLng += coord.lng;
      sumElev += coord.elevation;
    }

    return new Coordinate(
      sumLat / coordinates.length,
      sumLng / coordinates.length,
      sumElev / coordinates.length,
      coordinates[0].heightReference,
      coordinates[0].projection,
    );
  }

  /**
     * Create an offset line parallel to an existing line.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a line
     * @param {number} offsetMeters - Offset distance in meters (positive is right, negative is left)
     * @param {Object} [options={}] - Offset options
     * @param {boolean} [options.closed=false] - Whether the line forms a closed loop
     * @returns {Coordinate[]} Array of coordinates forming the offset line
     */
  static createOffsetLine(coordinates, offsetMeters, options = {}) {
    if (coordinates.length < 2) {
      throw new Error('Cannot create offset: need at least 2 coordinates');
    }

    const closed = options.closed || false;
    const result = [];

    // Process each segment
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];

      // Calculate bearing of the segment
      const bearing = start.bearingTo(end);

      // Calculate perpendicular bearing (90 degrees to the right)
      const perpBearing = (bearing + 90) % 360;

      // Calculate offset points
      const startOffset = this._calculateDestinationPoint(
        start,
        offsetMeters,
        perpBearing,
      );

      result.push(startOffset);

      // Add the end point for the last segment
      if (i === coordinates.length - 2) {
        const endOffset = this._calculateDestinationPoint(
          end,
          offsetMeters,
          perpBearing,
        );
        result.push(endOffset);
      }
    }

    // If closed, add first point to close the loop
    if (closed && result.length > 2) {
      result.push(result[0]);
    }

    return result;
  }

  /**
     * Find the closest point on a line segment to a given point.
     * @param {Coordinate|Object} point - The reference point
     * @param {Coordinate|Object} segmentStart - Start of the line segment
     * @param {Coordinate|Object} segmentEnd - End of the line segment
     * @returns {Object} Object with the closest point and distance information
     */
  static nearestPointOnSegment(start, end, point) {
    const result = this._findClosestPointOnLineSegment(point, start, end);
    return {
      point: result.point,
      distance: result.distance,
      fraction: result.fraction,
      segmentPosition: result.fraction, // For compatibility with existing code
    };
  }

  /**
     * Calculate a destination point given a starting point, distance, and bearing.
     * Public method wrapping the private implementation.
     * @param {Coordinate} coordinate - Starting coordinate
     * @param {number} distance - Distance in meters
     * @param {number} bearing - Bearing in degrees
     * @returns {Coordinate} Destination coordinate
     */
  static destinationCoordinate(coordinate, distance, bearing) {
    return this._calculateDestinationPoint(coordinate, distance, bearing);
  }

  /**
     * Calculate a destination point given a starting point, distance, and bearing.
     * Uses CoordinateUtils for consistent property handling.
     * @param {Coordinate|Object} start - Starting coordinate
     * @param {number} distance - Distance in meters
     * @param {number} bearing - Bearing in degrees
     * @returns {Coordinate} Destination coordinate
     * @private
     */
  static _calculateDestinationPoint(start, distance, bearing) {
    // Standardize coordinate properties
    const standardStart = CoordinateUtils.standardizeCoordinate(start);

    if (!standardStart) {
      console.error('Invalid starting coordinate for destination calculation:', start);
      return null;
    }

    const earthRadius = this._EARTH_RADIUS_M;
    const bearingRad = bearing * Math.PI / 180;
    const latRad = standardStart.lat * Math.PI / 180;
    const lngRad = standardStart.lng * Math.PI / 180;

    const distRatio = distance / earthRadius;
    const sinDistRatio = Math.sin(distRatio);
    const cosDistRatio = Math.cos(distRatio);

    const sinLat1 = Math.sin(latRad);
    const cosLat1 = Math.cos(latRad);

    const sinLat2 = sinLat1 * cosDistRatio + cosLat1 * sinDistRatio * Math.cos(bearingRad);
    const lat2 = Math.asin(sinLat2);

    const y = Math.sin(bearingRad) * sinDistRatio * cosLat1;
    const x = cosDistRatio - sinLat1 * sinLat2;
    const lng2 = lngRad + Math.atan2(y, x);

    // Preserve the original height reference and projection if available
    const heightReference = start.heightReference ? start.heightReference :
      (start instanceof Coordinate ? start.heightReference : 'ellipsoidal');
    const projection = start.projection ? start.projection :
      (start instanceof Coordinate ? start.projection : 'WGS84');

    return new Coordinate(
      lat2 * 180 / Math.PI,
      ((lng2 * 180 / Math.PI) + 540) % 360 - 180, // Normalize to -180 to +180
      standardStart.elevation,
      heightReference,
      projection,
    );
  }

  /**
     * Find the closest point on a line segment to a given point.
     * Uses CoordinateUtils for consistent property handling.
     * @param {Coordinate|Object} point - The reference point
     * @param {Coordinate|Object} segmentStart - Start of the line segment
     * @param {Coordinate|Object} segmentEnd - End of the line segment
     * @returns {Object} Object with closest point and distance information
     * @private
     */
  static _findClosestPointOnLineSegment(point, segmentStart, segmentEnd) {
    // Standardize coordinates using CoordinateUtils
    const standardPoint = CoordinateUtils.toCoordinate(point);
    const standardStart = CoordinateUtils.toCoordinate(segmentStart);
    const standardEnd = CoordinateUtils.toCoordinate(segmentEnd);

    // Calculate vectors
    const x = standardPoint.lng - standardStart.lng;
    const y = standardPoint.lat - standardStart.lat;
    const dx = standardEnd.lng - standardStart.lng;
    const dy = standardEnd.lat - standardStart.lat;

    // Calculate dot product
    const dot = x * dx + y * dy;

    // Calculate squared length of the segment
    const len2 = dx * dx + dy * dy;

    // Calculate parametric position along the line segment
    const t = len2 > 0 ? Math.max(0, Math.min(1, dot / len2)) : 0;

    // Calculate closest point
    const closestLng = standardStart.lng + t * dx;
    const closestLat = standardStart.lat + t * dy;

    // Calculate elevation (linear interpolation)
    const closestElev = standardStart.elevation +
            t * (standardEnd.elevation - standardStart.elevation);

    // Create the closest point coordinate
    const closestPoint = new Coordinate(
      closestLat,
      closestLng,
      closestElev,
      standardStart.heightReference,
      standardStart.projection,
    );

    // Calculate the distance to the closest point
    const distance = standardPoint.distanceTo(closestPoint);

    return {
      point: closestPoint,
      distance,
      fraction: t,
    };
  }
    
  /**
     * Check if two line segments intersect.
     * @param {Coordinate} p1 - First point of first line segment
     * @param {Coordinate} p2 - Second point of first line segment
     * @param {Coordinate} p3 - First point of second line segment
     * @param {Coordinate} p4 - Second point of second line segment
     * @returns {boolean} True if the line segments intersect
     * @private
     */
  static _lineSegmentsIntersect(p1, p2, p3, p4) {
    // Convert to longitude, latitude order for calculation
    const pt1 = { x: p1.lng, y: p1.lat };
    const pt2 = { x: p2.lng, y: p2.lat };
    const pt3 = { x: p3.lng, y: p3.lat };
    const pt4 = { x: p4.lng, y: p4.lat };

    // Calculate cross products
    const d1 = this._direction(pt3, pt4, pt1);
    const d2 = this._direction(pt3, pt4, pt2);
    const d3 = this._direction(pt1, pt2, pt3);
    const d4 = this._direction(pt1, pt2, pt4);

    // Check if the line segments intersect
    return (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
                ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) ||
            (d1 === 0 && this._onSegment(pt3, pt4, pt1)) ||
            (d2 === 0 && this._onSegment(pt3, pt4, pt2)) ||
            (d3 === 0 && this._onSegment(pt1, pt2, pt3)) ||
            (d4 === 0 && this._onSegment(pt1, pt2, pt4));
  }

  /**
     * Calculate the direction of three points.
     * @param {Object} a - First point {x, y}
     * @param {Object} b - Second point {x, y}
     * @param {Object} c - Third point {x, y}
     * @returns {number} Direction value
     * @private
     */
  static _direction(a, b, c) {
    return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  }

  /**
     * Check if a point is on a line segment.
     * @param {Object} a - First endpoint of segment {x, y}
     * @param {Object} b - Second endpoint of segment {x, y}
     * @param {Object} c - Point to check {x, y}
     * @returns {boolean} True if the point is on the segment
     * @private
     */
  static _onSegment(a, b, c) {
    return c.x <= Math.max(a.x, b.x) && c.x >= Math.min(a.x, b.x) &&
            c.y <= Math.max(a.y, b.y) && c.y >= Math.min(a.y, b.y);
  }

  /**
     * Check if a polygon is self-intersecting.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {boolean} True if the polygon is self-intersecting
     * @private
     */
  static _isSelfIntersecting(coordinates) {
    // Check all line segments against all other line segments for intersection
    for (let i = 0; i < coordinates.length - 1; i++) {
      for (let j = i + 2; j < coordinates.length - 1; j++) {
        // Skip adjacent segments
        if (i === 0 && j === coordinates.length - 2) continue;

        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];
        const p3 = coordinates[j];
        const p4 = coordinates[j + 1];

        if (this._lineSegmentsIntersect(p1, p2, p3, p4)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
     * Check if a polygon or path is self-intersecting.
     * Public method wrapping the private implementation.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon or path
     * @returns {boolean} True if the polygon or path is self-intersecting
     */
  static hasSelfIntersections(coordinates) {
    if (!coordinates || coordinates.length < 4) {
      return false; // A path needs at least 4 points to self-intersect
    }

    return this._isSelfIntersecting(coordinates);
  }

  /**
     * Calculate 2D area using spherical geometry.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {number} Area in square meters
     * @private
     */
  static _calculate2DSphericalArea(coordinates) {
    // We don't need R here since it's used in _calculateSphericalTriangleArea
    let area = 0;

    // For more than 3 coordinates, we compute the area using a sum of spherical triangles
    for (let i = 1; i < coordinates.length - 1; i++) {
      area += this._calculateSphericalTriangleArea(
        coordinates[0],
        coordinates[i],
        coordinates[i + 1],
      );
    }

    return Math.abs(area);
  }

  /**
     * Calculate the area of a spherical triangle using Girard's formula.
     * @param {Coordinate} A - First coordinate
     * @param {Coordinate} B - Second coordinate
     * @param {Coordinate} C - Third coordinate
     * @returns {number} Area in square meters
     * @private
     */
  static _calculateSphericalTriangleArea(A, B, C) {
    const R = this._EARTH_RADIUS_M;

    // Convert to radians
    const a1 = A.lat * Math.PI / 180;
    const a2 = A.lng * Math.PI / 180;
    const b1 = B.lat * Math.PI / 180;
    const b2 = B.lng * Math.PI / 180;
    const c1 = C.lat * Math.PI / 180;
    const c2 = C.lng * Math.PI / 180;

    // Calculate the angles of the spherical triangle
    const a = Math.acos(
      Math.sin(b1) * Math.sin(c1) +
            Math.cos(b1) * Math.cos(c1) * Math.cos(b2 - c2),
    );
    const b = Math.acos(
      Math.sin(a1) * Math.sin(c1) +
            Math.cos(a1) * Math.cos(c1) * Math.cos(a2 - c2),
    );
    const c = Math.acos(
      Math.sin(a1) * Math.sin(b1) +
            Math.cos(a1) * Math.cos(b1) * Math.cos(a2 - b2),
    );

    // Calculate the spherical excess (in radians)
    const E = a + b + c - Math.PI;

    // Calculate the area
    return E * R * R;
  }

  /**
     * Calculate area of a self-intersecting polygon using triangulation.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @param {Object} options - Calculation options
     * @returns {number} Area in square meters
     * @private
     */
  static _calculateAreaWithTriangulation(coordinates, _options) {
    // For simplicity in this implementation, we'll assume the polygon is not self-intersecting
    // A full implementation would use ear clipping or other triangulation methods

    console.warn('Self-intersecting polygon detected. Area calculation may be inaccurate.');

    // Fall back to 2D calculation
    return this._calculate2DSphericalArea(coordinates);
  }

  /**
     * Calculate 3D area considering elevation.
     * @param {Coordinate[]} coordinates - Array of coordinates defining a polygon
     * @returns {number} Area in square meters
     * @private
     */
  static _calculate3DArea(coordinates) {
    // For 3D area, we'll project to a plane and calculate
    // First determine plane normal vector by taking cross product
    // of vectors formed by first three points

    if (coordinates.length < 3) {
      return 0;
    }

    // Convert to Cartesian coordinates
    const cartesian = coordinates.map(coord => this._geographicToCartesian(coord));

    // Calculate normal vector of best-fit plane
    const normal = this._calculateBestFitPlaneNormal(cartesian);

    // Project points onto the plane
    const projectedPoints = cartesian.map(point =>
      this._projectPointOntoPlane(point, normal, cartesian[0]),
    );

    // Calculate 3D area of the polygon on this plane
    let area = 0;
    for (let i = 0; i < projectedPoints.length - 1; i++) {
      const p1 = projectedPoints[i];
      const p2 = projectedPoints[i + 1];

      // Add area of triangle formed with origin point
      const crossProduct = this._crossProduct(p1, p2);
      area += 0.5 * this._vectorLength(crossProduct);
    }

    return area;
  }

  /**
     * Calculate the normal vector of the best-fit plane for a set of points.
     * @param {Object[]} points - Array of Cartesian coordinates {x, y, z}
     * @returns {Object} Normal vector {x, y, z}
     * @private
     */
  static _calculateBestFitPlaneNormal(points) {
    // For simplicity, we'll use the normal of the first triangle
    // In a full implementation, we would use Principal Component Analysis

    if (points.length < 3) {
      return { x: 0, y: 0, z: 1 }; // Default to up
    }

    // Calculate vectors from first point to second and third points
    const v1 = {
      x: points[1].x - points[0].x,
      y: points[1].y - points[0].y,
      z: points[1].z - points[0].z,
    };

    const v2 = {
      x: points[2].x - points[0].x,
      y: points[2].y - points[0].y,
      z: points[2].z - points[0].z,
    };

    // Calculate cross product to get normal vector
    const normal = this._crossProduct(v1, v2);

    // Normalize
    const length = this._vectorLength(normal);

    return {
      x: normal.x / length,
      y: normal.y / length,
      z: normal.z / length,
    };
  }

  /**
     * Convert geographic coordinates to Cartesian (ECEF) coordinates.
     * Uses CoordinateUtils for consistent property handling.
     * @param {Coordinate|Object} coord - Geographic coordinate
     * @returns {Object} Cartesian coordinate with consistent property naming
     * @private
     */
  static _geographicToCartesian(coord) {
    const a = this._WGS84_SEMI_MAJOR_AXIS;
    const e2 = 0.00669437999014; // WGS84 first eccentricity squared

    // Standardize coordinate properties using CoordinateUtils
    const standardCoord = CoordinateUtils.standardizeCoordinate(coord);

    if (!standardCoord || standardCoord.lat === null || standardCoord.lng === null) {
      console.error('Invalid coordinate format for conversion:', coord);
      // Return a default value at origin
      return { x: 0, y: 0, z: 0, originalFormat: 'cartesian' };
    }

    const latRad = standardCoord.lat * Math.PI / 180;
    const lngRad = standardCoord.lng * Math.PI / 180;
    const h = standardCoord.elevation;

    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLng = Math.sin(lngRad);
    const cosLng = Math.cos(lngRad);

    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

    // Create result with both naming conventions for compatibility
    const result = {
      x: (N + h) * cosLat * cosLng,
      y: (N + h) * cosLat * sinLng,
      z: (N * (1 - e2) + h) * sinLat,
      // Include standardized geographic properties
      lat: standardCoord.lat,
      lng: standardCoord.lng,
      elevation: standardCoord.elevation,
      originalFormat: 'geographic',
    };

    return result;
  }

  /**
     * Project a point onto a plane.
     * @param {Object} point - Cartesian coordinate {x, y, z}
     * @param {Object} normal - Normal vector of the plane {x, y, z}
     * @param {Object} planePoint - A point on the plane {x, y, z}
     * @returns {Object} Projected point on the plane
     * @private
     */
  static _projectPointOntoPlane(point, normal, planePoint) {
    // Calculate vector from plane point to target point
    const v = {
      x: point.x - planePoint.x,
      y: point.y - planePoint.y,
      z: point.z - planePoint.z,
    };

    // Calculate distance from point to plane
    const dist = this._dotProduct(v, normal);

    // Project the point onto the plane
    return {
      x: point.x - dist * normal.x,
      y: point.y - dist * normal.y,
      z: point.z - dist * normal.z,
    };
  }

  /**
     * Calculate the dot product of two vectors.
     * @param {Object} v1 - First vector {x, y, z}
     * @param {Object} v2 - Second vector {x, y, z}
     * @returns {number} Dot product
     * @private
     */
  static _dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  /**
     * Calculate the cross product of two vectors.
     * @param {Object} v1 - First vector {x, y, z}
     * @param {Object} v2 - Second vector {x, y, z}
     * @returns {Object} Cross product vector {x, y, z}
     * @private
     */
  static _crossProduct(v1, v2) {
    return {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x,
    };
  }

  /**
     * Calculate the length of a vector.
     * @param {Object} v - Vector {x, y, z}
     * @returns {number} Vector length
     * @private
     */
  static _vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
     * Calculate the approximate 2D distance between two coordinates using Haversine formula.
     * @param {Coordinate|Object} coord1 - First coordinate
     * @param {Coordinate|Object} coord2 - Second coordinate
     * @returns {number} Distance in meters
     * @private
     */
  static _calculateApproximateDistance(coord1, coord2) {
    const R = this._EARTH_RADIUS_M;
    const lat1 = coord1.lat * Math.PI / 180;
    const lat2 = coord2.lat * Math.PI / 180;
    const dLat = lat2 - lat1;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}