var fs = require("fs");
var tele = require("telehash");

// set up our readline interface
rl = require("readline").createInterface(process.stdin, process.stdout, null);
function log(line){
  // hacks!
  rl.output.write('\x1b[2K\r');
  console.log(line);
  rl._refreshLine()
}

// load or generate our crypto id
var idfile = process.argv[2]||"./id.json";
var id;
if(fs.existsSync(idfile))
{
  id = require(idfile);
  init();
}else{
  tele.genkey(function(err, key){
    if(err) return cmds.quit(err);
    id = key;
    rl.question('nickname? ', function(nick) {
      id.nick = nick;
      fs.writeFileSync(idfile, JSON.stringify(id, null, 4));
      init();
    });    
  });
}

var im;
function init()
{
  rl.setPrompt(id.nick+"> ");
  rl.prompt();

  var seeds = require("./seeds.json");
  im = tele.hashname("im.telehash.org", id);
  seeds.forEach(im.addSeed);

  im.online(function(err){
    log((err?err:"online as "+im.hashname));
    if(err) process.exit(0);
  });  

  im.listen("_im", handshake);
}

var streams = {};
var nicks = {};
function incoming(im, packet, callback)
{
  callback();
  if(packet.js.message || packet.js.nick) packet.stream.send({}); // receipt ack, maybe have flag for stream to auto-ack?

  if(packet.js.message) log("["+(packet.stream.nick||packet.from.hashname)+"] "+packet.js.message);
  if(packet.js.nick) nickel(packet.from.hashname, packet.js.nick);
}
function handshake(im, packet, callback)
{
  if(callback) callback();
  log("connected "+packet.js.nick+" ("+packet.from.hashname+")");
  streams[packet.from.hashname] = packet.stream;
  packet.stream.handler = incoming;
  nickel(packet.from.hashname, packet.js.nick);
  if(packet.js.seq == 0) packet.stream.send({nick:id.nick});
  else packet.stream.send({});
}

// update nick and refresh prompt
function nickel(hashname, nick)
{
  streams[hashname].nick = nick;
  nicks[nick] = hashname;
  if(!to || to == hashname) cmds.to(hashname);
}

// our chat handler
var to;
rl.on('line', function(line) {
  if(line.indexOf("/") == 0) {
    var parts = line.split(" ");
    var cmd = parts.shift().substr(1);
    if(cmds[cmd]) cmds[cmd](parts.join(" "));
    else log("I don't know how to "+cmd);
  }else{
    if(!to) log("who are you talking to? /to hashname|nickname");
    else streams[to].send({message:line});
  }
  rl.prompt();
});

var cmds = {};
cmds.quit = function(err){
  log(err||"poof");
  process.exit();
}
cmds.whoami = function(){
  log("my hashname is "+ im.hashname);  
}
cmds.who = function(){
  if(!to) return log("talking to nobody");
  log("talking to "+streams[to].nick+" ("+to+")");
}
cmds.to = function(targ){
  to = nicks[targ] || targ;
  if(!streams[to]) streams[to] = im.stream(to, handshake).send({type:"_im", nick:id.nick});
  rl.setPrompt(id.nick+"->"+(streams[to].nick||to)+"> ");
  rl.prompt();
}
cmds["42"] = function(){
  log("I hash, therefore I am.");
}
