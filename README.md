#JooDee#
JooDee is a replacement for PHP or ASP using Node.js javascript. To use JooDee, embed server-side javascript on web pages using special tags.  Write to
the page using plain HTML outside of the JooDee tags, or using the special output tag. End the response (if you are running any asyncrhonous code) using Response.end().

Easily use server-side javascript variables in your client-side javascript using the built in
Client and Session objects.

##Dependencies##
JooDee depends on syntax-error and mime, both of which are packaged inside of `node_modules`.

##Tags##
```
<:   :> //general purpose server-side script tag<br>
<::  :> //shortcut for Response.write(), writes the evaluated code to the page<br>
<::: :> //includes a .html or .joo file
```

##Special variables##
The variables Client and Session are available to you server-side and client-side.  
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

##LongFeng##
LongFeng is a program for creating and controlling JooDee instances. It initially creates them based on the `config.json` file.
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
