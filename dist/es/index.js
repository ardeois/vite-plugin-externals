var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import MagicString from 'magic-string';
import { init, parse } from 'es-module-lexer';
import { Parser } from 'acorn';
import { isObject } from './utils';
import { ensureFile, writeFile, ensureDir, emptyDirSync } from 'fs-extra';
import path from 'path';
const ID_FILTER_REG = /\.(mjs|js|ts|vue|jsx|tsx)(\?.*|)$/;
const NODE_MODULES_FLAG = 'node_modules';
const CACHE_DIR = '.vite-plugin-externals';
export function viteExternalsPlugin(externals = {}, userOptions = {}) {
    var _a;
    let isBuild = false;
    const externalsKeys = Object.keys(externals);
    const isExternalEmpty = externalsKeys.length === 0;
    const cachePath = path.join(process.cwd(), NODE_MODULES_FLAG, CACHE_DIR);
    const transformModuleName = ((useWindow) => {
        return (externalValue) => {
            if (useWindow === false) {
                return typeof externalValue === 'string' ? externalValue : externalValue.join('.');
            }
            if (typeof externalValue === 'string') {
                return `window['${externalValue}']`;
            }
            const vals = externalValue.map((val) => `['${val}']`).join('');
            return `window${vals}`;
        };
    })((_a = userOptions.useWindow) !== null && _a !== void 0 ? _a : true);
    return {
        name: 'vite-plugin-externals',
        async config(config, { mode, command }) {
            var e_1, _a;
            var _b, _c, _d;
            isBuild = command === 'build';
            if (mode !== 'development') {
                return;
            }
            if (isExternalEmpty) {
                return;
            }
            const newAlias = [];
            const alias = (_c = (_b = config.resolve) === null || _b === void 0 ? void 0 : _b.alias) !== null && _c !== void 0 ? _c : {};
            if (isObject(alias)) {
                Object.keys(alias).forEach((aliasKey) => {
                    newAlias.push({ find: aliasKey, replacement: alias[aliasKey] });
                });
            }
            else if (Array.isArray(alias)) {
                newAlias.push(...alias);
            }
            await ensureDir(cachePath);
            await emptyDirSync(cachePath);
            try {
                for (var externalsKeys_1 = __asyncValues(externalsKeys), externalsKeys_1_1; externalsKeys_1_1 = await externalsKeys_1.next(), !externalsKeys_1_1.done;) {
                    const externalKey = externalsKeys_1_1.value;
                    const externalCachePath = path.join(cachePath, `${externalKey}.js`);
                    newAlias.push({ find: new RegExp(`^${externalKey}$`), replacement: externalCachePath });
                    await ensureFile(externalCachePath);
                    await writeFile(externalCachePath, `module.exports = ${transformModuleName(externals[externalKey])};`);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (externalsKeys_1_1 && !externalsKeys_1_1.done && (_a = externalsKeys_1.return)) await _a.call(externalsKeys_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            config.resolve = Object.assign(Object.assign({}, ((_d = config.resolve) !== null && _d !== void 0 ? _d : {})), { alias: newAlias });
            return config;
        },
        async transform(code, id, options) {
            const ssr = compatSsrInOptions(options);
            if (!isNeedExternal.call(this, userOptions, code, id, isBuild, ssr)) {
                return;
            }
            if (isBuild && id.includes(NODE_MODULES_FLAG)) {
                code = replaceRequires(code, externals, transformModuleName);
            }
            await init;
            const [imports] = parse(code);
            let s;
            imports.forEach(({ d: dynamic, n: dependence, ss: statementStart, se: statementEnd, }) => {
                var _a;
                if (dynamic !== -1) {
                    return;
                }
                if (!dependence) {
                    return;
                }
                const externalValue = externals[dependence];
                if (!externalValue) {
                    return;
                }
                s = s || (s = new MagicString(code));
                const raw = code.substring(statementStart, statementEnd);
                const ast = Parser.parse(raw, {
                    ecmaVersion: 'latest',
                    sourceType: 'module',
                });
                const specifiers = (_a = ast.body[0]) === null || _a === void 0 ? void 0 : _a.specifiers;
                if (!specifiers) {
                    return;
                }
                const newImportStr = replaceImports(specifiers, externalValue, transformModuleName);
                s.overwrite(statementStart, statementEnd, newImportStr);
            });
            if (!s) {
                return { code, map: null };
            }
            return {
                code: s.toString(),
                map: s.generateMap({
                    source: id,
                    includeContent: true,
                    hires: true,
                }),
            };
        },
    };
}
function replaceRequires(code, externals, transformModuleName) {
    return Object.keys(externals).reduce((code, externalKey) => {
        const r = new RegExp(`require\\((["'\`])\\s*${externalKey}\\s*(\\1)\\)`, 'g');
        return code.replace(r, transformModuleName(externals[externalKey]));
    }, code);
}
function replaceImports(specifiers, externalValue, transformModuleName) {
    return specifiers.reduce((s, specifier) => {
        const { local } = specifier;
        if (specifier.type === 'ImportDefaultSpecifier') {
            s += `const ${local.name} = ${transformModuleName(externalValue)}\n`;
        }
        else if (specifier.type === 'ImportSpecifier') {
            const { imported } = specifier;
            s += `const ${local.name} = ${transformModuleName(externalValue)}.${imported.name}\n`;
        }
        else if (specifier.type === 'ImportNamespaceSpecifier') {
            s += `const ${local.name} = ${transformModuleName(externalValue)}\n`;
        }
        else if (specifier.type === 'ExportSpecifier') {
            const { exported } = specifier;
            const value = `${transformModuleName(externalValue)}${local.name !== 'default' ? `.${local.name}` : ''}`;
            if (exported.name === 'default') {
                s += `export default ${value}\n`;
            }
            else {
                s += `export const ${exported.name} = ${value}\n`;
            }
        }
        return s;
    }, '');
}
function isNeedExternal(options, code, id, isBuild, ssr) {
    const { disableSsr = true, filter, } = options;
    if (disableSsr && ssr) {
        return false;
    }
    if (typeof filter === 'function') {
        if (!filter.call(this, code, id, ssr)) {
            return false;
        }
    }
    else {
        if (!ID_FILTER_REG.test(id) ||
            (id.includes(NODE_MODULES_FLAG) && !isBuild)) {
            return false;
        }
    }
    return true;
}
function compatSsrInOptions(options) {
    var _a;
    if (typeof options === 'boolean') {
        return options;
    }
    return (_a = options === null || options === void 0 ? void 0 : options.ssr) !== null && _a !== void 0 ? _a : false;
}
