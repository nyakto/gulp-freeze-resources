var crypto = require('crypto');

module.exports = function (str) {
    var sha1 = crypto.createHash('sha1');
    sha1.update(str);
    var base64 = sha1.digest('base64');
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
        .replace(/^[+-]+/g, '');
};
