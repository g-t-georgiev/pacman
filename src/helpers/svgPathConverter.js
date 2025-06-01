/**
 * Extracts (x, y) coordinate pairs from an SVG path string.
 * Handles integers, decimals, negative numbers, and optional commas.
 * Ignores all commands like M, L, z, etc.
 * 
 * @param {string} path 
 * @returns {number[][]}
 */
function convertSVGPathToMatrixOfPoints(path) {
    const matches = path.match(/-?\d*\.?\d+(?:,|\s+)-?\d*\.?\d+/g) ?? [];
    return matches.map(pair =>
        pair
            .replace(',', ' ')
            .trim()
            .split(/\s+/)
            .map(Number)
    );
}

console.log(convertSVGPathToMatrixOfPoints('M11 111 L21 111 L21 101 L41 101 z M-10,-20 L0 0'));
// Output: [[11,111], [21,111], [21,101], [41,101], [-10,-20], [0,0]]