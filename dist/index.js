/* eslint-disable functional/immutable-data */
/* eslint-disable no-useless-catch */
/* eslint-disable functional/no-let */
import { lineString, point } from '@turf/helpers';
import length from '@turf/length';
import { coordEach, featureEach } from '@turf/meta';
import pointToLineDistance from '@turf/point-to-line-distance';
import rhumbDistance from '@turf/rhumb-distance';
import RouteFinder from 'ts-geojson-path-finder';
import { marnet } from './lib/utils';
//@ts-ignore
const routefinder = new RouteFinder(marnet);
const snapToNetwork = (pt) => {
    let nearestLineIndex = 0;
    let distance = 30000;
    //@ts-ignore
    featureEach(marnet, function (feature, ftIndex) {
        //@ts-ignore
        const dist = pointToLineDistance(pt, feature, { units: 'kilometers' });
        if (dist < distance) {
            distance = dist;
            nearestLineIndex = ftIndex;
        }
    });
    let nearestVertexDist = null;
    let nearestCoord = null;
    console.log(nearestLineIndex);
    //@ts-ignore
    coordEach(marnet.features[nearestLineIndex], function (currentCoord) {
        const distToVertex = rhumbDistance(pt, currentCoord);
        if (!nearestVertexDist) {
            nearestVertexDist = distToVertex;
            nearestCoord = currentCoord;
        }
        else if (distToVertex < nearestVertexDist) {
            nearestVertexDist = distToVertex;
            nearestCoord = currentCoord;
        }
    });
    return point(nearestCoord);
};
export const seaRoute = (origin, destination, units = 'nauticalmiles') => {
    try {
        const snappedOrigin = snapToNetwork(origin);
        const snappedDestination = snapToNetwork(destination);
        const route = routefinder.findPath(snappedOrigin, snappedDestination);
        if (route == null) {
            console.log("No route found");
            return null;
        }
        const ls = lineString(route.path);
        ls.properties.units = units;
        ls.properties.length = units === 'nauticalmiles'
            ? length(ls, { units: 'miles' }) * 1.15078
            : length(ls, { units: units });
        return ls;
    }
    catch (err) {
        // eslint-disable-next-line functional/no-throw-statement
        throw err;
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOENBQThDO0FBQzlDLHFDQUFxQztBQUNyQyxzQ0FBc0M7QUFFdEMsT0FBTyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQVMsTUFBTSxlQUFlLENBQUM7QUFDekQsT0FBTyxNQUFNLE1BQU0sY0FBYyxDQUFDO0FBQ2xDLE9BQU8sRUFBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ25ELE9BQU8sbUJBQW1CLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxhQUFhLE1BQU0sc0JBQXNCLENBQUM7QUFDakQsT0FBTyxXQUFXLE1BQU0sd0JBQXdCLENBQUM7QUFFakQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUVyQyxZQUFZO0FBQ1osTUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFNUMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxFQUFNLEVBQUUsRUFBRTtJQUM3QixJQUFJLGdCQUFnQixHQUFHLENBQUMsQ0FBQztJQUN6QixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7SUFDckIsWUFBWTtJQUNaLFdBQVcsQ0FBQyxNQUFNLEVBQUUsVUFBVSxPQUFPLEVBQUUsT0FBTztRQUM5QyxZQUFZO1FBQ1osTUFBTSxJQUFJLEdBQUcsbUJBQW1CLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFBO1FBQ3RFLElBQUksSUFBSSxHQUFHLFFBQVEsRUFBRTtZQUNoQixRQUFRLEdBQUcsSUFBSSxDQUFDO1lBQ2hCLGdCQUFnQixHQUFHLE9BQU8sQ0FBQztTQUMvQjtJQUFBLENBQUMsQ0FBQyxDQUFDO0lBRUosSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUM7SUFDN0IsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDO0lBQ3hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtJQUM3QixZQUFZO0lBQ1osU0FBUyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxVQUFVLFlBQVk7UUFFbkUsTUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDLEVBQUUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsaUJBQWlCLEVBQUU7WUFDcEIsaUJBQWlCLEdBQUcsWUFBWSxDQUFDO1lBQ2pDLFlBQVksR0FBRyxZQUFZLENBQUM7U0FDL0I7YUFBTSxJQUFJLFlBQVksR0FBRyxpQkFBaUIsRUFBRTtZQUN6QyxpQkFBaUIsR0FBRyxZQUFZLENBQUM7WUFDakMsWUFBWSxHQUFHLFlBQVksQ0FBQztTQUMvQjtJQUNELENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDL0IsQ0FBQyxDQUFBO0FBR0QsTUFBTSxDQUFDLE1BQU0sUUFBUSxHQUFHLENBQUMsTUFBVSxFQUFFLFdBQWUsRUFBRSxRQUFhLGVBQWUsRUFBRSxFQUFFO0lBQ2xGLElBQUk7UUFDQSxNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUMsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFdEQsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUV0RSxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUU7WUFDZixPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDOUIsT0FBTyxJQUFJLENBQUM7U0FDZjtRQUVELE1BQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUE7UUFFakMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQzVCLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLEtBQUssS0FBSyxlQUFlO1lBQzVDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLEdBQUcsT0FBTztZQUMxQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBRW5DLE9BQU8sRUFBRSxDQUFDO0tBQ2I7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNWLHlEQUF5RDtRQUN6RCxNQUFNLEdBQUcsQ0FBQztLQUNiO0FBQ0wsQ0FBQyxDQUFBIn0=