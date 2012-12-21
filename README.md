#JooDee#
JooDee is a replacement for PHP or ASP using Node.js javascript. To use JooDee, embed server-side javascript on web 
pages using special tags.  Write to the page using plain HTML outside of the JooDee tags, or using the special output 
tag. End the response (if you are running any asyncrhonous code) using Response.end().

Easily use server-side javascript variables in your client-side javascript using the built in
Client and Session objects.

##Dependencies##
JooDee depends on `syntax-error` and `mime`, both of which are packaged inside of `node_modules`.

##Tags##
General purpose server-side script tag
```
    <:
        var code = 'goes here';
    :>
```

Shortcut for Response.write(), writes the evaluated code to the page.  Must be outside of script tags.
```
    <:: must('evaluate') + ' to a js string' :>
```

Includes a .html or .joo file
```
    <::: file/path/here.joo :>
```

##Special variables##
The variables `Client` and `Session` are available to you server-side and client-side.  
Add attributes to them to make use of them.<br>
```
    <:
        Client.x = 5;
        Session.username = "Iroh";
    :>
    
    <script type="application/javascript"> 
        alert(Session.username + Client.x); //will alert Iroh5
    </script>
```
You also have access to the variable `Page`, which is a static single variable that is 
specific to a given page, as well as `GET` and `POST`, which hold the GET or POST data
sent in the request.  These three variables, `Page`, `GET`, and `POST` are available server-side,
but you can easily expose them to the client:
```
    <:
        Client.GET = GET;
        Client.POST = POST;
    :>
    
    <script type="application/javascript">
        console.log(Client.GET);
    </script>
    
```
Note: changes to any of these special variables client-side will not be reflected server-side,
with the exception of `Session` (and even those changes would require the page to be reloaded).<br>
`Server` and `Page` are variables which are shared either across the entire server, or scoped to
all instances of a particular page.  For example, to keep track of the number of views on a particular
page since the server started up, you could write:
```
<:
    if(!Page.userCount) Page.views++
:>
```
`Server` acts in a similar matter, except that it is a single variable accessable to all pages.
##LongFeng##
LongFeng is a program for creating and controlling JooDee instances. It initially 
creates them based on the `config.json` file.
```
    [
        {
    		"name": "JooDee",
    		"dir": "./demo/",
    		"port": 8080,
    		"debug": true,
    		"defaultPage": "joodee.joo",
    		"timeout": 0
    	},
        {
        	"name": "JooDee2",
    		"dir": "./demo2/",
    		"port": 8081,
    		"debug": false,
    		"defaultPage": "joodee.joo",
    		"timeout": 0
    	}
    ]
```
It gives a console interface for controlling all of the JooDee instances.
```
    Command List:
       close
       listen
       kill
       load
       reload
       exit
    
    Type a "?" and a command to learn more about it.
```
Since `joodee.js` is only a module, `longfeng.js` is currently the easiest way to deploy and use your sites. To use `longfeng.js` just add your project's options object to the `config.json` file and run
```
    node longfeng.js
```

##Demo##
```
    node demo.js
```
navigate to `127.0.0.1:8081` in your browser.

##Async Demo##
This demonstrates one way of how to build a page when async calls are involved. <br>
```
    node async-demo.js
```
navigate to `127.0.0.1:8082` in your browser.
