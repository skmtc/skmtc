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
exports.transform = void 0;
const dntShim = __importStar(require("../_dnt.shims.js"));
const CoreContext_js_1 = require("../context/CoreContext.js");
const transform = ({ traceId, spanId, schema, settings, prettier, generatorsMap, logsPath, startAt }) => {
    const context = new CoreContext_js_1.CoreContext({ spanId, logsPath });
    const { artifacts, files, previews, pinnable, results } = context.transform({
        settings,
        generatorsMap,
        prettier,
        schema
    });
    const manifest = {
        files,
        previews,
        pinnable,
        traceId,
        spanId,
        results,
        deploymentId: dntShim.Deno.env.get('DENO_DEPLOYMENT_ID') ?? Date.now().toString(),
        region: dntShim.Deno.env.get('DENO_REGION'),
        startAt,
        endAt: Date.now()
    };
    return { artifacts, manifest };
};
exports.transform = transform;
