JooDee
======

Node.js embedded in HTML

##Dependencies##
npm install syntax-error<br>
npm install mime

##Demo##
node demo.js<br>
navigate to 127.0.0.1:8081 in your browser.

##Async Demo##
This demonstrates one way of how to build a page when async calls are involved. <br>

node async-demo.js<br>
naivate to 127.0.0.1:8082 in your browser.

##Tags##
<:   :> //general purpose server-side script tag<br>
<::  :> //shortcut for Response.write(), writes the evaluated code to the page<br>
<::: :> //includes a .html or .joo file

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