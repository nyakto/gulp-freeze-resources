var es = require('event-stream'),
    fs = require('fs'),
    through = require('through2'),
    gutil = require('gulp-util'),
    fileHash = require('./lib/file-hash'),
    sha1Base64Hash = require('./lib/sha1-base64-hash'),
    path = require('path'),
    stringRe = "(?:(?:'[^'\\r\\n]*')|(?:\"[^\"\\r\\n]*\"))",
    urlRe = "(?:(?:\\burl\\(\\s*" + stringRe + "\\s*\\))|(?:\\burl\\(\\s*[^\\s\\r\\n'\"]*\\s*\\)))",
    srcRe = "(?:src\\s*=\\s*[^,)]+)",
    commentRe = '(?:/\\*[^*]*\\*+(?:[^/][^*]*\\*+)*/)',
    urlStringRe = new RegExp('^' + urlRe + '$'),
    srcStringRe = new RegExp('^' + srcRe + '$');

function isRelativeUrl(url) {
    return !/^(\w+:|\/)/.test(url);
}

function parseUrl(url) {
    if (url.lastIndexOf('url(', 0) === 0) {
        url = url.replace(/^url\(\s*/, '').replace(/\s*\)$/, '');
    }

    if (url.charAt(0) === '\'' || url.charAt(0) === '"') {
        url = url.substr(1, url.length - 2);
    }

    return url;
}

function parseSrc(src) {
    src = src.replace(/^src\s*=\s*/, '').replace(/\s*\)$/, '');

    if (src.charAt(0) === '\'' || src.charAt(0) === '"') {
        src = src.substr(1, src.length - 2);
    }

    return src;
}

function getRelativeFileName(baseFile, fileName) {
    var match;
    if ((match = /(.*?)[#?].*/.exec(fileName)) !== null) {
        fileName = match[1];
    }
    return path.resolve(path.dirname(baseFile), fileName);
}

function Freezer(options) {
    options = options || {};

    this.map = {};
    this.resourcesStream = through({
        objectMode: true
    });

    this.testFn = options.test || function (fileName) {
        return true;
    };

    this.hashFn = options.hash || fileHash(sha1Base64Hash);

    this.renameFn = options.rename || function (fileName, hash) {
        return hash + path.extname(fileName);
    };
}

Freezer.prototype.freeze = function () {
    var self = this;

    var stream = es.map(function (file, cb) {
        var buff = file.contents;

        if (file.isStream()) {
            buff = new Buffer();
            file.contents.on('data', function (data) {
                buff.write(data);
            });
            file.contents.on('end', function (data) {
                buff.write(data);
            });
        }

        var contents = new Buffer(
            self.processCSS(
                file,
                buff.toString()
            ),
            'utf-8'
        );

        return cb(null, new gutil.File({
            cwd: file.cwd,
            base: file.base,
            path: file.path,
            contents: contents
        }));
    });
    stream.on('end', function () {
        self.resourcesStream.end();
    });
    return stream;
};

Freezer.prototype.resources = function () {
    return this.resourcesStream;
};

Freezer.prototype.getGeneratedResourceName = function (fileName) {
    if (this.map.hasOwnProperty(fileName)) {
        return this.map[fileName];
    }
    return null;
};

Freezer.prototype.rename = function () {
    var self = this;
    return es.map(function (file, cb) {
        var generatedFileName = self.getGeneratedResourceName(file.path);
        if (generatedFileName === null) {
            return cb(null, file);
        }
        var filePath = path.resolve(file.cwd, generatedFileName);

        return cb(null, new gutil.File({
            cwd: file.cwd,
            base: file.cwd,
            path: filePath,
            contents: file.contents
        }));
    });
};

Freezer.prototype.processCSS = function (file, content) {
    var match;
    var result = [];
    var pos = 0;
    var allRe = new RegExp(commentRe + '|' + urlRe + '|' + srcRe, 'g');
    while ((match = allRe.exec(content)) !== null) {
        if (match[0].lastIndexOf('/*', 0) !== 0) {
            result.push(content.substr(pos, allRe.lastIndex - pos - match[0].length));
            pos = allRe.lastIndex;
            if (urlStringRe.test(match[0])) {
                var url = this.processResource(file, parseUrl(match[0]));
                result.push('url(' + url + ')');
            } else if (srcStringRe.test(match[0])) {
                var src = this.processResource(file, parseSrc(match[0]));
                result.push('src=' + src);
            } else {
                result.push(match[0]);
            }
        }
    }
    if (pos < content.length) {
        result.push(content.substr(pos));
    }
    return result.join('');
};

Freezer.prototype.processResource = function (file, url) {
    if (!isRelativeUrl(url)) {
        return url;
    }
    var fileName = getRelativeFileName(file.path, url);
    if (!this.testFn(fileName)) {
        return url;
    }
    var hash = this.hashFn(fileName);
    var newFileName = this.renameFn(fileName, hash);
    this.resourcesStream.write(new gutil.File({
        cwd: file.cwd,
        base: file.base,
        path: fileName,
        contents: new Buffer(fs.readFileSync(fileName))
    }));
    this.map[fileName] = newFileName;
    return newFileName;
};

module.exports = Freezer;
