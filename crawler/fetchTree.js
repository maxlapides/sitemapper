/*****************************************
SITEMAPPER
Max Lapides 2014

Fetch the tree of a website
in JSON format for D3.js
*****************************************/

var _			= require('underscore'),
	Q			= require('q'),
	Site		= require('../schemas/Site.js'),
	Page		= require('../schemas/Page.js');

function buildTree(site) {

	var tree = {};
	var pages = [];

	var deferred = Q.defer();

	function findRoot() {
		return _.find(pages, function(page) {
			return page.path === '/';
		});
	}

	function getChildren(parent) {

		var children = [];
		var childElmt = {};
		var childElmtChildren = [];

		_.each(pages, function(page) {

			if(page.parent && page.parent.toString() === parent._id.toString()) {

				childElmt = {};
				childElmt.name = page.path;

				childElmtChildren = getChildren(page);
				if(childElmtChildren.length > 0) {
					childElmt.children = childElmtChildren;
				}

				children.push(childElmt);

			}

		});

		return children;

	}

	function getPages() {

		Page.find({ siteid : site._id }, '_id path parent', function(err, fetchedPages) {

			// handle error
			if(err) { console.log(err); return; }

			pages = fetchedPages;

			tree.name = site.domain;

			var children = getChildren(findRoot());
			if(children.length > 0) {
				tree.children = children;
			}

			console.log('Fetched tree: ' + site.domain);
			deferred.resolve(tree);

		});

	}

	// either site is a full site document
	// or site is the site ID

	// if site is just the site ID
	if(!site.domain) {

		// find the site in the database
		Site.findById(site, function(err, doc) {

			// handle error
			if(err) { console.log(err); return false; }

			// replace site
			site = doc;

		// then get all the pages for that site
		}).exec().then(getPages);

	}

	// otherwise, we just need to get all the pages for the site
	else {
		getPages();
	}

	return deferred.promise;

}

module.exports = buildTree;

//buildTree(mongoose.Types.ObjectId('52fbfb2b43ff25079b0b1f38'))
//	.then(function(tree) { console.log(tree); } );