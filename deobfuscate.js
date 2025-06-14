import fs from 'fs';
import * as babel from '@babel/core';
import { normalizeLiterals } from './transformers/normalizeLiterals.js';
import { controlFlowUnflattener } from './transformers/controlFlowUnflattener.js';
import { inlineArrayBuilder } from './transformers/inlineArrayBuilder.js';
import { inlineWrapperFunctions } from './transformers/inlineProxiedFunctions.js';
import { solveStringArray } from './transformers/solveStringArray.js';
import { solveStateMachine } from './transformers/solveStateMachine.js';
import { inlineStringArray } from './transformers/inlineStringArray.js';

try {
    let intermediateCode;
    // normalize literals and unflatten cf
    const inputCode = fs.readFileSync('input.txt', 'utf-8');
    console.log("--- Starting Pass 1: Normalizing Literals and Unflattening Control Flow ---");
    const unflattenedResult = babel.transformSync(inputCode, {
        sourceType: "script",
        plugins: [normalizeLiterals, controlFlowUnflattener],
        code: true
    });

    if (!unflattenedResult || !unflattenedResult.code) {
        throw new Error("Pass 1 (Normalizing and unflattening) failed to produce code.");
    }
    intermediateCode = unflattenedResult.code;
    fs.writeFileSync('output.js', intermediateCode, 'utf-8');
    console.log("Pass 1 complete.");

    // inline data
    console.log("--- Starting Pass 2: Inlining Arrays and Wrapper Funcs ---")
    const inlinedDataResult = babel.transformSync(intermediateCode, {
        sourceType: "script",
        plugins: [inlineArrayBuilder, inlineWrapperFunctions],
        code: true
    });

    if (!inlinedDataResult || !inlinedDataResult.code) {
        throw new Error("Pass 2 (Inlining Arbitrary Data) failed to produce code.");
    }
    intermediateCode = inlinedDataResult.code;
    fs.writeFileSync('output.js', intermediateCode, 'utf-8');
    console.log("Pass 2 complete.")

    // solve string array and state machine
    console.log("--- Starting Pass 3: Solving String Array and Solving State Machine ---")
    const transformStringArray = babel.transformSync(intermediateCode, {
        sourceType: "script",
        plugins: [solveStringArray, solveStateMachine],
        code: true
    });

    if (!transformStringArray || !transformStringArray.code) {
        throw new Error("Pass 3 (Solving String Array & State Machine) failed to produce code.");
    }
    intermediateCode = transformStringArray.code;
    fs.writeFileSync('output.js', intermediateCode, 'utf-8');
    console.log("Pass 3 complete.")


    // solve string array and state machine
    console.log("--- Starting Pass 4: Inlining String Array ---")
    const inlineStringArr = babel.transformSync(intermediateCode, {
        sourceType: "script",
        plugins: [inlineStringArray],
        code: true
    });

    if (!inlineStringArr || !inlineStringArr.code) {
        throw new Error("Pass 4 (Inlining String Array) failed to produce code.");
    }
    intermediateCode = inlineStringArr.code;
    fs.writeFileSync('output.js', intermediateCode, 'utf-8');
    console.log("Pass 4 complete.")
} catch (err) {
    console.error("\nAn error occurred during deobfuscation:", err);
}