// globalplayer, 2020
// bewegende Architekturmanufaktur GesbR


// socket io usage based on Chris Ochsenreither:
// https://github.com/lmccart/itp-creative-js/tree/master/Spring-2014/week6/04_socket_server
// and Shawn Van Every's Live Web:
// http://itp.nyu.edu/~sve204/liveweb_fall2013/week3.html


// to run localy install nodejs and npm
// npm install socket.io
// start with "node server" in directory

var http = require('http');
var url = require('url');
var path = require('path');
var fs = require('fs');

var server = http.createServer(handleRequest);
server.listen(8080);

var ids = [];                     // to save all players
var others_pos = [];              // other positions in x,y (including yours)
var others_old = [];              // to check for inactivity
var others_afk = [];              // check if user is away from keyboard

var earth_pos = [640, 360];       // position of earth in x,y
var influence_pos = [640, 360];   // influence in x,y
var earth_blocked = 0;            // is earth able to move?
var obstacles = [];               // obstacles in x,y and radius
var drawing = true;               // wether you are drawing or not

// game
var frame = 0;
var score = 0;                    // score of the team
var counter_amount = 100;         // update score every counter_amount
var counter = 0;                  // storing the recent counter

// to generate random positions and radius
function create_obstacle () {
  var x = Math.floor(Math.random() * (1280 - 0)) + 0;         // radnom x
  var y = Math.floor(Math.random() * (-200 + 0)) - 0;         // random y
  var r = Math.floor(Math.random() * (100 - 50)) + 50;        // random radius

  obstacles.push([x,y,r]);
}

create_obstacle();

console.log('Server started on port 8080');

function handleRequest(req, res) {
  var pathname = req.url;

  if (pathname == '/') {
    pathname = '/index.html';
  }

  var ext = path.extname(pathname);
  var typeExt = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css'
  };

  var contentType = typeExt[ext] || 'text/plain';

  fs.readFile(__dirname + pathname,
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading ' + pathname);
      }
      res.writeHead(200,{ 'Content-Type': contentType });
      res.end(data);
    }
  );
}

var io = require('socket.io').listen(server);
io.sockets.on('connection',
  function (socket) {
    // save player
    ids.push(socket.id);
    others_pos.push([640,360]);
    others_old.push([640,360]);
    others_afk.push(0);
    console.log("new client: " + socket.id);

    // inform player about his own id and the current score
    var data = {
      id: socket.id,
      score: score
    };

    socket.emit('welcome', data);

    // get single position of one player
    socket.on('data',
      function(data) {
        // save position of player into others_pos
        var index = ids.indexOf(data.id);
          if (index > -1) {
          others_pos[index] = data.own_pos;
          // set afk to 0
          others_afk[index] = 0;

          if (earth_blocked < 1) {
            move_earth();
          }
        }
      }
    );

    socket.on('disconnect', function() {
      console.log(socket.id, "has disconnected");

      // delete from game
      var index = ids.indexOf(socket.id);
      // delete if not allready kicket because of afk
      if (index > -1) {
        ids.splice(index, 1);
        others_pos.splice(index, 1);
        others_old.splice(index, 1);
        others_afk.splice(index, 1);
      }
    });
  }
);

// update data
function update() {
  try {
    // all users are there?
    check_afk();

    // update obstacles
    for (let i = 0; i < obstacles.length; i++){
      move_obstacles(i);
      collision_obstacle_earth(i);
      collision_obstacle_players(i);
    }

    // recreate obstacles
    var r = Math.random() * 20;
    if (r < 1) {
      create_obstacle();
    }

    // update earth
    earth_pos[0] = (earth_pos[0]*9 + influence_pos[0]) / 10;
    earth_pos[1] = (earth_pos[1]*9 + influence_pos[1]) / 10;

    var data = {
      others_pos: others_pos,
      earth_pos: earth_pos,
      earth_blocked: earth_blocked,
      obstacles: obstacles,
      score: score
    };
    io.emit('update', data);

    // count downwards if blocked
    if (earth_blocked > 0){
      earth_blocked = earth_blocked -1;
    }

    // count downwards to increase score
    if (counter < 1) {
      score = score + 1;
      counter = counter_amount;
    }
    counter = counter -1;

    // possible error?
    throw "myException"; // Fehler wird ausgelöst
  }
  catch (e) {
 }
 console.log(others_pos);
 console.log(others_old);
 console.log(others_afk);
 console.log("");
}

setInterval(update, 40);

function move_earth(){
  // calculate average of all players
  var average_x = 0;
  for(var i = 0; i < others_pos.length; i++) {
      average_x += others_pos[i][0];
  }
  influence_pos[0] = average_x / others_pos.length;

  var average_y = 0;
  for(var i = 0; i < others_pos.length; i++) {
      average_y += others_pos[i][1];
  }
  influence_pos[1] = average_y / others_pos.length;
}

function move_obstacles(i) {
  obstacles[i][1] = obstacles[i][1] + 1; // move obstacles in y direction
  // delete if below screen
  if (obstacles[i][1] > 700) {
    obstacles.splice(i, 1);
  }
}

function collision_obstacle_earth(i) {
  var distance = Math.sqrt(
    Math.pow((earth_pos[0]-obstacles[i][0]), 2) +
    Math.pow((earth_pos[1]-obstacles[i][1]), 2)
  );

  var touching = (100 + obstacles[i][2])*0.5;
  if (distance < touching) {
    // delete obstacle
    obstacles.splice(i, 1);
    // set earth to blocked
    earth_blocked = 100;
    // update score
    score = score -10;
  }
}

function collision_obstacle_players(i) {
  // collision with players
  for (let j = 0; j < others_pos.length; j++){
    var distance = Math.sqrt(
      Math.pow((others_pos[j][0]-obstacles[i][0]), 2) +
      Math.pow((others_pos[j][1]-obstacles[i][1]), 2)
    );

    var touching = (25 + obstacles[i][2])*0.5;
    if (distance < touching) {
      // delete obstacle
      obstacles.splice(i, 1);

      // delete obstacle
      obstacles.splice(i, 1);
      // inform player
      var id = ids[j];
      io.emit('blocked', id);
      // update score
      score = score -1;
    }
  }
}

function check_afk() {
  try {
    for (let i = 0; i < others_afk.length; i++){
      if (others_afk[i] > 200) {
        console.log(ids[i], "is afk and kicket out");
        io.emit('afk', ids[i]);

        // kick player because of afk
        ids.splice(i, 1);
        others_pos.splice(i, 1);
        others_old.splice(i, 1);
        others_afk.splice(i, 1);
       }
     else {
       others_afk[i] = others_afk[i] + 1;
     }
    }
  }
  catch (e) {
  }
}
