/*****************************************
SITEMAPPER
Max Lapides 2014

Front-end scripts for user interactions
*****************************************/

//@codekit-prepend 'spin', 'jquery.spin.js', 'jquery.fancybox.js', 'displayTree'

/* global io, displayTree */

var currentTree;

$(document).ready(function() {

	var spinner = {

		spinnerElmt: $('#tree-container'),

		start: function() {
			this.spinnerElmt
				.addClass('spinning')
				.empty()
				.spin();
		},

		stop: function() {
			this.spinnerElmt
				.removeClass('spinning')
				.spin(false);
		}

	};

	var socket = io.connect('http://localhost');
	socket.on('tree complete', function(tree) {
		spinner.stop();
		displayTree(tree);
		currentTree = tree;
		$('#download-tree').show();
	});

	// on form submit
	$('form').submit(function(e) {

		// do not pass go, do not collect $200
		e.preventDefault();

		// start spinner
		spinner.start();

		// hide download button
		$('#download-tree').hide();

		// post request to server

		// old method: make an HTTP request
		/*
		$.getJSON(
			'/crawl/',
			{ url: $('input#site').val() },
			function(tree) {
				spinner.stop();
				displayTree(tree);
			}
		);
		*/

		// new method: make a request over web sockets
		socket.emit('crawl request', $('input#site').val());

	});

	function printTree(tree) {

		var out = '<li>' + tree.name;

		if(tree.children) {
			out += '<ul>';
			for(var i = 0; i < tree.children.length; i++) {
				out += printTree(tree.children[i]);
			}
			out += '</ul>';
		}

		out += '</li>';

		return out;

	}

	$('#download-tree').click(function(e) {
		e.preventDefault();
		$.fancybox('<ul>' + printTree(currentTree) + '</ul>');
	});

});