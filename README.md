# gis-survey.js

A JavaScript module for mapping and surveying tools that works with or without GNSS integration.

![CI](https://github.com/BrandonLewis/gis-survey.js/workflows/CI/badge.svg)
[![npm version](https://badge.fury.io/js/gis-survey.js.svg)](https://badge.fury.io/js/gis-survey.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 3D-first geometry engine
- Feature management (points, lines, polygons)
- Survey tools (measurement, drawing, editing)
- Map provider abstraction (Google Maps, Leaflet)
- Coordinate transformations

## Installation

```bash
npm install gis-survey.js
```

## Usage

```javascript
import { createSurvey } from 'gis-survey.js';

// Initialize with Google Maps
const map = new google.maps.Map(document.getElementById('map'), {
  center: { lat: 0, lng: 0 },
  zoom: 2
});

// Create survey with map
const survey = await createSurvey(map, 'google', {
  enable3D: true
});

// Use drawing tools
survey.tools.drawing.activate({ mode: 'point' });

// Integrate with GNSS module (optional)
import { GnssModule } from 'gnss.js';
const gnss = new GnssModule();
survey.connectGnssModule(gnss);
```

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Run development build with watch mode
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Generate documentation
npm run docs
```

The build process generates the following outputs:
- `dist/gis-survey.js` - UMD build (development)
- `dist/gis-survey.min.js` - UMD build (production, minified)
- `dist/gis-survey.esm.js` - ESM build for bundlers

### CI/CD

This repository uses GitHub Actions for:
- Continuous Integration: Running linting and builds on PRs and pushes to main
- Automated releases: Using semantic versioning to automatically publish to npm
- CDN deployment: Automatically deploying builds to a CDN-optimized branch

## API Documentation

Documentation is automatically generated using JSDoc. View the latest version in the [docs](https://BrandonLewis.github.io/gis-survey.js/docs/) directory.

## License

MIT