# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build

# Run linting
npm run lint

# Generate documentation
npm run docs
```

## Project Structure and Architecture

This project is a JavaScript module for mapping and surveying tools that works with or without GNSS integration.

### Core Components

- **Core**: Contains fundamental geometric utilities like coordinate handling, transformations, and a geometry engine
- **Features**: Implements handling of different geospatial features (points, lines, polygons)
- **Map**: Abstracts different map providers (Google Maps, Leaflet) with common interfaces
- **Tools**: Implements specialized surveying tools like drawing, measurement, and editing

### Key Architecture Patterns

1. **Adapter Pattern**: Used for map providers (GoogleMapsAdapter, LeafletAdapter) to normalize different mapping APIs
2. **Factory Pattern**: MapFactory and TransformerFactory help create appropriate implementations
3. **Strategy Pattern**: RenderingStrategy implementations for different map providers
4. **Event-driven Communication**: event-emitter.js provides pub/sub capabilities

### Build System

- Uses Rollup for bundling with configurations for:
  - UMD build (development)
  - UMD build (production, minified)
  - ESM build for modern bundlers

### CI/CD Configuration

GitHub Actions workflows handle:
- Continuous Integration: Linting and builds on PRs and pushes to main
- Automated releases using semantic versioning
- CDN deployment for built assets