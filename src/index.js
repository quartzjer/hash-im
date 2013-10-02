var EventEmitter = require('events').EventEmitter,
    Line = require('./line'),
    telehash = require('telehash');

// Welcome to the core of IM via TeleHash.
var IM = module.exports = function() {
  this.connection = null;
  this.lines = {};
};

IM.prototype.__proto__ = EventEmitter.prototype;

// Provides convenient access to generating a TeleHash keypair.
IM.genkey = telehash.genkey;

// This one is handy too. It creates a new IM instance and immediately starts a connection.
IM.connect = function() {
  var instance = new IM();
  instance.connect.apply(instance, arguments);
  return instance;
};

IM.prototype.connect = function(id, seeds, callback) {
  var connection;

  connection = telehash.hashname(id);
  seeds.forEach(connection.addSeed);

  // HAX. The id should be passed to the constructor, connect should accept seeds and callback.
  this.id = id;
  this.hashname = connection.hashname;

  connection.listen('im', this.didReceiveLine.bind(this));
  connection.online(callback);

  this.connection = connection;
};

IM.prototype.sendMessage = function(recipient, message) {
  var line = this.lines[recipient];

  if (!line) {
    line = this.openLine(recipient);
  }

  return line.send(message);
};

IM.prototype.openLine = function(recipient) {
  var stream, line;

  // FIXME: There are cases where the stream's handler is called immediately with an error.
  //        For now, use a dummy handler to throw these.
  stream = this.connection.stream(recipient, 'im', function(error) {
    throw(error);
  });

  line = new Line(this).connect(stream);
  line.on('message', this.didReceiveMessage.bind(this));

  this.lines[recipient] = line;
  return line;
};

IM.prototype.didReceiveMessage = function(message) {
  this.emit('message', message);
};

IM.prototype.didReceiveLine = function(error, stream, js) {
  var line = this.lines[stream.hashname];

  if (typeof line !== 'undefined') {
    throw('A line for hashname ' + stream.hashname + ' already exists.');
  }

  line = new Line(this).accept(error, stream, js);
  line.on('message', this.didReceiveMessage.bind(this));
  this.lines[stream.hashname] = line;
};

IM.prototype.getNickname = function() {
  return this.id.nick;
};
