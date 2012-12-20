/* Copyright (c) 2012 Matthew Scandalis & Jake Scott
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

//LongFeng.js handles and deploys JooDee instances using DaiLi.js
var fs = require('fs');
var joodee = require('./joodee');
var fork = require('child_process').fork;

var servers = [];

var logPath = './log.txt';
var logStream = fs.openSync(logPath,'a');
var cl = console.log;
console.log = function(data) {
    cl(data);
    if((typeof data) == 'object') {
        data = require('util').inspect(data);
    }
    var s = (new Date()).toUTCString() + ': ' + data + '\n';
    fs.write(logStream, s, 0, s.length, null);
}

var spawn = function(config) {
	var child = fork('./daili');
	child.send({
		options: config,
		log: './log.txt'
	});
	child.on('message', function(message) {
		servers[message.name].process = message;
	});
	servers[config.name] = child;
};

var actions = new Array();
//Help command similar to '?' in unix
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
			console.log('   close');
			console.log('   listen');
			console.log('   kill');
			console.log('   load');
			console.log('   reload');
			console.log('   exit');
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
actions['close'] = function(params) {
	var names = params.split(' ');
	var touched = false;
	for (n in names) {
		var name = names[n];
		if(servers[name]) {
			var name = names[n];
			servers[name].send('close');
			touched = true;
		}
	}
	if(!touched) console.log('No servers affected')
};

//Allow connections to servers with the given names
actions['listen'] = function(params) {
	var names = params.split(' ');
	var touched = false;
	for (n in names) {
		var name = names[n];
		if(servers[name]) {
			var name = names[n];
			servers[name].send('listen');
			touched = true;
		}
	}
};

//Close the given servers and remove them from memory
actions['kill'] = function(params) {
	var names = params.split(' ');
	var touched = false;
	for (n in names) {
		var name = names[n];
		if(servers[name]) {
			var name = names[n];
			servers[name].kill();
			console.log('Server "'+name+'" killed');
			servers[name] = null;
			touched = true;
		}
	}
	if(!touched) {
		console.log('No servers affected');
	}
};

//Load and start given servers listed in the config file
//This does not work on the LongFeng JooDee
actions['load'] = function(params) {
	var names = params.split(' ');
	var touched = false;
	fs.readFile('./config.json', 'utf8', function(err, data) {
		if(err){
			console.log(err);
			console.log('No servers affected');
			return;
		}
		var config = JSON.parse(data);
		for(i in config) {
			var name = config[i].name;
			if(names.indexOf(name) > -1) {
				if(servers[name]) {
					console.log('There is already a server named "'+name+'"');
				} else {
					spawn(config[i]);
					touched = true;
				}
			}
		}
		if(!touched) {
			console.log('No servers affected');
		}
	});
};

//Kill then load and spawn the given servers listed in the config file
//This does not work on the LongFeng JooDee
actions['reload'] = function(params) {
	actions['kill'](params);
	actions['load'](params);
};

//Outputs the server's status to the console
actions['status'] = function(params) {
	if(params) {
		var names = params.split(' ');
		for (n in names) {
			var name = names[n];
			if(servers[name]) {
				var name = names[n];
				servers[name].send('status');
			}
			else {
				console.log('Server "'+name+'" does not exist. Maybe you killed it')
			}
		}
	}
	else {
		var touched = false;
		for(s in servers) {
			var server = servers[s];
			if (server) {
				server.send('status');
				touched = true;
			}
		}
		if(!touched) console.log('No servers affected')
	}
}

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
			spawn(config[i]);
		}
	}
});

process.on('uncaughtException', function(e) {
	if(e.code == 'EACCES') {
		console.log('Could not start a server at the requested port (insufficient permissions).');
		console.log(e.stack,'\n');
	}
	
	else if (e.code == 'EADDRINUSE') {
		console.log('Could not start a server at the requested port (already in use).');
		console.log(e.stack,'\n');
	}
	
	else {
		console.log('Uncaught exception.',e.stack,'\n');
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