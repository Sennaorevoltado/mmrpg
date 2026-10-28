/**
 * Geometria das áreas de efeito para Regiões do Foundry (v14), sem dependência do Foundry.
 *
 * Convenção: direção em graus, 0 = leste e crescendo no sentido horário (como no canvas).
 * Todas as medidas de entrada e saída estão em pixels.
 */

const toRad = (deg) => (deg * Math.PI) / 180;
const round = (n) => Math.round(n * 100) / 100;

/** Abertura do cone, em graus. */
export const CONE_SPREAD = 90;

/** Segmentos usados para aproximar o arco do cone. */
const CONE_STEPS = 16;

/**
 * Dados de forma de uma Região para a área de uma ação.
 *
 * @param {object} p
 * @param {"circle"|"cone"|"ray"|"rect"} p.shape
 * @param {number} p.x            Origem (centro do token), em pixels.
 * @param {number} p.y
 * @param {number} p.length       Raio, comprimento ou lado, em pixels.
 * @param {number} [p.direction=0]
 * @param {number} [p.cell=100]   Largura da linha (uma casa da grade), em pixels.
 * @returns {object}
 */
export function regionShapeData({ shape, x, y, length, direction = 0, cell = 100 }) {
  switch (shape) {
    case "cone": {
      const spread = toRad(CONE_SPREAD);
      const start = toRad(direction) - spread / 2;
      const points = [x, y];
      for (let i = 0; i <= CONE_STEPS; i++) {
        const a = start + (i / CONE_STEPS) * spread;
        points.push(x + Math.cos(a) * length, y + Math.sin(a) * length);
      }
      return { type: "polygon", points: points.map(round) };
    }
    case "ray": {
      const a = toRad(direction);
      const half = cell / 2;
      const px = Math.cos(a + Math.PI / 2) * half;
      const py = Math.sin(a + Math.PI / 2) * half;
      const ex = x + Math.cos(a) * length;
      const ey = y + Math.sin(a) * length;
      return { type: "polygon", points: [x + px, y + py, ex + px, ey + py, ex - px, ey - py, x - px, y - py].map(round) };
    }
    case "rect":
      return { type: "rectangle", x: round(x - length / 2), y: round(y - length / 2), width: round(length), height: round(length), rotation: 0 };
    case "circle":
    default:
      return { type: "circle", x: round(x), y: round(y), radius: round(length) };
  }
}

/**
 * Converte unidades da cena em pixels.
 * @param {number} units
 * @param {{ size: number, distance: number }} dimensions   canvas.dimensions
 * @returns {number}
 */
export function unitsToPixels(units, dimensions) {
  const perCell = Number(dimensions?.distance) || 1;
  const cellPx = Number(dimensions?.size) || 100;
  return (Number(units) || 0) * (cellPx / perCell);
}
