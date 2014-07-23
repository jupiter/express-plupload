var fs = require('fs');
var path = require('path');

exports.chunkOptions = function(filePath, chunkSize) {
  chunkSize = chunkSize || 500 * 1024; // 500kB
  var stat = fs.statSync(filePath);
  var fileName = path.basename(filePath);

  var chunks = Math.ceil(stat.size / chunkSize);
  var options = [];
  for (var i = 0; i < chunks; i++) {
    options.push({
      chunk: i,
      chunks: chunks,
      fileName: fileName,
      filePath: filePath,
      start: i * chunkSize,
      end: (i + 1) * chunkSize - 1
    });
  }
  return options;
};

exports.append = function(form, options) {
  form.append('name', options.fileName);
  form.append('chunk', options.chunk);
  form.append('chunks', options.chunks);
  form.append('blob', fs.createReadStream(options.filePath, {
    start: options.start,
    end: options.end
  }).on('end', function(){
    // console.log('finish readstream', options.fileName);
  }));
};
