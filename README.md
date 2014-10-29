express-plupload
================

Middleware for Express to accept 'chunked' uploads from PLUpload (http://www.plupload.com), output as a single readStream.

Note: this will only work where incoming requests for different PLUpload chunks will always hit the same server. State of an upload is stored in memory.

## To install

`npm install express-plupload`*

## How to use

From **examples/app.js**:

```
app.use('/upload', require('express-plupload').middleware);
app.use('/upload', function(req, res, next){
  // If the upload already has a writeStream
  if (!req.plupload.isNew) {
    req.once('end', function(){ res.send(201); });
    return;
  }

  // Create a new, single writeStream for the new/resuming upload
  var writePath = path.join('/tmp', req.plupload.filename);
  var writeStream = fs.createWriteStream(writePath, {
    start: req.plupload.completedOffset
  });

  req.plupload.stream.pipe(writeStream);
  req.once('end', function(){ res.send(201); });
});
```
