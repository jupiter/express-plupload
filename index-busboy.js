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
    // console.log(attrs.filename, attrs.chunk, attrs.chunks, 'begin');
    if (attrs.chunk === 0) {
      if (upload && upload.stream) {
        upload.stream.destroy();
      }
      upload = uploads[uploadId] = {
        filename: attrs.name,
        totalChunks: attrs.chunks,
        nextChunk: 0, // chunk that can be added to the queue
        completedChunks: 0,
        completedOffset: 0
      };
    } else if (!upload || attrs.chunk !== upload.nextChunk) {
      return next(new Error('expecting chunk ' + (upload && upload.nextChunk || 0) + ' got ' + attrs.chunk));
    }

    // Increment next chunk
    upload.nextChunk = attrs.chunk + 1;

    file.on('unpipe', function(readable) {
      if (timeout) clearTimeout(timeout);
      upload.completedChunks = attrs.chunk;
      upload.completedOffset += upload.stream.currentBytes;
    });

    // Continue with existing stream
    if (upload.stream) {
      upload.stream.append(file);

      if (upload.nextChunk === upload.totalChunks) {
        upload.stream.append(null);
      }
      status = 201;
      return;// cb();
    }

    function cleanUp() {
      if (!uploads[uploadId] || upload.stream) return;
      delete(uploads[uploadId]);
    }

    function onError() {
      if (!upload) return;
      upload.nextChunk = upload.completedChunks + 1;
      upload.stream = null;
      timeout = setTimeout(cleanUp, 30000);
    }

    // Start a new stream
    upload.stream = new QueuedStream();
    upload.stream
    .on('data', function() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(onError, 3000);
    })
    .on('error', function(err) {
      if (timeout) clearTimeout(timeout);
      onError();
    })
    .on('end', function() {
      if (timeout) clearTimeout(timeout);
      cleanUp();
    })
    .append(file);

    if (upload.nextChunk === upload.totalChunks) {
      upload.stream.append(null);
    }

    req.plupload = upload;
    next();
  });
  busboy.on('finish', function() {
    // console.log(attrs.filename, attrs.chunk, attrs.chunks, 'finish');
    if (status) {
      res.send(status);
    }
  });
  req.pipe(busboy);
};