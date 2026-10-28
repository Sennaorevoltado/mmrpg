/**
 * Dado Marvel (denominação "m", fórmula "1dm").
 *
 * É um d6 cuja face 1 aparece como "M", conta como 6 na soma e é um resultado Fantástico.
 * O total é calculado a partir dos resultados ativos (sem depender de super.total), para que
 * re-rolagens por Edge/Trouble que marcam resultados como descartados funcionem direto.
 */

import { MARVEL_FACE, countedValue } from "../rules/d616.mjs";

export default class MarvelDie extends foundry.dice.terms.Die {
  static DENOMINATION = "m";

  constructor(termData = {}) {
    super({ ...termData, faces: 6 });
  }

  /** @inheritdoc */
  get total() {
    if (!this._evaluated) return undefined;
    return this.results.reduce((sum, r) => {
      if (r.active === false || r.discarded) return sum;
      return sum + countedValue("marvel", r.result);
    }, 0);
  }

  /** @inheritdoc */
  getResultLabel(result) {
    return result.result === MARVEL_FACE ? "M" : String(result.result);
  }

  /** @inheritdoc */
  getResultCSS(result) {
    const css = ["die", "d6", "marvel-die"];
    if (result.result === MARVEL_FACE) css.push("fantastic");
    else if (result.result === 6) css.push("max");
    if (result.discarded || result.active === false) css.push("discarded");
    return css;
  }
}
