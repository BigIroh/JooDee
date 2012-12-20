var JooDee = require('./joodee');
var options = {
  name: "demo",
	port: 8081,
	debug: true,
	dir: "./demo",
	defaultPage: "joodee.joo",
};

var jd = new JooDee.Server(options);