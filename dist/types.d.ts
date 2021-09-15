import { TransformPluginContext } from 'rollup';
export declare type ExternalValue = string | string[];
export declare type Externals = Record<string, ExternalValue>;
export interface Options {
    disableSsr?: boolean;
    filter?: (this: TransformPluginContext, code: string, id: string, ssr?: boolean) => boolean;
    useWindow?: boolean;
}
