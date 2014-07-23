var fs = require('fs');
var crypto = require('crypto');
var stream = require('stream');
var createDigestStream = require('digest-stream');

exports.fromFile = function(path, start, end, cb) {
  var fileOptions = {
    start: start || 0
  };

  if (end) {
    fileOptions.end = end;
  }

  var digest;
  var length;
  var digestStream = createDigestStream('md5', 'hex', function(currentDigest, currentlength){
    digest = currentDigest;
    length = currentlength;
  });

  var writeStream = new stream.Writable();
  writeStream._write = function(chunk, encoding, next){
    next();
  };

  fs.createReadStream(path, fileOptions)
  .pipe(digestStream)
  .pipe(writeStream)
  .on('finish', function(){
    cb(null, digest, length);
  });
};

exports.fromString = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};


