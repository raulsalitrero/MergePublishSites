const inquirer = require('inquirer');
const chalk = require('chalk');

/* funciones y utilidades */
const promiseFromChildProcess = function promiseFromChildProcess(child) {
    return new Promise((resolve, reject) => {
        child.addListener("exit", resolve);
    });
};

const prompt = async function prompt(query, defa, validar = undefined, desatendido = global.desatendido) {
    if (!desatendido) {
        return (await inquirer.prompt([
            {
                type: 'input',
                message: query,
                name: 'valor',
                validate: validar || undefined
            }])).valor
    } else {
        console.log(chalk.gray(query) + ': ' + chalk.cyanBright(defa));
        return defa;
    }
};

const promptSiNo = async function promptSiNo(query, defa, desatendido = global.desatendido) {
    if (!desatendido) {
        let v = (await inquirer.prompt([
            {
                type: 'input',
                message: query + chalk.cyan(` (S${chalk.gray`[${chalk.underline`i`}]`}/N${chalk.gray`[${chalk.underline`o`}]`})`),
                name: 'valor',
                default: defa ? 'S' : 'N',
                validate: function (valor) {
                    return /^(si?|no?)$/ig.test((valor || '').trim()) ||
                        'Escriba un valor valido' + chalk.cyan(` (S${chalk.gray`[${chalk.underline`i`}]`}/N${chalk.gray`[${chalk.underline`o`}]`})`);
                }
            }])).valor;
        v = (v === "" ? (defa ? "S" : "N") : v);
        return (v.toLowerCase().substr(0, 1) === "s");
    } else {
        console.log(chalk.gray(query) + ': ' + chalk.cyanBright(defa ? "S" : "N"));
        return defa;
    }
};

const promptHidden = async function promptHidden(query, defa, validar = undefined, desatendido = global.desatendido) {
    if (!desatendido) {
        return (await inquirer.prompt([
            {
                type: 'password',
                message: query,
                name: 'valor',
                default: defa,
                validate: validar || undefined
            }])).valor;
    } else {
        console.log(chalk.gray('Reutilizando valor para '+ query));
        return defa;
    }
};

module.exports = { promiseFromChildProcess, prompt, promptHidden, promptSiNo };