import { test, assertDeepEqual, assertEqual, assertNotEqual, assertThrows } from './testRunner.mjs';
import { distance, PerlinNoise } from '../js/utils.mjs';

// Test for distance function
test('distance function calculates correctly', () => {
    assertEqual(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5, 'Distance 3-4-5 triangle');
    assertEqual(distance({ x: 1, y: 1 }, { x: 1, y: 1 }), 0, 'Distance to self is 0');
    assertEqual(distance({ x: -1, y: 0 }, { x: 2, y: 4 }), 5, 'Distance with negative coordinates');
    assertEqual(distance({ x: 0, y: 0 }, { x: 1, y: 0 }), 1, 'Horizontal distance');
    assertEqual(distance({ x: 0, y: 0 }, { x: 0, y: 1 }), 1, 'Vertical distance');
});

test('distance function handles invalid input', () => {
    assertEqual(distance(null, { x: 1, y: 1 }), null, 'Handles null for point A');
    assertEqual(distance({ x: 1, y: 1 }, null), null, 'Handles null for point B');
    assertEqual(distance({ x: 1 }, { x: 1, y: 1 }), null, 'Handles missing y for point A');
    assertEqual(distance({ x: 1, y: 1 }, { y: 1 }), null, 'Handles missing x for point B');
});

// Test for PerlinNoise constructor
test('PerlinNoise constructor initializes with a seed', () => {
    const noise1 = new PerlinNoise(123);
    const noise2 = new PerlinNoise(123);
    const noise3 = new PerlinNoise(456);

    assertEqual(noise1.seed, 123, 'Seed should be set correctly');
    assertDeepEqual(noise1.permutation, noise2.permutation, 'Same seed should produce same permutation');
    assertNotEqual(JSON.stringify(noise1.permutation), JSON.stringify(noise3.permutation), 'Different seed should produce different permutation');
});

test('PerlinNoise constructor handles no seed', () => {
    const noise = new PerlinNoise();
    assertEqual(typeof noise.seed, 'number', 'Should generate a random seed if none provided');
});

// Test for PerlinNoise noise method (basic check, not for exact values)
test('PerlinNoise noise method returns a number', () => {
    const noise = new PerlinNoise(1);
    const value = noise.noise(0.5, 0.5);
    assertEqual(typeof value, 'number', 'noise method should return a number');
});

// Run all tests (this will be called by the main test runner script)
// In a real setup, you might have a main test file that imports all individual test files.
// For this minimal setup, we'll rely on the package.json script to execute this file directly.
