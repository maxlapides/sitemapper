/*****************************************
SITEMAPPER
Max Lapides 2014

Give each page a parent
*****************************************/

var cheerio		= require('cheerio'),
	url			= require('url'),
	_			= require('underscore'),
	Q			= require('q'),
	Page		= require('../schemas/Page.js');

function organize(sitedoc) {

	console.log('Organizing...');
	var deferred = Q.defer();
	var pages;
	var pagesOrganized = [];
	var $;

	function handleError(err) {
		if(err) { console.log(err); }
		return false;
	}

	function findPageByPath(path) {

		var page = _.find(pages, function(page) {
			return page.path.replace(/\//g,'') === path.replace(/\//g,'');
		});

		if(page) {
			return page;
		}

		else {

			var newPage = new Page({
				siteid	: sitedoc._id,
				path	: path,
			});

			newPage.save(function(err, savedPage) {
				if(err) { return handleError(err); }
				return savedPage;
			});

		}

	}

	function findPageByAnchor(anchor) {
		var parsedUrl = url.parse(url.resolve(sitedoc.domain, anchor.attr('href')));
		var anchorPath = parsedUrl.pathname;

		if(anchorPath === sitedoc.domain) {
			anchorPath = '/';
		}

		return findPageByPath(anchorPath);

	}

	function getSitePages() {

		var sitePagesDefer = Q.defer();

		var mapPagesQuery = Page.find({ siteid : sitedoc._id }, '_id path', function(err, fetchedPages) {
			if(err) { return handleError(err); }
			pages = fetchedPages;
		});

		mapPagesQuery.exec().onFulfill(function() {
			console.log('\tFetched site pages!');
			sitePagesDefer.resolve(sitedoc);
		});

		return sitePagesDefer.promise;

	}

	function organizeByUrl() {

		var urlDeferred = Q.defer();

		// iterate over every page
		_.each(pages, function(page) {

			// find the parent by URL path
			var parentPath = page.path.split('/');

			if(_.last(parentPath) === '') {
				parentPath.pop();
			}

			function logError(err, saved) { if(err) { console.log(err); console.log(saved); } }

			// search for the parent page
			while(parentPath.length > 1) {

				parentPath.pop();

				var parentPathStr = parentPath.join('/');
				if(!parentPathStr) { parentPathStr = '/'; }

				var parentPage = findPageByPath(parentPathStr);

				if(parentPage) {
					Page.findByIdAndUpdate(page._id, { parent: parentPage._id }, logError );
					break;
				}

			}

		});

		console.log('\tOrganized by URL!');
		urlDeferred.resolve(sitedoc);
		return urlDeferred.promise;

	}

	function crawlNav(rootNode, parentdoc) {

		function savePageParent(anchor, parentdoc) {

			var pagedoc = findPageByAnchor(anchor);

			// exceptions:
			if(!pagedoc ||										// couldn't find the page doc
				(pagedoc.path === '/') ||						// this page is the root
				(pagedoc.parent === parentdoc._id) ||			// the updated parent is the same as the current parent
				(pagesOrganized.indexOf(pagedoc._id) > -1))		// page's parent has already been updated
				{ return; }

			// remember that we updated this page's parent
			pagesOrganized.push(pagedoc._id);

			// update page's parent
			console.log('\t' + pagedoc.path + ' (' + pagedoc._id + ')' + ' ==> ' + parentdoc.path + ' (' + parentdoc._id + ')');
			function logError(err, saved) { if(err) { console.log(err); console.log(saved); } }
			Page.findByIdAndUpdate(pagedoc._id, { parent : parentdoc._id }, logError);

		}

		// base case
		if(!rootNode || !parentdoc) { return; }

		// get the children of the root
		var children = rootNode.children();

		// if there were no children, stop here
		if(!children || children.length < 1) { return; }

		var links, subnav, subparentdoc;
		children.each(function() {

			// either this element is itself an anchor
			if($(this).is('a')) {
				savePageParent($(this), parentdoc);
			}

			// or not and so we need to find each anchor
			else {

				links = $(this).children('a');

				if(links && links.length > 0) {
					links.each(function() {
						savePageParent($(this), parentdoc);
					});
				}

			}

			// then crawl all of the subpages, using the current child page as the root
			subnav = $(this).children('ul');
			subnav.each(function() {
				subparentdoc = findPageByAnchor($(this).siblings('a').first());
				crawlNav($(this), subparentdoc);
			});

		});

	}

	function organizeByNav(itemSelectors, containerSelectors, name) {

		var navDeferred = Q.defer();
		var nav;

		Page.find({ siteid : sitedoc._id, path : '/' }, 'html', function(err, pages) {

			if(err) { return handleError(err); }

			var root = pages[0];
			if(!root) { console.log('ERROR: could not find root'); return; }

			var rootHtml = pages[0].html;
			if(!rootHtml) { console.log('ERROR: could not find root HTML'); return; }

			$ = cheerio.load(rootHtml);
			var i, selector, elmt;

			// let the hunt begin!

			// start by searching for a navigation item
			for(i = 0; i < itemSelectors.length; i++) {

				// get current selector
				selector = itemSelectors[i];

				// search for this selector
				elmt = $(selector);
				// if not found, continue
				if(!elmt.length) { continue; }

				// search for the nav container
				nav = elmt.first().parents('ul');

				// if we found the nav container
				if(nav.length) {
					// select the last element as the nav
					nav = nav.last();
					break;
				}

			}

			// if we didn't find the nav
			if(!nav || !nav.length) {

				// start by searching for a navigation item
				for(i = 0; i < containerSelectors.length; i++) {

					// get current selector
					selector = containerSelectors[i];

					// search for this selector
					elmt = $(selector);
					// if not found, continue
					if(!elmt.length) { continue; }

					if(elmt.is('ul')) {
						// the nav is this element
						nav = elmt;
						break;
					}

					nav = elmt.find('ul');

					// if we found it
					if(nav.length) {
						// the nav is the first one
						nav = nav.first();
						break;
					}

				}

			}

			if(nav && nav.length) {
				console.log('\tFound the ' + name + ' navigation!');
				var rootdoc = findPageByPath('/');
				crawlNav(nav, rootdoc);
			}

			else {
				console.log('\tCould not find the ' + name + ' navigation :(');
			}

			navDeferred.resolve(sitedoc);

		});

		return navDeferred.promise;

	}

	function organizeByTopNav() {

		var topNavItemSelectors = [
			'li.current_page_item',				// WordPress
			'li.page_item',						// WordPress
			'li.menu-item',						// WordPress
			'li[class^="sf-item"]',				// Superfish
			'header li[class^="menu-"]',		// Drupal Nice Menus
			'.menu .leaf'						// Drupal
		];

		var topNavContainerSelectors = [
			'header nav[role="navigation"]',
			'.sf-menu',							// Superfish
			'.nice-menu',						// Drupal Nice Menus
			'#site-navigation',					// WordPress Twenty Twelve/Thirteen
			'.main-navigation',					// WordPress Twenty Twelve/Thirteen
			'.nav-menu',						// WordPress Twenty Twelve/Thirteen
			'div#access[role="navigation"]',	// WordPress Twenty Ten/Eleven
			'#header nav',
			'#topnav',
			'#top-nav',
			'#navtop',
			'#nav-top',
			'#main-menu',
			'nav.main .menu',
			'nav.main',
			'nav[role="navigation"]',
			'#main-nav',
			'.main-nav',
			'header .menu'
		];

		return organizeByNav(topNavItemSelectors, topNavContainerSelectors, 'top');

	}

	function organizeByFooterNav() {

		var footerNavItemSelectors = [
			'footer li.current_page_item',		// WordPress
			'footer li.page_item',				// WordPress
			'footer li.menu-item',				// WordPress
			'footer li[class^="menu-"]',		// Drupal Nice Menus
			'footer .menu .leaf',				// Drupal
			'#footer li.current_page_item',		// WordPress
			'#footer li.page_item',				// WordPress
			'#footer li.menu-item',				// WordPress
			'#footer li[class^="menu-"]',		// Drupal Nice Menus
			'#footer .menu .leaf'				// Drupal
		];

		var footerNavContainerSelectors = [
			'footer nav',
			'footer .nav',
			'#footer nav',
			'#footer .nav',
			'#menu-footer-links',
			'#footer-nav',
			'.footer-nav'
		];

		return organizeByNav(footerNavItemSelectors, footerNavContainerSelectors, 'footer');

	}

	getSitePages()
		.then(organizeByUrl)
		.then(organizeByFooterNav)
		.then(organizeByTopNav)
		.then(function() {
			console.log('\tDone organizing!');

			// wait 100ms before resolving the promise
			// fixed bug: sitemap only showed pages modified after organizeByUrl
			// (this is not an optimal solution, but it works for now)
			setTimeout(function() {
				deferred.resolve(sitedoc);
			}, 100);

		});

	return deferred.promise;

}

module.exports = organize;

/*

// connect to MongoDB
var mongoose	= require('mongoose'),
	Site		= require('../schemas/Site.js');
mongoose.connect('mongodb://localhost/sitemapper');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'mongo connection error:'));

Site.find({ domain : 'juddshill.com' }, function(err, sitedoc) {
	organize(sitedoc[0]);
});

*/