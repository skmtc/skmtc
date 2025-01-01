import * as dntShim from "../_dnt.shims.js";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
const apiKey = dntShim.Deno.env.get('GEMINI_API_KEY');
if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash'
});
export const handleEnrichment = async ({ prompt, content, responseSchema: zodResponseSchema }) => {
    const responseSchema = zodToJsonSchema(zodResponseSchema, {
        target: 'openApi3'
    });
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
// deno-lint-ignore no-explicit-any
export function removeProperties(obj, propertyName) {
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
