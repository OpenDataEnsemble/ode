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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const compiler_1 = require("./compiler");
const fixturesDir = path.join(__dirname, '..', 'fixtures');
function expectedFragments(fixture, dialect) {
    return (fixture.expectedSqlFragmentsByDialect?.[dialect] ??
        fixture.expectedSqlFragments ??
        []);
}
function loadFixtures() {
    return fs
        .readdirSync(fixturesDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8')));
}
describe('ObservationQueryCompiler fixtures', () => {
    const fixtures = loadFixtures();
    it.each(fixtures.map((f) => [f.name, f]))('%s', (_name, fixture) => {
        const indexes = (fixture.indexKeys ?? []).map((key) => ({
            key,
            path: `$.${key}`,
        }));
        const indexKeys = (0, compiler_1.indexKeysFromConfig)(indexes);
        const dialect = fixture.jsonColumn === 'data' ? 'formulus' : 'desktop';
        const result = (0, compiler_1.compileObservationQuery)({
            dialect,
            jsonColumn: fixture.jsonColumn,
            indexKeys,
            formType: fixture.formType,
            includeDeleted: fixture.includeDeleted ?? false,
            filter: fixture.filter,
        });
        if (fixture.expectError) {
            expect('code' in result).toBe(true);
            if (fixture.expectedErrorCode && 'code' in result) {
                expect(result.code).toBe(fixture.expectedErrorCode);
            }
            return;
        }
        expect('sql' in result).toBe(true);
        if (!('sql' in result))
            return;
        for (const fragment of expectedFragments(fixture, dialect)) {
            expect(result.sql).toContain(fragment);
        }
        if (fixture.expectWarning) {
            expect(result.warnings.length).toBeGreaterThan(0);
        }
    });
});
