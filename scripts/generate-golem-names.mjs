#!/usr/bin/env node
// Generates 4,444 unique pronounceable Golem names for human review before
// import into the character_registry table (see GOLEMIANS_ARENA_SETUP.md).
// Does NOT touch Supabase — writes golemians-characters.json/.csv to the
// repo root for the user to review and, if approved, import manually.
//
// Assumes token IDs 0..4443 (0-indexed). Confirm this matches the real
// Golemians contract's numbering before importing — if the contract is
// 1-indexed instead, shift token_id by one before import.
//
// Run: node scripts/generate-golem-names.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOTAL_NAMES = 4444;
const MIN_LEN = 4;
const MAX_LEN = 10;

const CONSONANTS = [
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z',
  'br', 'cr', 'dr', 'fr', 'gr', 'kr', 'pr', 'tr', 'st', 'sk', 'sh', 'th', 'gl', 'kl',
];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ae', 'io', 'ou'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCandidate() {
  const syllableCount = 2 + Math.floor(Math.random() * 2); // 2-3 syllables
  let name = '';
  for (let i = 0; i < syllableCount; i++) {
    name += randomItem(CONSONANTS) + randomItem(VOWELS);
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function generateNames(count) {
  const names = new Set();
  let attempts = 0;
  const maxAttempts = count * 200;

  while (names.size < count && attempts < maxAttempts) {
    attempts++;
    const candidate = generateCandidate();
    if (candidate.length < MIN_LEN || candidate.length > MAX_LEN) continue;
    names.add(candidate);
  }

  if (names.size < count) {
    throw new Error(`Only generated ${names.size}/${count} unique names after ${attempts} attempts`);
  }
  return [...names];
}

const names = generateNames(TOTAL_NAMES).sort();

const outDir = path.join(__dirname, '..');
const jsonPath = path.join(outDir, 'golemians-characters.json');
const csvPath = path.join(outDir, 'golemians-characters.csv');

const rows = names.map((name, i) => ({ token_id: i, character_name: name }));

fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));

const csvLines = ['token_id,character_name', ...rows.map((r) => `${r.token_id},${r.character_name}`)];
fs.writeFileSync(csvPath, csvLines.join('\n'));

console.log(`Generated ${names.length} unique names.`);
console.log(`Written to:\n  ${jsonPath}\n  ${csvPath}`);
console.log('Review before importing into character_registry — this script does not touch Supabase.');
console.log('Confirm token_id numbering (0-indexed here) matches the real contract before import.');
