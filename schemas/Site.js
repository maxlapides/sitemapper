/*****************************************
SITEMAPPER
Max Lapides 2014

Site schema
*****************************************/

var mongoose = require('mongoose');

var siteSchema = mongoose.Schema({
	domain	: { type: String, index: true }
});

// disable auto-indexing in production
//siteSchema.set('autoIndex', false);

module.exports = mongoose.model('Site', siteSchema);