import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EVENT_HOLD_MS, buildMilestones, connectorPose, entryDistance, eventDistance,
  nextExitAngle, orbitDirection, orbitPose, railPose, smoothMotion,
} from '../src/knowledge/timeline-motion.ts';

const dataset = JSON.parse(await readFile(new URL('../public/corpus/timeline.json', import.meta.url), 'utf8'));
const milestones = buildMilestones(dataset.events);
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 0.001, message + ': ' + a + ' ≠ ' + b);

test('milestones remain chronological and traceable to actual PDF references', () => {
  assert.ok(milestones.length >= 15);
  assert.deepEqual([...new Set(milestones.map((item) => item.year))], milestones.map((item) => item.year));
  assert.deepEqual([...milestones.map((item) => item.year)].sort((a, b) => a - b), milestones.map((item) => item.year));
  assert.equal(milestones[0].year, 1891);
  assert.equal(milestones.at(-1).year, 1956);
  assert.match(milestones.find((item) => item.year === 1932).title, /Poona Pact/i);
  const knownIds = new Set(dataset.events.map((event) => event.id));
  for (const item of milestones) {
    assert.ok(knownIds.has(item.id));
    assert.equal(item.event.year, item.year);
    assert.ok(item.event.sourceReferences.some((source) => source.documentId && source.pageNumber > 0 && source.pdfUrl));
  }
});

test('connected rails meet the alternating orbital tracks without a positional jump', () => {
  for (let index = 0; index < milestones.length - 1; index++) {
    const exit = orbitPose(index, 0);
    const connectorStart = connectorPose(index, 0);
    const connectorEnd = connectorPose(index, 1);
    const entry = orbitPose(index + 1, Math.PI);
    near(exit.x, connectorStart.x, 'exit x');
    near(exit.y, connectorStart.y, 'exit y');
    near(entry.x, connectorEnd.x, 'entry x');
    near(entry.y, connectorEnd.y, 'entry y');
    near(entry.x, railPose(entryDistance(index + 1), milestones.length).x, 'distance entry x');
    near(exit.x, railPose(eventDistance(index), milestones.length).x, 'distance exit x');
  }
});

test('orbits exit on the rail and motion has fixed reading time', () => {
  assert.equal(EVENT_HOLD_MS, 10000);
  near(smoothMotion(0), 0, 'ease start');
  near(smoothMotion(1), 1, 'ease end');
  for (let index = 0; index < milestones.length; index++) {
    const direction = orbitDirection(index);
    const angle = Math.PI + direction * Math.PI * 3;
    near(orbitPose(index, angle).x, orbitPose(index, 0).x, 'orbital exit x');
    near(orbitPose(index, angle).y, orbitPose(index, 0).y, 'orbital exit y');
    const interrupted = Math.PI + direction * 1.17;
    const exitAngle = nextExitAngle(interrupted, direction);
    near(orbitPose(index, exitAngle).x, orbitPose(index, 0).x, 'interrupted exit x');
    near(orbitPose(index, exitAngle).y, orbitPose(index, 0).y, 'interrupted exit y');
  }
});
