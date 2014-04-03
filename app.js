/*****************************************
SITEMAPPER
Max Lapides 2014

Initialize Express site
*****************************************/

// include modules
var express		= require('express'),
	routes		= require('./routes'),
	http		= require('http'),
	path		= require('path'),
	app			= express(),
	server		= http.createServer(app),
	io			= require('socket.io').listen(server).set('log level', 2),
	mongoose	= require('mongoose');

// include crawler stuff
var Scraper		= require('./crawler/scraper.js'),
	organize	= require('./crawler/organize.js'),
	fetch		= require('./crawler/fetchTree.js');

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

if('development' === app.get('env')) {
	app.use(express.errorHandler());
}

// include moment - http://momentjs.com
app.locals.moment = require('moment');

app.get('/', routes.index);
app.get('/crawl/', routes.crawl);

server.listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});

io.sockets.on('connection', function(socket) {

	socket.on('crawl request', function(domain) {

		// get URL to crawl
		console.log('Request to crawl ' + domain);

		// connect to MongoDB
		mongoose.connect('mongodb://localhost/sitemapper');
		var db = mongoose.connection;
		db.on('error', console.error.bind(console, 'mongo connection error:'));


		// The Thesis
		var myScraper = new Scraper();
		myScraper.init(domain)
			.then(organize)
			.then(fetch)
			.then(function(tree) {
				socket.emit('tree complete', tree);
				mongoose.disconnect();
			});

		// demo without crawl

		/*

		var Site = require('./schemas/Site.js');
		Site.find({ domain : 'maxlapides.com' }, function(err, sitedoc) {
			organize(sitedoc[0])
				.then(fetch)
				.then(function(tree) {
					console.log(tree);
					socket.emit('tree complete', tree);
					mongoose.disconnect();
				});
		});

	*/

	});

});