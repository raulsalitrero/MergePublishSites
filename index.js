/*+ jshint nodejs,es6 */
"use strict";
const util = require('util');
const rimraf = util.promisify(require("rimraf"));
const {
    exec
} = require("child_process");
let sitios = require("./sitios.json");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
let args = yargs(hideBin(process.argv));
const inquirer = require('inquirer');
const pLimit = require('promise-limit');
const fs = require('fs-extra');
const { promiseFromChildProcess, promptHidden, promptSiNo } = require('./funciones');
const chalk = require('chalk');

/* poner reglas de uso */
args = args.usage("node index.js [opciones]").locale("es").option('?', {
    alias: 'h'
}).alias('?', 'ayuda').option('d', {
    alias: 'desatendido',
    demand: false,
    type: 'boolean',
    describe: 'Indica si no realiza preguntas (usa sitios.json)'
}).option('u', {
    alias: 'ultima',
    demand: false,
    type: 'boolean',
    describe: 'Repite la ultima compilacion (usa ultconfig.json, implica -d)'
}).help('?');
args.showHelp();
args = args.argv;
if (args.h) {
    return;
}

/* obtener datos de la ultima ejecucion si es necesaria
 y la mezcla con el arreglo de sitios
 para determinar la lista a compilar */

const repite = args.u;
const desatendido = args.d || repite;
global.desatendido = desatendido;
if (repite) {
    let ultimos = sitios;
    try {
        ultimos = require("./ultconfig.json");
        ultimos.sitios = ultimos.sitios.map(ult => {
            let actual = sitios.sitios.find(act => act.clave === ult.clave) || ult;
            let merged = { ...actual, compilar: ult.compilar };
            return merged;
        });
    } catch (e) {
        console.error(e);
        ultimos = sitios;
    }
    sitios = ultimos;
}

/* correr todo en una funcioin async para usar await */
(async () => {

    /* limpiar remanentes anteriores */
    const limpias = sitios.sitios.map(async x => {

        console.log(chalk.gray`limpiando ${chalk.white(x.folder)}`);
        try {
            await rimraf(`built\\${x.folder}`);
            console.log(chalk.gray`  -> listo: ${chalk.white(x.folder)}`);
        }
        catch (ex) {
            console.error(chalk.red`  -> Error Limpiando: ${chalk.bgGreenBright(x.folder)} ${chalk.bold.red(ex.message ?? ex)}`);
        }
        return x.folder;
    });
    await Promise.all(limpias);
    console.log(`limpiando sitios.7z`);
    await rimraf("sitios.7z");

    /* preguntar variables y sitios a compilar */
    sitios.vars.comprimir = await promptSiNo("Comprimir?", sitios.vars.comprimir ?? true);
    sitios.vars.borrarwc = await promptSiNo("Borrar Web.config?", sitios.vars.borrarwc ?? true);
    sitios.vars.obtener = await promptSiNo("Obtener Sources?", sitios.vars.obtener ?? true);
    if (!desatendido) {
        let resp = await inquirer.prompt([
            {
                type: 'checkbox',
                message: 'Sitios a Compilar',
                name: 'compilar',
                choices: sitios.sitios.
                    sort((a, b) => a.clave.localeCompare(b.clave)).
                    map(s => ({
                        name: s.clave,
                        checked: s.compilar
                    })),
                pageSize: 20
            },
        ]);
        sitios.sitios.filter(s => {
            return resp.compilar.includes(s.clave);
        }).forEach(s => s.compilar = true);
    } else {
        console.log(chalk.gray('Compilando: '), chalk.cyanBright(sitios.sitios.map(s => s.compilar ? s.clave : undefined).filter(Boolean).join(', ')));
    }
    /* pedir password para el 7zip */
    if (sitios.vars.comprimir) {
        let pw = await promptHidden("Contraseña deseada (vacio para ninguna)", sitios.vars.pw7 || "");
        let pw2 = await promptHidden("Repetir Contraseña deseada (vacio para ninguna)", sitios.vars.pw7 || "");
        if (pw !== pw2) {
            console.log("los Passwords no coinciden, se dejara vacio");
            sitios.vars.pw7 = "";
        } else {
            sitios.vars.pw7 = pw;
        }
    } else {
        sitios.vars.pw7 = sitios.vars.pw7 || "";
    }
    /* grabar seleccion en clon de sitios.json ultconfig.json */
    try {
        await fs.outputJSON('ultconfig.json', sitios);
        console.log("listo grabando ultconfig.json");
    }
    catch (ex) {
        console.error(`Error grabando ultconfig.json: ${ex.message}`);
    }

    /* lista json de sitios publicados para el publisher.exe */
    const publicados = sitios.sitios.filter(s => s.compilar).map(s => s.folder + (s.keyVersion ?
        ':' + s.keyVersion : ''));
    try {
        await fs.outputJSON('publicados.json', publicados);
        console.log("listo grabando publicados.json");
    } catch (ex) {
        console.error(`Error grabando publicados.json: ${inspection.reason()}`);
    }

    /* get sources svn*/
    let promesasSVN = [];
    if (sitios.vars.obtener) {
        promesasSVN = sitios.sitios.map(x => {
            if (x.compilar) {
                const child = exec(`svn checkout ${x.repo} svn\\${x.folder}`);
                child.stdout.on('data', data => {
                    process.stdout.write(`stdout de ${x.clave}: ${data}`);
                });
                child.stderr.on('data', data => {
                    process.stderr.write(`error de ${x.clave}: ${data}`);
                });
                child.on('close', code => {
                    console.log(`cerrando svn ${x.clave}: ${code}`);
                });
                return promiseFromChildProcess(child);
            } else {
                return null;
            }
        });
    }
    await Promise.all(promesasSVN);
    console.log("obtencion de sources completa");

    /* compilar limitado a 4 procesos en paralelo */
    let promesasCompilar = [];
    const parallel = 4;
    let limit = pLimit(parallel);
    promesasCompilar = sitios.sitios.map(async x => {
        return limit(() => {
            if (x.compilar) {
                let child;
                let net;
                net = x.versionNet === 4 ? sitios.vars.net4 : sitios.vars.net2;
                if (x.es64bit) {
                    net = net.replace("Microsoft.NET\\Framework\\", "Microsoft.NET\\Framework64\\")
                }
                child = exec(
                    `${net}\\aspnet_compiler.exe -v /${x.folder} -p svn\\${x.folder} -f built\\${x.folder}${x.xclude
                        ? (typeof (x.xclude) === "string" ?
                            " -x " + x.xclude :
                            x.xclude.map(xi => " -x " + xi).join(" "))
                        : ""}`
                );
                child.stdout.on('data', data => {
                    process.stdout.write(`stdout de ${x.clave}: ${data}`);
                });
                child.stderr.on('data', data => {
                    process.stderr.write(`error de ${x.clave}: ${data}`);
                });
                child.on('close', code => {
                    console.log(
                        `cerrando aspnet_compiler de ${x.clave}: ${code}`
                    );
                });
                return promiseFromChildProcess(child);
            } else {
                return null;
            }
        });
    });
    await Promise.all(promesasCompilar);
    console.log("Compilacion completa");

    //limpiar basura y pdbs
    console.log("limpiando datos basura");
    const promesasLimpiaCopia = [
        rimraf("built/**/*.pdb"),
        rimraf("built/**/*.inc"),
        rimraf("built/**/*.log"),
        rimraf("built/**/*.psd")];
    if (sitios.vars.borrarwc) {
        promesasLimpiaCopia.push(rimraf("built/**/web.config"));
    }
    promesasLimpiaCopia.push(...sitios.sitios.map(x => {
        if (x.compilar && x.postcopy) {
            if (typeof x.postcopy === "string") {
                return fs.copy(`svn\\${x.folder}\\${x.postcopy}`,
                    `built\\${x.folder}\\${x.postcopy}`, {
                    preserveTimestamps: true
                });
            } else {
                return x.postcopy.map(xc => fs.copy(
                    `svn\\${x.folder}\\${xc}`,
                    `built\\${x.folder}\\${xc}`, {
                    preserveTimestamps: true
                }));
            }
        } else {
            return null;
        }
    }));
    await Promise.all(promesasLimpiaCopia);

    //comprimir con 7z
    if (sitios.vars.comprimir) {
        console.log("Comprimiendo Archivos. puede tomar algun tiempo...");
        let pass = sitios.vars.pw7;
        pass = (pass || (`${pass}`).trim() !== "") ? (`${pass}`).trim() : false;
        const child = exec(
            `"${sitios.vars.z7}" a sitios.7z -mx=3 -y -ms=100m built publicados.json thePublisher.exe thePublisher.exe.config thePublisher.pdb .\\*.dll ${(pass !== false)
                ? " -p"
                : ""}`
        );
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
        if (pass !== false) {
            child.stdin.write(`${pass}\n`);
        }
        child.on('close', code => {
            console.log(`cerrando 7z: ${code}`);
        });
        await promiseFromChildProcess(child);
    }
})();