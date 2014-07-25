var crypto = require('crypto');
var fs = require('fs');
var assert = require('assert');
var async = require('async');
var request = require('request');
var createRandomFile = require('./support/createRandomFile');
var md5 = require('./support/md5');
var form = require('./support/form');
// var app = require('../examples/app'); // For now, you have to have this running separately

function uploadChunked(filePath, n) {
  var req = request({
    method: 'post',
    url: '/upload'
  });

  form(req.form(), filePath, n);
  return req;
}

function delayedFn(ms, fn) {
  return function(){
    var args = arguments;
    setTimeout(function(){
      fn.apply(null, args);
    }, ms);
  };
}

describe('when example app', function() {
  describe('receiving chunked pluploads', function() {
    beforeEach(function(done) {
      var self = this;

      var fileName = crypto.randomBytes(20).toString('hex') + '.ext';

      self.uploadedFilePath = '/tmp/' + fileName;
      self.filePath = '/tmp/uploading/' + fileName;

      createRandomFile(self.filePath, 1200 * 1024);

      self.chunkOptions = form.chunkOptions(self.filePath);

      md5.fromFile(this.filePath, null, null, function(err, digest, length){
        self.expectedDigest = digest;
        self.expectedLength = length
        done();
      });
    });

    afterEach(function(){
      var self = this;

      fs.unlinkSync(self.filePath);
      fs.unlinkSync(self.uploadedFilePath);
    });

    it('will save a single file', function(done){
      var self = this;

      async.eachSeries(self.chunkOptions, function(chunkOptions, next){
        var r = request({
          method: 'post',
          url: 'http://localhost:3000/upload',
          // proxy: 'http://localhost:5389'
        }, next);
        form.append(r.form(), chunkOptions);
      }, delayedFn(100, function(err){
        if (err) return done(err);

        assert.ok(fs.statSync(self.uploadedFilePath));

        md5.fromFile(self.uploadedFilePath, null, null, function(err, digest, length){
          if (err) return done(err);
          assert.equal(length, self.expectedLength);
          assert.equal(digest, self.expectedDigest);
          done();
        });
      }));
    });

    it('will error for out-of-order chunks, but allow correction', function(done){
      var self = this;

      var chunkOptions = [
        self.chunkOptions[0],
        self.chunkOptions[2],
        self.chunkOptions[1],
        self.chunkOptions[2],
      ];

      var statusCodes = [];

      async.eachSeries(chunkOptions, function(chunkOptions, next){
        var r = request({
          method: 'post',
          url: 'http://localhost:3000/upload',
          // proxy: 'http://localhost:5389'
        }, function(err, res, body){
          if (err) return next(err);

          statusCodes.push(res.statusCode);
          next();
        });
        form.append(r.form(), chunkOptions);
      }, delayedFn(100, function(err){
        if (err) return done(err);

        assert.deepEqual(statusCodes, [201, 500, 201, 201]);
        assert.ok(fs.statSync(self.uploadedFilePath));
        md5.fromFile(self.uploadedFilePath, null, null, function(err, digest, length){
          if (err) return done(err);
          assert.equal(length, self.expectedLength);
          assert.equal(digest, self.expectedDigest);
          done();
        });
      }));
    });

    it('can be restarted', function(done){
      var self = this;

      var chunkOptions = [
        self.chunkOptions[0],
        self.chunkOptions[1],
        self.chunkOptions[0],
        self.chunkOptions[1],
        self.chunkOptions[2],
      ];

      var statusCodes = [];

      async.eachSeries(chunkOptions, function(chunkOptions, next){
        var r = request({
          method: 'post',
          url: 'http://localhost:3000/upload',
          // proxy: 'http://localhost:5389'
        }, function(err, res, body){
          if (err) return next(err);

          statusCodes.push(res.statusCode);
          next();
        });
        form.append(r.form(), chunkOptions);
      }, delayedFn(100, function(err){
        if (err) return done(err);

        assert.deepEqual(statusCodes, [201, 201, 201, 201, 201]);
        assert.ok(fs.statSync(self.uploadedFilePath));
        md5.fromFile(self.uploadedFilePath, null, null, function(err, digest, length){
          if (err) return done(err);
          assert.equal(length, self.expectedLength);
          assert.equal(digest, self.expectedDigest);
          done();
        });
      }));
    });

    it('will queue parallel uploads', function(done){
      var self = this;

      var statusCodes = [];

      async.each(self.chunkOptions, function(chunkOptions, next){
        var r = request({
          method: 'post',
          url: 'http://localhost:3000/upload',
          // proxy: 'http://localhost:5389'
        }, next);
        form.append(r.form(), chunkOptions);
      }, delayedFn(100, function(err){
        if (err) return done(err);

        assert.ok(fs.statSync(self.uploadedFilePath));
        md5.fromFile(self.uploadedFilePath, null, null, function(err, digest, length){
          if (err) return done(err);
          assert.equal(length, self.expectedLength);
          assert.equal(digest, self.expectedDigest);
          done();
        });
      }));
    });
  });
});
