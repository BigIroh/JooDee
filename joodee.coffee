#Run the generated page code in a clean namespace

JooDee = (GET, POST, Session, Client, Response) ->
  eval Response.scriptString
  { Client, Session }

# Runs the page after exporting it and requiring it (this gets us line numbers for errors!)
# The callback executes after the script finishes executing, and passes an error if one
# exists.
JooDebugger = (GET, POST, Session, Client, Response, debugFilename, callback) ->

  #wrap scriptstring in a module so we can execute it in a separate file
  Response.scriptString = """
  exports.run = function(GET, POST, Session, Client, Response) { 
    try{ #{Response.scriptString} } 
    catch(e){
      var str = e.stack.split('\\n')[1];
      var col = str.split(':');
      return {line: col[col.length-2], message: e+''};
    }};
  """

  #write these out to a new file and clear the require cache
  fs = require 'fs'
  fs.writeFile debugFilename, Response.scriptString, (err) ->
    if err
      console.log "Debugger encountered an error while writing to #{debugFilename}"
      Response.end()
    else
      delete require.cache[require.resolve(debugFilename)]
      runtimeError = require(debugFilename).run GET, POST, Session, Client, Response
      fs.unlinkSync debugFilename
      callback runtimeError


events = require 'events'
util = require 'util'

# the filedescriptor is an array of line descriptors which ultimately allows
# the mapping of an error-line-number in the script created by JooDee to the
# correct line, filename, and code in the user-created files.  it's layout is
# described in the example below:
# [
#    {file: "main.joo", text:"var a=23;", line:1}      //first line of main.joo
#    {file: "main.joo", text:"console.log(a);", line:2}    //second line of main.joo
#    {file: "include.joo", text:"console.log(a+a);", line:1} //first line of include.joo
#    {file: "main.joo", text:"console.log(a+a+a);", line:3}  //third line of main.joo
# ]
#
# when the filedescriptor is done parsing files, it emits the 'ready' event, which
# should be listened to by the server so it knows when the page is ready for further
# processing.

FileDescriptor = (filename, data, callback) ->
  #construct the object
  fileDescriptorInstance = this
  lines = data.split('\n')
  descriptor = []
  includes = {}
  includes[filename] = data + ''

  #contains all the information needed for a single line of code
  LineDescriptor = (@file, @text, @line) ->

  for line in lines
    descriptor.push new LineDescriptor filename, lines[line], +line+1

  #returns plaintext of entire descriptor for eval'ing
  getText = ->
    descriptor.map((lineDescriptor) ->
      lineDescriptor.text)
    .join('\n')

  #adds the plain string 'content' to the descripor, starting at 'line' in the descriptor.
  #content will be split by \n and converted into linedescriptors, then spliced in.
  addContent = (filename, content, line) ->
    relativeLine = 1
    includeDescriptor = content.split('\n').map (text) ->
      new LineDescriptor filename, content, relativeLine++
    args = [line+1, 0].concat includeDescriptor
    Array::splice.apply descriptor, args

  #replaces all instances of reInclude regex with the file's contents, or emits
  #the event 'ready' if there are no more to replace. This will call itself recursively
  #until there are no more to replace
  replaceIncludes = ->
    reInclude = /<:::(.*?):>/
    includeList = []   #keeps track of all files that need to be included in this iteration
    for desc,i in descriptor
      result = reInclude.exec(desc.text)
      #since checking by lines, allow for one include per line, and ignore extra characters
      if result
        includeList.push {path: result[1], line: i}
        desc.text = ''

    #base case for recursion
    if includeList.length is 0
      callback getText(), descriptor, includes
      return

    #once the entire file has been examined for include tags, load all of the includes from the disk
    fs = require 'fs'
    loadedCount = 0
    for incl,i in includeList
      #only load each include 1x, and store the contents into the map 'includes,' which maps
      #the include's path to the the file's contents.  includes[path] is set to 'true' just 
      #before 'readFile' is called to prevent it from being included multiple times before
      #it got the chance to finish loading the first time.  The callback is called even if
      #the file has already been loaded, to ensure that it is called the correct number of 
      #times (if it isn't called once per file in 'includeList,' the program will not progress).
      path = includeList[i].path
      unless includes[path]
        includes[path] = true
        fs.readFile path, 'utf8', (err, data) ->
          includesLoadedCallback err, data, path
      else
        includesLoadedCallback()
    }

    #this callback waits until all files at the current level have loaded
    includesLoadedCallback = (err, data, path) ->
      loadedCount++
      if err
        #emit an error event here
        #do something to let the user know it happened
        console.log "error loading include file @#{path}"
      else if data
        includes[path] = data + ''

      if loadedCount is includeList.length
        #now, insert the contents of the includes into the filedescriptor
        for incl in includeList
          path = incl.path
          content = includes[path]
          line = incl.line
          addContent path, content, line

        #recursively call this until no more includes are found
        replaceIncludes()

    #end of includesLoadedCallback
  #end of replaceIncludes

  replaceIncludes()

  @descriptor = descriptor
  @getText = getText
#end of FileDescriptor

exports.Server = (options) ->

  serverInstance = this
  events.EventEmitter.call serverInstance

  fs = require 'fs' #remove with parse
  url = require 'url'
  http = require 'http'
  https = require 'https'
  qs = require 'querystring'
  nodeDir = "" #directory that the server is running in
  firstTime = true #ensures relative pathing for 'dir' only happens 1x
  defaults =
    name: null
    timeout: "none"    #10 seconds
    protocol: "http"   #or https
    port: 80
    sessionLength: 900000  #15 minutes
    debug: false
    dir: "/"
    ip: "0.0.0.0"      #INADDR_ANY
    defaultPage: "index.joo"
    error404: "404.joo"
    error500: "500.joo"
    key: null
    certificate: null

  # create session variable and append it to the header
   # converts 'set-cookie' into an array if it is undefined or a string so that 'push' works later
   # this has the effect of adding on to set-cookie as opposed to overwriting it
  appendSessionVariable = (res, Session) ->
    setCookieHeader = res.getHeader("Set-Cookie") ? []
    unless setCookieHeader.push
      setCookieHeader = [setCookieHeader]

    setCookieHeader.push "session=" + JSON.stringify Session #When we have more than one server running, this name might have to change
    setCookieHeader

  # Inserts a JSON version of the server's 'Client' object at the open HTML tag in the file.
  insertClient = (html, Client) ->
    return html.replace "<html>", """
      <html>
      <script type='application/javascript'>
      var Client = JSON.parse("#{JSON.stringify(Client)}");
      </script>
      """

  handleJoo = (req, res, filePath, data) ->
    res.setHeader "Content-Type", "text/html"
    #get and post data
    switch req.method
      when 'GET':
        GET = url.parse(req.url,true).query
      when 'POST':
        #get post data from the request
         if request.method is 'POST'
          body = ''
          request.on 'data', (data) ->
            body += data
          request.on 'end', ->
            POST = qs.parse(body)

    #grab the session cookie from the req header, create Cookies object from all cookies
    Session = {}
    Cookies = {}
    if(req.headers.cookie) {
      rawCookies = req.headers.cookie.split ";"
      for cookie in rawCookies
        splitLocation = cookie.indexOf "="
        if splitLocation is -1
          console.log "Malformed cookie (no '='): #{cookie}"
          continue
        cookieKey = rawCookies[c].substring(0,splitLocation).trim()
        cookieValue = rawCookies[c].substring(splitLocation+1)
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
      else if(options.debug) {
        var debugFilename = filePath.split('.joo')[0] + "_debug.js";
        JooDebugger.call({},  GET, POST, Session, Client, Response, debugFilename, function(runtimeError) {
          if(runtimeError) {
            outputErrorMessage(runtimeError, 'Runtime Error');
            serverInstance.emit('runtimeError', runtimeError);
            Response.end();
          }
        });
      }
      else {
        //prevent shit like this = {} from killing everyone
        JooDee.call({},  GET, POST, Session, Client, Response); 
      }
      
    });//end of FileDescriptor call
    
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
    var filePath = process.cwd()+path;
    var ext = path.substring(path.lastIndexOf('.')+1);
    fs.readFile(filePath, function (err, data) {  
      if (err) {
        res.writeHead(404, {'Content-Type': 'text/html'});
        res.end('File not found.');
      } 
      else if (ext == 'joo') {
        handleJoo(req, res, filePath, data);
      }//end of .joo extension branch
      //process non .joo files
      else {
        var type = require('mime').lookup(filePath);
        res.writeHead(200, {"Content-Type" :type});
        res.end(data);
      }
    }); 
  };

  //forward any uncaught exceptions as events
  process.on('uncaughtException', function(err) {
    serverInstance.emit('uncaughtException', err);
  });

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



  server.listen(options.port, options.ip);
  console.log('Server '+options.name+' listening on '+options.port);

  function parse(data) {
    var responseEndFound = false;

    //get locations of script and output tags
    var reScript = /<:([\s\S]*?):>/gm;
    var scriptSpans = []; //array of [start,end] pairs indicating where tags are
    while((result = reScript.exec(data)) !== null) {
      scriptSpans.push([result.index, result.index + result[0].length]);
    }

    //loop through all scripts, writing out the text between the scripts.
    var scriptString = 'delete Response.scriptString;'; //builds the entire script
    
    var start = 0;
    for(var i=0; i<scriptSpans.length; i++) {
      scriptString += 'Response.write("'+
        data.substring(start,scriptSpans[i][0])
          .replace(/\"/gm,'\\"')
          .replace(/\r/gm,"")
          .replace(/\n/gm,"\\n\\\n")
          .replace("/\\/gm","\\\\") +
        '");';

      //determine output or script tag, eval etc
      var snippet = data.substring(scriptSpans[i][0], scriptSpans[i][1]);
      if(snippet.charAt(2) == ':') { //output tag
        snippet = snippet.substring(3,snippet.length-2);
        snippet = "Response.write(" + snippet + "+'');";
      }
      else {
        //check for response end
        if(snippet.indexOf("Response.end()") >= 0) {
          responseEndFound = true;
        }
        snippet = snippet.substring(2,snippet.length-2);
      }
      scriptString += snippet;
      start = scriptSpans[i][1];
    }

    scriptString += 'Response.write("'+
      data.substring(start)
        .replace(/\"/gm,'\\"')
        .replace(/\r/gm,"")
        .replace(/\n/gm,"\\n\\\n")
        .replace("/\\/gm","\\\\")+
      '");\n';
    
    //append response.end if none was found
    if(!responseEndFound) scriptString += "Response.end();";

    return scriptString;
  }
}
