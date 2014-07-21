var crypto = require('crypto');
var Busboy = require('busboy');
var QueuedStream = require('queued-stream');

var uploads = {};

function id(req, options) {
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  return md5([ip, options.chunks, options.name, options.filename, req.path].join());
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

exports.middleware = function(req, res, next) {
  var contentType = req.get('content-type');
  if (!contentType || !~contentType.indexOf('multipart/form-data')) return next();

  var attrs = {};
  var status;
  var timeout;

  var busboy = new Busboy({ headers: req.headers });
  busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
    attrs[fieldname] = val;
  });
  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    attrs.filename = filename;
    attrs.chunk = parseInt(attrs.chunk, 10);
    attrs.chunks = parseInt(attrs.chunks, 10);

    var uploadId = id(req, attrs);
    var upload = uploads[uploadId];

    if (!upload) {
      upload = uploads[uploadId] = {
        filename: attrs.name,
        totalChunks: attrs.chunks,
        nextChunk: 0, // chunk that can be added to the queue
        completedChunks: 0,
        completedOffset: 0
      };
    }

    if (upload.nextChunk !== attrs.chunk) {
      return next(new Error('out_of_order'));
    }

    // Increment next chunk
    upload.nextChunk = attrs.chunk + 1;

    function onReadEnd(readable) {
      if (file !== readable) return;
      if (timeout) clearTimeout(timeout);
      upload.completedChunks = attrs.chunk;
      upload.completedOffset += upload.stream.currentBytes;
      upload.stream.removeListener('readEnd', onReadEnd);
    }

    // Continue with existing stream
    if (upload.stream) {
      upload.stream.append(file).on('readEnd', onReadEnd);
      status = 201;
      return;
    }

    function onError() {
      upload.nextChunk = upload.completedChunks + 1;
      upload.stream = null;
    }

    file.on('data', function() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(onError, 2000);
    });

    // Start a new stream
    upload.stream = new QueuedStream();
    upload.stream
    .on('error', function() {
      if (timeout) clearTimeout(timeout);
      onError();
    })
    .on('end', function() {
      if (timeout) clearTimeout(timeout);
    })
    .on('readEnd', onReadEnd)
    .append(file);

    req.plupload = upload;
    next();
  });
  busboy.on('finish', function() {
    if (status) {
      res.send(status);
    }
  });
  req.pipe(busboy);
};
