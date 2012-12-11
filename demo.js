var JooDee = require('./joodee');
var options = {
  name: "demo",
	port: 8081,
	debug: true,
	dir: "./",
	defaultPage: "demo.joo",
};

new JooDee.Server(options);