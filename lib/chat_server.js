var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

/* Helper functions */

//Assign names to guest
function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
	var name = 'Guest' + guestNumber;
	nickNames[socket.id] = name;
	socket.emit('nameResult', {
		success: true, 
		name: name
	});
	namesUsed.push(name);
	return guestNumber + 1;
}

//Joining rooms
function joinRoom(socket, room) {
	//Make user join room
	socket.join(room);

	//Note that user is now in this room
	currentRoom[socket.id] = room;
	//Let user know they're now in new room
	socket.emit('joinResult', {room: room});
	//Let other users in room know that user has joined
	socket.broadcast.to(room).emit('message', {
		text: nickNames[socket.id] + ' has joined ' + room + '.'
	});
	//Determine what other users are in the same room
	var usersInRoom = io.sockets.clients(room);

	if(usersInRoom.length > 1) {
		var usersInRoomSummary = 'Users currently in ' + room + ': ';
		for(var index in usersInRoom) {
			var userSocketId = usersInRoom[index].id;
			if(userSocketId != socket.id) {
				if(index > 0) {
					usersInRoomSummary += ', ';
				}

				usersInRoomSummary += nickNames[userSocketId];
			}
		}

		usersInRoomSummary += '.';
		socket.emit('message', {text: usersInRoomSummary});
	}
}

//Handles requests by users to change their names
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
	//Listener for nameAttempt events
	socket.on('nameAttempt', function(name) {
		//Don't allow nicknames to begin with Guest
		if(name.indexOf('Guest') == 0) {
			socket.emit('nameResult', {
				success: false,
				message: 'Names cannot begin with "Guest".'
			});
		} else {
			if(namesUsed.indexOf(name == -1)) {
				var previousName = nickNames[socket.id];
				var previousNameIndex = namesUsed.indexOf(previousName);
				namesUsed.push(name);
				nickNames[socket.id] = name;
				delete namesUsed[previousNameIndex];
				socket.emit('nameResult', {
					success: true,
					name: name
				});
				socket.broadcast.to(currentRoom[socket.id]).emit('message', {
					text: previousName + ' is now known as ' + name + '.'
				});
			} else {
				socket.emit('nameResult', {
					success: false,
					message: 'That name is already in use.'
				});
			}
		}
	});
}

//Sending chat messages
function handleMessageBroadcasting(socket) {
	socket.on('message', function (message) {
		socket.broadcast.to(message.room).emit('message', {
			text: nickNames[socket.id] + ': ' + message.text
		});
	});
}

//Creating rooms
function handleRoomJoining(socket) {
	socket.on('join', function(room) {
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket, room.newRoom);
	})
}

//Handling user disconnections
function handleClientDisconnection(socket) {
	socket.on('disconnect', function() {
		var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
		delete namesUsed[nameIndex];
		delete nickNames[socket.id];
	});
}

/* Connection logic starts Socket.IO server, limits verbosity of Socket.IO's logging
	to the console, establishes how each incoming connection should be handled */

exports.listen = function(server) {
	//Start Socket.IO server, allowing it to piggyback on existing HTTP server
	io = socketio.listen(server);
	io.set('log level', 1);
	io.sockets.on('connection', function(socket) {
		guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
		joinRoom(socket, 'Lobby');
		handleMessageBroadcasting(socket, nickNames);
		handleNameChangeAttempts(socket, nickNames, namesUsed);
		handleRoomJoining(socket);

		socket.on('rooms', function() {
			socket.emit('rooms', io.sockets.manager.rooms);
		});

		handleClientDisconnection(socket, nickNames, namesUsed);
	});

};