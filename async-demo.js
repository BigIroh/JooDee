var JooDee = require('./joodee');
var options = {
    name: "demo2",
	port: 8082,
	debug: true,
	dir: "./",
	defaultPage: "async-demo.joo",
};

new JooDee.Server(options);