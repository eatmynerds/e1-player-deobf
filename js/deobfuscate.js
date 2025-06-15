import fs from "node:fs";
import axios from "axios";
import * as babel from "@babel/core";

import * as parser from "@babel/parser";
import traverseMod from "@babel/traverse";
import generatorMod from "@babel/generator";
const traverse = traverseMod.default;
const generate = generatorMod.default;

import { normalizeLiterals }       from "./transformers/normalizeLiterals.js";
import { controlFlowUnflattener }  from "./transformers/controlFlowUnflattener.js";
import { inlineArrayBuilder }      from "./transformers/inlineArrayBuilder.js";
import { inlineWrapperFunctions }  from "./transformers/inlineProxiedFunctions.js";
import { solveStringArray }        from "./transformers/solveStringArray.js";
import { solveStateMachine }       from "./transformers/solveStateMachine.js";
import { inlineStringArray }       from "./transformers/inlineStringArray.js";

async function deobfuscate(srcCode) {
  const run = (code, plugins, label) => {
    const res = babel.transformSync(code, { sourceType: "script", plugins, code: true });
    if (!res?.code) throw new Error(`${label} produced no code`);
    return res.code;
  };

  console.log("── Pass 1: normalize literals + unflatten control‑flow");
  let code = run(srcCode, [normalizeLiterals, controlFlowUnflattener], "Pass 1");

  console.log("── Pass 2: inline arrays + wrapper functions");
  code = run(code, [inlineArrayBuilder, inlineWrapperFunctions], "Pass 2");

  console.log("── Pass 3: solve string array + state machine");
  code = run(code, [solveStringArray, solveStateMachine], "Pass 3");

  console.log("── Pass 4: inline string array");
  code = run(code, [inlineStringArray], "Pass 4");

  return code;
}

const isHexString = (s) => {
  if (typeof s !== "string" || !s.length) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const digit = c >= 48 && c <= 57;       // 0‑9
    const lower = c >= 97 && c <= 102;      // a‑f
    const upper = c >= 65 && c <= 70;       // A‑F
    if (!(digit || lower || upper)) return false;
  }
  return true;
};
const isTargetStringArray = (arr) =>
  arr.elements.length >= 20 &&
  arr.elements.every((el) => el && el.type === "StringLiteral" && isHexString(el.value));

const isMatchingNumberArray = (arr, len) =>
  arr.elements.length === len &&
  arr.elements.every(
    (el) => el && el.type === "NumericLiteral" && Number.isInteger(el.value) && el.value >= 0,
  );

(async function main() {
  try {
    const { data: rawCode } = await axios.get(
      "https://cloudvidz.net/js/player/m/v2/pro/embed-1.min.js",
    );

    const finalCode = await deobfuscate(rawCode);

    const ast = parser.parse(finalCode, {
      sourceType: "script",
      allowReturnOutsideFunction: true,
      plugins: ["numericSeparator", "bigInt", "objectRestSpread", "classProperties"],
    });

    const arrays = [];
    traverse(ast, {
      VariableDeclarator(p) {
        if (p.node.init?.type === "ArrayExpression") {
          arrays.push({ idNode: p.node.id, arrayNode: p.node.init, loc: p.node.loc });
        }
      },
      AssignmentExpression(p) {
        if (p.node.right.type === "ArrayExpression") {
          arrays.push({ idNode: p.node.left, arrayNode: p.node.right, loc: p.node.loc });
        }
      },
    });

    let found = false;
    for (let i = 0; i < arrays.length - 1; i++) {
      const first = arrays[i];
      const second = arrays[i + 1];

      if (
        isTargetStringArray(first.arrayNode) &&
        isMatchingNumberArray(second.arrayNode, first.arrayNode.elements.length)
      ) {
        found = true;
        const strings = first.arrayNode.elements.map((e) => e.value);
        const map     = second.arrayNode.elements.map((e) => e.value);
        const decoded = map.map((n) => strings[n]).join("");

        console.log("\n══════════════════════════════════════════════════════════════");
        console.log(`🎯  Pair found near line ${first.loc?.start?.line ?? "?"}`);
        console.log("▪︎", generate(first.idNode).code,  "=", generate(first.arrayNode ).code);
        console.log("▪︎", generate(second.idNode).code, "=", generate(second.arrayNode).code);
        console.log("→  Decoded string:", decoded);
        console.log("══════════════════════════════════════════════════════════════\n");
        fs.writeFileSync("key.txt", decoded);
        console.log("Wrote key to key.txt");
        break; // stop at first match
      }
    }

    if (!found) console.log("⚠️  No matching hex‑string / map pair found.");
  } catch (err) {
    console.error("\n❌  Error during de‑obfuscation / decoding:\n", err);
  }
})();
