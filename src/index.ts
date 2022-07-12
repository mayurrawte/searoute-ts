/* eslint-disable functional/immutable-data */
/* eslint-disable no-useless-catch */
/* eslint-disable functional/no-let */

import { lineString, point, Units } from '@turf/helpers';
import length from '@turf/length';
import {coordEach, featureEach } from '@turf/meta';
import pointToLineDistance from '@turf/point-to-line-distance';
import rhumbDistance from '@turf/rhumb-distance';
import RouteFinder from 'ts-geojson-path-finder';

import { marnet } from './lib/utils';

//@ts-ignore
const routefinder = new RouteFinder(marnet);

const snapToNetwork = (pt:any) => {
    let nearestLineIndex = 0;
    let distance = 30000;
    //@ts-ignore
    featureEach(marnet, function (feature, ftIndex) {
    //@ts-ignore
    const dist = pointToLineDistance(pt, feature, { units: 'kilometers' })
    if (dist < distance) {
         distance = dist;
         nearestLineIndex = ftIndex;
    }});

    let nearestVertexDist = null;
    let nearestCoord = null;
    console.log(nearestLineIndex)
    //@ts-ignore
    coordEach(marnet.features[nearestLineIndex], function (currentCoord) {

    const distToVertex = rhumbDistance(pt, currentCoord);
    if (!nearestVertexDist) {
        nearestVertexDist = distToVertex;
        nearestCoord = currentCoord;
    } else if (distToVertex < nearestVertexDist) {
        nearestVertexDist = distToVertex;
        nearestCoord = currentCoord;
    }
    });
    return point(nearestCoord);
}


export const seaRoute = (origin:any, destination:any, units: Units='nauticalmiles') => {
    try {
        const snappedOrigin = snapToNetwork(origin);
        const snappedDestination = snapToNetwork(destination);

        const route = routefinder.findPath(snappedOrigin, snappedDestination);

        if (route == null) {
            console.log("No route found");
            return null;
        }

        const ls = lineString(route.path)

        ls.properties.units = units;
        ls.properties.length = units === 'nauticalmiles'
            ? length(ls, { units: 'miles' }) * 1.15078
            : length(ls, { units: units });

        return ls;
    } catch (err) {
        // eslint-disable-next-line functional/no-throw-statement
        throw err;
    }
}