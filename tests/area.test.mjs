import test from "node:test";
import assert from "node:assert/strict";
import { regionShapeData, unitsToPixels, CONE_SPREAD } from "../module/helpers/area-shapes.mjs";

test("converte unidades da cena em pixels", () => {
  assert.equal(unitsToPixels(20, { size: 100, distance: 5 }), 400);
  assert.equal(unitsToPixels(3, { size: 70, distance: 1 }), 210);
  assert.equal(unitsToPixels(5, undefined), 500);
});

test("círculo e retângulo ficam centrados na origem", () => {
  assert.deepEqual(regionShapeData({ shape: "circle", x: 300, y: 200, length: 150 }), { type: "circle", x: 300, y: 200, radius: 150 });
  const rect = regionShapeData({ shape: "rect", x: 300, y: 200, length: 100 });
  assert.equal(rect.type, "rectangle");
  assert.equal(rect.x, 250);
  assert.equal(rect.y, 150);
  assert.equal(rect.width, 100);
  assert.equal(rect.height, 100);
});

test("cone parte da origem e abre na direção pedida", () => {
  const cone = regionShapeData({ shape: "cone", x: 0, y: 0, length: 100, direction: 0 });
  assert.equal(cone.type, "polygon");
  assert.deepEqual(cone.points.slice(0, 2), [0, 0]);
  const pts = [];
  for (let i = 2; i < cone.points.length; i += 2) pts.push([cone.points[i], cone.points[i + 1]]);
  for (const [px, py] of pts) {
    assert.ok(Math.abs(Math.hypot(px, py) - 100) < 0.05, "todos os pontos do arco a 100 px");
    assert.ok(px > 0, "aponta para leste");
  }
  const angles = pts.map(([px, py]) => (Math.atan2(py, px) * 180) / Math.PI);
  assert.ok(Math.abs(Math.max(...angles) - Math.min(...angles) - CONE_SPREAD) < 0.1, "abertura do cone");
});

test("linha tem comprimento e largura de uma casa", () => {
  const ray = regionShapeData({ shape: "ray", x: 0, y: 0, length: 300, direction: 0, cell: 100 });
  const xs = ray.points.filter((_, i) => i % 2 === 0);
  const ys = ray.points.filter((_, i) => i % 2 === 1);
  assert.equal(Math.max(...xs) - Math.min(...xs), 300);
  assert.equal(Math.max(...ys) - Math.min(...ys), 100);
});
