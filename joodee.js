/* TODO
 *  22. Timeouts.. very important now
 *	26. pipe output to a different file for each server?
 *  29. Emit event on 500, set 500 event
 *  30. Add gzip capabilities and caching for non .joo files. Possibly add on the fly gzip for .joo files but this may be too expensive
 * DONE
 *	 1. Create a shortcut for Response.write().  Anything in between <:: and :> will be output
 *	 2. The parser should escape strings when searching for a closing :> tag
 *	 3. Create an object clientside that allows access to variables created serverside in the 'Client' object
 *	 5. Populate GET and POST objects with posted data / URL params.  Create arrays from entries with the same name
 *	 6. Figure out a good way to handle session variables
 *	 7. HTTPS support
 *	 8. HTTP Status Codes
 *	 9. Create a master control program to spawn/stop/restart/monitor the servers.
 *	10.	Make the constructor for the server take different params (port, http/https, ip, root directory)
 *	11. Read from a config file to set params for this server
 *  12. Add ability too include other files, like .html and .joo
 *  13. How the fuck do users debug?  OOOH.  instead of replacing text, do the require trick on all includes.
 *  16. CSS images aren't loading
 *  17.	MIME types (This project now requires NPM INSTALL MIME)
 *  18. Debugging for includes
 *  19. Make dir work with relative paths (sort of working right now)
 *  20. newlines inside of javascript strings (Like str = "hi \n matt") are  not behaving correctly
 *    	and neither are literal newlines escaped by a \ (all clientside JS)
 *  21. Add Response.end() and have it end and sent the response.
 *  22. ensure server can't crash on error
 *  23. Move debugging to a separate module
 *	24. Add server-wide static variable?
 *	25.	Have servers start in child processes for graceful resetting
 *  27. we should make a standalone module.. allow for binding events etc.
 *  28.	Redirect to 404 pages, emit event on 404
 *  31. Path sanitation and limiting to only children of dir
 */


//Run the generated page code in a clean namespace
var JooDee = function( GET, POST, Session, Client, Server, Page, Response) {
	eval(Response.scriptString);
	return {
		client: Client,
		session: Session
	};
};

/* Runs the page after exporting it and requiring it (this gets us line numbers for errors!)
 * The callback executes after the script finishes executing, and passes an error if one
 * exists. */
var JooDebugger = function(GET, POST, Session, Client, Server, Page, Response, debugFilename, callback) {
	//wrap scriptstring in a module so we can execute it in a separate file
	Response.scriptString = "exports.run = function(GET, POST, Session, Client, Server, Page, Response) { try{" +
		Response.scriptString + "} catch(e){" +
		"var str = e.stack.split('\\n')[1];" +
		"var col = str.split(':');" +
		"return {line: col[col.length-2], message: e+''};" +
		"}};";

	//write these out to a new file and clear the require cache
	var fs = require('fs');
	fs.writeFile(debugFilename, Response.scriptString, function(err) {
		if(err) {
			console.log("Debugger encountered an error while writing to " + debugFilename);
			Response.end();
		}
		else {
			delete require.cache[require.resolve(debugFilename)];
			var runtimeError = require(debugFilename).run(GET, POST, Session, Client, Server, Page, Response);
			fs.unlinkSync(debugFilename);
			callback(runtimeError);
		}
	});
}


var events = require('events');
var util = require('util');

/* the filedescriptor is an array of line descriptors which ultimately allows
 * the mapping of an error-line-number in the script created by JooDee to the
 * correct line, filename, and code in the user-created files.  it's layout is
 * described in the example below:
 * [
 *		{file: "main.joo", text:"var a=23;", line:1}			//first line of main.joo
 *		{file: "main.joo", text:"console.log(a);", line:2}		//second line of main.joo
 *		{file: "include.joo", text:"console.log(a+a);", line:1}	//first line of include.joo
 *		{file: "main.joo", text:"console.log(a+a+a);", line:3}	//third line of main.joo
 * ]
 *
 * When the filedescriptor is done parsing files, the callback is executed. */
var FileDescriptor = function (filename, data, callback) { 	
	//construct the object
 	var fileDescriptorInstance = this;
	var lines = data.split('\n');
	var descriptor = [];
	var includes = {};
	includes[filename] = data+'';

	//contains all the information needed for a single line of code
	var LineDescriptor = function (filename, text, line) {
		this.file = filename;
		this.text = text;
		this.line = line;
	};

	for(line in lines) {
		descriptor.push( new LineDescriptor(filename, lines[line], Number(line)+1) );
	}

	//returns plaintext of entire descriptor for eval'ing
	var getText = function() {
		return descriptor.map( function(lineDescriptor) {
			return lineDescriptor.text;
		}).join('\n');
	};

	//adds the plain string 'content' to the descriptor, starting at 'line' in the descriptor.
	//content will be split by \n and converted into linedescriptors, then spliced in.
	var addContent = function(filename, content, line) {
		var relativeLine = 1;
		var includeDescriptor = content.split('\n').map( function(text) {
			return new LineDescriptor(filename, text, relativeLine++);
		});
		var args = [line+1, 0].concat(includeDescriptor);
		Array.prototype.splice.apply(descriptor, args);
	}

	//replaces all instances of reInclude regex with the file's contents, or emits
	//the event 'ready' if there are no more to replace.  This will call itself recursively
	//until there are no more to replace
	function replaceIncludes() {
		//finds things in the form of <script type='joodee' src='blah'/> or <script src="blah" type="blah"/>
		var reInclude = /<:::(.*?):>/gmi;
		var includeList = [];	//keeps track of all files that need to be included in this iteration
		for(var i=0; i<descriptor.length; i++) {
			var result = reInclude.exec(descriptor[i].text);
			//when an include is found, the line it was found on is split so that the include tag
			//will be at the start of the NEXT line.  The list of includes is updated with a new
			//entry containing the path and line number for the include.  The file itself is not
			//loaded yet.
			if(result) {
				var includePath = result[1];
				includeList.push({path: includePath, line: i});

				//split the current line on to a new line
				var extraText = descriptor[i].text.substring(result.index + result[0].length);
				descriptor[i].text = descriptor[i].text.substring(0, result.index);
				descriptor.splice(i, 0, 
					new LineDescriptor(descriptor[i].file, extraText, descriptor[i].line));
			}

		}

		//base case for recursion
		if(includeList.length == 0) {
			callback(getText(), descriptor, includes);
			return;
		}

		//once the entire file has been examined for include tags, load all of the includes from the disk
		var fs = require('fs');
		var loadedCount = 0;
		for(var i=0; i<includeList.length; i++) {

			//only load each include 1x, and store the contents into the map 'includes,' which maps
			//the include's path to the the file's contents.  includes[path] is set to 'true' just 
			//before 'readFile' is called to prevent it from being included multiple times before
			//it got the chance to finish loading the first time.  The callback is called even if
			//the file has already been loaded, to ensure that it is called the correct number of 
			//times (if it isn't called once per file in 'includeList,' the program will not progress).
			var path = includeList[i].path;
			if(!includes[path]) {
				includes[path] = true;
				fs.readFile(path, 'utf8', function(err, data) {
					includesLoadedCallback(err, data, path);
				});
			}
			else {
				includesLoadedCallback();
			}
		}

		//this callback waits until all files at the current level have loaded
		function includesLoadedCallback(err, data, path) {

			loadedCount++;
			if(err) {
				//emit an error event here
				//do something to let the user know it happened
				console.log("error loading include file @" + path);
			}
			else if(data) {
				includes[path] = data + '';
			}

			if(loadedCount == includeList.length) {
				//now, insert the contents of the includes into the filedescriptor
				for(var i in includeList) {
					var path = includeList[i].path;
					var content = includes[path];
					var line = includeList[i].line;
					addContent(path, content, line);
				}

				//recursively call this until no more includes are found
				replaceIncludes();
			}
		}
	};

	replaceIncludes();

	this.descriptor = descriptor;
	this.getText = getText;
}

/* Given the raw text of the file we're serving, build the script that will be
 * eval'd later in the program.  Escape all fancy characters (new lines, etc).
 * Appends Response.end() at the bottom of the script if it was not encountered
 * during the parsing. */
var parse = function(data) {
	var responseEndFound = false;
	var reScript = /<::?([\s\S]*?):>/gm;
	var scriptString = 'delete Response.scriptString;';

	var start = 0;
	while((result = reScript.exec(data)) !== null) {
		//get all html before this scripttag pair
		scriptString += 'Response.write("'+
			data.substring(start, result.index)
				.replace(/\"/gm,'\\"')
				.replace(/\r/gm,"")
				.replace(/\n/gm,"\\n\\\n")
				.replace("/\\/gm","\\\\") +
				'");';

		//output tag
		if(result[0].charAt(2)==':') {
			scriptString += 'Response.write(' + result[1] + ');';
		}
		else {
			scriptString += result[1];	//actual code to be executed
			if(result[1].indexOf("Response.end()") >= 0) {
				responseEndFound = true;
			}
		}
		start = result.index + result[0].length;
	}
	//get all html left over
	scriptString += 'Response.write("'+
		data.substring(start, data.length)
			.replace(/\"/gm,'\\"')
			.replace(/\r/gm,"")
			.replace(/\n/gm,"\\n\\\n")
			.replace("/\\/gm","\\\\") +
			'");';

	if(!responseEndFound) scriptString += "Response.end();";
	return scriptString;
};

exports.Server = function (options) {
	var pageObjects = {};
	var serverInstance = this;
	events.EventEmitter.call(serverInstance);

	var fs = require('fs'); //remove with parse
	var url = require('url');
	var http = require('http');
	var https = require('https');	
	var pathLib = require('path');	
	var qs = require('querystring');
	var nodeDir = "";		//directory that the server is running in
	var firstTime = true; //ensures relative pathing for 'dir' only happens 1x
	var defaults = {
		name: null,
		timeout: "none",		//10 seconds
		protocol: "http",		//or https
		port: 80,
		sessionLength: 900000, 	//15 minutes
		debug: false,
		dir: "/",
		ip: "0.0.0.0",			//INADDR_ANY
		defaultPage: "index.joo",
		error404: "404.joo",
		error500: "500.joo",
		key: null,
		certificate: null
	}

	/* create session variable and append it to the header
	 * converts 'set-cookie' into an array if it is undefined or a string so that 'push' works later
	 * this has the effect of adding on to set-cookie as opposed to overwriting it */
	var appendSessionVariable = function (res, Session) {
		var setCookieHeader = res.getHeader("Set-Cookie");
		if(typeof setCookieHeader != "object") {
			setCookieHeader = (setCookieHeader ? [setCookieHeader] : []);
		}
		setCookieHeader.push("session=" + JSON.stringify(Session));	//When we have more than one server running, this name might have to change
		return setCookieHeader;
	}

	/* Inserts a JSON version of the server's 'Client' object at the open HTML tag in the file. */
	var insertClient = function(html, Client) {
		return html.replace("<html>", 
			"<html>\n<script type='application/javascript'>\n"
			+"var Client = "+JSON.stringify(Client)+";\n"+
			"</script>");
	}

	var handleJoo = function (req, res, filePath, data, is404) {
		//if this page doesnt have a static variable created for it yet, create one now
		if(typeof pageObjects[filePath] == "undefined") {
			pageObjects[filePath] = {};
		}

		//get and post data
		var GET;
		var POST;
		switch(req.method) {
			case 'GET':
				GET = url.parse(req.url,true).query;
			break;
			case 'POST':
				//get post data from the request
				 if (request.method == 'POST') {
					var body = '';
					request.on('data', function (data) {
						body += data;
					});
					request.on('end', function () {
						POST = qs.parse(body);
					});
				}
			break;
		}

		//grab the session cookie from the req header, create Cookies object from all cookies
		var Session = {};
		var Cookies = {};
		if(req.headers.cookie) {
			var rawCookies = req.headers.cookie.split(";");
			for(c in rawCookies) {
				var splitLocation = rawCookies[c].indexOf("=");
				if(splitLocation == -1) {
					console.log("Malformed cookie (no '='): " + rawCookies[c]);
					continue;
				}
				var cookieKey = rawCookies[c].substring(0,splitLocation).trim();
				var cookieValue = rawCookies[c].substring(splitLocation+1);
				Cookies[cookieKey] = cookieValue;
			}
			try {
				Session = JSON.parse(Cookies.session);
				//if some idiot sets 'Session' equal to a non-object in a page, it breaks Session.
				if(typeof Session != "object") {
					Session = [Session];
				}
			}
			catch(e) {
				console.log("Error attempting to parse Session variable: " + Cookies.session);
			}
		}

		new FileDescriptor(filePath, data+'', function(text, descriptor, includes) {
			var scriptString = parse(text);
			var check = require('syntax-error');
			var syntaxError = check(scriptString, "");

			/*Create a JooDee to serve the page.*/
			var html = '';
			var Client = {};
			if(is404){
				Client.filePath = filePath.substring(0, filePath.lastIndexOf('/')+1);
				Client.fileName = filePath.substring(filePath.lastIndexOf('/')+1);
			}

			//Create Response object that JooDee will use to build the html
			var Response = {
				write: function(text) {
					html += text;
				},
				reset: function() {
					html = '';
				},
				end: function() {
					//Put the Client object in the page for use by client side JS
					html = insertClient(html, Client);
					//Append the Session variable to the header
					res.setHeader("Set-Cookie", appendSessionVariable(res, Session));
					if(is404) {
						res.writeHead(404);
					}
					//write the page
					res.write(html);
					res.end();
				},
				scriptString: scriptString //This is the generated js that JooDee will eval. It is passed in with the Response so delete can be called, cleaning the namespace
			};
			var outputErrorMessage = function (err, additionalMessage) {
				err.line-=1;
				Response.write("<div style='background-color: #DDDDDD; border: 1px solid black; font: 12px Arial;'>");
				Response.write(err.message + " at " +
					descriptor[err.line].file + ": Line " + (descriptor[err.line].line) + "<br><br>");
				
				var outputCode = includes[descriptor[err.line].file].split('\n');
				if(!outputCode) return;
				for(var i=Math.max(0,descriptor[err.line].line-2); i<Math.min(Number(descriptor[err.line].line)+3, outputCode.length); i++) {
					var str = "<span style='font: 12px Courier, Monospace'>\
									&nbsp;\
									<span style='font-weight:900;'>" +
									"&nbsp;" +(i+1) + "&nbsp;\
									</span>\n";
					if(i == descriptor[err.line].line-1) str += "<span style='color: red'>";
					str += outputCode[i].replace('<', '&lt;').replace('>', '&gt;');
					if(i == descriptor[err.line].line-1) str += "</span>";
					str += "</span>\n<br>\n";
					Response.write(str)
				}
				Response.write("<br>"+additionalMessage+"</div>");
			}
			if(syntaxError) {
				outputErrorMessage(syntaxError, 'Syntax Error');
				serverInstance.emit('syntaxError', syntaxError);
				Response.end();
			}
			else if(options.debug && !is404) {
				var debugFilename = filePath.split('.joo')[0] + "_debug.js";
				JooDebugger.call({},  GET, POST, Session, Client, serverInstance.Server, pageObjects[filePath], Response, debugFilename, function(runtimeError) {
					if(runtimeError) {
						console.log(runtimeError);
						outputErrorMessage(runtimeError, 'Runtime Error');
						serverInstance.emit('runtimeError', runtimeError);
						Response.end();
					}
				});
			}
			else {
				//prevent shit like this = {} from killing everyone
				JooDee.call({},  GET, POST, Session, Client, serverInstance.Server, pageObjects[filePath], Response);	
			}
		});
	};

	var requestListener = function (req, res) {
		//forward all events from res to our server
		res.on('close', function() {
			serverInstance.emit('close');
		});

		//grab file from disk
		path = require('url').parse(req.url).path.split("?")[0];
		if (path[path.length-1] == '/') {
			path = path + options.defaultPage;
		}
		try {
			if(firstTime) {
				nodeDir = process.cwd();
				process.chdir(options.dir);
				firstTime = false;
			}
		}
		catch(e) {
			console.log("Error changing directory to " + options.dir + ".");
			console.log("Current directory is " + process.cwd() + ".");
			console.log(e.stack);
		}
		var filePath = pathLib.join(process.cwd(),path);
		var errorPath = pathLib.join(process.cwd(), options.error404);
		var ext = path.substring(path.lastIndexOf('.')+1);
		fs.readFile(filePath, function (err, data) {
			if (err || filePath.indexOf(process.cwd())<0) {
				console.log('404 at ' + filePath);
				serverInstance.emit('404', filePath);
				res.setHeader('Content-Type', 'text/html; charset=utf8');
				fs.readFile(errorPath, function (err, data) {
					handleJoo(req, res, path, data, true);
				});
			} 
			else if (ext == 'joo') {
				res.setHeader("Content-Type", "text/html; charset=utf8");
				handleJoo(req, res, filePath, data);
			}
			else {
				var type = require('mime').lookup(filePath);
				res.writeHead(200, {'Content-Type' :type + (type=='text/html' ?  'charset=utf8' : '')});
				res.end(data);
			}
		});	
	};

	var uncaughtException = function(err) {
		console.log("Uncaught exception: ",err.stack);
		serverInstance.emit('uncaughtException', err);
	};

	// forward any uncaught exceptions as events
	process.on('uncaughtException', uncaughtException);

	//copy default into options if no option is set
	if(!options) {
		options = {};
	}
	for(d in defaults) {
		if(options[d] === undefined) {
			options[d] = defaults[d];
		}
	}
	if(options.dir.charAt(options.dir.length-1) != '/') {
		options.dir = options.dir + '/';
	}

	//Create the server
	var server;
	switch(options.protocol) {
		case "http":
			server = http.createServer(requestListener);
		break;
		case "https":
			server = https.createServer({
				key: fs.readFileSync(options.key),
				cert: fs.readFileSync(options.certificate)
			}, requestListener);
		break;
	}

	this.Server = {
		httpServer: server,
		listening: false
	};
	var Server = this.Server;

	this.options = options;

	this.close = function(callback) {
		if(Server.listening) {
			server.close(function(){
				Server.listening = false;
				console.log('Server "'+options.name+'" closed');
				if(callback) callback();
			});
		}
		else {
			console.log('Server "'+options.name+'" already closed');
		}
	};

	this.listen = function(callback) {
		if(Server.listening) {
			console.log('Server "'+options.name+'" already listening');
		}
		else {
			server.listen(options.port, options.ip, function(){
				Server.listening = true;
				console.log('Server "'+options.name+'" listening on port '+options.port);
				if(callback) callback();
			});
		}
	}

	this.kill = function(callback) {
		process.removeListener('uncaughtException', uncaughtException);
		console.log('Server "'+options.name+'" killed');
		if(callback) callback();
	}

	this.status = function() {
		console.log('Server "'+options.name+'" is ' + (Server.listening ? '' : 'not ') + 'currently listening');
		return Server.listening;
	}

	this.httpServer = function() {
		return server
	};
	

	//foraward events from the httpServer to our server
	server.on('request', function(req, res) {
		serverInstance.emit('request', req, res);
	});

	server.on('connection', function(socket) {
		serverInstance.emit('connection', socket);
	});

	server.on('close', function() {
		serverInstance.emit('close');
	});

	server.on('checkContinue', function(request, response) {
		serverInstance.emit('checkContinue', request, response);
	});

	server.on('connect', function(request, socket, head) {
		serverInstance.emit('connect', request, socket, head);
	});

	server.on('upgrade', function(request, socket, head) {
		serverInstance.emit('upgrade', request, socket, head);
	});

	server.on('clientError', function(exception) {
		serverInstance.emit('clientError', exception);
	});

	this.listen(); // start the server
}
util.inherits(exports.Server, events.EventEmitter);
