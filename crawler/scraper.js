/*****************************************
SITEMAPPER
Max Lapides 2014

Crawl a website
*****************************************/

var cheerio		= require('cheerio'),
	url			= require('url'),
	crawler		= require('simplecrawler'),
	Q			= require('q'),
	settings	= require('./settings.js'),
	Site		= require('../schemas/Site.js'),
	Page		= require('../schemas/Page.js');

function Scraper() {

	var _this = this;

	this.init = function(siteurl) {

		this.siteurl = url.parse(siteurl);
		this.paths = [];

		this.addSite()
			.then(this.setupCrawler);

		this.deferred = Q.defer();
		return this.deferred.promise;

	};

	this.handleError = function(err) {
		if(err) { console.log(err); }
		return false;
	};

	this.addSite = function() {

		// remove old site from database
		var sitePromise = Site.findOneAndRemove({ domain: _this.siteurl.host }, function(err, oldSite) {

			if(err) { return _this.handleError(err); }

			// delete old pages
			if(oldSite) {
				Page.remove({ siteid: oldSite._id }, function(err) {
					if(err) { return _this.handleError(err); }
				});
			}

		});

		// re-add this site to the database
		sitePromise.then(function() {

			var newSite = new Site({ domain: _this.siteurl.host });

			newSite.save(function(err, thisSite) {

				if(err) { return _this.handleError(err); }

				// save site
				_this.sitedoc = thisSite;

			});

		});

		return sitePromise;

	};

	this.setupCrawler = function() {

		// start crawler
		_this.c = crawler.crawl(_this.siteurl.href);
		_this.c.discoverResources = false;
		_this.c.maxResourceSize = 1024 * 1024 * 1;		// 1MB (default 16MB)
		_this.c.timeout = 10 * 1000;					// 10 seconds (default 5 minutes)

		_this.c.on('fetchstart', function(queueItem) {
			process.stdout.write('Crawling ' + queueItem.path + '...');
		});

		_this.c.on('fetcherror', function() {
			console.log(' error :(');
		});

		_this.c.on('fetchcomplete', function(queueItem, data) {
			console.log(' done!');
			if(data) {
				_this.discoverPages(queueItem, data);
			}
		});

		_this.c.on('complete', function() {
			console.log('Scraped site: ' + _this.siteurl.host);
			_this.deferred.resolve(_this.sitedoc);
		});

	};

	this.discoverPages = function(queueItem, data) {

		// get the content of this page
		var $ = cheerio.load(data);

		var fullSiteUrl = url.format(_this.siteurl);
		var resolvedUrl = url.resolve(fullSiteUrl, queueItem.path);

		var newPage = new Page({
			siteid	: _this.sitedoc._id,
			path	: url.parse(resolvedUrl).path,
			html	: data
		});

		newPage.save(function(err) {
			if(err) { return _this.handleError(err); }
		});

		// iterate over links
		$('a').each(function() {

			// halt crawling if we reached the maximum page limit
			if(_this.paths.length >= settings.maxPages) {
				return false;
			}

			// get this URL
			var href = $(this).attr('href');
			if(!href) { return; }
			var pageUrl = url.parse(href);

			// skip right now if page doesn't belong to website
			if(pageUrl.host !== null && pageUrl.host.replace('www.','') !== _this.siteurl.host.replace('www.','')) {
				return;
			}

			// strip queries, hashes
			pageUrl.query = null;
			pageUrl.hash = null;

			// get the "resolved" URL (the full URL)
			var resolvedUrl = url.resolve(fullSiteUrl, url.format(pageUrl));

			// check file extension
			var extension = '';
			if(pageUrl.pathname) {
				extension = pageUrl.pathname.replace(/(.*)\.(.*)/, '$2');
			}

			// test whether we need to skip this page
			var skipPage =
				// the URL for this page, for whatever reason, doesn't exist
				!pageUrl ||
				// page has already been crawled
				(_this.paths.indexOf(resolvedUrl) !== -1) ||
				// page doesn't belong to website
				(pageUrl.host !== null && pageUrl.host.replace('www.','') !== _this.siteurl.host.replace('www.','')) ||
				// page isn't a page
				(extension.match(/(jpg|jpeg|png|gif|bmp|zip|pdf)/) !== null);

			// skip this page if necessary
			if(skipPage) { return; }

			// queue this page
			_this.paths.push(resolvedUrl);
			_this.c.queueURL(pageUrl.href);

		});

	};

}

module.exports = Scraper;