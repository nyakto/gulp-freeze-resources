var fs = require('fs');

module.exports = function (hashFn) {
    return function (fileName) {
        return hashFn(fs.readFileSync(fileName));
    };
};
