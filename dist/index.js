"use strict";
/* eslint-disable functional/immutable-data */
/* eslint-disable no-useless-catch */
/* eslint-disable functional/no-let */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seaRoute = void 0;
const helpers_1 = require("@turf/helpers");
const length_1 = __importDefault(require("@turf/length"));
const meta_1 = require("@turf/meta");
const point_to_line_distance_1 = __importDefault(require("@turf/point-to-line-distance"));
const rhumb_distance_1 = __importDefault(require("@turf/rhumb-distance"));
const ts_geojson_path_finder_1 = __importDefault(require("ts-geojson-path-finder"));
const utils_1 = require("./lib/utils");
//@ts-ignore
const routefinder = new ts_geojson_path_finder_1.default(utils_1.marnet);
const snapToNetwork = (pt) => {
    let nearestLineIndex = 0;
    let distance = 30000;
    //@ts-ignore
    (0, meta_1.featureEach)(utils_1.marnet, function (feature, ftIndex) {
        //@ts-ignore
        const dist = (0, point_to_line_distance_1.default)(pt, feature, { units: 'kilometers' });
        if (dist < distance) {
            distance = dist;
            nearestLineIndex = ftIndex;
        }
    });
    let nearestVertexDist = null;
    let nearestCoord = null;
    console.log(nearestLineIndex);
    //@ts-ignore
    (0, meta_1.coordEach)(utils_1.marnet.features[nearestLineIndex], function (currentCoord) {
        const distToVertex = (0, rhumb_distance_1.default)(pt, currentCoord);
        if (!nearestVertexDist) {
            nearestVertexDist = distToVertex;
            nearestCoord = currentCoord;
        }
        else if (distToVertex < nearestVertexDist) {
            nearestVertexDist = distToVertex;
            nearestCoord = currentCoord;
        }
    });
    return (0, helpers_1.point)(nearestCoord);
};
const seaRoute = (origin, destination, units = 'nauticalmiles') => {
    try {
        const snappedOrigin = snapToNetwork(origin);
        const snappedDestination = snapToNetwork(destination);
        const route = routefinder.findPath(snappedOrigin, snappedDestination);
        if (route == null) {
            console.log("No route found");
            return null;
        }
        const ls = (0, helpers_1.lineString)(route.path);
        ls.properties.units = units;
        ls.properties.length = units === 'nauticalmiles'
            ? (0, length_1.default)(ls, { units: 'miles' }) * 1.15078
            : (0, length_1.default)(ls, { units: units });
        return ls;
    }
    catch (err) {
        // eslint-disable-next-line functional/no-throw-statement
        throw err;
    }
};
exports.seaRoute = seaRoute;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLDhDQUE4QztBQUM5QyxxQ0FBcUM7QUFDckMsc0NBQXNDOzs7Ozs7QUFFdEMsMkNBQXlEO0FBQ3pELDBEQUFrQztBQUNsQyxxQ0FBbUQ7QUFDbkQsMEZBQStEO0FBQy9ELDBFQUFpRDtBQUNqRCxvRkFBaUQ7QUFFakQsdUNBQXFDO0FBRXJDLFlBQVk7QUFDWixNQUFNLFdBQVcsR0FBRyxJQUFJLGdDQUFXLENBQUMsY0FBTSxDQUFDLENBQUM7QUFFNUMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxFQUFNLEVBQUUsRUFBRTtJQUM3QixJQUFJLGdCQUFnQixHQUFHLENBQUMsQ0FBQztJQUN6QixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7SUFDckIsWUFBWTtJQUNaLElBQUEsa0JBQVcsRUFBQyxjQUFNLEVBQUUsVUFBVSxPQUFPLEVBQUUsT0FBTztRQUM5QyxZQUFZO1FBQ1osTUFBTSxJQUFJLEdBQUcsSUFBQSxnQ0FBbUIsRUFBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxDQUFDLENBQUE7UUFDdEUsSUFBSSxJQUFJLEdBQUcsUUFBUSxFQUFFO1lBQ2hCLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDaEIsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDO1NBQy9CO0lBQUEsQ0FBQyxDQUFDLENBQUM7SUFFSixJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQztJQUM3QixJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7SUFDeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO0lBQzdCLFlBQVk7SUFDWixJQUFBLGdCQUFTLEVBQUMsY0FBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLFVBQVUsWUFBWTtRQUVuRSxNQUFNLFlBQVksR0FBRyxJQUFBLHdCQUFhLEVBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUNwQixpQkFBaUIsR0FBRyxZQUFZLENBQUM7WUFDakMsWUFBWSxHQUFHLFlBQVksQ0FBQztTQUMvQjthQUFNLElBQUksWUFBWSxHQUFHLGlCQUFpQixFQUFFO1lBQ3pDLGlCQUFpQixHQUFHLFlBQVksQ0FBQztZQUNqQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1NBQy9CO0lBQ0QsQ0FBQyxDQUFDLENBQUM7SUFDSCxPQUFPLElBQUEsZUFBSyxFQUFDLFlBQVksQ0FBQyxDQUFDO0FBQy9CLENBQUMsQ0FBQTtBQUdNLE1BQU0sUUFBUSxHQUFHLENBQUMsTUFBVSxFQUFFLFdBQWUsRUFBRSxRQUFhLGVBQWUsRUFBRSxFQUFFO0lBQ2xGLElBQUk7UUFDQSxNQUFNLGFBQWEsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUMsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFdEQsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUV0RSxJQUFJLEtBQUssSUFBSSxJQUFJLEVBQUU7WUFDZixPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDOUIsT0FBTyxJQUFJLENBQUM7U0FDZjtRQUVELE1BQU0sRUFBRSxHQUFHLElBQUEsb0JBQVUsRUFBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUE7UUFFakMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQzVCLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLEtBQUssS0FBSyxlQUFlO1lBQzVDLENBQUMsQ0FBQyxJQUFBLGdCQUFNLEVBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLEdBQUcsT0FBTztZQUMxQyxDQUFDLENBQUMsSUFBQSxnQkFBTSxFQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBRW5DLE9BQU8sRUFBRSxDQUFDO0tBQ2I7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNWLHlEQUF5RDtRQUN6RCxNQUFNLEdBQUcsQ0FBQztLQUNiO0FBQ0wsQ0FBQyxDQUFBO0FBeEJZLFFBQUEsUUFBUSxZQXdCcEIifQ==