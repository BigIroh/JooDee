//DaiLi.js wraps JooDee for message passing.

var joodee = require('./joodee');
var server;

process.on('message', function(message) {  
    if(message.options){
        server = new joodee.Server(message.options);
    }
    if(message.log){
        var fs = require('fs');
        var logStream = fs.openSync(message.log,'a');
        console.log = function(data) {
            process.stdout.write(data + '\n');
            var s = (new Date()).toUTCString() + ': ' + data + '\n';
            fs.write(logStream, s, 0, s.length, null);
        }
    }
    switch(message) {
        case 'close':
            server.close();
        break;
        case 'listen':
            server.listen();
        break;
        case 'status':
            server.status();
        break;           
    }
});
