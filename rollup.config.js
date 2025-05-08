import terser from '@rollup/plugin-terser';
import { readFileSync } from 'node:fs';

// Read package.json
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Banner for the builds
const banner = `/**
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * ${pkg.homepage}
 * 
 * @license ${pkg.license}
 * @copyright ${new Date().getFullYear()} ${pkg.author}
 */
`;

export default [
  // UMD build for browsers (development)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gis-survey.js',
      format: 'umd',
      name: 'GisSurvey',
      banner,
      sourcemap: true
    }
  },
  
  // UMD build for browsers (production, minified)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gis-survey.min.js',
      format: 'umd',
      name: 'GisSurvey',
      banner,
      sourcemap: true,
      plugins: [terser()]
    }
  },
  
  // ESM build for bundlers
  {
    input: 'src/index.js',
    output: {
      file: 'dist/gis-survey.esm.js',
      format: 'esm',
      banner,
      sourcemap: true
    }
  }
]