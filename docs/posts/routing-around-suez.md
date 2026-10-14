# What happens inside a sea-routing library when you close the Suez Canal

*How searoute-ts turns "what if Suez is shut?" into a shortest-path problem, and the two places where that goes wrong if you are not careful.*

Every few months the question comes back: a Red Sea disruption, a grounding, a strike, and someone in logistics wants to know how many extra days the Cape of Good Hope adds. [searoute-ts](https://github.com/mayurrawte/searoute-ts) is a TypeScript library that answers it in one call:

```ts
import { seaRoute } from 'searoute-ts';
import 'searoute-ts/ports';

seaRoute('SGSIN', 'NLRTM', { units: 'kilometers', speedKnots: 16 });
// 15,630 km, 22 days, via Malacca, Bab-el-Mandeb, Suez, Gibraltar, Dover

seaRoute('SGSIN', 'NLRTM', { units: 'kilometers', speedKnots: 16, restrictions: ['suez'] });
// 21,961 km, 31 days, round the Cape
```

Nine extra days from Singapore. This post is about what happens between those two lines, because the interesting parts are not the algorithm. They are the data and the edge cases.

## The sea is a graph

The library does not route over water. It routes over the Eurostat **marnet**, a hand-curated network of shipping lanes published with the original Java [searoute](https://github.com/eurostat/searoute) project. The bundled 100 km variant has:

| | |
|---|---|
| LineString features | 9,847 |
| Unique vertices | 5,241 |
| Edges | 10,411 |

Each edge is weighted by its great-circle length and the shortest path is plain Dijkstra, via `geojson-path-finder`. There is no A* and no heuristic. The graph is small enough that a warm route takes about 75 ms, and the first call pays for building the finder once.

Twelve passages carry a `pass` label on the network features themselves: Suez, Panama, Gibraltar, Bab-el-Mandeb, Malacca, Dover, Kiel, Corinth, Bering, Magellan, and the Northwest and Northeast Passages. That label is the whole mechanism behind `restrictions`.

## Closing a canal is a weight function

`geojson-path-finder` lets you supply a weight function per edge. Return a number and the edge exists with that cost. Return zero and the edge is dropped from the graph. So "close Suez" is:

```ts
weight: (a, b, props) => {
  if (props?.pass && blocked.has(props.pass)) return 0;
  return distance(a, b, { units: 'kilometers' });
}
```

Nothing is removed from the data. Each distinct set of restrictions gets its own finder, cached by network identity plus a sorted restriction key, so routing a thousand port pairs with Suez closed builds the graph once.

Two defaults sit on top of this. The Northwest and Northeast Passages are blocked unless you pass `allowArctic: true`, because on the graph they are shorter: Shanghai to Rotterdam through the Northeast Passage is 17,418 km against 19,753 km through Suez, and no container line sails it. And `vesselDraftMeters` adds canals the ship cannot physically fit through, using published limits for Panama, Suez, Kiel and Corinth.

## The passages the data does not know about

Four passages people ask about are not labelled in the marnet: the Bosporus, Hormuz, Sunda and Cape Horn. For those the library falls back to a bounding box and drops any edge that crosses it.

The first implementation sampled five points along each edge and tested them against the box. It passed every test and let ships sail straight through a closed Bosporus. The strait is about 30 km long. An edge on a 100 km network can have both endpoints outside the box and still cross it, and five samples spaced 20 km apart can all land outside a box that narrow.

The fix is an exact segment-against-rectangle test, Liang–Barsky clipping, which is a dozen lines and costs nothing measurable. It is the single most useful lesson in the codebase: when your graph is coarser than the feature you are testing for, sampling is not a test.

## Snapping, and why short hops misbehave

Ports are not on the network. Each input point is snapped in two passes: find the nearest line by point-to-segment distance, then the nearest vertex on that line. That is the same approach the Java original uses.

It has two consequences that show up in real projects:

- `length` covers the in-water path only. The legs from the port to the first vertex and from the last vertex to the destination are not counted, even with `appendOriginDestination`, which only draws them. Two of the eleven public projects using the library measured "last mile" from the raw point and got zero.
- Points closer together than the network resolution snap to the same vertex. Since 2.3.1 the error says so instead of a generic "no route found". If you route between Greek islands, use the 20 km network from `searoute-ts/marnet-20km`.

`maxSnapDistanceKm` exists to catch the inland typo before it snaps to a coast 400 km away.

## The result that surprised me

Close Suez and route Shanghai to Rotterdam, and the library goes through **Panama**, not round the Cape.

| Shanghai to Rotterdam | km | days at 16 kn |
|---|---|---|
| via Suez | 19,753 | 28 |
| Suez closed (library's pick: Panama) | 25,315 | 33 |
| Suez and Panama closed (Cape, via Sunda) | 25,845 | 36 |

From Shanghai the two detours are within 2 per cent of each other on this network, so the shortest-path answer is Panama. From Singapore the Cape wins comfortably. The library does not have an opinion about which is "the" Suez alternative, and that turns out to be the right design: `restrictions` says what is closed, and `via: ['panama']` or blocking Panama as well says what you want to compare. `seaRouteAlternatives` does exactly that, running a fixed set of canal permutations (no Suez, no Panama, both, no Malacca, no Gibraltar) and returning the distinct ones sorted by length. It is not Yen's k-shortest-paths, because nobody asking for an alternative wants a route that deviates by two vertices. They want to know what happens when a chokepoint shuts.

## The dateline

Any route that crosses the Pacific crosses longitude 180. Left as computed, that Shanghai-via-Panama route jumps from 179 to minus 179 and most map renderers draw a line across the whole world. The library can `unwrap` the longitudes (that route runs from 121 to 365 degrees) so the line stays continuous, or `split` it into a MultiLineString at the dateline for strict GeoJSON consumers. At the data level, vertices at exactly 180 are rewritten to minus 180 so the two sides of the Pacific share a single graph vertex. Without that the graph has a seam and trans-Pacific routes do not exist.

## What it is not

It is not a navigation tool. The output is a network path for visualisation and distance or duration estimates. There is no weather, no seasonal routing, no canal transit cost or waiting time. Those have been asked about and deferred: nobody using the library has needed them yet, and each one pushes the project towards voyage planning, which is a different product.

## Try it

- `npm install searoute-ts`, MIT, zero network calls, works in Node and the browser.
- 294 pre-computed route pages, each a deep link into the interactive demo: [mayurrawte.is-a.dev/searoute-ts/routes](https://mayurrawte.is-a.dev/searoute-ts/routes/)
- An MCP server so an agent can ask the same question: `npx -y @searoute-ts/mcp`
- The network data is Eurostat's, EUPL-1.2. The library is a port of the idea, not a fork of the code.
