var joodee = require('./joodee');
 var server;
 process.on('message', function(message) {  
    if(message.options){
        server = new joodee.Server(message.options);
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
