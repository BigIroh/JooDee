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

//DaiLi.js wraps JooDee for message passing.

var joodee = require('./joodee');
var server;

process.on('message', function(message) {  
    if(message.options) {
        server = new joodee.Server(message.options);
    }
    if(message.log) {
        var fs = require('fs');
        var logStream = fs.openSync(message.log,'a');
        var cl = console.log;
        console.log = function(data) {
            cl(data);
            if((typeof data) == 'object') {
                data = require('util').inspect(data);
            }
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
        case 'process':
            process.send({
                name: server.name,
                process: process,
                cwd: process.cwd(),
                uptime: process.uptime(),
                hrtime: process.hrtime(),
                memoryUsage: process.memoryUsage()
            });
        break;
    }
});
