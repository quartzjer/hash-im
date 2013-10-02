var readline = require('readline'),
    path = require('path'),
    fs = require('fs'),
    IM = require('./index.js');

var CLI = function(idFile) {
  this.id = null; // The user's profile (nickname and keypair).
  this.rl = null; // Readline interface.
  this.session = null; // Instance of the IM.
  this.nicks = {};
  this.idFile = idFile || './id.json';
};

CLI.prototype.run = function() {
  this.rl = readline.createInterface(process.stdin, process.stdout, null);

  if (fs.existsSync(this.idFile)) {
    this.id = require(path.resolve(this.idFile));
    this.connect();
  } else {
    this.createId(this.connect.bind(this));
  }
};

CLI.prototype.createId = function(callback) {
  IM.genkey(function(err, key){
    if (err) {
      return cmds.quit(err);
    }

    this.id = key;

    this.rl.question('nickname? ', function(nick) {
      this.id.nick = nick;

      fs.writeFileSync(this.idFile, JSON.stringify(this.id, null, 4));
      callback();
    });
  });
};

CLI.prototype.connect = function() {
  // Register input handler and set up the prompt.
  this.rl.on('line', this.didReadLine.bind(this));
  this.rl.setPrompt(this.id.nick + "> ");
  this.rl.prompt();

  var seeds = require(__dirname + '/../seeds.json');

  this.session = IM.connect(this.id, seeds, this.didConnect.bind(this));
  this.session.on('message', this.didReceiveMessage.bind(this));
}

CLI.prototype.didReadLine = function(line) {
  var isCommand = line.indexOf('/') == 0;

  if (isCommand) {
    this.didReadCommand(line);
  } else {
    this.didReadMessage(line);
  }

  this.rl.prompt();
};

CLI.prototype.didReadCommand = function(line) {
  var parts = line.split(' '),
      command = parts.shift().substr(1),
      commands, handler;

  commands = {
    'quit': this.execQuit,
    'who': this.execWho,
    'whoami': this.execWhoami,
    'to': this.execTo,
    '42': this.exec42
  },

  handler = commands[command];

  if (handler) {
    handler.call(this, parts.join(' '));
  } else {
    this.log("I don't know how to " + command);
  }
};

CLI.prototype.execQuit = function() {
  this.log('poof');
  process.exit();
};

CLI.prototype.execWhoami = function() {
  this.log("my hashname is " + this.session.hashname);
}

CLI.prototype.execWho = function() {
  var recipient;

  if (this.to) {
    recipient = streams[to].nick + '(' + to + ')';
  } else {
    recipient = 'nobody';
  }

  this.log('talking to ' + recipient);
}

CLI.prototype.execTo = function(targ) {
  var hashname = (this.nicks[targ] || targ),
      line, displayName;

  // HAX
  line = this.session.lines[hashname];
  if (line) {
    displayName = line.nickname;
  } else {
    displayName = hashname;
  }

  this.to = hashname;

  this.rl.setPrompt(this.id.nick + '->' + displayName + '> ');
  this.rl.prompt();
}

CLI.prototype.exec42 = function() {
  this.log("I hash, therefore I am.");
}

CLI.prototype.didReadMessage = function(line) {
  if (!this.to) {
    this.log("who are you talking to? /to hashname|nickname");
  } else {
    this.session.sendMessage(this.to, line);
  }
};

CLI.prototype.didConnect = function(error) {
  if (error) {
    this.log(error);
    return process.exit(0);
  }

  this.log('online as ' + this.session.hashname);
};

CLI.prototype.didReceiveMessage = function(event) {
  var displayName;

  displayName = event.nickname || event.hashname;
  this.log("[" + displayName + "] " + event.message);
};

CLI.prototype.log = function(line) {
  // hacks!
  this.rl.output.write('\x1b[2K\r');
  console.log(line);
  this.rl._refreshLine()
};

var cli = new CLI(process.argv[2] || "./id.json");
cli.run();
