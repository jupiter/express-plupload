var path = require('path');
var fs = require('fs');
var express = require('express');
var app = express();
var pluploadMiddleware = require('../index.js').middleware;

app.use('/upload', pluploadMiddleware);
app.use('/upload', function(req, res, next){
  var writePath = path.join('/tmp', req.plupload.filename);
  var writeStream = fs.createWriteStream(writePath);

  req.plupload.stream.pipe(writeStream);
  res.send(201);
});

app.use(express.static(__dirname + '/public'));
app.listen(3000);
