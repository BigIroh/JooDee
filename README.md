#JooDee#
JooDee is a replacement for PHP or ASP using Node.js javascript. To use JooDee, embed server-side javascript on web 
pages using special tags.  Write to the page using plain HTML outside of the JooDee tags, or using the special output 
tag. End the response (if you are running any asyncrhonous code) using Response.end().

Easily use server-side javascript variables in your client-side javascript using the built in
Client and Session objects.

##Dependencies##
JooDee depends on `syntax-error` and `mime`, both of which are packaged inside of `node_modules`.

##Tags##
```
//general purpose server-side script tag
<script type="joodee"></script>

//shortcut for Response.write(), writes the evaluated code to the page
<: must(evaluate) + " to a js string" :>

//includes a .html or .joo file
<script type="joodee" src="file/to/include.joo"/>
```

##Special variables##
The variables `Client` and `Session` are available to you server-side and client-side.  
Add attributes to them to make use of them.<br>
```
    <script type="joodee">
        Client.x = 5;
        Session.username = "Iroh";
    </script>
    
    <script type="application/javascript"> 
        alert(Session.username + Client.x); //will alert Iroh5
    </script>
```
You also have access to the variable `Page`, which is a static single variable that is 
specific to a given page, as well as `GET` and `POST`, which hold the GET or POST data
sent in the request.  These three variables, `Page`, `GET`, and `POST` are available server-side,
but you can easily expose them to the client:
```
    <script type="joodee">
        Client.GET = GET;
        Client.POST = POST;
    </script>
    
    <script type="application/javascript">
        console.log(Client.GET);
    </script>
    
```
Note: changes to any of these special variables client-side will not be reflected server-side,
with the exception of `Session` (and even those changes would require the page to be reloaded).
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
