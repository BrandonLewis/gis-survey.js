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

### npm

```bash
npm install @brandon7lewis/gis-survey.js
```

### CDN

You can also use the library directly from the CDN:

```html
<!-- Development version -->
<script src="https://cdn.jsdelivr.net/gh/BrandonLewis/gis-survey.js@cdn-dist/dist/gis-survey.js"></script>

<!-- Production version -->
<script src="https://cdn.jsdelivr.net/gh/BrandonLewis/gis-survey.js@cdn-dist/dist/gis-survey.min.js"></script>
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

### API Keys and Environment Variables

This project uses environment variables for configuration. Copy the example environment file to create your own:

```bash
cp .env.example .env
```

Then edit the `.env` file to add your Google Maps API key. This key will be automatically injected into the examples when using the development server.

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
- Continuous Integration: Running linting and builds on PRs
- Automated releases: Using semantic-release to automatically publish to npm
- CDN deployment: Automatically deploying builds to the cdn-dist branch

### Contributing

We follow conventional commit standards to automate versioning:

- `fix:` prefix for bug fixes (patch version bump)
- `feat:` prefix for new features (minor version bump)
- `BREAKING CHANGE:` in the commit body for breaking changes (major version bump)

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details on commit conventions and development workflow.

## API Documentation

Documentation is automatically generated using JSDoc. View the latest version in the [docs](https://BrandonLewis.github.io/gis-survey.js/docs/) directory.

## License

MIT