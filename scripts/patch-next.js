#!/usr/bin/env node
/**
 * Patch Next.js for Node 22 compatibility
 *
 * Issue: Next.js's config loading doesn't properly pass generateBuildId in Node 22
 * Fix: Check if generate is a function before calling it
 */

const fs = require('fs');
const path = require('path');

const generateBuildIdPath = path.join(
  __dirname,
  '../node_modules/next/dist/build/generate-build-id.js'
);

if (!fs.existsSync(generateBuildIdPath)) {
  console.log('Next.js not installed yet, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(generateBuildIdPath, 'utf8');

// Check if already patched
if (content.includes('typeof generate === \'function\'')) {
  console.log('Next.js already patched for Node 22 compatibility');
  process.exit(0);
}

// Apply patch
const original = 'let buildId = await generate();';
const patched = `// Handle case where generate is not a function (Node 22 compatibility)
    let buildId = typeof generate === 'function' ? await generate() : null;`;

if (!content.includes(original)) {
  console.log('Could not find patch target in generate-build-id.js');
  process.exit(1);
}

content = content.replace(original, patched);
fs.writeFileSync(generateBuildIdPath, content);

console.log('✓ Patched Next.js for Node 22 compatibility');
