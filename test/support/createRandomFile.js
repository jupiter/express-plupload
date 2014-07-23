var fs = require('fs');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var path = require('path');

module.exports = function(filePath, size, options) {
  mkdirp.sync(path.dirname(filePath));
  fs.writeFileSync(filePath, crypto.randomBytes(size));

  if (options && options.duplicate) {
    var buf = fs.readFileSync(filePath);
    fs.writeFileSync(options.duplicate, buf, options);
  }
};
