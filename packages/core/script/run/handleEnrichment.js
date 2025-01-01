"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEnrichment = void 0;
exports.removeProperties = removeProperties;
const dntShim = __importStar(require("../_dnt.shims.js"));
const generative_ai_1 = require("@google/generative-ai");
const zod_to_json_schema_1 = require("zod-to-json-schema");
const apiKey = dntShim.Deno.env.get('GEMINI_API_KEY');
if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
}
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash'
});
const handleEnrichment = async ({ prompt, content, responseSchema: zodResponseSchema }) => {
    const responseSchema = (0, zod_to_json_schema_1.zodToJsonSchema)(zodResponseSchema, {
        target: 'openApi3'
    });
    console.log('RESPONSE SCHEMA', responseSchema);
    console.log('PROMPT', prompt);
    console.log('CONTENT', content);
    const chatSession = model.startChat({
        generationConfig: {
            temperature: 1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: removeProperties(responseSchema, 'additionalProperties')
        }
    });
    const result = await chatSession.sendMessage(`${prompt}\n\n${content}`);
    return result.response.text();
};
exports.handleEnrichment = handleEnrichment;
// deno-lint-ignore no-explicit-any
function removeProperties(obj, propertyName) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    const result = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
        if (key === propertyName) {
            continue;
        }
        const value = obj[key];
        if (typeof value === 'object' && value !== null) {
            // deno-lint-ignore ban-ts-comment
            // @ts-ignore
            result[key] = removeProperties(value, propertyName);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
