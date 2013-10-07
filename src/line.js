var EventEmitter = require('events').EventEmitter;

var Line = module.exports = function(im) {
  this.im = im;
  this.nickname = null; // The buddy's nickname.
  this.stream = null; // Current stream used by this line.
  this.connected = false; // Whether a connection is currently established.
  this.outbox = [];
  this.outboxCounter = 0;
};

Line.prototype.__proto__ = EventEmitter.prototype;

// Accept a incoming line. This interface is derived from how node-telehash handles incoming streams.
Line.prototype.accept = function(error, stream, json) {
  if (this.stream) {
    throw("Line already has a stream assigned, can't accept another one.");
  }

  stream.handler = this.handlePacket.bind(this);

  this.stream = stream;
  this.connected = false;
  this.handlePacket(error, stream, json);

  return this;
};

// Handles an incoming packet.
Line.prototype.handlePacket = function(error, stream, json) {
  var displayName;

  // The first packet we receive is the handshake.
  if (!this.connected) {
    this.handleHandshake(error, stream, json);
    // The connection is established after receiving the handshake.
    this.connected = true;
    // Send messages that have been queued before.
    this.flush();

    return;
  }

  if (json.message || json.nick) stream.send({}); // receipt ack, maybe have flag for stream to auto-ack?

  // Packet contains a nickname, remember it.
  if (json.nick) {
    this.rememberNickname(stream.hashname, json.nick);
  }

  // Packet contains a message, emit an event.
  if (json.message) {
    this.emit('message', {nickname: this.nickname, hashname: stream.hashname, message: json.message});
  }
};

// Establish a line when opening a stream to a remote peer.
Line.prototype.connect = function(stream) {
  if (this.stream) {
    throw("Line already has a stream assigned, can't open another one.");
  }

  stream.handler = this.handlePacket.bind(this);

  this.stream = stream;
  this.sendHandshake();

  return this;
};

// Processes the handshake packet.
Line.prototype.handleHandshake = function(error, stream, json) {
  this.rememberNickname(json.nick);
  stream.send({});
};

// Sends the handshake packet.
Line.prototype.sendHandshake = function() {
  this.stream.send({nick: this.im.getNickname()});
};

// Stores the buddy's nickname and emits an event if it changed.
Line.prototype.rememberNickname = function(nickname) {
  if (this.nickname !== nickname) {
    this.nickname = nickname;
    this.emit('nickname', nickname);
  }
};

// Sends a message via this line.
Line.prototype.send = function(message) {
  this.outbox.push({message: message});

  if (this.connected) {
    this.flush();
  }
};

// Flushes all queued messages.
Line.prototype.flush = function() {
  var message;

  if (!this.connected) {
    throw('No connection available');
  }

  // Abort if already flushing.
  if (this.flushing) {
    return;
  }

  this.flushing = true;

  while (message = this.outbox.shift()) {
    this.stream.send(message);
  }

  this.flushing = false;
};

