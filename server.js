var express = require('express');
var path = require('path');

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(80);
console.log("Listening on port 80");
// WARNING: app.listen(80) will NOT work here!

app.use(express.static(path.join(__dirname, 'att-react/build'))); //  "public" off of current is root

/*SOCKET IO*/
let rooms = {};
let idToRooms = {};

function generateRoomCode(){
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var res = '';
  for(let i = 0; i < 4; i++){
    var pos = Math.floor(Math.random() * 26);
    res = res + alphabet.charAt(pos);
  }

  if(res in rooms) return generateRoomCode();
  else return res;
}

function Room(roomcode, roomid){
  this.roomcode = roomcode;
  this.roomid = roomid;
  this.members = [];
  this.question = "";
  this.answers = [];
  this.isAnonymous = false;
  this.hostPresent = false;
}

io.on('connection', function (socket) {
  console.log("user connected");
  socket.on('displayJoin', (data) => {
    var roomcode = initRoom(socket);
  });

  socket.on('userJoin', (data) => {
    if(!(data.roomcode in rooms)){
      socket.emit('err_inv_room', data);
    }
    else if(rooms[data.roomcode].hostPresent && data.isHost){
      socket.emit('err_host_present');
    }
    else{
      var userObj = {username: data.username, isHost: data.isHost, id: socket.id};
      rooms[data.roomcode].members.push(userObj);
      if(data.isHost){
        rooms[data.roomcode].hostPresent = true;
      }
      idToRooms[socket.id] = data.roomcode;
      socket.join(data.roomcode);
      socket.broadcast.emit('updateUser_ind', {room: rooms[data.roomcode]});
      socket.emit('userJoin_resp', {room: rooms[data.roomcode], type: data.isHost ? "host" : "user"});
      // console.log(rooms[data.roomcode]);
    }
  });

  socket.on('postQuestion', (data) =>{
    rooms[data.roomcode].isAnonymous = data.isAnonymous;
    rooms[data.roomcode].question = data.message;
    rooms[data.roomcode].answers = [];

    socket.broadcast.emit('questionReceived', data);
    socket.emit('questionReceived', data);
  });

  socket.on('postAnswer', (data) =>{
    rooms[data.roomcode].answers.push({username: data.username, message: data.message});
    socket.emit('postAnswer_resp');
  });

  socket.on('endQuestion', (data) => {
    console.log("SERVER: End Question");
    socket.broadcast.emit('results', {answers: rooms[data.roomcode].answers, question: rooms[data.roomcode].question, isAnonymous: rooms[data.roomcode].isAnonymous});
    socket.emit('results', {answers: rooms[data.roomcode].answers, question: rooms[data.roomcode].question, isAnonymous: rooms[data.roomcode].isAnonymous});
  })

  socket.on('disconnect', () => {
    if(socket.id in idToRooms){
      var roomcode = idToRooms[socket.id];
      if(roomcode in rooms){
        for(var i = 0; i < rooms[roomcode].members.length; i++){
          if(rooms[roomcode].members[i].id == socket.id){
            if(rooms[roomcode].members[i].isHost) rooms[roomcode].hostPresent = false;
            rooms[roomcode].members.splice(i,1);
            break;
          }
        }
        socket.broadcast.emit('updateUser_ind', {room: rooms[roomcode]});
      }
    }
  });
});


initRoom = (socket) => {
  var roomcode = generateRoomCode();
  rooms[roomcode] = new Room(roomcode, socket.id);
  console.log(rooms);
  socket.join(roomcode);
  socket.emit('displayJoin_resp', {room: rooms[roomcode], type: "display"});
};
