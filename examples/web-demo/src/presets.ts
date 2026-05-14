export type Preset = {
  id: string;
  label: string;
  origin: [number, number];
  destination: [number, number];
};

export const PRESETS: Preset[] = [
  { id: 'shanghai-rotterdam', label: 'Shanghai → Rotterdam', origin: [121.5, 31.0], destination: [4.4, 51.9] },
  { id: 'singapore-rotterdam', label: 'Singapore → Rotterdam', origin: [103.8, 1.3], destination: [4.4, 51.9] },
  { id: 'ny-la', label: 'New York → LA', origin: [-74.04, 40.69], destination: [-118.3, 33.7] },
  { id: 'yokohama-la', label: 'Yokohama → LA', origin: [139.6, 35.4], destination: [-118.3, 33.7] },
  { id: 'sydney-vancouver', label: 'Sydney → Vancouver', origin: [151.2, -33.9], destination: [-123.1, 49.3] },
  { id: 'mumbai-rotterdam', label: 'Mumbai → Rotterdam', origin: [72.9, 19.0], destination: [4.4, 51.9] },
  { id: 'ny-rotterdam', label: 'New York → Rotterdam', origin: [-74.04, 40.69], destination: [4.4, 51.9] },
];
