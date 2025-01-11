import { z } from '@hono/zod-openapi';
export declare const stringFormat: z.ZodEnum<["date-time", "time", "date", "duration", "email", "hostname", "ipv4", "ipv6", "uuid", "uri", "regex", "password", "byte", "binary"]>;
export declare const oasStringData: z.ZodType<OasStringData>;
export type StringFormat = 'date-time' | 'time' | 'date' | 'duration' | 'email' | 'hostname' | 'ipv4' | 'ipv6' | 'uuid' | 'uri' | 'regex' | 'password' | 'byte' | 'binary';
export type OasStringData = {
    title?: string;
    description?: string;
    default?: string;
    type: 'string';
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    enum?: string[];
    format?: string;
    nullable?: boolean;
    example?: string;
};
//# sourceMappingURL=string-types.d.ts.map