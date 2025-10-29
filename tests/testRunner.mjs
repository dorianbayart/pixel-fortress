

// tests/testRunner.js
let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✓ ${name}`);
        passedTests++;
    } catch (error) {
        console.error(`✗ ${name}`);
        console.error(error);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`Assertion Failed: ${message || ''} Expected "${expected}", got "${actual}"`);
    }
}

function assertDeepEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Assertion Failed: ${message || ''} Expected deep equality for "${JSON.stringify(expected)}", got "${JSON.stringify(actual)}"`);
    }
}

function assertNotEqual(actual, expected, message) {
    if (actual === expected) {
        throw new Error(`Assertion Failed: ${message || ''} Expected "${actual}" not to equal "${expected}"`);
    }
}

function assertThrows(fn, message) {
    let thrown = false;
    try {
        fn();
    } catch (e) {
        thrown = true;
    }
    if (!thrown) {
        throw new Error(`Assertion Failed: ${message || ''} Expected function to throw an error, but it did not.`);
    }
}

// Global setup/teardown (optional)
function runTests() {
    console.log('\n--- Running Tests ---');
    // All test files should be imported here or run sequentially
    // For now, we'll assume tests are run by importing them directly in the runner or a main test file.
    // This function is mainly for reporting.
    process.on('exit', () => {
        console.log('\n--- Test Summary ---');
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${totalTests - passedTests}`);
        if (passedTests === totalTests) {
            console.log('All tests passed!');
            process.exit(0);
        } else {
            console.error('Some tests failed.');
            process.exit(1);
        }
    });
}

// Export for use in test files
export { test, assertEqual, assertDeepEqual, assertNotEqual, assertThrows, runTests };

