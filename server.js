/*** Variable Declarations ***/
var http = require('http');		//Provides HTTP server and client functionality
var fs = require('fs');			//Interact with filesystem
var path = require('path');		//Provides filesystem path-related functionality
var mime = require('mime');		//Ability to derive MIME type based on filename extension		
var cache = {};					//Where contents of cached files are stored
var chatServer = require('./lib/chat_server');

/*** Helper functions ***/
//Handle sending of 404 errors
function send404(response) {
	response.writeHead(404, {'Content-Type': 'text/plain'});
	response.write('Error 404: resource not found.');
	response.end();
}

//Serve file data
function sendFile(response, filePath, fileContents) {
	response.writeHead(
		200,
		{"content-type": mime.lookup(path.basename(filePath))}
	);
	response.end(fileContents);
}

//Check if file is cached and serves it
function serveStatic(response, cache, absPath) {
	if (cache[absPath]) {
		sendFile(response, absPath, cache[absPath]);
	} else {
		fs.exists(absPath, function(exists){
			if(exists) {
				fs.readFile(absPath, function(err, data) {
					if(err) {
						send404(response);
					} else {
						cache[absPath] = data;
						sendFile(response, absPath, data);
					}
				});
			}
		});
	}
}

/*** Create the HTTP server ***/
var server = http.createServer(function(request, response) {
	var filePath = false; 

	if(request.url == '/') {
		filePath = 'public/index.html'; 	//Default HTML file to be served
	} else {
		filePath = 'public' + request.url;	//Translate URL path to relative file path
	}
	var absPath = './' + filePath;
	serveStatic(response, cache, absPath);
});

var port = Number(process.env.PORT || 3000);

server.listen(port, function() {
	console.log("Server listening on port " + port + ".");
});

chatServer.listen(server);