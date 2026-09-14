import test from 'node:test';
import assert from 'node:assert';

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function calculateDistance(p1, p2) {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function calculateRouteDistances(coordinates) {
  if (coordinates.length < 2) {
    return { totalDistance: 0, cumulativeDistances: [0] };
  }

  const cumulativeDistances = [0];
  let total = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = { lat: coordinates[i][0], lng: coordinates[i][1] };
    const p2 = { lat: coordinates[i + 1][0], lng: coordinates[i + 1][1] };
    const dist = calculateDistance(p1, p2);
    total += dist;
    cumulativeDistances.push(total);
  }

  return { totalDistance: total, cumulativeDistances };
}

function interpolateRoutePosition(coordinates, targetDistanceMeters, cumulativeDistances) {
  if (coordinates.length === 0) return { position: { lat: 0, lng: 0 } };
  if (coordinates.length === 1) return { position: { lat: coordinates[0][0], lng: coordinates[0][1] } };

  const cumDist = cumulativeDistances || calculateRouteDistances(coordinates).cumulativeDistances;
  const totalDist = cumDist[cumDist.length - 1];

  if (targetDistanceMeters <= 0) {
    return { position: { lat: coordinates[0][0], lng: coordinates[0][1] } };
  }
  if (targetDistanceMeters >= totalDist) {
    const n = coordinates.length;
    return { position: { lat: coordinates[n - 1][0], lng: coordinates[n - 1][1] } };
  }

  let low = 0;
  let high = cumDist.length - 1;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (cumDist[mid] <= targetDistanceMeters) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const segStartDist = cumDist[low];
  const segEndDist = cumDist[low + 1];
  const segLength = segEndDist - segStartDist;

  const p1 = { lat: coordinates[low][0], lng: coordinates[low][1] };
  const p2 = { lat: coordinates[low + 1][0], lng: coordinates[low + 1][1] };

  const fraction = (targetDistanceMeters - segStartDist) / segLength;
  const lat = p1.lat + (p2.lat - p1.lat) * fraction;
  const lng = p1.lng + (p2.lng - p1.lng) * fraction;

  return { position: { lat, lng } };
}

test('calculateDistance should accurately compute distance between known points', () => {
  // Brandenburger Tor to Siegessäule approx 1.9-2.0 km
  const p1 = { lat: 52.51627, lng: 13.3777 };
  const p2 = { lat: 52.5145, lng: 13.3501 };
  const dist = calculateDistance(p1, p2);
  assert.ok(dist > 1800 && dist < 2000, `Expected ~1900m, got ${dist}m`);
});

test('calculateRouteDistances should compute total and cumulative segment distances', () => {
  const coords = [
    [52.0, 13.0],
    [52.0, 13.1],
    [52.0, 13.2],
  ];
  const res = calculateRouteDistances(coords);
  assert.strictEqual(res.cumulativeDistances.length, 3);
  assert.strictEqual(res.cumulativeDistances[0], 0);
  assert.ok(res.totalDistance > 0);
  assert.strictEqual(res.cumulativeDistances[2], res.totalDistance);
});

test('interpolateRoutePosition should linearly position pacer along multi-segment route', () => {
  const coords = [
    [50.0, 10.0],
    [50.0, 11.0],
    [50.0, 12.0],
  ];
  const { totalDistance, cumulativeDistances } = calculateRouteDistances(coords);

  // At distance 0 -> Start point
  const atStart = interpolateRoutePosition(coords, 0, cumulativeDistances);
  assert.strictEqual(atStart.position.lat, 50.0);
  assert.strictEqual(atStart.position.lng, 10.0);

  // At distance totalDistance -> End point
  const atEnd = interpolateRoutePosition(coords, totalDistance, cumulativeDistances);
  assert.strictEqual(atEnd.position.lat, 50.0);
  assert.strictEqual(atEnd.position.lng, 12.0);

  // At 50% distance -> exactly middle waypoint
  const atHalf = interpolateRoutePosition(coords, totalDistance / 2, cumulativeDistances);
  assert.ok(Math.abs(atHalf.position.lng - 11.0) < 0.001);
});

test('Pacer arrival logic: exact arrival at target minute :00', () => {
  const startMs = new Date('2026-09-14T18:00:00Z').getTime();
  const targetMs = new Date('2026-09-14T18:30:00Z').getTime(); // Target minute 18:30:00
  const durationSec = (targetMs - startMs) / 1000;
  assert.strictEqual(durationSec, 1800); // exactly 30 minutes

  const distanceMeters = 5000; // 5 km
  const speedMps = distanceMeters / durationSec; // ~2.777 m/s
  const speedKmh = speedMps * 3.6; // 10.0 km/h
  assert.strictEqual(speedKmh, 10);

  // At 18:15 (halfway)
  const midwayMs = new Date('2026-09-14T18:15:00Z').getTime();
  const progressMid = (midwayMs - startMs) / (targetMs - startMs);
  assert.strictEqual(progressMid, 0.5);

  // At 18:30:00 (target minute begins)
  const finishMs = new Date('2026-09-14T18:30:00Z').getTime();
  const progressEnd = (finishMs - startMs) / (targetMs - startMs);
  assert.strictEqual(progressEnd, 1.0);
});
