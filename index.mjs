/*+ jshint nodejs,es6 */
'use strict';
import util from 'util';
import rimrafModule from 'rimraf';
const rimraf = util.promisify(rimrafModule);
import { exec } from 'child_process';

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
let args = yargs(hideBin(process.argv));
import inquirer from 'inquirer';
import pLimit from 'promise-limit';
import fs from 'fs-extra';
let datosSitios = await fs.readJSON('./sitios.json');
import { promiseFromChildProcess, promptHidden, promptSiNo } from './funciones.js';
import chalk from 'chalk';

/**
 * Niveles de registro de log
 * @readonly
 * @enum {Object}
 */
const LOG_LEVEL = {
    /** LOG_LEVEL.LOG nivel normal*/
    LOG: { f: console.log, p: 'Log: ' } /** LOG_LEVEL.WARN nivel de advertencia*/,
    WARN: { f: console.warn, p: 'Warning: ' } /** LOG_LEVEL.ERR nivel de errores*/,
    ERR: { f: console.error, p: 'Error: ' },
};
// fijar el nivel de log como Enumeración constante
Object.freeze(LOG_LEVEL);
const AnsiCodesRegex =
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
let ultLog = null;
/**
 * Escribe un texto a consola y a un archivo log
 * @param {string} log texto a escribir
 * @param {*} level
 * @returns
 */
const log_write = async (log, level = LOG_LEVEL.LOG) => {
    const out = LOG_LEVEL[level] ?? LOG_LEVEL.LOG;
    out.f.call(this, log);
    /* esperar la ultima escritura que termine */
    await ultLog;
    return (ultLog = fs.appendFile(
        `log_${new Date().toISOString().substring(0, 10)}.log`,
        out.p + new Date().toLocaleTimeString() + ' ' + log.replace(AnsiCodesRegex, '') + '\n'
    ));
};

/* poner instrucciones de uso del programa */
args = args
    .usage('node index.js [opciones]')
    .locale('es')
    .option('?', { alias: 'h' })
    .alias('?', 'ayuda')
    .option('d', {
        alias: 'desatendido',
        demand: false,
        type: 'boolean',
        describe: 'Indica si no realiza preguntas (usa sitios.json)',
    })
    .option('u', {
        alias: 'ultima',
        demand: false,
        type: 'boolean',
        describe: 'Repite la ultima compilacion (usa ultconfig.json, implica -d)',
    })
    .help('?');
args.showHelp();
args = args.argv;
if (args.h) {
    process.exit(0);
}

/* obtener datos de la ultima ejecucion si es necesaria
y la mezcla con el arreglo de sitios
para determinar la lista a compilar */

const repite = args.u;
const desatendido = args.d || repite;
global.desatendido = desatendido;
if (repite) {
    let ultimos = datosSitios;
    try {
        ultimos = await fs.readJSON('./ultconfig.json');
        ultimos.sitios = ultimos.sitios.map((ult) => {
            let actual = datosSitios.sitios.find((act) => act.clave === ult.clave) || ult;
            let merged = { ...actual, compilar: ult.compilar };
            return merged;
        });
    } catch (e) {
        log_write(e, LOG_LEVEL.ERR);
        ultimos = datosSitios;
    }
    datosSitios = ultimos;
}

/* limpiar remanentes anteriores */
const limpias = datosSitios.sitios.map(async (x) => {
    console.log(chalk.gray`limpiando ${chalk.white(x.folder)}`);
    try {
        await rimraf(`built\\${x.folder}`);
        console.log(chalk.gray`  -> listo: ${chalk.white(x.folder)}`);
    } catch (ex) {
        log_write(
            chalk.red`  -> Error Limpiando: ${chalk.bgGreenBright(x.folder)} ${chalk.bold.red(
                ex.message ?? ex
            )}`,
            LOG_LEVEL.ERR
        );
    }
    return x.folder;
});
await Promise.all(limpias);
console.log(`limpiando sitios.7z`);
await rimraf('sitios.7z');

/* preguntar variables y sitios a compilar */
datosSitios.vars.comprimir = await promptSiNo('Comprimir?', datosSitios.vars.comprimir ?? true);
datosSitios.vars.borrarwc = await promptSiNo(
    'Borrar Web.config?',
    datosSitios.vars.borrarwc ?? true
);
datosSitios.vars.obtener = await promptSiNo('Obtener Sources?', datosSitios.vars.obtener ?? true);
if (!desatendido) {
    let resp = await inquirer.prompt([
        {
            type: 'checkbox',
            message: 'Sitios a Compilar',
            name: 'compilar',
            choices: datosSitios.sitios
                .sort((a, b) => a.clave.localeCompare(b.clave))
                .map((s) => ({ name: s.clave, checked: s.compilar })),
            pageSize: 20,
        },
    ]);
    datosSitios.sitios
        .filter((s) => {
            return resp.compilar.includes(s.clave);
        })
        .forEach((s) => (s.compilar = true));
} else {
    console.log(
        chalk.gray('Compilando: '),
        chalk.cyanBright(
            datosSitios.sitios
                .map((s) => (s.compilar ? s.clave : undefined))
                .filter(Boolean)
                .join(', ')
        )
    );
}
/* pedir password para el 7zip */
if (datosSitios.vars.comprimir) {
    let pw = await promptHidden(
        'Contraseña deseada (vacio para ninguna)',
        datosSitios.vars.pw7 || ''
    );
    let pw2 = await promptHidden(
        'Repetir Contraseña deseada (vacio para ninguna)',
        datosSitios.vars.pw7 || ''
    );
    if (pw !== pw2) {
        console.log('los Passwords no coinciden, se dejara vacio');
        datosSitios.vars.pw7 = '';
    } else {
        datosSitios.vars.pw7 = pw;
    }
} else {
    datosSitios.vars.pw7 = datosSitios.vars.pw7 || '';
}

log_write('Comienza proceso');
/* grabar seleccion en clon de sitios.json ultconfig.json */
try {
    await fs.outputJSON('ultconfig.json', datosSitios);
    console.log('listo grabando ultconfig.json');
} catch (ex) {
    log_write(`Error grabando ultconfig.json: ${ex.message}`, LOG_LEVEL.ERR);
}

/* lista json de sitios publicados para el publisher.exe */
const publicados = datosSitios.sitios
    .filter((s) => s.compilar)
    .map((s) => s.folder + (s.keyVersion ? ':' + s.keyVersion : ''));
try {
    await fs.outputJSON('publicados.json', publicados);
    console.log('listo grabando publicados.json');
} catch (ex) {
    log_write(`Error grabando publicados.json: ${inspection.reason()}`, LOG_LEVEL.ERR);
}

/* get sources svn*/
let promesasSVN = [];
if (datosSitios.vars.obtener) {
    log_write('obteniendo sources');
    promesasSVN = datosSitios.sitios.map((x) => {
        if (x.compilar) {
            const child = exec(`svn checkout ${x.repo} svn\\${x.folder}`);
            child.stdout.on('data', (data) => {
                process.stdout.write(`stdout de ${x.clave}: ${data}`);
            });
            child.stderr.on('data', (data) => {
                process.stderr.write(`error de ${x.clave}: ${data}`);
            });
            child.on('close', (code) => {
                console.log(`cerrando svn ${x.clave}: ${code}`);
            });
            return promiseFromChildProcess(child);
        } else {
            return null;
        }
    });
}
await Promise.all(promesasSVN);
console.log('obtencion de sources completa');

/* compilar limitado a 4 procesos en paralelo */
let promesasCompilar = [];
const parallel = 4;
let limit = pLimit(parallel);
log_write('compilando');
promesasCompilar = datosSitios.sitios.map(async (x) => {
    return limit(() => {
        if (x.compilar) {
            if (!x.customBuild) {
                let child;
                let net;
                net = x.versionNet === 4 ? datosSitios.vars.net4 : datosSitios.vars.net2;
                if (x.es64bit) {
                    net = net.replace('Microsoft.NET\\Framework\\', 'Microsoft.NET\\Framework64\\');
                }
                child = exec(
                    `${net}\\aspnet_compiler.exe -v /${x.folder} -p svn\\${x.folder} -f built\\${
                        x.folder
                    }${
                        x.xclude
                            ? typeof x.xclude === 'string'
                                ? ' -x ' + x.xclude
                                : x.xclude.map((xi) => ' -x ' + xi).join(' ')
                            : ''
                    }`
                );
                child.stdout.on('data', (data) => {
                    process.stdout.write(`stdout de ${x.clave}: ${data}`);
                });
                child.stderr.on('data', (data) => {
                    process.stderr.write(`error de ${x.clave}: ${data}`);
                });
                child.on('close', (code) => {
                    console.log(`cerrando aspnet_compiler de ${x.clave}: ${code}`);
                });
                return promiseFromChildProcess(child);
            } else {
                let child;
                child = exec(x.customBuild);
                child.stdout.on('data', (data) => {
                    process.stdout.write(`stdout de ${x.clave}: ${data}`);
                });
                child.stderr.on('data', (data) => {
                    process.stderr.write(`error de ${x.clave}: ${data}`);
                });
                child.on('close', (code) => {
                    console.log(`cerrando Build Personalizado de ${x.clave}: ${code}`);
                });
                return promiseFromChildProcess(child);
            }
        }
        return null;
    });
});
await Promise.all(promesasCompilar);
log_write('Compilacion completa');

//limpiar basura y pdbs
log_write('limpiando datos basura');
const promesasLimpiaCopia = [
    rimraf('built/**/*.pdb'),
    rimraf('built/**/*.inc'),
    rimraf('built/**/*.log'),
    rimraf('built/**/*.psd'),
];
if (datosSitios.vars.borrarwc) {
    promesasLimpiaCopia.push(rimraf('built/**/web.config'));
}
promesasLimpiaCopia.push(
    ...datosSitios.sitios.map((x) => {
        if (x.compilar && x.postcopy) {
            if (typeof x.postcopy === 'string') {
                return fs.copy(
                    `svn\\${x.folder}\\${x.postcopy}`,
                    `built\\${x.folder}\\${x.postcopy}`,
                    { preserveTimestamps: true }
                );
            } else {
                return x.postcopy.map((xc) =>
                    fs.copy(`svn\\${x.folder}\\${xc}`, `built\\${x.folder}\\${xc}`, {
                        preserveTimestamps: true,
                    })
                );
            }
        } else {
            return null;
        }
    })
);
await Promise.all(promesasLimpiaCopia);

//comprimir con 7z
if (datosSitios.vars.comprimir) {
    log_write('Comprimiendo Archivos. puede tomar algun tiempo...');
    let pass = datosSitios.vars.pw7;
    pass = pass || `${pass}`.trim() !== '' ? `${pass}`.trim() : false;
    const child = exec(
        `"${
            datosSitios.vars.z7
        }" a sitios.7z -mx=3 -bsp1 -y -ms=100m built publicados.json thePublisher.exe thePublisher.exe.config thePublisher.pdb .\\*.dll ${
            pass !== false ? ' -p' : ''
        }`
    );
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    if (pass !== false) {
        child.stdin.write(`${pass}\n`);
    }
    child.on('close', (code) => {
        console.log(`cerrando 7z: ${code}`);
    });
    await promiseFromChildProcess(child);
}
log_write('termina proceso');
