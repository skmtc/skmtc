import "../_dnt.polyfills.js";
import { type Method } from './Method.js';
import { z } from 'zod';
export declare const enrichedSetting: z.ZodObject<{
    selected: z.ZodBoolean;
    enrichments: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    selected: boolean;
    enrichments?: unknown;
}, {
    selected: boolean;
    enrichments?: unknown;
}>;
export type EnrichedSetting = {
    selected: boolean;
    enrichments?: unknown;
};
export declare const operationsGeneratorSettings: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    operations: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodType<Method, z.ZodTypeDef, Method>, z.ZodObject<{
        selected: z.ZodBoolean;
        enrichments: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        selected: boolean;
        enrichments?: unknown;
    }, {
        selected: boolean;
        enrichments?: unknown;
    }>>>;
}, "strip", z.ZodTypeAny, {
    operations: Record<string, Partial<Record<Method, {
        selected: boolean;
        enrichments?: unknown;
    }>>>;
    id: string;
    description?: string | undefined;
}, {
    operations: Record<string, Partial<Record<Method, {
        selected: boolean;
        enrichments?: unknown;
    }>>>;
    id: string;
    description?: string | undefined;
}>;
export type OperationsGeneratorSettings = {
    id: string;
    description?: string;
    operations: Record<string, Partial<Record<Method, EnrichedSetting>>>;
};
export declare const modelsGeneratorSettings: z.ZodObject<{
    id: z.ZodString;
    exportPath: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    models: z.ZodRecord<z.ZodString, z.ZodObject<{
        selected: z.ZodBoolean;
        enrichments: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        selected: boolean;
        enrichments?: unknown;
    }, {
        selected: boolean;
        enrichments?: unknown;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    models: Record<string, {
        selected: boolean;
        enrichments?: unknown;
    }>;
    description?: string | undefined;
    exportPath?: string | undefined;
}, {
    id: string;
    models: Record<string, {
        selected: boolean;
        enrichments?: unknown;
    }>;
    description?: string | undefined;
    exportPath?: string | undefined;
}>;
export type ModelsGeneratorSettings = {
    id: string;
    exportPath?: string;
    description?: string;
    models: Record<string, EnrichedSetting>;
};
export declare const clientGeneratorSettings: z.ZodUnion<[z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    operations: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodType<Method, z.ZodTypeDef, Method>, z.ZodObject<{
        selected: z.ZodBoolean;
        enrichments: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        selected: boolean;
        enrichments?: unknown;
    }, {
        selected: boolean;
        enrichments?: unknown;
    }>>>;
}, "strip", z.ZodTypeAny, {
    operations: Record<string, Partial<Record<Method, {
        selected: boolean;
        enrichments?: unknown;
    }>>>;
    id: string;
    description?: string | undefined;
}, {
    operations: Record<string, Partial<Record<Method, {
        selected: boolean;
        enrichments?: unknown;
    }>>>;
    id: string;
    description?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    exportPath: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    models: z.ZodRecord<z.ZodString, z.ZodObject<{
        selected: z.ZodBoolean;
        enrichments: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        selected: boolean;
        enrichments?: unknown;
    }, {
        selected: boolean;
        enrichments?: unknown;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    models: Record<string, {
        selected: boolean;
        enrichments?: unknown;
    }>;
    description?: string | undefined;
    exportPath?: string | undefined;
}, {
    id: string;
    models: Record<string, {
        selected: boolean;
        enrichments?: unknown;
    }>;
    description?: string | undefined;
    exportPath?: string | undefined;
}>]>;
export type ClientGeneratorSettings = OperationsGeneratorSettings | ModelsGeneratorSettings;
export declare const modulePackage: z.ZodObject<{
    rootPath: z.ZodString;
    moduleName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    rootPath: string;
    moduleName: string;
}, {
    rootPath: string;
    moduleName: string;
}>;
export type ModulePackage = {
    rootPath: string;
    moduleName: string;
};
export declare const clientSettings: z.ZodObject<{
    basePath: z.ZodOptional<z.ZodString>;
    packages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        rootPath: z.ZodString;
        moduleName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rootPath: string;
        moduleName: string;
    }, {
        rootPath: string;
        moduleName: string;
    }>, "many">>;
    generators: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        id: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        operations: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodType<Method, z.ZodTypeDef, Method>, z.ZodObject<{
            selected: z.ZodBoolean;
            enrichments: z.ZodOptional<z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            selected: boolean;
            enrichments?: unknown;
        }, {
            selected: boolean;
            enrichments?: unknown;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        operations: Record<string, Partial<Record<Method, {
            selected: boolean;
            enrichments?: unknown;
        }>>>;
        id: string;
        description?: string | undefined;
    }, {
        operations: Record<string, Partial<Record<Method, {
            selected: boolean;
            enrichments?: unknown;
        }>>>;
        id: string;
        description?: string | undefined;
    }>, z.ZodObject<{
        id: z.ZodString;
        exportPath: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        models: z.ZodRecord<z.ZodString, z.ZodObject<{
            selected: z.ZodBoolean;
            enrichments: z.ZodOptional<z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            selected: boolean;
            enrichments?: unknown;
        }, {
            selected: boolean;
            enrichments?: unknown;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        models: Record<string, {
            selected: boolean;
            enrichments?: unknown;
        }>;
        description?: string | undefined;
        exportPath?: string | undefined;
    }, {
        id: string;
        models: Record<string, {
            selected: boolean;
            enrichments?: unknown;
        }>;
        description?: string | undefined;
        exportPath?: string | undefined;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    generators: ({
        operations: Record<string, Partial<Record<Method, {
            selected: boolean;
            enrichments?: unknown;
        }>>>;
        id: string;
        description?: string | undefined;
    } | {
        id: string;
        models: Record<string, {
            selected: boolean;
            enrichments?: unknown;
        }>;
        description?: string | undefined;
        exportPath?: string | undefined;
    })[];
    basePath?: string | undefined;
    packages?: {
        rootPath: string;
        moduleName: string;
    }[] | undefined;
}, {
    generators: ({
        operations: Record<string, Partial<Record<Method, {
            selected: boolean;
            enrichments?: unknown;
        }>>>;
        id: string;
        description?: string | undefined;
    } | {
        id: string;
        models: Record<string, {
            selected: boolean;
            enrichments?: unknown;
        }>;
        description?: string | undefined;
        exportPath?: string | undefined;
    })[];
    basePath?: string | undefined;
    packages?: {
        rootPath: string;
        moduleName: string;
    }[] | undefined;
}>;
export type ClientSettings = {
    basePath?: string;
    packages?: ModulePackage[];
    generators: ClientGeneratorSettings[];
};
export type SkmtcClientConfig = {
    serverName?: string;
    stackName?: string;
    deploymentId?: string;
    settings: ClientSettings;
};
export declare const skmtcClientConfig: z.ZodObject<{
    serverName: z.ZodOptional<z.ZodString>;
    stackName: z.ZodOptional<z.ZodString>;
    deploymentId: z.ZodOptional<z.ZodString>;
    settings: z.ZodObject<{
        basePath: z.ZodOptional<z.ZodString>;
        packages: z.ZodOptional<z.ZodArray<z.ZodObject<{
            rootPath: z.ZodString;
            moduleName: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            rootPath: string;
            moduleName: string;
        }, {
            rootPath: string;
            moduleName: string;
        }>, "many">>;
        generators: z.ZodArray<z.ZodUnion<[z.ZodObject<{
            id: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            operations: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodType<Method, z.ZodTypeDef, Method>, z.ZodObject<{
                selected: z.ZodBoolean;
                enrichments: z.ZodOptional<z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                selected: boolean;
                enrichments?: unknown;
            }, {
                selected: boolean;
                enrichments?: unknown;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            operations: Record<string, Partial<Record<Method, {
                selected: boolean;
                enrichments?: unknown;
            }>>>;
            id: string;
            description?: string | undefined;
        }, {
            operations: Record<string, Partial<Record<Method, {
                selected: boolean;
                enrichments?: unknown;
            }>>>;
            id: string;
            description?: string | undefined;
        }>, z.ZodObject<{
            id: z.ZodString;
            exportPath: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            models: z.ZodRecord<z.ZodString, z.ZodObject<{
                selected: z.ZodBoolean;
                enrichments: z.ZodOptional<z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                selected: boolean;
                enrichments?: unknown;
            }, {
                selected: boolean;
                enrichments?: unknown;
            }>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            models: Record<string, {
                selected: boolean;
                enrichments?: unknown;
            }>;
            description?: string | undefined;
            exportPath?: string | undefined;
        }, {
            id: string;
            models: Record<string, {
                selected: boolean;
                enrichments?: unknown;
            }>;
            description?: string | undefined;
            exportPath?: string | undefined;
        }>]>, "many">;
    }, "strip", z.ZodTypeAny, {
        generators: ({
            operations: Record<string, Partial<Record<Method, {
                selected: boolean;
                enrichments?: unknown;
            }>>>;
            id: string;
            description?: string | undefined;
        } | {
            id: string;
            models: Record<string, {
                selected: boolean;
                enrichments?: unknown;
            }>;
            description?: string | undefined;
            exportPath?: string | undefined;
        })[];
        basePath?: string | undefined;
        packages?: {
            rootPath: string;
            moduleName: string;
        }[] | undefined;
    }, {
        generators: ({
            operations: Record<string, Partial<Record<Method, {
                selected: boolean;
                enrichments?: unknown;
            }>>>;
            id: string;
            description?: string | undefined;
        } | {
            id: string;
            models: Record<string, {
                selected: boolean;
                enrichments?: unknown;
            }>;
            description?: string | undefined;
            exportPath?: string | undefined;
        })[];
        basePath?: string | undefined;
        packages?: {
            rootPath: string;
            moduleName: string;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    settings: {
        generators: ({
            operations: Record<string, Partial<Record<Method, {
                selected: boolean;
                enrichments?: unknown;
            }>>>;
            id: string;
            description?: string | undefined;
        } | {
            id: string;
            models: Record<string, {
                selected: boolean;
                enrichments?: unknown;
            }>;
            description?: string | undefined;
            exportPath?: string | undefined;
        })[];
        basePath?: string | undefined;
        packages?: {
            rootPath: string;
            moduleName: string;
        }[] | undefined;
    };
    deploymentId?: string | undefined;
    serverName?: string | undefined;
    stackName?: string | undefined;
}, {
    settings: {
        generators: ({
            operations: Record<string, Partial<Record<Method, {
                selected: boolean;
                enrichments?: unknown;
            }>>>;
            id: string;
            description?: string | undefined;
        } | {
            id: string;
            models: Record<string, {
                selected: boolean;
                enrichments?: unknown;
            }>;
            description?: string | undefined;
            exportPath?: string | undefined;
        })[];
        basePath?: string | undefined;
        packages?: {
            rootPath: string;
            moduleName: string;
        }[] | undefined;
    };
    deploymentId?: string | undefined;
    serverName?: string | undefined;
    stackName?: string | undefined;
}>;
export declare const skmtcStackConfig: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    generators: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    generators: string[];
    name?: string | undefined;
    version?: string | undefined;
}, {
    generators: string[];
    name?: string | undefined;
    version?: string | undefined;
}>;
export type SkmtcStackConfig = {
    name?: string;
    version?: string;
    generators: string[];
};
//# sourceMappingURL=Settings.d.ts.map