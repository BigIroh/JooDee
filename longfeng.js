var joodee = require('./joodee');
var fs = require('fs');


var actions = new Array();
//Ends the LongFeng instance and all the JooDees it is handling
actions['?'] = function(params) {
	switch(params) {
		case 'close':
			console.log('Close servers from receiveing connections');
			console.log('Usage: close server1 server2 server3');
		break;
		case 'listen':
			console.log('Allow connections to servers');
			console.log('Usage: listen server1 server2 server3');
		break;
		case 'kill':
			console.log('Close the given servers and remove them from memory');
			console.log('Usage: kill server1 server2 server3');
		break;
		case 'load':
			console.log('Load and start given servers listed in the config file');
			console.log('Usage: load server1 server2 server3');
		break;
		case 'reload':
			console.log('First kills then loads servers to get them their new configuration');
			console.log('Usage: reload server1 server2 server3');
		break;
		case 'exit':
			console.log('Exits LongFeng and ends the servers. What else were you expecting?');
			console.log('Usage: exit');
		break;
		default:
			console.log('Command List:');
			console.log('close');
			console.log('listen');
			console.log('kill');
			console.log('load');
			console.log('reload');
			console.log('exit');
			console.log('');
			console.log('Type a "?" and a command to learn more about it.');
	}
};


//Ends the LongFeng instance and all the JooDees it is handling
actions['exit'] = function(params) {
	console.log('Exiting...');
	process.exit(0);
};

//Close servers from receiveing connections with the given names
actions['close'] =  function(params) {
	var names = params.split(' ');
	for (n in names) {
		var name = names[n];
		servers[name].close();
	}
};

//Allow connections to servers with the given names
actions['listen'] =  function(params) {
	var names = params.split(' ');
	for (n in names) {
		var name = names[n];
		servers[name].listen();
	}
};

//Close the given servers and remove them from memory
actions['kill'] =  function(params) {
	var names = params.split(' ');
	actions['close'](params);
	for (n in names) {
		var name = names[n];
		servers[name].kill();
		servers[name] = null;
		console.log('Server "'+ name + '" killed');
	}
};

//Load and start given servers listed in the config file
//This does not work on the LongFeng JooDee
actions['load'] =  function(params) {
	var names = params.split(' ');
	fs.readFile('./config.json', 'utf8', function(err, data) {
		if(err){
			console.log(err);
			return;
		}
		var config = JSON.parse(data);
		for(i in config) {
			var name = config[i].name;
			if(names.indexOf(name) > -1) {
				if(servers[name]) {
					console.log('There is already a server named "'+name+'"');
				} else {
					servers[name] = new joodee.Server(config[i]);
				}
			}
		}
	});
};

//Kill then load and spawn the given servers listed in the config file
//This does not work on the LongFeng JooDee
actions['reload'] = function(params) {
	actions['kill'](params);
	actions['load'](params);
};

var servers = [];

//Read in the config file and spawn servers
fs.readFile('./config.json', 'utf8', function(err, data) {
	if(err){
		console.log(err);
		return;
	}
	var config = JSON.parse(data);
	for(i in config) {
		if(servers[config[i].name]) {
			console.log('There is already a server named "'+config[i].name+'"');
		} else {
			servers[config[i].name] = new joodee.Server(config[i]);
		}
	}
});

process.on("uncaughtException", function(e) {
	if(e.code == "EACCES") {
		console.log("Could not start a server at the requested port (insufficient permissions).");
		console.log(e.stack,"\n");
	}
	
	else if (e.code == "EADDRINUSE") {
		console.log("Could not start a server at the requested port (already in use).");
		console.log(e.stack,"\n");
	}
	
	else {
		console.log("Uncaught exception.",e.stack,"\n");
	}
});

//separate the first word as the command and the rest of the line is passed as
//a parameter to the given function in the action array
var processCommand = function(command) {
	var split = command.indexOf(' ');
	var action = command;
	var params = '';
	if (split > -1) {
		action = command.substr(0, split);
		params = command.substr(split+1);
	}
	if (actions[action]) {
		actions[action](params);
	} else {
		console.log('"' + action + '" is not a recognized command.');
	}
}

//read console input, segment it by line, and send it to be processed
var text = '';
process.stdin.resume();
process.stdin.on('data', function(chunk) {
	text += chunk;
	if (text.indexOf('\n')+text.indexOf('\r') > -2) {
		var nlines = text.split('\n');
		text = '';
		for (n in nlines) {
			var rlines = nlines[n].split('\r');
			for (r in rlines) {
				if (rlines[r]) {
					processCommand(rlines[r]);
				}
			}
		}
	}
});