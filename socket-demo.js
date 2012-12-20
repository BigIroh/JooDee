var JooDee = require('./joodee');

var options = {
  name: "socket-demo",
	port: 8083,
	debug: true,
	dir: "./socket-demo",
	defaultPage: "chatroom-demo.joo",
};

var jd = new JooDee.Server(options);