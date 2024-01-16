import inquirer from 'inquirer';
import chalk from 'chalk';

/* funciones y utilidades */
/**
 * Devuelve una promesa que resuelve con el resultado de un proceso ejecutandose
 * al terminar este (evento exit)
 * @param {ChildProcess} child 
 * @returns {Promise<any>}
 */
const promiseFromChildProcess = function promiseFromChildProcess(child) {
    return new Promise((resolve, reject) => {
        child.addListener("exit", resolve);
    });
};

/**
 * Realiza un prompt de **inquirerjs**, solo es un wrapper para mantener la API compatible a la version antigua del codigo
 * @param {string} query Texto a preguntar (mostrar)
 * @param {string} defa Valor por defecto tras el prompt
 * @param {function} validar función para validar si la entrada es correcta
 * @param  {boolean} desatendido indica si esta corriendo de manera que no pregunte y devuelva solo el valor default
 * @returns {string} valor escrito
 */
const prompt = async function prompt(query, defa, validar = undefined, desatendido = global.desatendido) {
    if (!desatendido) {
        return (await inquirer.prompt([
            {
                type: 'input',
                message: query,
                name: 'valor',
                validate: validar || undefined,
                default: defa
            }])).valor
    } else {
        console.log(chalk.gray(query) + ': ' + chalk.cyanBright(defa));
        return defa;
    }
};

/**
 * Version de prompt que siempre pregunta una respuesta afirmativa o negativa
 * @param {string} query Pregunta a realizar
 * @param {boolean} defa Valor predeterminado 
 * @param {boolean} desatendido indica si esta corriendo de manera que no pregunte y devuelva solo el valor default
 */
const promptSiNo = async function promptSiNo(query, defa, desatendido = global.desatendido) {
    if (!desatendido) {
        let v = await prompt(
            query + chalk.cyan(` (S${chalk.gray`[${chalk.underline`i`}]`}/N${chalk.gray`[${chalk.underline`o`}]`})`),
            defa ? 'S' : 'N',
            (valor) => /^(si?|no?)$/ig.test((valor || '').trim()) ||
                'Escriba un valor valido' + chalk.cyan(` (S${chalk.gray`[${chalk.underline`i`}]`}/N${chalk.gray`[${chalk.underline`o`}]`})`), 
            desatendido);
        v = (v === "" ? (defa ? "S" : "N") : v);
        return (v.toLowerCase().substr(0, 1) === "s");
    } else {
        console.log(chalk.gray(query) + ': ' + chalk.cyanBright(defa ? "S" : "N"));
        return defa;
    }
};

/**
 * realiza un prompt para passwords o algo oculto (que no haga echo) Tambien utiliza **Inquirerjs**
 * @param {string} query pregunta a realizar
 * @param {string} defa Valor predeterminado (para desatendido) 
 * @param {function} validar funcion para validar
 * @param {boolean} desatendido indica si esta corriendo de manera que no pregunte y devuelva solo el valor default
 * @returns {string} texto ingresado
 */
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
        console.log(chalk.gray('Reutilizando valor para ' + query));
        return defa;
    }
};

export { promiseFromChildProcess, prompt, promptHidden, promptSiNo };
