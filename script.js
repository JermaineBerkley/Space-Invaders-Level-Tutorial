// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel

// MIT license

(function () {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] ||
            window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function (callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function () {
                    callback(currTime + timeToCall);
                },
                timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
}());

(function () {
    $(document).ready(function () {

        // object that holds the canvas's and a sizing method
        var canvas = {
            background: document.getElementById('background_canvas'),
            enemy: document.getElementById('enemy_canvas'),
            player: document.getElementById('player_canvas'),
            area: function (ctx, width, height) {
                // take this canvas context (ctx), asign a value for width and height
                ctx.width = width;
                ctx.height = height;
                // return it to finalize augmentation, make it available for other functions usage
                return ctx;
            }
        };

        // grabing all the canvas's contexts after initial initialization of the object to ensure availeability at the time a drawing to the canvas's
        canvas.background_ctx = canvas.background.getContext('2d');
        canvas.enemy_ctx = canvas.enemy.getContext('2d');
        canvas.player_ctx = canvas.player.getContext('2d');

        // assets for the game.
        var assets = {};

        // array to hold the drawn stars from the add_stars function
        assets.stars = [];

        // image object within the assets object
        assets.images = {
            container: [],
            loaded: 0,
            from_queue: 0
        };

        // takes and array of images, sets images form queue to the length of that array, makes a new image, gives that image thr src of an index from the array, and places it in the container array as an image
        assets.loader = function (file_paths) {
            assets.images.from_queue = file_paths.length;
            console.log(file_paths.length);
            for (path in file_paths) {
                var img = new Image();
                // make a new image
                assets.images.container[path] = img;
                // asign the value of img (the new image )to the assets object's images container and the index of path
                assets.images.container[path].onload = function () {
                    // add one to the number of pictures loaded property in the assets object's player object
                    assets.images.loaded++;
                };
                img.src = file_paths[path];
                // set the src of the new Image to the value of the index in the file_paths array 
            }
        };

        // projectile images
        assets.projectile_images = [];

        // projectiles
        assets.projectiles = [];

        assets.projectile_loader = function(file_paths){
            assets.images.from_queue = file_paths.length;
            console.log(file_paths.length);
            for (path in file_paths) {
                var img = new Image();
                // make a new image
                assets.projectile_images[path] = img;
                // asign the value of img (the new image )to the assets object's images container and the index of path
                assets.projectile_images[path].onload = function () {
                    // add one to the number of pictures loaded property in the assets object's player object
                    assets.images.loaded++;
                };
                img.src = file_paths[path];
                // set the src of the new Image to the value of the index in the file_paths array 
            }
        };

        // checks the 'images loaded' against 'images from queue', , .
        assets.check_images = function () {
            if (assets.images.loaded >= assets.images.from_queue) {
                // if all images have loaded, call init
                init();
            } else {
                // else, call this function once a millisecond checking until images loaded is equal to from queue (infinite loop)
                setTimeout(function () {
                    assets.check_images();
                }, 1);
            }
        };

        // jquery magic??
        assets.keys = [];

        // array for the enemies
        assets.enemies = [];

        assets.sounds = {};
        assets.sounds.explosion = new Audio('explosion_s.wav'); 
        assets.sounds.fire = new Audio('shot_s.wav'); 

        // player object in assets object to quickly access all player data
        assets.player = {};
        assets.player.width = canvas.background.width * .3;
        assets.player.height = canvas.background.height * .5;
        
        assets.player.speed = 8;

        // player object in assets object to quickly access all player data
        assets.cpu = {};
        assets.cpu.container = [];
        assets.cpu.speed = 5;

        // logic used to keep data important for of the game
        assets.cpu.logic = {};

        // logic container
        // these divisor and counter properties work to move the enemy units
        assets.cpu.logic.counter = 16;
        assets.cpu.logic.divisor = 48;
        // state to determine if the game should shift the enemy units left or not
        assets.cpu.logic.shift_left = false;

        // the time between shots allowed by the game
        assets.cpu.logic.shot_penalty = 20;
        // initiating the shot pause at full, so when it begins count down, it is full
        assets.cpu.logic.shot_pause = assets.cpu.logic.shot_penalty;

        // a function that uses an interesting algorythem to simplify collision detection
        assets.cpu.logic.collision = function(first, second){
            // algorythem that considers two seperate rectagles that are not touching from all possible sides
            return !(first.x > second.x + second.width ||
                     first.x + first.width < second.x ||
                     // ^^^^^^ the first and second rectangles are not touching on either sides
                    first.y > second.y + second.height ||
                    first.y + first.height < second.y);
                     // ^^^^^^ the first and second rectangles are not touching on top or bottom
        };

        // a small state object to hold the victory conditions
        assets.cpu.logic.game_state = {};
        assets.cpu.logic.game_state.victory = false;
        assets.cpu.logic.game_state.game_over = false;
        assets.cpu.logic.game_state.shift_down = false;
        
        // grid details for enemy placement
        assets.grid = {};
        assets.grid.columns = 5;
        assets.grid.rows = 5;

        $(document).keydown(function (e) {
            assets.keys[e.keyCode ? e.keyCode : e.which] = true;
        });

        $(document).keyup(function (e) {
            delete(assets.keys[e.keyCode ? e.keyCode : e.which] = false);
        });

        // sets the background color to black.
        function background_color() {
            canvas.background_ctx.fillStyle = 'black';
            canvas.background_ctx.fillRect(0, 0, canvas.background.width, canvas.background.height);
            canvas.background_ctx.fill();

            return canvas.background_ctx;
            // this function grabs the canvas, paints it black, and returns it.
        };

        // refeshes the canvas
        function refresh() {
            canvas.background_ctx.clearRect(0, 0, canvas.background.width, canvas.background.height);
            canvas.enemy_ctx.clearRect(0, 0, canvas.background.width, canvas.background.height);
            canvas.player_ctx.clearRect(assets.player.x, assets.player.y, assets.player.width, assets.player.height);
            return canvas.background_ctx, canvas.enemy_ctx, canvas.player_ctx;
            // this function refreshes all canvases and returns them for redraw
        };

        // star generator
        function add_stars(num) {
            var i;
            for (i = 0; i < num; i += 2) {
                assets.stars.push({
                    x: Math.floor(Math.random() * canvas.background.width),
                    y:  /* canvas.background.height - 10scrolling */  Math.floor(Math.random() * canvas.background.height)/* <-- sparkle */ ,
                    size: Math.random() * 5
                });
            }
        };

        // bullet generator
        function add_bullet(){
            assets.projectiles.push({
                x: assets.player.x,
                y: assets.player.y,
                width: (canvas.background.width * .02),
                height: (canvas.background.height * .1)
            });
        };

        // UPDATE FUNCTION
        function update() {
            // the counter is initiated 
            assets.cpu.logic.counter++;

            // this part works because in the key listener actually dictates when the shot penalty begins, leaving this with the job of simply counting down once a projectile has been fired
            if(assets.cpu.logic.shot_pause > 0){
                assets.cpu.logic.shot_pause--;
            }
            // add stars function to draw stars at a rate of 1 per millisecond
            add_stars(1);

            // go through the assets.stars array, and if that particular star has a y value of -5 or less, delete it from the array because its off screeen
            for (star in assets.stars) {
                assets.stars[star].y--;
                if (assets.stars[star].y <= -5) {
                    assets.stars.splice(star, 1);
                }
            }

            // key listener in jquery
            if (assets.keys[32] && assets.cpu.logic.shot_pause <= 0) {
                add_bullet();
                assets.sounds.fire.play();
                // after the player has shot, set the pause time to the penalty time so the player can't infinity shoot
                assets.cpu.logic.shot_pause = assets.cpu.logic.shot_penalty;
                console.log('space');
            } else if (assets.keys[38] || assets.keys[87]) {
                // if up arrow or a is pressed, move the player up on the canvas
                assets.player.y -= assets.player.speed;
                if (assets.player.y <= 0) {
                    // if the player object's y coordinate is less than or equal to the top of the canvas, the object's y is 0
                    assets.player.y = 0;
                    console.log('top collision!');
                }
                console.log('up');
            } else if (assets.keys[40] || assets.keys[83]) {
                // if down arrow or s is pressed, move the player down on the canvas
                assets.player.y += assets.player.speed;
                if ((assets.player.y + assets.player.height) >= canvas.background.height) {
                    // if the player object's y coordinate plus the player object's height is greater than the canvas's height, it's at the bottm of the canvas. asign the the player object's y to the difference of the canvas's height minus the player object's height 
                    assets.player.y = (canvas.background.height - assets.player.height);
                    console.log('bottom collision!');
                }
                console.log('down');
            } else if (assets.keys[37] || assets.keys[65]) {
                // if left arrow or w is pressed, move the player left on the canvas
                assets.player.x -= assets.player.speed;
                if (assets.player.x <= 0) {
                    // if the player object's x coordinate is less than or equal to the width of the canvas, the object's x is 0
                    assets.player.x = 0;
                    console.log('left collision!');
                }
                console.log('left');
            } else if (assets.keys[39] || assets.keys[68]) {
                // if right arrow or d is pressed, move the player right on the canvas
                assets.player.x += assets.player.speed;
                if (assets.player.x + assets.player.width >= canvas.background.width) {
                    // if the player object's y coordinate plus the player object's height is greater than the canvas's height, it's at the bottm of the canvas. asign the the player object's y to the difference of the canvas's height minus the player object's height
                    assets.player.x = (canvas.background.width - assets.player.width);
                    console.log('right collision!');
                }
                console.log('right');
            }
            
            // this conditional checks to see if counter is divisable by divisor, and when it is, change the enemy's lateral movement from left to right
            if(assets.cpu.logic.counter % assets.cpu.logic.divisor === 0){
                // the lower the counter is, the more times it will be divisable. this equates into how quickly the enemy units shift
                assets.cpu.logic.shift_left = !assets.cpu.logic.shift_left;
            }

            // go through all of the enemies on the board. if shift left is true, shift them that way, else shift them right
            for(enemy in assets.cpu.container){
                
                if(!assets.cpu.logic.game_state.shift_down){
                    if(assets.cpu.logic.shift_left){
                        assets.cpu.container[enemy].x -= assets.cpu.speed;
                    } else {
                        assets.cpu.container[enemy].x += assets.cpu.speed;
                    }
                }

                if(assets.cpu.logic.game_state.shift_down){
                    assets.cpu.container[enemy].y++;
                }

                if(assets.cpu.container[enemy].y >= canvas.background.height){
                    assets.cpu.logic.game_state.game_over = true;
                }
            }

            // go through all of the projectiles on screen and move them at a rate of 14 of the y axis
            for(projectile in assets.projectiles){
                assets.projectiles[projectile].y -= 4;
                if(assets.projectiles[projectile].y <= -assets.projectiles[projectile].size){
                    // if the projectile has reached the top of the screen, remove it from memory out of the enemies array
                    assets.projectiles.splice(projectile, 1);
                }
            }

            // go through both the enemies and projectiles arrays, if there is a collision between a projectile and an enemy, set the enemy's state to dead, set the enemy image to the explosion png, and remove the projectile from the projectiles array
            for(enemy in assets.cpu.container){
                for(projectile in assets.projectiles){
                    if(assets.cpu.logic.collision(assets.cpu.container[enemy], assets.projectiles[projectile])){
                        assets.cpu.container[enemy].dead = true;
                        assets.cpu.container[enemy].image = 3;
                        assets.sounds.explosion.play();
                        console.log('project collision!');
                        assets.projectiles.splice(projectile, 1);
                    }
                }
            }

            // cycle through the enemies, and if their state is dead (explosion pic), initiated the dead time counter. when the time is at zero remove the enemy (explosion done)
            for(enemy in assets.cpu.container){
                if(assets.cpu.container[enemy].dead){
                    assets.cpu.container[enemy].dead_time--;
                    if(assets.cpu.container[enemy].dead && assets.cpu.container[enemy].dead_time <= 0){
                        assets.cpu.container.splice(enemy, 1);
                    }
                }
            }
        };

        // RENDER FUNCTION
        function render() {
            // STARS: 
            // cycle through the stars created and pushed into the assets object's starts array
            for (star in assets.stars) {
                // hold the current star in a variable made by accessing  its' instance through bracket notationassets.cpu.logic.
                var current_star = assets.stars[star];
                // draw the current star at its' unique position based on it's current values
                canvas.background_ctx.fillStyle = 'white';
                canvas.background_ctx.fillRect(current_star.x, current_star.y, current_star.size, current_star.size);
                canvas.background_ctx.fill();
            }

            // ENEMIES: 
            for(enemy in assets.cpu.container){
                var current_enemy = assets.cpu.container[enemy];
                console.log(assets.cpu.container[enemy].image);
                canvas.enemy_ctx.drawImage(assets.images.container[assets.cpu.container[enemy].image], current_enemy.x, current_enemy.y, current_enemy.width, current_enemy.height);
            }

            // PROJECTILES:
            for(projectile in assets.projectiles){
                var proj = assets.projectiles[projectile];                    
                canvas.enemy_ctx.drawImage(assets.images.container[2], proj.x, proj.y, proj.width, proj.height);
            }

            // PLAYER:
            canvas.player_ctx.drawImage(assets.images.container[0], 0, 0, 712, 704, assets.player.x, assets.player.y, assets.player.width, assets.player.height);
        };

        // LOOP FUCNTION
        function loop() {
            // clear the canvases
            refresh();
            // draw background canvas black
            background_color();
            // update the star\'s position
            update();
            // draw the star 
            render();
            window.requestAnimationFrame(loop);
        };

        // INIT FUNCTION
        function init() {
            var i;
            var j;

            // make all three canvas's the size of the user's browser windowassets.cpu.logic.
            canvas.area(canvas.background, window.innerWidth, window.innerHeight);
            canvas.area(canvas.enemy, window.innerWidth, window.innerHeight);
            canvas.area(canvas.player, window.innerWidth, window.innerHeight);

            for (i = 0; i < assets.grid.columns; i++) {
                // for every one time this loop executes, 
                for (j = 0; j < assets.grid.rows; j++) {
                    // this loop happens assets.grid.rows (5) times
                    assets.cpu.container.push({
                        x: (i * (canvas.background.width * .1)) + ((canvas.background.width * .07) * i) + (canvas.background.width * .1),
                        y: (j * (canvas.background.height * .07)) + ((canvas.background.height * .02)* j) + (canvas.background.width * .05),
                        width: (canvas.background.width * .07),
                        height: (canvas.background.height * .15),
                        image: 1,
                        dead: false,
                        dead_time: 15
                    });
                }
            }
            assets.player.x = (canvas.background.width / 2) - (assets.player.width / 2);
            assets.player.y = (canvas.background.height - assets.player.height);
            // begin game loop
            loop();

            setTimeout(function(){
                assets.cpu.logic.game_state.shift_down = true;
            }, 1000);
        };

        // load the game's image assets using this array to cycle through
        assets.loader(['spaceship.png', 'ufo.png', 'static_proj_upright.png','static_explosion.png']);                       

        // find out how many pictures have loaded, if it isn't equal to the total needed, call yourself until all images are loaded, call the init function
        assets.check_images();
    });
})();