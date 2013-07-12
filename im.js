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
var idfile = process.argv[3]||"./id.json";
if(fs.existsSync(idfile))
{
  var id = require(idfile);
  init();
}else{
  tele.genkey(function(err, key){
    if(err) return cmds.quit(err);
    var id = key;
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

  im.listen("_im", function(operator, packet){
    if(!streams[packet.from.hashname]) streams[packet.from.hashname] = packet.stream;
    packet.stream.handler = incoming;
  });
}

var streams = {};
function incoming(im, packet, callback)
{
  callback();
  packet.stream.send({}); // receipt ack
  if(!packet.js.message) return;
  log("["+packet.from.hashname.substr(0,4)+"]< "+packet.js.message);  
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
    else to.send({message:line});
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
cmds.to = function(hashname){
  if(!streams[hashname]) to = streams[hashname] = im.stream(hashname, incoming).send({type:"_im"});
  if(!to.nick) to.nick = to.hashname;
  rl.setPrompt(id.nick+"->"+to.nick+"> ");
}
cmds["42"] = function(){
  log("I hash, therefore I am.");
}
