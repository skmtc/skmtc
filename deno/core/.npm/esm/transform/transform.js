import * as dntShim from "../_dnt.shims.js";
import { CoreContext } from '../context/CoreContext.js';
export const transform = ({ traceId, spanId, schema, settings, prettier, generatorsMap, logsPath, startAt }) => {
    const context = new CoreContext({ spanId, logsPath });
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
