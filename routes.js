/*****************************************
SITEMAPPER
Max Lapides 2014

Route HTTP requests
*****************************************/

var mongoose	= require('mongoose'),
	Scraper		= require('./crawler/scraper.js'),
	organize	= require('./crawler/organize.js'),
	fetch		= require('./crawler/fetchTree.js');

exports.index = function(req, res) {
	res.render('index', { title: 'Sitemapper by Max Lapides' });
};

exports.crawl = function(req, res) {

	// get URL to crawl
	var url = req.param('url');
	console.log('Request to crawl ' + url);

	// connect to MongoDB
	mongoose.connect('mongodb://localhost/sitemapper');
	var db = mongoose.connection;
	db.on('error', console.error.bind(console, 'mongo connection error:'));

	// The Thesis
	var myScraper = new Scraper();
	myScraper.init(url)
		.then(organize)
		.then(fetch)
		.then(function(tree) {
			//console.log(JSON.stringify(tree));
			res.json(tree);
			mongoose.disconnect();
		});

};