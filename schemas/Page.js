/*****************************************
SITEMAPPER
Max Lapides 2014

Page schema
*****************************************/

var mongoose = require('mongoose'),
	ObjectId = mongoose.Schema.ObjectId;

var pageSchema = mongoose.Schema({
	siteid	: { type: ObjectId, ref: 'Site' },
	path	: String,
	html	: String,
	parent	: { type: ObjectId, ref: 'Page' }
});

module.exports = mongoose.model('Page', pageSchema);