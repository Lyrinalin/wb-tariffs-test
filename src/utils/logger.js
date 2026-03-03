/**
 * Простой логгер с префиксами и timestamp
 */
const logger = {
    /**
     * @param {string} message
     * @param  {...any} args
     */
    info(message, ...args) {
        console.log(`[${new Date().toISOString()}] [INFO] ${message}`, ...args);
    },

    /**
     * @param {string} message
     * @param  {...any} args
     */
    error(message, ...args) {
        console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, ...args);
    },

    /**
     * @param {string} message
     * @param  {...any} args
     */
    warn(message, ...args) {
        console.warn(`[${new Date().toISOString()}] [WARN] ${message}`, ...args);
    },
};

module.exports = logger;
