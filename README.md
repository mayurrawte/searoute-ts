# Searoute-TS

Typescript implementation of https://github.com/johnx25bd/searoute

An npm package for generating the shortest sea route between two points on Earth.

If points are on land, the function will attempt to find the nearest point on the sea and calculate the route from there.

**Not for routing purposes!** This library was developed to generate realistic-looking searoutes for visualizations of maritime routes, not for mariners to route their ships.

![Searoute map](https://raw.githubusercontent.com/johnx25bd/searoute/master/assets/searoute.png)

## Installation

```bash
npm install searoute-ts
```

## Usage

```typescript
import seaRoute from 'searoute-ts';

// Define origin and destination GeoJSON points:
const origin = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [132.5390625, 21.616579336740603],
  },
};

const destination = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [-71.3671875, 75.05035357407698],
  },
};

const route = seaRoute(origin, destination);
// > Returns a GeoJSON LineString Feature

// Optionally, define the units for the length calculation included in the properties object.
// Defaults to nautical miles, can be degrees, radians, miles, or kilometers.
const routeMiles = seaRoute(origin, destination, 'miles');
```

## Credits

Based on Eurostat's [Searoute Java library](https://github.com/eurostat/searoute) and Dijkstra's algorithm implemented by [perliedman](https://www.liedman.net/geojson-path-finder/) and js library by [johnx25bd](https://github.com/johnx25bd/searoute)
